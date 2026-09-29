// Responder rescue panels: RESCUE PERSON detail, emergency control summary, safe-location designation.
import React, { useEffect, useState } from 'react';
import { X, Users, MapPin, Route as RouteIcon, UserCheck, CheckCircle2, Phone, ShieldCheck, Trash2, Send, Footprints } from 'lucide-react';
import { panel, Card, KV, Btn, Caveat, Unavailable, Spinner } from './ui';
import { emergencyApi, apiError, type RescueRequestDTO } from '../../emergency/api';
import { RescueStatus as S, STATUS_LABEL, TONE_HEX, statusTone } from '../../emergency/status';
import { ago, fmtDistance } from '../../emergency/device';
import type { FeatureCollection, LngLat } from '../../types/geo';
import type { DeliverySummary } from './useRescue';

function Shell({ title, onClose, children, icon: Icon = Users }: { title: string; onClose: () => void; children: React.ReactNode; icon?: any }) {
  return (
    <aside className={`${panel} pointer-events-auto flex max-h-full w-full md:w-[410px] flex-col overflow-hidden rounded-2xl`}>
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3 dark:border-white/10">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]"><Icon className="h-4 w-4 text-rose-600" />{title}</div>
        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-3 overflow-y-auto p-3.5">{children}</div>
    </aside>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white" style={{ background: TONE_HEX[statusTone(status)] }}>{STATUS_LABEL[status as S] ?? status}</span>;
}

// ============================================================================ person

export function RescuePersonPanel({ id, responders, onClose, onFocus, onRoute, onChanged }: {
  id: string; responders: Array<{ id: string; name: string; role: string }>; onClose: () => void;
  onFocus: (ll: LngLat, zoom?: number) => void; onRoute: (fc: FeatureCollection | null, fit?: boolean) => void; onChanged: (r: RescueRequestDTO) => void;
}) {
  const [r, setR] = useState<RescueRequestDTO | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [assignee, setAssignee] = useState('');
  const [route, setRoute] = useState<any>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);

  const load = () => emergencyApi.rescueDetail(id).then((d) => { setR(d); setErr(null); }).catch((e) => setErr(apiError(e, 'Could not load this request.')));
  useEffect(() => { setR(null); setRoute(null); onRoute(null); load(); return () => onRoute(null); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (key: string, fn: () => Promise<RescueRequestDTO>) => {
    setBusy(key); setErr(null);
    try { const out = await fn(); onChanged(out); await load(); } catch (e) { setErr(apiError(e, 'Action failed.')); } finally { setBusy(null); }
  };

  const showRoute = async () => {
    setBusy('route'); setErr(null);
    try {
      const d = await emergencyApi.rescueRoute(id);
      setRoute(d);
      if (d.available) onRoute({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { unavailable: false }, geometry: d.geometry }] }, true);
      else if (d.destination) onRoute({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { unavailable: true }, geometry: { type: 'LineString', coordinates: [d.origin, [d.destination.lon, d.destination.lat]] } }] }, true);
      else onRoute(null);
    } catch (e) { setErr(apiError(e, 'Route request failed.')); } finally { setBusy(null); }
  };

  if (!r) return <Shell title="Rescue person" onClose={onClose}>{err ? <Unavailable>{err}</Unavailable> : <Spinner label="Loading…" />}</Shell>;
  const ll: LngLat = [r.location.longitude, r.location.latitude];
  const tone = statusTone(r.status);

  return (
    <Shell title="Rescue person" onClose={onClose}>
      <div className="rounded-xl p-3 text-white" style={{ background: TONE_HEX[tone] }}>
        <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] opacity-90">{STATUS_LABEL[r.status as S]}{r.is_demo ? ' · DEMO' : ''}</div>
        <div className="text-[22px] font-black leading-tight">{r.people_count} {r.people_count === 1 ? 'PERSON' : 'PEOPLE'}</div>
        <div className="text-[13px] font-semibold">{r.person?.name ?? 'Name not provided'}</div>
      </div>
      <Card>
        <KV k="Phone" v={r.person?.phone ? <a className="font-bold text-sky-700" href={`tel:${r.person.phone}`}><Phone className="mr-1 inline h-3 w-3" />{r.person.phone}</a> : '—'} />
        <KV k="Emergency contact" v={r.person?.emergency_contact?.phone ? `${r.person.emergency_contact.name ?? ''} ${r.person.emergency_contact.phone}` : '—'} />
        <KV k="Position" mono v={`${ll[1].toFixed(5)}, ${ll[0].toFixed(5)}`} />
        <KV k="GPS accuracy" v={r.location.accuracy_m != null ? `±${Math.round(r.location.accuracy_m)} m` : '—'} />
        <KV k="Last update" v={<span className={r.location.freshness === 'STALE' ? 'font-bold text-amber-600' : ''}>{ago(r.location.captured_at)} · {r.location.freshness}</span>} />
        <KV k="Risk level" v={r.risk_level ?? 'Not linked to an alert'} />
        <KV k="Nearest safe location" v={r.nearest_safe_location ? `${r.nearest_safe_location.name} · ${fmtDistance(r.nearest_safe_location.distance_m)}` : 'None designated'} />
        {r.safe_location && <KV k="Heading to" v={`${r.safe_location.name} (${r.journey.status})`} />}
        <KV k="Responder" v={r.responder ? `${r.responder.name}${r.assigned_at ? ` · ${ago(r.assigned_at)}` : ''}` : 'Unassigned'} />
        {r.note && <KV k="Note" v={`“${r.note}”`} />}
      </Card>

      <div className="grid grid-cols-2 gap-1.5">
        <Btn onClick={() => onFocus(ll, 17.5)}><MapPin className="h-3.5 w-3.5" />View location</Btn>
        <Btn disabled={busy === 'route'} onClick={showRoute}><RouteIcon className="h-3.5 w-3.5" />{busy === 'route' ? 'Routing…' : 'Show route'}</Btn>
      </div>
      {route && (
        <div className="rounded-lg bg-slate-50 p-2 text-[11.5px] dark:bg-white/5">
          {route.available
            ? <>Route to <b>{route.destination.name}</b>{route.chosen_by_person ? ' (chosen by person)' : ' (nearest)'}: {fmtDistance(route.distance_m)} · ~{Math.round(route.duration_s / 60)} min {route.profile === 'foot' ? 'walking' : 'driving'} · risk {route.risk?.level}<div className="text-slate-500">{route.source}</div></>
            : <><b>ROUTING DATA UNAVAILABLE</b>{route.destination ? <> — dashed line is the straight line to {route.destination.name}, not a route.</> : <> — {route.message}</>}</>}
        </div>
      )}

      <Card>
        <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Assign responder</div>
        <div className="flex gap-1.5">
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-200 bg-transparent px-1.5 py-1 text-[12px] dark:border-white/10">
            <option value="">Me</option>
            {responders.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.role})</option>)}
          </select>
          <Btn tone="danger" disabled={!!busy} onClick={() => act('assign', () => emergencyApi.assign(r.id, assignee || undefined))}><UserCheck className="h-3.5 w-3.5" />{busy === 'assign' ? '…' : 'Assign'}</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-1.5">
        <Btn disabled={!!busy || r.status === S.EVACUATING} onClick={() => act('evac', () => emergencyApi.responderStatus(r.id, 'EVACUATING'))}><Footprints className="h-3.5 w-3.5" />Mark evacuating</Btn>
        {!confirmResolve
          ? <Btn tone="primary" disabled={!!busy} onClick={() => setConfirmResolve(true)}><CheckCircle2 className="h-3.5 w-3.5" />Mark resolved</Btn>
          : <Btn tone="primary" disabled={!!busy} onClick={() => act('resolve', () => emergencyApi.responderStatus(r.id, 'RESOLVED', 'Resolved by responder'))}>Confirm resolve</Btn>}
      </div>
      {err && <div className="text-[11.5px] font-semibold text-rose-600">{err}</div>}

      {r.history && r.history.length > 0 && (
        <Card>
          <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">History</div>
          {r.history.slice().reverse().map((h, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5 text-[11px]">
              <span className="w-16 shrink-0 text-slate-500">{new Date(h.at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</span>
              <StatusPill status={h.to} /><span className="truncate text-slate-500">{h.note}</span>
            </div>
          ))}
        </Card>
      )}
      <Caveat tone="slate">Position is the person's own device GPS, shared when they pressed a button or while their journey screen was open. Access is audited.</Caveat>
    </Shell>
  );
}

// ============================================================================ safe location detail

export function SafeLocationPanel({ props, responder, onClose, onChanged }: { props: Record<string, any>; responder: boolean; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Shell title="Safe location" icon={ShieldCheck} onClose={onClose}>
      <div className="text-[17px] font-bold">{props.name}</div>
      {props.is_demo && <div className="inline-block rounded bg-amber-400 px-1.5 text-[10px] font-extrabold text-amber-950">DEMO — EXERCISE ONLY</div>}
      <Card>
        <KV k="Type" v={String(props.type).replace('_', ' ')} />
        <KV k="Capacity" v={props.capacity ?? '—'} />
        <KV k="Address" v={props.address ?? '—'} />
        <KV k="Designation" v={props.verification ?? '—'} />
      </Card>
      {responder && (
        <Btn tone="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await emergencyApi.deactivateSafe(props.id); onChanged(); onClose(); } catch (e) { setErr(apiError(e, 'Failed')); } finally { setBusy(false); } }}>
          <Trash2 className="h-3.5 w-3.5" />Deactivate safe location
        </Btn>
      )}
      {err && <div className="text-[11.5px] text-rose-600">{err}</div>}
    </Shell>
  );
}

// ============================================================================ emergency control (summary + list + designation + deliveries)

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2 text-center dark:bg-white/5">
      <div className="text-[22px] font-black" style={{ color }}>{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

export function EmergencyControlPanel(p: {
  summary: any; requests: RescueRequestDTO[]; deliveries: DeliverySummary[]; safe: Array<Record<string, any>>; error: string | null;
  selectedLL: LngLat | null; selectedName: string; demo: boolean;
  onSelectPerson: (r: RescueRequestDTO) => void; onFocus: (ll: LngLat, zoom?: number) => void; onSafeChanged: () => void; onRefresh: () => void;
  onOpenCompose: () => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<'people' | 'safe' | 'delivery'>('people');
  const s = p.summary;
  return (
    <Shell title="Emergency control" onClose={p.onClose}>
      {p.error && <Unavailable>{p.error}</Unavailable>}
      <div className="grid grid-cols-3 gap-1.5">
        <Stat label="Active emergencies" value={s?.active_emergencies ?? '—'} color="#c92a2a" />
        <Stat label="Need rescue" value={s?.people_needing_rescue ?? '—'} color={TONE_HEX.red} />
        <Stat label="Evacuating" value={s?.people_evacuating ?? '—'} color={TONE_HEX.orange} />
        <Stat label="Safe" value={s?.people_safe ?? '—'} color={TONE_HEX.green} />
        <Stat label="Unresolved" value={s?.unresolved_requests ?? '—'} />
        <button onClick={p.onOpenCompose} className="rounded-lg bg-rose-600 px-1 text-[10.5px] font-extrabold uppercase tracking-wider text-white hover:bg-rose-700"><Send className="mx-auto mb-0.5 h-4 w-4" />Send emergency alert</button>
      </div>
      <div className="flex gap-2 text-[10px] font-semibold text-slate-500">
        {(['red', 'orange', 'yellow', 'green'] as const).map((t) => (
          <span key={t} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TONE_HEX[t] }} />
            {{ red: 'Rescue required', orange: 'Evacuating / attention', yellow: 'Pinned', green: 'Reached safety' }[t]}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/5">
        {(['people', 'safe', 'delivery'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md py-1.5 text-[10.5px] font-bold uppercase tracking-wider ${tab === t ? 'bg-white text-rose-600 shadow dark:bg-slate-800' : 'text-slate-500'}`}>
            {t === 'people' ? `People (${p.requests.length})` : t === 'safe' ? `Safe loc. (${p.safe.length})` : 'Delivery'}
          </button>
        ))}
      </div>

      {tab === 'people' && (p.requests.length === 0
        ? <div className="text-[12px] text-slate-500">No open rescue requests. People appear here the moment they pin their location or request rescue in the FloodGuard Emergency app.</div>
        : p.requests.map((r) => (
          <button key={r.id} onClick={() => p.onSelectPerson(r)} className="w-full rounded-xl border border-slate-200 p-2.5 text-left hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: TONE_HEX[statusTone(r.status)] }} />
              <b className="text-[13px]">{r.people_count} {r.people_count === 1 ? 'PERSON' : 'PEOPLE'}</b>
              <StatusPill status={r.status} />
              {r.is_demo && <span className="text-[9.5px] font-bold text-amber-600">DEMO</span>}
              <span className="ml-auto text-[10.5px] text-slate-500">{ago(r.location.captured_at)}</span>
            </div>
            <div className="mt-0.5 text-[11.5px]">{r.person?.name ?? '—'} · {r.person?.phone ?? 'no phone'}{r.responder ? ` · ${r.responder.name}` : ''}</div>
          </button>
        )))}

      {tab === 'safe' && <SafeTab {...p} />}

      {tab === 'delivery' && (p.deliveries.length === 0
        ? <div className="text-[12px] text-slate-500">Delivery results appear here after an alert is sent (targeted users, pushes accepted by the push service, failures, users without a subscription).</div>
        : p.deliveries.map((d) => (
          <Card key={d.alert_id}>
            <div className="text-[11px] text-slate-500">Alert {d.alert_id.slice(0, 8)} · {ago(d.at)}</div>
            {d.push_configured === false && <div className="text-[11.5px] font-bold text-rose-600">Emergency push notifications are not configured.</div>}
            <div className="mt-1 grid grid-cols-5 gap-1 text-center text-[10px]">
              <Stat label="Targeted" value={d.targeted_users} />
              <Stat label="Sent" value={d.sent} color={TONE_HEX.green} />
              <Stat label="Failed" value={d.failed} color={d.failed ? TONE_HEX.red : undefined} />
              <Stat label="Expired" value={d.expired} />
              <Stat label="No sub." value={d.no_subscription} />
            </div>
            <div className="mt-1 text-[10px] text-slate-500">“Sent” = accepted by the browser push service. Display on the device depends on its OS notification settings.</div>
          </Card>
        )))}
      <Btn tone="ghost" onClick={p.onRefresh}>Refresh</Btn>
    </Shell>
  );
}

function SafeTab(p: { safe: Array<Record<string, any>>; selectedLL: LngLat | null; selectedName: string; demo: boolean; onFocus: (ll: LngLat, zoom?: number) => void; onSafeChanged: () => void }) {
  const [f, setF] = useState({ name: '', type: 'relief_camp', capacity: 100, verification: '', address: '', phone: '', demo: p.demo });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setF((x) => ({ ...x, demo: p.demo })); }, [p.demo]);
  const inp = 'w-full rounded border border-slate-200 bg-transparent px-2 py-1 text-[12px] dark:border-white/10';
  const submit = async () => {
    if (!p.selectedLL) return;
    setBusy(true); setMsg(null);
    try {
      await emergencyApi.designateSafe({ name: f.name.trim(), longitude: p.selectedLL[0], latitude: p.selectedLL[1], shelter_type: f.type, capacity: f.capacity,
        verification: f.verification.trim(), address: f.address.trim() || undefined, contact_phone: f.phone.trim() || undefined, is_demo: f.demo });
      setMsg('Designated. It is now offered to people searching for a safe location.');
      setF({ ...f, name: '', verification: '', address: '', phone: '' });
      p.onSafeChanged();
    } catch (e) { setMsg(apiError(e, 'Designation failed.')); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 text-[12px]">
      {p.safe.length === 0 && <Caveat>No safe location is designated. OpenStreetMap has no mapped relief camps for Wayanad, so FloodGuard offers none until an authorised responder designates one.</Caveat>}
      {p.safe.map((s) => (
        <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 dark:border-white/10">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
          <span className="flex-1 truncate"><b>{s.name}</b>{s.is_demo ? ' · DEMO' : ''}<span className="block truncate text-[10.5px] text-slate-500">{s.verification}</span></span>
          <Btn onClick={() => p.onFocus([s.lon, s.lat], 16)}>Focus</Btn>
        </div>
      ))}
      <Card>
        <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Designate safe location</div>
        {!p.selectedLL ? <div className="text-slate-500">Click the exact place on the map first (e.g. a school or relief-camp building).</div> : (
          <div className="space-y-1.5">
            <div className="text-[11px] text-slate-500">At {p.selectedLL[1].toFixed(5)}, {p.selectedLL[0].toFixed(5)} (near {p.selectedName})</div>
            <input className={inp} placeholder="Name (e.g. GHSS Meppadi relief camp)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <div className="flex gap-1.5">
              <select className={inp} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                {['relief_camp', 'school', 'community_hall', 'government_building', 'religious', 'assembly_point', 'other'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
              <input className={inp} type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: +e.target.value })} title="Capacity" />
            </div>
            <input className={inp} placeholder="Authority / verification (required, e.g. 'District EOC order 12/2026')" value={f.verification} onChange={(e) => setF({ ...f, verification: e.target.value })} />
            <input className={inp} placeholder="Address (optional)" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            <input className={inp} placeholder="Contact phone (optional)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <label className="flex items-center gap-1 font-semibold text-amber-600"><input type="checkbox" checked={f.demo} onChange={(e) => setF({ ...f, demo: e.target.checked })} />DEMO (exercise only)</label>
            <Btn tone="primary" disabled={busy || f.name.trim().length < 3 || f.verification.trim().length < 5} onClick={submit}><ShieldCheck className="h-3.5 w-3.5" />{busy ? 'Saving…' : 'Designate'}</Btn>
          </div>
        )}
        {msg && <div className="mt-1 text-[11.5px]">{msg}</div>}
      </Card>
    </div>
  );
}
