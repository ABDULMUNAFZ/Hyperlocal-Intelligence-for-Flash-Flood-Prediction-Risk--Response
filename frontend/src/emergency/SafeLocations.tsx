// Nearest designated safe locations → GO HERE → I'M GOING.
import React, { useState } from 'react';
import type { SafeLocation } from './api';
import { fmtDistance } from './device';
import { BigButton, InfoNote, Section } from './ui';

const RISK_STYLE: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-800', MODERATE: 'bg-amber-100 text-amber-900', HIGH: 'bg-rose-100 text-rose-800', UNKNOWN: 'bg-slate-100 text-slate-700',
};
const fmtEta = (s: number) => (s < 3600 ? `${Math.max(1, Math.round(s / 60))} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`);
const TYPE: Record<string, string> = {
  relief_camp: 'Relief camp', school: 'School', community_hall: 'Community hall', government_building: 'Government building',
  religious: 'Religious building', assembly_point: 'Assembly point', other: 'Safe location',
};

export function RouteSummary({ s }: { s: SafeLocation }) {
  if (s.route) {
    return (
      <div className="text-[12.5px] text-slate-700">
        <b>{fmtDistance(s.route.distance_m)}</b> by {s.route.source.includes('foot') ? 'walking route' : 'road'} · ETA <b>{fmtEta(s.route.duration_s)}</b>
        <div className="text-[10.5px] text-slate-500">{s.route.source}</div>
        {s.route.distance_m > Math.max(3 * s.distance_m, s.distance_m + 2000) && (
          <div className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
            Mapped route is {Math.round(s.route.distance_m / Math.max(s.distance_m, 1))}× the straight-line distance — the path network may be incomplete here (e.g. a river without a mapped footbridge). Use known local paths and follow officials.
          </div>
        )}
      </div>
    );
  }
  return <div className="text-[12px] font-extrabold tracking-wide text-slate-600">{s.routing === 'NOT_REQUESTED' ? 'Route not computed for this option' : 'ROUTING DATA UNAVAILABLE'}</div>;
}

export function SafeLocations({ list, message, onGo, onBack, starting }: {
  list: SafeLocation[]; message?: string; onGo: (s: SafeLocation) => Promise<void>; onBack: () => void; starting: boolean;
}) {
  const [sel, setSel] = useState<SafeLocation | null>(null);

  if (sel) {
    return (
      <Section title="Safe location" right={<button onClick={() => setSel(null)} className="text-[12px] font-bold text-slate-500">← All</button>}>
        <div className="text-[20px] font-black text-slate-900">{sel.name}</div>
        <div className="text-[12.5px] text-slate-600">{TYPE[sel.type] ?? sel.type}{sel.address ? ` · ${sel.address}` : ''}{sel.capacity ? ` · capacity ${sel.capacity}` : ''}</div>
        {sel.is_demo && <div className="mt-1 inline-block rounded bg-amber-400 px-1.5 text-[10px] font-extrabold text-amber-950">DEMO SAFE LOCATION — EXERCISE ONLY</div>}
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 py-2"><div className="text-[22px] font-black">{fmtDistance(sel.distance_m)}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">straight line</div></div>
          <div className="rounded-xl bg-slate-50 py-2"><div className="text-[22px] font-black">{sel.bearing}</div><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">direction{sel.bearing_deg != null ? ` · ${sel.bearing_deg}°` : ''}</div></div>
        </div>
        <div className="mt-3"><RouteSummary s={sel} /></div>
        <div className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${RISK_STYLE[sel.route_risk.level]}`}>ROUTE RISK: {sel.route_risk.level}</div>
        <div className="text-[11px] text-slate-500">{sel.route_risk.basis}</div>
        {sel.verification && <div className="mt-2 text-[11px] text-slate-500">Designated: {sel.verification}</div>}
        {sel.contact_phone && <a href={`tel:${sel.contact_phone}`} className="mt-1 block text-[13px] font-bold text-[#0d2b59]">📞 {sel.contact_phone}</a>}
        <div className="mt-4 space-y-2">
          <BigButton tone="green" busy={starting} onClick={() => onGo(sel)} className="min-h-[62px] text-[18px]">I'M GOING</BigButton>
          <InfoNote>Pressing I'M GOING tells responders where you are heading and starts live location sharing while this screen stays open.</InfoNote>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Nearest safe locations" right={<button onClick={onBack} className="text-[12px] font-bold text-slate-500">Close</button>}>
      {list.length === 0 ? (
        <div className="rounded-xl bg-amber-50 p-3 text-[13.5px] font-semibold text-amber-900 ring-1 ring-amber-200">
          {message ?? 'No designated safe location is registered yet.'}
          <div className="mt-1 text-[12px] font-normal">FloodGuard only lists places designated by authorised responders — it never invents shelters. Move to higher ground away from streams and follow official instructions.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s, i) => (
            <div key={s.id} className="rounded-2xl p-3 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] font-black text-slate-900">{i === 0 && '★ '}{s.name}</div>
                  <div className="text-[11.5px] text-slate-500">{TYPE[s.type] ?? s.type}{s.is_demo ? ' · DEMO' : ''}</div>
                </div>
                <div className="text-right">
                  <div className="text-[17px] font-black">{fmtDistance(s.distance_m)}</div>
                  <div className="text-[11px] font-bold text-slate-500">{s.bearing}</div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <RouteSummary s={s} />
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${RISK_STYLE[s.route_risk.level]}`}>RISK {s.route_risk.level}</span>
              </div>
              <BigButton tone="navy" className="mt-2 min-h-[46px]" onClick={() => setSel(s)}>GO HERE</BigButton>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
