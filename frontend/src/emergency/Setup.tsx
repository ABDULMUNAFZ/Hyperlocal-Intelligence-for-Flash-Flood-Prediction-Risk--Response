// Device readiness: install, emergency alerts (Web Push), location, emergency contact.
// Every permission prompt is triggered only by the user pressing a button.
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { emergencyApi, apiError, type MeDTO } from './api';
import {
  canPromptInstall, freshness, getFix, isIOS, isStandalone, notificationPermission, onInstallChange, promptInstall, pushSupport, subscribePush, ago,
} from './device';
import { sound } from '../components/Wayanad/sound';
import { BigButton, Chip, ErrorNote, InfoNote, Section, input } from './ui';

function Row({ done, title, detail, children }: { done: boolean | null; title: string; detail: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-black ${done ? 'bg-emerald-600 text-white' : done === null ? 'bg-slate-300 text-white' : 'bg-amber-400 text-amber-950'}`}>
        {done ? '✓' : done === null ? '–' : '!'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-slate-900">{title}</div>
        <div className="text-[12.5px] text-slate-600">{detail}</div>
        {children && <div className="mt-2 space-y-2">{children}</div>}
      </div>
    </div>
  );
}

export function useInstallState() {
  return useSyncExternalStore(onInstallChange, () => `${isStandalone()}|${canPromptInstall()}`);
}

export function LocationChip({ me }: { me: MeDTO }) {
  const f = me.location.captured_at ? freshness(me.location.captured_at, me.limits.stale_minutes) : 'PERMISSION_REQUIRED';
  if (me.permissions.location === 'denied') return <Chip tone="red">LOCATION: PERMISSION REQUIRED</Chip>;
  return f === 'CONNECTED' ? <Chip tone="green">LOCATION: CONNECTED</Chip> : f === 'STALE' ? <Chip tone="amber">LOCATION: STALE</Chip> : <Chip tone="amber">LOCATION: PERMISSION REQUIRED</Chip>;
}

export function PushChip({ me }: { me: MeDTO }) {
  if (!me.push.configured) return <Chip tone="slate">ALERTS: NOT CONFIGURED</Chip>;
  if (notificationPermission() === 'denied') return <Chip tone="red">ALERTS: BLOCKED</Chip>;
  return me.push.active_subscriptions > 0 && notificationPermission() === 'granted' ? <Chip tone="green">ALERTS: ON</Chip> : <Chip tone="amber">ALERTS: OFF</Chip>;
}

export function Setup({ me, onMe, onLocated }: { me: MeDTO; onMe: (m: MeDTO) => void; onLocated: () => void }) {
  useInstallState();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushErr, setPushErr] = useState<string | null>(null);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: me.emergency_contact?.name ?? '', phone: me.emergency_contact?.phone ?? '' });
  const [contactMsg, setContactMsg] = useState<string | null>(null);
  const [cfg, setCfg] = useState<{ configured: boolean; public_key: string | null; message: string | null } | null>(null);
  useEffect(() => { emergencyApi.pushConfig().then(setCfg).catch(() => setCfg(null)); }, []);
  useEffect(() => { setContact({ name: me.emergency_contact?.name ?? '', phone: me.emergency_contact?.phone ?? '' }); }, [me.emergency_contact?.name, me.emergency_contact?.phone]);

  const standalone = isStandalone();
  const sup = pushSupport();
  const perm = notificationPermission();
  const pushOn = me.push.active_subscriptions > 0 && perm === 'granted';
  const locFresh = me.location.captured_at ? freshness(me.location.captured_at, me.limits.stale_minutes) : 'PERMISSION_REQUIRED';

  const enablePush = async () => {
    setPushBusy(true); setPushErr(null); setPushMsg(null);
    try {
      await sound.enable(true); // unlocks in-app alarm audio on this user gesture
      const c = cfg ?? await emergencyApi.pushConfig();
      if (!c.configured || !c.public_key) throw new Error(c.message ?? 'Emergency push notifications are not configured.');
      const sub = await subscribePush(c.public_key);
      await emergencyApi.subscribe(sub);
      onMe(await emergencyApi.profile({ push_permission: 'granted' }));
      setPushMsg('Emergency alerts are enabled on this device.');
    } catch (e: any) {
      setPushErr(apiError(e, 'Could not enable emergency alerts.'));
      const p = notificationPermission();
      emergencyApi.profile({ push_permission: p === 'unsupported' ? 'unsupported' : p }).then(onMe).catch(() => undefined);
    } finally { setPushBusy(false); }
  };

  const testPush = async () => {
    setPushBusy(true); setPushErr(null); setPushMsg(null);
    try {
      const r = await emergencyApi.pushTest();
      if (!r.configured) setPushErr(r.message ?? 'Emergency push notifications are not configured.');
      else if (!r.results.length) setPushErr(r.message ?? 'No active push subscription.');
      else {
        const sent = r.results.filter((x) => x.status === 'sent').length;
        if (sent) setPushMsg(`Push service accepted the test for ${sent} device(s). It should appear within seconds; if not, check the OS notification settings for this browser/app.`);
        else setPushErr(`Push delivery failed: ${r.results.map((x) => `${x.status}${x.error ? ` (${x.error})` : ''}`).join(', ')}`);
      }
    } catch (e) { setPushErr(apiError(e, 'Test failed.')); } finally { setPushBusy(false); }
  };

  const shareLocation = async () => {
    setLocBusy(true); setLocErr(null);
    try {
      const fix = await getFix();
      await emergencyApi.location(fix);
      onLocated();
    } catch (e: any) {
      setLocErr(e?.code ? e.message : apiError(e, 'Could not store your location.'));
      if (e?.code === 'DENIED') emergencyApi.profile({ location_permission: 'denied' }).then(onMe).catch(() => undefined);
    } finally { setLocBusy(false); }
  };

  const saveContact = async () => {
    setContactMsg(null);
    try {
      onMe(await emergencyApi.profile({ emergency_contact_name: contact.name.trim(), emergency_contact_phone: contact.phone.trim() || undefined }));
      setContactMsg('Saved.');
    } catch (e) { setContactMsg(apiError(e, 'Could not save.')); }
  };

  return (
    <Section title="Device readiness">
      <Row done={standalone} title={standalone ? 'Installed as an app' : 'Install FloodGuard'}
        detail={standalone ? 'Running as an installed app.' : isIOS() ? 'On iPhone/iPad: tap Share ⎋ → "Add to Home Screen", then open FloodGuard from the Home Screen. Emergency push alerts on iOS work only for Home Screen apps (iOS 16.4+).' : 'Installing keeps FloodGuard one tap away and improves notification reliability.'}>
        {!standalone && canPromptInstall() && (
          <BigButton tone="white" onClick={async () => { const r = await promptInstall(); setInstallMsg(r === 'accepted' ? 'Installing…' : r === 'dismissed' ? 'Install dismissed.' : null); }}>INSTALL FLOODGUARD</BigButton>
        )}
        {!standalone && !canPromptInstall() && !isIOS() && <div className="text-[11.5px] text-slate-500">Your browser has not offered installation yet — use the browser menu → “Install app” / “Add to Home screen”.</div>}
        {installMsg && <div className="text-[12px] text-slate-600">{installMsg}</div>}
      </Row>

      <Row done={cfg && !cfg.configured ? null : pushOn} title="Emergency alerts"
        detail={cfg && !cfg.configured ? 'Emergency push notifications are not configured.' : !sup.supported ? sup.reason : perm === 'denied' ? 'Notifications are blocked for this site. Enable them in browser / phone settings, then reload.' : pushOn ? `Enabled (${me.push.active_subscriptions} device${me.push.active_subscriptions > 1 ? 's' : ''}). Sound & vibration follow your phone's notification settings — silent mode and Do Not Disturb cannot be overridden by a web app.` : 'Receive alerts when an emergency affects your area.'}>
        {cfg?.configured && sup.supported && perm !== 'denied' && !pushOn && <BigButton tone="red" busy={pushBusy} onClick={enablePush}>ALLOW EMERGENCY ALERTS</BigButton>}
        {cfg?.configured && pushOn && <BigButton tone="ghost" busy={pushBusy} onClick={testPush}>SEND TEST NOTIFICATION</BigButton>}
        <ErrorNote>{pushErr}</ErrorNote>
        {pushMsg && <div className="text-[12px] font-semibold text-emerald-700">{pushMsg}</div>}
      </Row>

      <Row done={locFresh === 'CONNECTED'} title={`Location: ${locFresh === 'CONNECTED' ? 'CONNECTED' : locFresh === 'STALE' ? 'STALE' : 'PERMISSION REQUIRED'}`}
        detail={me.location.captured_at ? `Last shared ${ago(me.location.captured_at)} (±${Math.round(me.location.accuracy_m ?? 0)} m). Used to target alerts to your area.` : 'Share your current location so alerts for your area reach you. It is stored only when you press the button.'}>
        <BigButton tone="white" busy={locBusy} onClick={shareLocation}>{me.location.captured_at ? 'UPDATE MY LOCATION' : 'SHARE MY LOCATION'}</BigButton>
        <ErrorNote>{locErr}</ErrorNote>
      </Row>

      <Row done={!!me.emergency_contact?.phone} title="Emergency contact" detail="Shown to responders if you request rescue.">
        <input className={input} placeholder="Contact name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
        <input className={input} type="tel" placeholder="Contact phone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
        <BigButton tone="white" onClick={saveContact}>SAVE CONTACT</BigButton>
        {contactMsg && <div className="text-[12px] text-slate-600">{contactMsg}</div>}
      </Row>
      <InfoNote>Browsers cannot share your location in the background. FloodGuard updates it only while this app is open and you press a button or are on an active evacuation journey.</InfoNote>
    </Section>
  );
}
