import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { X, Shield, LogOut, Send, MapPin, Trash2, Bell, BellOff, Volume2, VolumeX, AlertTriangle, Users, Info, Crosshair, CheckCircle2, Siren } from 'lucide-react';
import { panel, Card, KV, SectionTitle, Btn, Caveat, StatusBadge, Unavailable } from './ui';
import { sound } from './sound';
import { distanceToLineKm, pointInGeometry, rings } from './geo';
import type { LngLat, OperationalZone } from '../../types/geo';
import type { CitizenReport, LiveAlert, ReportType } from '../../services/liveApi';
import { REPORT_LABEL } from './ContextPanel';
import { emergencyApi, apiError } from '../../emergency/api';

function Shell({ title, icon: Icon, onClose, children, accent = 'text-sky-600' }: { title: string; icon: any; onClose: () => void; children: React.ReactNode; accent?: string }) {
  return (
    <aside className={`${panel} pointer-events-auto flex max-h-full w-full md:w-[410px] flex-col overflow-hidden rounded-2xl`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] uppercase"><Icon className={`h-4 w-4 ${accent}`} />{title}</div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
      <div className="overflow-y-auto p-3.5 space-y-3">{children}</div>
    </aside>
  );
}

export const LEVEL_STYLE: Record<string, string> = {
  INFO: 'bg-sky-600 text-white', WATCH: 'bg-amber-400 text-amber-950', WARNING: 'bg-orange-500 text-white', CRITICAL: 'bg-rose-600 text-white',
};
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
};
const ist = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Distance (km) from a point to a (multi)polygon; 0 when inside. */
export function distanceToAreaKm(pt: LngLat, geometry: any): number {
  if (!geometry) return Infinity;
  if (pointInGeometry(pt, geometry)) return 0;
  return Math.min(...rings(geometry).map((r) => distanceToLineKm(pt, r)));
}

// =========================================================================== sound

export function useSound() {
  return useSyncExternalStore((cb) => sound.subscribe(cb), () => `${sound.enabled}|${sound.volume}|${sound.alarming}`);
}

export function SoundControl() {
  useSound();
  return (
    <div className="flex items-center gap-1.5">
      <button title={sound.enabled ? 'Sound on — click to mute' : 'Sound off — click to enable'} onClick={() => sound.enable(!sound.enabled)} className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
        {sound.enabled ? <Volume2 className="h-4 w-4 text-sky-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
      </button>
      {sound.enabled && <input aria-label="Master volume" type="range" min={0} max={1} step={0.05} value={sound.volume} onChange={(e) => sound.setVolume(+e.target.value)} className="w-16 accent-sky-600 hidden xl:block" />}
    </div>
  );
}

// =========================================================================== incoming alert banner

export function AlertBanner({ alert, onView, onAck, onDismiss, distanceKm }: { alert: LiveAlert; onView: () => void; onAck: () => void; onDismiss: () => void; distanceKm: number | null }) {
  useSound();
  const crit = alert.level === 'CRITICAL';
  return (
    <div role="alert" aria-live="assertive" className={`pointer-events-auto w-[min(560px,94vw)] rounded-2xl border-2 ${crit ? 'border-rose-500 fg-alert-pulse' : 'border-orange-400'} bg-white/95 dark:bg-slate-950/95 shadow-2xl backdrop-blur-xl overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-2 ${LEVEL_STYLE[alert.level]}`}>
        <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-[0.2em]"><Siren className="h-4 w-4" />FLOODGUARD ALERT · {alert.level}</div>
        {alert.is_demo && <span className="rounded bg-black/30 px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-wider">DEMO / SIMULATION</span>}
      </div>
      <div className="px-4 py-3">
        <div className="text-[17px] font-bold leading-tight">{alert.title}</div>
        <div className="text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">{alert.area_name}, Wayanad</div>
        <div className="mt-1.5 text-[12.5px]">{alert.message}</div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 text-[11.5px]">
          <KV k="Reason" v={<span className="text-[11px]">{alert.basis}</span>} />
          <KV k="Issued" v={ist(alert.sent_at)} />
          <KV k="Valid until" v={ist(alert.expires)} />
          {distanceKm !== null && <KV k="Your distance" v={distanceKm === 0 ? 'INSIDE the area' : `${distanceKm < 1 ? (distanceKm * 1000).toFixed(0) + ' m' : distanceKm.toFixed(1) + ' km'}`} />}
        </div>
        {alert.recommended_action && <div className="mt-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] font-semibold text-rose-700 dark:text-rose-300">➜ {alert.recommended_action}</div>}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Btn tone="danger" onClick={onView}><Crosshair className="h-3.5 w-3.5" />View area</Btn>
          <Btn onClick={onAck}><CheckCircle2 className="h-3.5 w-3.5" />Acknowledge</Btn>
          {sound.alarming && <Btn onClick={() => sound.stopAlarm()}><BellOff className="h-3.5 w-3.5" />Mute alarm</Btn>}
          <Btn tone="ghost" onClick={onDismiss}>Dismiss</Btn>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">Issued by {alert.source}. Emergencies: 112 · District EOC 1077.</div>
      </div>
    </div>
  );
}

// =========================================================================== responder console

interface AdminProps {
  me: { email: string; role: string; responder: boolean } | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => void;
  alerts: LiveAlert[];
  reports: CitizenReport[];
  zone: OperationalZone | null;
  pointOfInterest: { lngLat: LngLat; name: string } | null;
  draftBasis: string | null;
  demo: boolean;
  onPublish: (body: Record<string, any>) => Promise<void>;
  onCancel: (id: string) => void;
  onFocus: (ll: LngLat, zoom?: number) => void;
  onReportStatus: (id: string, status: string) => void;
  riskSummary: string | null;
  onClose: () => void;
}

export function AdminPanel(p: AdminProps) {
  const [tab, setTab] = useState<'alerts' | 'reports' | 'compose'>('alerts');
  if (!p.me?.responder) return <Shell title="Responder console" icon={Shield} onClose={p.onClose}><LoginForm me={p.me} onLogin={p.onLogin} onLogout={p.onLogout} /></Shell>;
  const open = p.reports.filter((r) => r.status !== 'resolved');
  const people = open.reduce((s, r) => s + r.people_count, 0);
  return (
    <Shell title="Responder console" icon={Shield} onClose={p.onClose} accent="text-rose-600">
      <div className="flex items-center justify-between text-[11px]">
        <span>Signed in <b>{p.me.email}</b> · {p.me.role}</span>
        <button onClick={p.onLogout} className="flex items-center gap-1 text-slate-500 hover:text-rose-600"><LogOut className="h-3.5 w-3.5" />Sign out</button>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Stat label="Active alerts" value={p.alerts.length} tone={p.alerts.some((a) => a.level === 'CRITICAL') ? 'text-rose-600' : ''} />
        <Stat label="Open reports" value={open.length} tone={open.some((r) => r.severity === 'critical') ? 'text-rose-600' : ''} />
        <Stat label="People reported" value={people} />
      </div>
      {p.riskSummary && <Caveat tone="slate">{p.riskSummary}</Caveat>}
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 dark:bg-white/5 p-1">
        {(['alerts', 'reports', 'compose'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md py-1.5 text-[10.5px] font-bold uppercase tracking-wider ${tab === t ? 'bg-white dark:bg-slate-800 shadow text-rose-600' : 'text-slate-500'}`}>
            {t === 'compose' ? 'Create alert' : t}
          </button>
        ))}
      </div>
      {tab === 'alerts' && (
        p.alerts.length === 0 ? <div className="text-[12px] text-slate-500">No active FloodGuard alerts.</div> :
          p.alerts.map((a) => (
            <Card key={a.id}>
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${LEVEL_STYLE[a.level]}`}>{a.level}</span>
                {a.is_demo && <span className="text-[9.5px] font-bold text-amber-600">DEMO</span>}
                <span className="ml-auto text-[10.5px] text-slate-500">{ago(a.sent_at)} · {a.acknowledged_count} ack</span>
              </div>
              <div className="mt-1 text-[12.5px] font-semibold">{a.title}</div>
              <div className="text-[11px] text-slate-500">{a.area_name} · until {ist(a.expires)}</div>
              <div className="mt-1.5 flex gap-1.5">
                {a.geometry && <Btn onClick={() => { const r = rings(a.geometry!)[0]; const c = r.reduce((s, q) => [s[0] + q[0] / r.length, s[1] + q[1] / r.length], [0, 0]); p.onFocus(c as LngLat, 13); }}>Focus</Btn>}
                <Btn tone="ghost" onClick={() => p.onCancel(a.id)}>Cancel alert</Btn>
              </div>
            </Card>
          ))
      )}
      {tab === 'reports' && (
        open.length === 0 ? <div className="text-[12px] text-slate-500">No open citizen reports.</div> :
          open.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${r.severity === 'critical' ? 'bg-rose-600' : r.severity === 'warning' ? 'bg-orange-500' : 'bg-amber-400'}`} />
                <b className="text-[13px]">{r.people_count} PEOPLE</b>
                <span className="text-[12px]">{REPORT_LABEL[r.report_type]}</span>
                {r.is_demo && <span className="text-[9.5px] font-bold text-amber-600">DEMO</span>}
                <span className="ml-auto text-[10.5px] text-slate-500">{ago(r.created_at)}</span>
              </div>
              <div className="text-[10.5px] font-mono text-slate-500">{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}{r.accuracy_m ? ` ±${Math.round(r.accuracy_m)} m` : ''} · {r.status}</div>
              {r.message && <div className="text-[11.5px] mt-0.5">“{r.message}”</div>}
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Btn onClick={() => p.onFocus([r.longitude, r.latitude], 17)}>Focus on map</Btn>
                {['acknowledged', 'dispatched', 'resolved'].map((st) => <Btn key={st} tone={st === 'dispatched' ? 'danger' : 'ghost'} disabled={r.status === st} onClick={() => p.onReportStatus(r.id, st)}>{st}</Btn>)}
              </div>
            </Card>
          ))
      )}
      {tab === 'compose' && <ComposeAlert {...p} onDone={() => setTab('alerts')} />}
    </Shell>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: number | string; tone?: string }) {
  return <div className="rounded-lg bg-slate-50 dark:bg-white/5 py-2"><div className={`text-[20px] font-bold ${tone}`}>{value}</div><div className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</div></div>;
}

function LoginForm({ me, onLogin, onLogout }: { me: AdminProps['me']; onLogin: AdminProps['onLogin']; onLogout: () => void }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (me && !me.responder) {
    return <><Unavailable>Signed in as {me.email} ({me.role}). Responder role (admin or disaster manager) is required.</Unavailable><Btn onClick={onLogout}>Sign out</Btn></>;
  }
  return (
    <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(null); try { await onLogin(email, pw); } catch (x: any) { setErr(x?.response?.data?.detail ?? 'Sign-in failed'); } finally { setBusy(false); } }}>
      <div className="text-[12px] text-slate-600 dark:text-slate-300">Publishing alerts and viewing citizen locations is restricted to authorised responders.</div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Responder e-mail" autoComplete="username" className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2.5 py-1.5 text-[12.5px]" />
      <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" required placeholder="Password" autoComplete="current-password" className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2.5 py-1.5 text-[12.5px]" />
      {err && <div className="text-[11.5px] text-rose-600">{err}</div>}
      <Btn tone="primary" className="w-full" disabled={busy}><Shield className="h-3.5 w-3.5" />{busy ? 'Signing in…' : 'Sign in'}</Btn>
      <div className="text-[10.5px] text-slate-500">Accounts are provisioned by administrators (backend/scripts/create_responder.py).</div>
    </form>
  );
}

function ComposeAlert(p: AdminProps & { onDone: () => void }) {
  const [hazard, setHazard] = useState('flash_flood');
  const [level, setLevel] = useState<'INFO' | 'WATCH' | 'WARNING' | 'CRITICAL'>('WARNING');
  const target = p.zone?.name ?? p.pointOfInterest?.name ?? '';
  const [area, setArea] = useState(target);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [action, setAction] = useState('Move away from streams and low-lying areas to higher ground. Do not cross flowing water. Follow official instructions.');
  const [basis, setBasis] = useState(p.draftBasis ?? 'Responder assessment');
  const [areaMode, setAreaMode] = useState<'zone' | 'radius'>(p.zone ? 'zone' : 'radius');
  const [radius, setRadius] = useState(2);
  const [hours, setHours] = useState(6);
  const [demo, setDemo] = useState(p.demo);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ affected_users: number; reachable_by_push: number; push_configured: boolean; body: Record<string, any> } | null>(null);
  useEffect(() => { setArea(target); }, [target]);
  useEffect(() => { if (p.draftBasis) setBasis(p.draftBasis); }, [p.draftBasis]);
  useEffect(() => { setDemo(p.demo); }, [p.demo]);
  const hz = { flash_flood: 'Flash flood', landslide: 'Landslide', flood: 'Flood', evacuation: 'Evacuation', road_closure: 'Road closure', weather: 'Weather' }[hazard];
  const autoTitle = `${hz} ${level === 'CRITICAL' ? 'emergency' : level.toLowerCase()} — ${area || 'Wayanad'}`;
  const canArea = areaMode === 'zone' ? !!p.zone : !!(p.pointOfInterest || p.zone);
  const body = () => {
    const center = p.pointOfInterest?.lngLat ?? p.zone?.center;
    return {
      hazard, level, title: title || autoTitle, message: message || `${hz} ${level.toLowerCase()} for ${area}.`, recommended_action: action, area_name: area || 'Wayanad',
      geometry: areaMode === 'zone' ? p.zone?.geometry : undefined,
      center: areaMode === 'radius' ? center : undefined, radius_km: areaMode === 'radius' ? radius : undefined,
      expires: new Date(Date.now() + hours * 3600_000).toISOString(), basis, is_demo: demo,
    };
  };
  // Step 1: server-side preview of who is inside the area (PostGIS on stored user locations)
  const review = async () => {
    setBusy(true); setErr(null);
    try {
      const b = body();
      const pv = await emergencyApi.previewAlert({ geometry: b.geometry, center: b.center, radius_km: b.radius_km, is_demo: b.is_demo });
      setConfirm({ ...pv, body: b });
    } catch (x: any) {
      setErr(apiError(x, 'Could not preview the alert area.'));
    } finally { setBusy(false); }
  };
  // Step 2: explicit SEND ALERT
  const submit = async () => {
    if (!confirm) return;
    setBusy(true); setErr(null);
    try {
      await p.onPublish(confirm.body);
      setConfirm(null);
      p.onDone();
    } catch (x: any) {
      setErr(apiError(x, 'Publish failed'));
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 text-[12px]">
      <div className="grid grid-cols-2 gap-2">
        <label>Type<select value={hazard} onChange={(e) => setHazard(e.target.value)} className="mt-0.5 w-full rounded border border-slate-200 dark:border-white/10 bg-transparent px-1.5 py-1">
          <option value="flash_flood">Flash flood</option><option value="landslide">Landslide</option><option value="flood">Flood</option><option value="evacuation">Evacuation</option><option value="road_closure">Road closure</option><option value="weather">Weather</option></select></label>
        <label>Severity<select value={level} onChange={(e) => setLevel(e.target.value as any)} className="mt-0.5 w-full rounded border border-slate-200 dark:border-white/10 bg-transparent px-1.5 py-1">
          <option>INFO</option><option>WATCH</option><option>WARNING</option><option>CRITICAL</option></select></label>
      </div>
      <label className="block">Area name<input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Meppadi" className="mt-0.5 w-full rounded border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1" /></label>
      <div className="flex gap-2 items-center">
        <label className="flex items-center gap-1"><input type="radio" checked={areaMode === 'zone'} disabled={!p.zone} onChange={() => setAreaMode('zone')} />Incident zone polygon</label>
        <label className="flex items-center gap-1"><input type="radio" checked={areaMode === 'radius'} onChange={() => setAreaMode('radius')} />Radius</label>
        {areaMode === 'radius' && <input type="number" min={0.5} max={30} step={0.5} value={radius} onChange={(e) => setRadius(+e.target.value)} className="w-16 rounded border border-slate-200 dark:border-white/10 bg-transparent px-1" />}
        {areaMode === 'radius' && <span>km</span>}
      </div>
      {!canArea && <div className="text-[11px] text-rose-600">Select an incident zone or a location on the map first.</div>}
      <label className="block">Headline<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle} className="mt-0.5 w-full rounded border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1" /></label>
      <label className="block">Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Extreme rainfall and flash-flood risk detected…" className="mt-0.5 w-full rounded border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1" /></label>
      <label className="block">Recommended action<textarea value={action} onChange={(e) => setAction(e.target.value)} rows={2} className="mt-0.5 w-full rounded border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1" /></label>
      <label className="block">Basis / reason<input value={basis} onChange={(e) => setBasis(e.target.value)} className="mt-0.5 w-full rounded border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1" /></label>
      <div className="flex items-center justify-between">
        <label>Valid for <input type="number" min={1} max={72} value={hours} onChange={(e) => setHours(+e.target.value)} className="w-14 rounded border border-slate-200 dark:border-white/10 bg-transparent px-1" /> h</label>
        <label className="flex items-center gap-1 font-semibold text-amber-600"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />DEMO / SIMULATION</label>
      </div>
      {err && <div className="text-[11px] text-rose-600 break-words">{err}</div>}
      {!confirm && <Btn tone="danger" className="w-full" disabled={busy || !canArea} onClick={review}><Send className="h-3.5 w-3.5" />{busy ? 'Checking area…' : `${demo ? 'Send DEMO emergency alert' : 'Send emergency alert'}…`}</Btn>}
      {!demo && !confirm && <div className="text-[10.5px] text-rose-600">This is a real public alert. Use DEMO for exercises and presentations.</div>}
      {confirm && (
        <div role="dialog" aria-modal="true" className={`rounded-xl border-2 p-3 ${demo ? 'border-amber-400 bg-amber-50 dark:bg-amber-400/10' : 'border-rose-600 bg-rose-50 dark:bg-rose-600/10'}`}>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-rose-700">{demo ? 'DEMO EMERGENCY — NOT A REAL WARNING' : 'Confirm emergency alert'}</div>
          <div className="mt-1.5 space-y-0.5 text-[12px]">
            <div><span className="text-slate-500">Area:</span> <b>{confirm.body.area_name}</b> ({areaMode === 'zone' ? 'incident polygon' : `${radius} km radius`})</div>
            <div><span className="text-slate-500">Risk level:</span> <b>{level}</b> · {hz}</div>
            <div><span className="text-slate-500">Alert type:</span> <b>{demo ? 'DEMO / SIMULATION' : 'RESPONDER ALERT'}</b></div>
            <div><span className="text-slate-500">Affected registered users:</span> <b className="text-[15px]">{confirm.affected_users}</b> <span className="text-slate-500">(last shared location inside the area)</span></div>
            <div><span className="text-slate-500">Reachable by push:</span> <b>{confirm.push_configured ? confirm.reachable_by_push : 'push not configured'}</b></div>
            {!confirm.push_configured && <div className="font-semibold text-rose-600">Emergency push notifications are not configured — only open apps (live stream) will receive this alert.</div>}
            {confirm.affected_users === 0 && <div className="text-slate-600">No registered user has shared a location inside this area; the alert still appears on the public map and live stream.</div>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Btn tone="ghost" disabled={busy} onClick={() => setConfirm(null)}>CANCEL</Btn>
            <Btn tone="danger" disabled={busy} onClick={submit}><Send className="h-3.5 w-3.5" />{busy ? 'Sending…' : 'SEND ALERT'}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================== citizen help / reporting

const TYPES: Array<{ id: ReportType; label: string; tone: string }> = [
  { id: 'NEED_RESCUE', label: 'Need rescue', tone: 'bg-rose-600 text-white' },
  { id: 'TRAPPED', label: 'Trapped', tone: 'bg-rose-600 text-white' },
  { id: 'MEDICAL', label: 'Medical emergency', tone: 'bg-rose-600 text-white' },
  { id: 'FLOODING', label: 'Flooding', tone: 'bg-orange-500 text-white' },
  { id: 'LANDSLIDE', label: 'Landslide', tone: 'bg-orange-500 text-white' },
  { id: 'ROAD_BLOCKED', label: 'Road blocked', tone: 'bg-amber-400 text-amber-950' },
  { id: 'EVACUATING', label: 'Evacuating', tone: 'bg-amber-400 text-amber-950' },
  { id: 'SAFE', label: 'Safe', tone: 'bg-emerald-600 text-white' },
  { id: 'OTHER', label: 'Other', tone: 'bg-slate-500 text-white' },
];

interface CitizenProps {
  location: { lngLat: LngLat; accuracy: number; at: string } | null;
  onLocate: () => Promise<void>;
  onForget: () => void;
  locError: string | null;
  alerts: LiveAlert[];
  myReports: CitizenReport[];
  onSend: (body: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => void;
  demo: boolean;
  notifyPermission: NotificationPermission | 'unsupported';
  onEnableNotify: () => void;
  onClose: () => void;
  onViewAlert: (a: LiveAlert) => void;
}

export function CitizenPanel(p: CitizenProps) {
  const [type, setType] = useState<ReportType>('NEED_RESCUE');
  const [people, setPeople] = useState(1);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const near = useMemo(() => {
    if (!p.location) return [];
    return p.alerts.map((a) => ({ a, d: distanceToAreaKm(p.location!.lngLat, a.geometry) })).filter((x) => x.d <= 5).sort((x, y) => x.d - y.d);
  }, [p.location, p.alerts]);

  return (
    <Shell title="Help & report" icon={AlertTriangle} onClose={p.onClose} accent="text-rose-600">
      <a href="/emergency" className="block rounded-xl bg-[#0d2b59] p-3 text-white hover:bg-[#0a2247]">
        <div className="text-[12px] font-extrabold tracking-[0.14em]">OPEN FLOODGUARD EMERGENCY APP →</div>
        <div className="text-[11px] text-sky-100">Install on your phone, receive emergency push alerts for your area, request rescue and navigate to a designated safe location.</div>
      </a>
      {near.map(({ a, d }) => (
        <div key={a.id} className={`rounded-xl border-2 p-3 ${a.level === 'CRITICAL' ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10' : 'border-orange-400 bg-orange-50 dark:bg-orange-500/10'}`}>
          <div className="text-[11px] font-extrabold tracking-wider">⚠ {a.hazard?.replace('_', ' ').toUpperCase()} {a.level}{a.is_demo ? ' · DEMO' : ''}</div>
          <div className="text-[13px] font-semibold mt-0.5">{d === 0 ? 'You are INSIDE an alert area' : `You are ${d < 1 ? (d * 1000).toFixed(0) + ' m' : d.toFixed(1) + ' km'} from an alert area`}</div>
          <div className="text-[11.5px]">{a.area_name} · issued {ist(a.sent_at)}</div>
          {a.recommended_action && <div className="mt-1 text-[12px] font-semibold">➜ {a.recommended_action}</div>}
          <Btn className="mt-1.5" onClick={() => p.onViewAlert(a)}>View area</Btn>
          <div className="text-[9.5px] text-slate-500 mt-1">Distance to the published alert polygon, from your shared location (±{Math.round(p.location!.accuracy)} m).</div>
        </div>
      ))}

      <Card>
        <SectionTitle><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Share my location</span></SectionTitle>
        <div className="text-[11.5px] text-slate-600 dark:text-slate-300">Your location is shared <b>only after you approve it</b>. It is sent to authorised FloodGuard responders only, stored without your name, deleted after 72 hours, and you can delete it any time. FloodGuard never tracks you in the background.</div>
        {p.location ? (
          <div className="mt-2 flex items-center justify-between text-[11.5px]">
            <span className="font-mono">{p.location.lngLat[1].toFixed(5)}, {p.location.lngLat[0].toFixed(5)} ±{Math.round(p.location.accuracy)} m</span>
            <button onClick={p.onForget} className="text-slate-500 hover:text-rose-600 text-[10.5px]">Forget</button>
          </div>
        ) : (
          <Btn tone="primary" className="mt-2 w-full" disabled={locating} onClick={async () => { setLocating(true); try { await p.onLocate(); } finally { setLocating(false); } }}>
            <MapPin className="h-3.5 w-3.5" />{locating ? 'Waiting for your permission…' : 'Share my location (asks permission)'}
          </Btn>
        )}
        {p.locError && <div className="mt-1 text-[11px] text-rose-600">{p.locError}</div>}
      </Card>

      <Card>
        <SectionTitle><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />Report</span></SectionTitle>
        <div className="grid grid-cols-3 gap-1">
          {TYPES.map((t) => (
            <button key={t.id} onClick={() => setType(t.id)} className={`rounded-lg px-1.5 py-2 text-[10.5px] font-bold ${type === t.id ? t.tone + ' ring-2 ring-offset-1 ring-slate-900 dark:ring-white' : 'bg-slate-100 dark:bg-white/5'}`}>{t.label}</button>
          ))}
        </div>
        <div className="mt-2 text-[11px] font-semibold">People with me</div>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => { setPeople(n); setCustom(''); }} className={`flex-1 rounded-lg py-2 text-[14px] font-bold ${people === n && !custom ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-white/5'}`}>{n === 5 ? '5+' : n}</button>
          ))}
          <input value={custom} onChange={(e) => { setCustom(e.target.value.replace(/\D/g, '')); }} placeholder="#" aria-label="Custom number of people" className="w-14 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent text-center text-[14px]" />
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Optional note (no personal details needed)" className="mt-2 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1 text-[12px]" />
        {err && <div className="text-[11px] text-rose-600">{err}</div>}
        {sent && <div className="text-[11.5px] text-emerald-600 font-semibold">✓ {sent}</div>}
        <Btn tone="danger" className="mt-1 w-full" disabled={!p.location || busy} onClick={async () => {
          setBusy(true); setErr(null); setSent(null);
          try {
            await p.onSend({ latitude: p.location!.lngLat[1], longitude: p.location!.lngLat[0], accuracy_m: p.location!.accuracy, report_type: type,
              people_count: custom ? Math.max(1, Math.min(500, parseInt(custom, 10))) : people, message: note || undefined, is_demo: p.demo });
            setSent('Report sent to responders.'); setNote('');
          } catch (x: any) { setErr(x?.response?.data?.detail ?? 'Could not send the report.'); } finally { setBusy(false); }
        }}><Send className="h-3.5 w-3.5" />{p.location ? `Send report${p.demo ? ' (DEMO)' : ''}` : 'Share location first'}</Btn>
        <div className="mt-1 text-[10px] text-slate-500">In danger now? Call 112. This form does not replace emergency calls.</div>
      </Card>

      <Card>
        <SectionTitle><span className="flex items-center gap-1"><Bell className="h-3.5 w-3.5" />Alerts on this device</span></SectionTitle>
        {p.notifyPermission === 'unsupported' ? <div className="text-[11.5px] text-slate-500">This browser does not support notifications; alerts still appear in the app.</div>
          : p.notifyPermission === 'granted' ? <div className="text-[11.5px] text-emerald-600">Browser notifications enabled.</div>
            : p.notifyPermission === 'denied' ? <div className="text-[11.5px] text-slate-500">Notifications blocked in browser settings; alerts still appear in the app.</div>
              : <Btn onClick={p.onEnableNotify}><Bell className="h-3.5 w-3.5" />Enable browser notifications</Btn>}
        <div className="mt-1.5 flex items-center justify-between text-[11.5px]"><span>Alert sound</span><SoundControl /></div>
      </Card>

      {p.myReports.length > 0 && (
        <Card>
          <SectionTitle>My reports</SectionTitle>
          {p.myReports.map((r) => (
            <div key={r.id} className="flex items-center gap-2 py-1 text-[11.5px] border-t first:border-0 border-slate-100 dark:border-white/5">
              <span className="flex-1">{r.people_count} · {REPORT_LABEL[r.report_type]} · <span className="capitalize">{r.status}</span> · {ago(r.created_at)}{r.is_demo ? ' · DEMO' : ''}</span>
              <button title="Delete this report" onClick={() => p.onDelete(r.id)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </Card>
      )}
    </Shell>
  );
}

// =========================================================================== about

export function AboutPanel({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="About this prototype" icon={Info} onClose={onClose}>
      <Card>
        <SectionTitle>Why Wayanad?</SectionTitle>
        <div className="text-[12px] leading-relaxed">Wayanad is a mountainous district on the Western Ghats where intense monsoon rainfall, steep terrain, drainage concentration, flash flooding and landslides interact — as in the 2019 Puthumala and 2024 Mundakkai–Chooralmala disasters. FloodGuard shows how many data sources can be combined into one hyperlocal disaster-awareness interface.</div>
      </Card>
      <Card>
        <SectionTitle>Value chain</SectionTitle>
        <div className="flex flex-wrap gap-1 text-[10.5px] font-semibold">
          {['Multi-source data', 'Spatial intelligence', 'ML risk prediction', '3D situational awareness', 'What-if simulation', 'Impact analysis', 'Early warning', 'Citizen reporting', 'Emergency response'].map((s, i, a) => (
            <React.Fragment key={s}><span className="rounded bg-sky-600/10 text-sky-700 dark:text-sky-300 px-1.5 py-0.5">{s}</span>{i < a.length - 1 && <span className="text-slate-400">→</span>}</React.Fragment>
          ))}
        </div>
      </Card>
      <Card>
        <SectionTitle>What is real, what is modelled</SectionTitle>
        <KV k="Terrain / buildings / roads" v="Copernicus GLO-30, OSM — real" />
        <KV k="Weather & rain animation" v="Open-Meteo model analysis / FORECAST" />
        <KV k="Population" v="HRSL / WorldPop — ESTIMATED" />
        <KV k="ML risk %" v={<span className="text-rose-600">Unvalidated (synthetic training)</span>} />
        <KV k="Flood depth, landslides" v="SIMULATION (uncalibrated physics)" />
        <KV k="Official alerts" v="NDMA SACHET — LIVE" />
        <KV k="Responder alerts / reports" v="Real-time; DEMO items labelled" />
        <KV k="Live cameras" v="None legitimately available" />
      </Card>
      <Caveat tone="slate">Situational-awareness prototype for SIH. Not an official warning system. Emergencies: 112 · District EOC 1077.</Caveat>
    </Shell>
  );
}
