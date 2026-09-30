// Emergency Response Mode: alert, PIN MY LOCATION, people count, I NEED RESCUE, FIND SAFE LOCATION, I AM SAFE.
import React, { useEffect, useState } from 'react';
import { emergencyApi, apiError, type MeDTO, type NearbyAlert, type RescueRequestDTO } from './api';
import { ago, fmtDistance, getFix, type DeviceFix } from './device';
import { RescueStatus as S, STATUS_LABEL, TONE_HEX, statusTone } from './status';
import { BigButton, ErrorNote, InfoNote, KindBadge } from './ui';

const PRESETS = [1, 2, 3, 4];

export function AlertCard({ a, me }: { a: NearbyAlert; me: MeDTO }) {
  const inside = a.distance_m <= 0;
  return (
    <div className={`rounded-2xl p-4 text-white shadow-lg ${a.is_demo ? 'bg-amber-600' : a.level === 'CRITICAL' ? 'bg-rose-700' : a.level === 'WARNING' ? 'bg-orange-600' : 'bg-sky-700'}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <KindBadge kind={a.kind} isDemo={a.is_demo} />
        <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider">{(a.hazard ?? '').replace('_', ' ').toUpperCase()} {a.level}</span>
      </div>
      <div className="mt-2 text-[18px] font-black leading-tight">{a.title}</div>
      <div className="mt-1 text-[13.5px] opacity-95">{a.message}</div>
      {a.recommended_action && <div className="mt-2 rounded-xl bg-black/20 px-3 py-2 text-[14px] font-bold">{a.recommended_action}</div>}
      <div className="mt-2 text-[12px] opacity-90">
        {a.area_name} · {inside ? 'You are INSIDE the alert area' : `${fmtDistance(a.distance_m)} from the alert area`}
        {me.location.captured_at && <> (from your location shared {ago(me.location.captured_at)})</>}
      </div>
      <div className="mt-1 text-[11px] opacity-80">Source: {a.basis ?? (a.kind === 'OFFICIAL' ? 'NDMA SACHET' : 'FloodGuard responders')} · issued {ago(a.sent_at)}</div>
    </div>
  );
}

export function PeoplePicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [custom, setCustom] = useState(value > 4 ? String(value) : '');
  useEffect(() => { if (value > 4) setCustom(String(value)); }, [value]);
  const isCustom = value > 4;
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold text-slate-700">How many people are with you (including you)?</div>
      <div className="grid grid-cols-5 gap-1.5">
        {PRESETS.map((n) => (
          <button key={n} disabled={disabled} onClick={() => { setCustom(''); onChange(n); }}
            className={`rounded-xl py-3 text-[17px] font-black ${value === n ? 'bg-[#0d2b59] text-white' : 'bg-white ring-1 ring-slate-300 text-slate-800'}`}>{n}</button>
        ))}
        <button disabled={disabled} onClick={() => { const n = Math.max(5, parseInt(custom || '5', 10)); setCustom(String(n)); onChange(n); }}
          className={`rounded-xl py-3 text-[17px] font-black ${isCustom ? 'bg-[#0d2b59] text-white' : 'bg-white ring-1 ring-slate-300 text-slate-800'}`}>5+</button>
      </div>
      {isCustom && (
        <input type="number" inputMode="numeric" min={5} max={500} value={custom} disabled={disabled}
          onChange={(e) => { setCustom(e.target.value); const n = parseInt(e.target.value, 10); if (n >= 1 && n <= 500) onChange(n); }}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[16px] font-bold" aria-label="Exact number of people" />
      )}
    </div>
  );
}

export function PinnedCard({ me, r }: { me: MeDTO; r: RescueRequestDTO }) {
  const tone = TONE_HEX[statusTone(r.status)];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: `2px solid ${tone}` }}>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: tone }} />
        <span className="text-[15px] font-black" style={{ color: tone }}>{STATUS_LABEL[r.status as S] ?? r.status}</span>
        {r.is_demo && <span className="rounded bg-amber-400 px-1.5 text-[10px] font-extrabold text-amber-950">DEMO</span>}
      </div>
      <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[13px]">
        <dt className="text-slate-500">Name</dt><dd className="font-semibold">{me.user.name ?? '—'}</dd>
        <dt className="text-slate-500">Phone</dt><dd className="font-semibold">{me.user.phone ?? '—'}</dd>
        <dt className="text-slate-500">People</dt><dd className="font-semibold">{r.people_count}</dd>
        <dt className="text-slate-500">Location</dt><dd className="font-mono text-[12.5px]">{r.location.latitude.toFixed(5)}, {r.location.longitude.toFixed(5)}</dd>
        <dt className="text-slate-500">Accuracy</dt><dd>±{Math.round(r.location.accuracy_m ?? 0)} m</dd>
        <dt className="text-slate-500">Pinned</dt><dd>{new Date(r.location.captured_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })} ({ago(r.location.captured_at)})</dd>
        {r.responder && <><dt className="text-slate-500">Responder</dt><dd className="font-bold text-rose-700">{r.responder.name} assigned {r.assigned_at ? ago(r.assigned_at) : ''}</dd></>}
        {r.safe_location && <><dt className="text-slate-500">Going to</dt><dd className="font-semibold">{r.safe_location.name}</dd></>}
      </dl>
      <div className="mt-2 text-[11px] text-slate-500">Visible only to authorised FloodGuard responders.</div>
    </div>
  );
}

interface Props {
  me: MeDTO;
  request: RescueRequestDTO | null;
  onRequest: (r: RescueRequestDTO) => void;
  onRefresh: () => void;
  alert: NearbyAlert | null;
  onFindSafe: (fix: DeviceFix) => void;
}

export function ResponseMode({ me, request, onRequest, onRefresh, alert, onFindSafe }: Props) {
  const [people, setPeople] = useState(request?.people_count ?? 1);
  useEffect(() => { if (request?.people_count) setPeople(request.people_count); }, [request?.people_count]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmSafe, setConfirmSafe] = useState(false);
  const status = request?.status as S | undefined;
  const emergency = !!alert && (alert.level === 'CRITICAL' || alert.level === 'WARNING');

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr(null); setMsg(null);
    try { await fn(); onRefresh(); /* location / status chips reflect the fix just stored */ } catch (e: any) {
      setErr(e?.code ? e.message : apiError(e, 'The request failed. Check your connection and try again, or call 112.'));
    } finally { setBusy(null); }
  };

  const pin = () => run('pin', async () => {
    const fix = await getFix();
    if (request && request.status !== S.SAFE && request.status !== S.REACHED_SAFE_LOCATION) {
      await emergencyApi.location(fix); // updates the active request's pin
      onRefresh();
    } else {
      onRequest(await emergencyApi.request(fix, S.LOCATION_PINNED, people, alert?.id));
    }
    setMsg('Location pinned and shared with responders.');
  });

  const rescue = () => run('rescue', async () => {
    const fix = await getFix();
    if (request && (request.status === S.RESCUE_REQUESTED || request.status === S.RESPONDER_ASSIGNED)) {
      await emergencyApi.location(fix);
      if (request.people_count !== people) await emergencyApi.people(request.id, people);
      onRefresh();
      setMsg('Rescue request updated with your latest location.');
    } else {
      onRequest(await emergencyApi.request(fix, S.RESCUE_REQUESTED, people, alert?.id));
      setMsg('RESCUE REQUESTED. Responders can now see your location. Stay where you are if it is safe, keep your phone on, and call 112 if you can.');
    }
  });

  const safe = () => run('safe', async () => {
    let fix: DeviceFix | undefined;
    try { fix = await getFix(15000); } catch { fix = undefined; } // marking safe must still work without GPS
    if (request) onRequest(await emergencyApi.status(request.id, S.SAFE, fix));
    else if (fix) onRequest(await emergencyApi.request(fix, S.SAFE, people, alert?.id));
    else throw new Error('Location unavailable; nothing to update yet. You have no open request.');
    setConfirmSafe(false);
    setMsg('Marked SAFE. Thank you — responders will prioritise others.');
  });

  const findSafe = () => run('find', async () => { onFindSafe(await getFix()); });

  const changePeople = async (n: number) => {
    setPeople(n);
    if (request && request.status !== S.RESOLVED) {
      try { onRequest(await emergencyApi.people(request.id, n)); } catch (e) { setErr(apiError(e, 'Could not update people count.')); }
    }
  };

  return (
    <section className={`rounded-3xl p-4 shadow-lg ${emergency ? (alert!.is_demo ? 'bg-amber-50 ring-4 ring-amber-400' : 'bg-rose-50 ring-4 ring-rose-600') : 'bg-white ring-1 ring-slate-200'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={`text-[12px] font-black uppercase tracking-[0.2em] ${emergency ? 'text-rose-700' : 'text-slate-500'}`}>{emergency ? '⚠ Emergency response mode' : 'If you are in danger'}</h2>
        {status && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold text-white" style={{ background: TONE_HEX[statusTone(status)] }}>{STATUS_LABEL[status]}</span>}
      </div>
      <div className="space-y-2.5">
        <BigButton tone="red" busy={busy === 'rescue'} disabled={!!busy} onClick={rescue} className="min-h-[64px] text-[18px]">🆘 I NEED RESCUE</BigButton>
        <PeoplePicker value={people} onChange={changePeople} disabled={!!busy} />
        <div className="grid grid-cols-2 gap-2">
          <BigButton tone="navy" busy={busy === 'pin'} disabled={!!busy} onClick={pin}>📍 PIN MY LOCATION</BigButton>
          <BigButton tone="orange" busy={busy === 'find'} disabled={!!busy} onClick={findSafe}>🧭 FIND SAFE LOCATION</BigButton>
        </div>
        {!confirmSafe
          ? <BigButton tone="green" disabled={!!busy} onClick={() => setConfirmSafe(true)}>✓ I AM SAFE</BigButton>
          : (
            <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-300">
              <div className="text-[13px] font-bold text-emerald-900">Confirm you and the people with you are safe?</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <BigButton tone="ghost" onClick={() => setConfirmSafe(false)}>CANCEL</BigButton>
                <BigButton tone="green" busy={busy === 'safe'} onClick={safe}>YES, WE ARE SAFE</BigButton>
              </div>
            </div>
          )}
        <ErrorNote>{err}</ErrorNote>
        {msg && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-200">{msg}</div>}
        {request && request.status !== S.RESOLVED && <PinnedCard me={me} r={request} />}
        <InfoNote>Buttons use this device's real GPS at the moment you press them. If GPS fails you will see why — FloodGuard never guesses your position. In a life-threatening emergency call <a className="font-bold text-rose-700" href="tel:112">112</a>.</InfoNote>
      </div>
    </section>
  );
}

