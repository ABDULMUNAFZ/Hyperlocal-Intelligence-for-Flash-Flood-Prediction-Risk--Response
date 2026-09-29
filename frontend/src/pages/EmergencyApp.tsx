// FloodGuard Emergency — installable citizen app (PWA) at /emergency.
import React, { useEffect, useMemo, useState } from 'react';
import { useEmergencyApp } from '../emergency/useEmergencyApp';
import { AuthScreen } from '../emergency/AuthScreen';
import { Setup, LocationChip, PushChip } from '../emergency/Setup';
import { AlertCard, ResponseMode } from '../emergency/ResponseMode';
import { SafeLocations } from '../emergency/SafeLocations';
import { Journey } from '../emergency/Journey';
import { emergencyApi, apiError, type SafeLocation } from '../emergency/api';
import { getFix, type DeviceFix } from '../emergency/device';
import { RescueStatus as S } from '../emergency/status';
import { BigButton, ErrorNote, KindBadge } from '../emergency/ui';

type View = 'home' | 'safe' | 'journey';

export default function EmergencyApp() {
  const app = useEmergencyApp();
  const { me, request } = app;
  const [view, setView] = useState<View>('home');
  const [safe, setSafe] = useState<{ list: SafeLocation[]; message?: string; fix: DeviceFix } | null>(null);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dismissedArrival, setDismissedArrival] = useState<string | null>(null);

  useEffect(() => { document.title = 'FloodGuard Emergency'; }, []);

  // An active journey always opens the journey screen.
  useEffect(() => {
    if (request?.status === S.EN_ROUTE_TO_SHELTER && request.safe_location) setView('journey');
    else if (view === 'journey') setView('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.status, request?.safe_location?.id]);

  const alert = useMemo(() => {
    if (!me) return null;
    const list = me.alerts_nearby;
    return list.find((a) => a.id === app.focusAlertId) ?? list[0] ?? null;
  }, [me, app.focusAlertId]);

  const findSafe = async (fix: DeviceFix) => {
    setErr(null);
    const r = await emergencyApi.nearby(fix);
    setSafe({ list: r.safe_locations, message: r.message, fix });
    setView('safe');
  };

  const go = async (s: SafeLocation) => {
    setStarting(true); setErr(null);
    try {
      const fix = await getFix();
      let r = request;
      if (!r || r.status === S.RESOLVED) r = await emergencyApi.request(fix, S.LOCATION_PINNED, 1, alert?.id);
      app.setRequest(await emergencyApi.start(r.id, s.id, fix));
      setView('journey');
    } catch (e: any) {
      setErr(e?.code ? e.message : apiError(e, 'Could not start the journey.'));
    } finally { setStarting(false); }
  };

  const rescueFromJourney = async () => {
    setErr(null);
    try {
      const fix = await getFix();
      app.setRequest(await emergencyApi.request(fix, S.RESCUE_REQUESTED, request?.people_count ?? 1, alert?.id));
      setView('home');
    } catch (e: any) { setErr(e?.code ? e.message : apiError(e, 'Rescue request failed — call 112.')); }
  };

  const arrived = request?.status === S.REACHED_SAFE_LOCATION && dismissedArrival !== request.id;

  return (
    <div className="min-h-[100dvh] bg-slate-100 text-slate-900" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {alert?.is_demo && <div className="sticky top-0 z-30 bg-amber-400 py-1.5 text-center text-[12px] font-black tracking-wider text-amber-950">DEMO EMERGENCY — NOT A REAL WARNING</div>}
      <header className="bg-[#0d2b59] px-4 pb-4 pt-3 text-white">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
            <div>
              <div className="text-[15px] font-black tracking-[0.12em]">FLOODGUARD</div>
              <div className="text-[10px] font-bold tracking-[0.22em] text-sky-200">EMERGENCY · WAYANAD</div>
            </div>
          </div>
          {me && <button onClick={app.signOut} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold">Sign out</button>}
        </div>
        {me && (
          <div className="mx-auto mt-3 flex max-w-lg flex-wrap gap-1.5">
            <LocationChip me={me} />
            <PushChip me={me} />
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wider ${app.stream.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
              LIVE: {app.stream.connected ? 'CONNECTED' : 'RECONNECTING'}
            </span>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-lg space-y-3 p-3">
        {app.incoming && (
          <div className="rounded-2xl bg-rose-700 p-3 text-white shadow-xl">
            <div className="flex items-center justify-between gap-2">
              {app.incoming.is_demo ? <KindBadge kind="DEMO" isDemo /> : <span className="text-[11px] font-black tracking-wider">NEW ALERT</span>}
              <button onClick={() => app.setIncoming(null)} className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-bold">OK</button>
            </div>
            <div className="mt-1 text-[15px] font-black">{app.incoming.title}</div>
            <div className="text-[13px]">{app.incoming.body}</div>
          </div>
        )}

        {!app.token && (
          <>
            <div className="rounded-2xl bg-white p-4 text-[13.5px] text-slate-700 ring-1 ring-slate-200">
              Register once to receive emergency alerts for your area, pin your location for rescuers, and find the nearest designated safe location.
            </div>
            <AuthScreen onSignIn={app.signIn} />
            <a href="tel:112" className="block rounded-2xl bg-rose-600 py-3 text-center text-[15px] font-black text-white">CALL 112</a>
          </>
        )}

        {app.token && app.loading && <div className="py-16 text-center text-[13px] text-slate-500">Loading…</div>}
        {app.token && !app.loading && !me && (
          <div className="space-y-2">
            <ErrorNote>{app.loadError ?? 'Could not load your emergency profile.'}</ErrorNote>
            <BigButton onClick={() => app.refresh()}>RETRY</BigButton>
          </div>
        )}

        {me && arrived && request?.safe_location && (
          <div className="rounded-3xl bg-emerald-600 p-6 text-center text-white shadow-xl">
            <div className="text-[44px] font-black leading-none">✓</div>
            <div className="mt-2 text-[26px] font-black tracking-wide">YOU ARE SAFE</div>
            <div className="mt-1 text-[14px]">You reached <b>{request.safe_location.name}</b></div>
            <div className="text-[12px] opacity-90">GPS-confirmed {request.journey.arrival_distance_m != null ? `${Math.round(request.journey.arrival_distance_m)} m from the location` : ''} at {request.journey.arrived_at ? new Date(request.journey.arrived_at).toLocaleTimeString('en-IN') : ''}</div>
            <div className="mt-2 text-[12px] opacity-90">Responders have been notified. Stay at the safe location and follow the instructions of officials there.</div>
            <BigButton tone="white" className="mt-4" onClick={() => setDismissedArrival(request.id)}>OK</BigButton>
          </div>
        )}

        {me && !arrived && view === 'journey' && request?.safe_location && (
          <>
            <Journey me={me} r={request} onUpdate={app.setRequest} onRescue={rescueFromJourney} />
            <ErrorNote>{err}</ErrorNote>
          </>
        )}

        {me && !arrived && view === 'safe' && safe && (
          <>
            <SafeLocations list={safe.list} message={safe.message} starting={starting} onGo={go} onBack={() => setView('home')} />
            <ErrorNote>{err}</ErrorNote>
          </>
        )}

        {me && !arrived && view === 'home' && (
          <>
            {me.alerts_nearby.length > 0
              ? me.alerts_nearby.map((a) => <AlertCard key={a.id} a={a} me={me} />)
              : (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <div className="text-[14px] font-bold">No active alert for your last shared location.</div>
                  <div className="text-[12px] text-slate-500">
                    {me.location.captured_at ? 'Alerts are checked against the location you last shared.' : 'Share your location below so alerts for your area can reach you.'}
                    {' '}FloodGuard never invents emergencies: alerts come from NDMA SACHET (official), authorised responders, or clearly labelled DEMO exercises.
                  </div>
                </div>
              )}
            <ResponseMode me={me} request={request} onRequest={app.setRequest} onRefresh={() => app.refresh()} alert={alert} onFindSafe={findSafe} />
            <Setup me={me} onMe={app.setMe} onLocated={() => app.refresh()} />
            <div className="px-1 pb-6 text-center text-[11px] text-slate-500">
              Signed in as {me.user.email}{me.user.responder && <> · <a href="/" className="font-bold text-[#0d2b59] underline">Open command center</a></>}
              <div className="mt-1">FloodGuard supports — never replaces — official warnings. Emergency: <a href="tel:112" className="font-bold text-rose-700">112</a> · District EOC <a href="tel:1077" className="font-bold">1077</a></div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
