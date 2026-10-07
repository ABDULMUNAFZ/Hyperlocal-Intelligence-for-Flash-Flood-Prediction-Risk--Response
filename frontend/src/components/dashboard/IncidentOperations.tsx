// Incident-response section of the command dashboard (formerly the standalone /admin page). The queue
// and dispatch form run on built-in simulation data and never send anything; real rescue requests and
// alerts are handled by responders on the Alerts and emergency consoles.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ListChecks, Megaphone, Radio, Send, Shield, Siren, UserCheck } from 'lucide-react';

type Severity = 'CRITICAL' | 'WARNING' | 'WATCH';
type Status = 'PENDING' | 'ACKNOWLEDGED' | 'RESCUE_ASSIGNED' | 'SAFE';

interface Incident {
  id: string;
  zone: string;
  severity: Severity;
  status: Status;
  people: number;
  lat: number;
  lon: number;
  age: string;
  source: string;
  note: string;
}

const DEMO_INCIDENTS: Incident[] = [
  { id: 'REQ-WAY-101', zone: 'Chooralmala River Bridge', severity: 'CRITICAL', status: 'RESCUE_ASSIGNED', people: 4, lat: 11.5385, lon: 76.172, age: '8 min ago', source: 'Citizen SOS PWA (location pin)', note: 'Water rising near tea factory quarters. 1 elder, 2 children.' },
  { id: 'REQ-WAY-102', zone: 'Mundakkai Upper Slope', severity: 'CRITICAL', status: 'ACKNOWLEDGED', people: 6, lat: 11.554, lon: 76.185, age: '19 min ago', source: 'Citizen SOS PWA', note: 'Hillside stream diverted toward house front yard.' },
  { id: 'REQ-WAY-103', zone: 'Meppadi Town Low Basin', severity: 'WARNING', status: 'PENDING', people: 2, lat: 11.552, lon: 76.124, age: '32 min ago', source: 'Citizen SOS PWA', note: 'Culvert clogged; road knee-deep in water.' },
  { id: 'REQ-WAY-104', zone: 'Vythiri NH 766 Bypass', severity: 'WATCH', status: 'SAFE', people: 1, lat: 11.549, lon: 76.042, age: '1 hr ago', source: 'Citizen SOS PWA', note: 'Arrived at Vythiri Community Hall relief shelter.' },
];

const SEVERITY_CHIP: Record<Severity, string> = {
  CRITICAL: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400',
  WARNING: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400',
  WATCH: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-400',
};

const STATUS_LABEL: Record<Status, string> = {
  PENDING: 'Pending',
  ACKNOWLEDGED: 'Acknowledged',
  RESCUE_ASSIGNED: 'Rescue assigned',
  SAFE: 'Safe at shelter',
};

const NEXT_ACTION: Partial<Record<Status, { label: string; next: Status; cls: string }>> = {
  PENDING: { label: 'Acknowledge', next: 'ACKNOWLEDGED', cls: 'bg-amber-600 hover:bg-amber-500' },
  ACKNOWLEDGED: { label: 'Assign team Beta-3', next: 'RESCUE_ASSIGNED', cls: 'bg-blue-600 hover:bg-blue-500' },
  RESCUE_ASSIGNED: { label: 'Mark safe at shelter', next: 'SAFE', cls: 'bg-emerald-600 hover:bg-emerald-500' },
};

export const IncidentOperations: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>(DEMO_INCIDENTS);
  const [tab, setTab] = useState<'queue' | 'dispatch'>('queue');
  const [headline, setHeadline] = useState('FLASH FLOOD WARNING: CHOORALMALA & MUNDAKKAI');
  const [instruction, setInstruction] = useState('Rapid river surge detected. Move immediately to St. Joseph School relief camp.');
  const [previewed, setPreviewed] = useState(false);

  const open = incidents.filter((i) => i.status !== 'SAFE');
  const setStatus = (id: string, status: Status) =>
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900" aria-labelledby="ops-title">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-r from-rose-50 via-white to-white px-6 py-4 dark:border-gray-700 dark:from-rose-500/10 dark:via-gray-900 dark:to-gray-900">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm">
            <Siren className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700 dark:text-rose-400">Incident response</div>
            <h2 id="ops-title" className="text-lg font-semibold text-gray-900 dark:text-white">Operations Command</h2>
            <div className="font-mono text-xs text-gray-500 dark:text-gray-400">Wayanad DDMA · Control Room 1077</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" title="Built-in scenario data, not live SOS requests">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Simulation data
          </span>
          <div className="inline-flex rounded-lg border bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800" role="tablist">
            {([['queue', `Incident queue (${incidents.length})`, ListChecks], ['dispatch', 'Dispatch warning', Megaphone]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  tab === key ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6 px-6 py-5">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Active SOS pins" icon={<Radio className="h-4 w-4 text-rose-500" strokeWidth={1.75} />} value={open.length} unit="tickets" hint="awaiting safe resolution" tone="text-rose-600 dark:text-rose-400" />
          <Kpi label="Citizens involved" icon={<UserCheck className="h-4 w-4 text-amber-500" strokeWidth={1.75} />} value={incidents.reduce((n, i) => n + i.people, 0)} unit="people" hint={`across ${incidents.length} micro-zones`} />
          <Kpi label="Responder teams" icon={<Shield className="h-4 w-4 text-sky-500" strokeWidth={1.75} />} value={4} unit="units" hint="Fire & Rescue + NDRF" tone="text-sky-600 dark:text-sky-400" />
          <Kpi label="Safe arrivals" icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" strokeWidth={1.75} />} value={incidents.length - open.length} unit="verified" hint="shelter confirmed" tone="text-emerald-600 dark:text-emerald-400" />
        </div>

        {tab === 'queue' ? (
          <ul className="space-y-3">
            {incidents.map((inc) => {
              const action = NEXT_ACTION[inc.status];
              return (
                <li key={inc.id} className="rounded-xl border bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{inc.id}</span>
                      <span className="font-medium text-sky-700 dark:text-sky-400">{inc.zone}</span>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SEVERITY_CHIP[inc.severity]}`}>{inc.severity}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">{inc.age}</span>
                      <span className="rounded-md border bg-white px-2 py-0.5 font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">{STATUS_LABEL[inc.status]}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{inc.note}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono">
                      <span>People <strong className="text-gray-900 dark:text-white">{inc.people}</strong></span>
                      <span>{inc.lat.toFixed(4)}°N, {inc.lon.toFixed(4)}°E</span>
                      <span className="hidden sm:inline">{inc.source}</span>
                    </div>
                    {action ? (
                      <button type="button" onClick={() => setStatus(inc.id, action.next)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${action.cls}`}>
                        {action.label}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} /> Resolved in shelter
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <form
            className="max-w-3xl space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setPreviewed(true);
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Alert headline</span>
              <input
                value={headline}
                onChange={(e) => { setHeadline(e.target.value); setPreviewed(false); }}
                className="w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm text-gray-900 focus:border-rose-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Instruction to citizens</span>
              <textarea
                rows={3}
                value={instruction}
                onChange={(e) => { setInstruction(e.target.value); setPreviewed(false); }}
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:border-rose-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
            <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <strong>Target area:</strong> Chooralmala, Mundakkai and Meppadi micro-zones, citizen PWA devices within 4 km of the river corridors.
            </p>
            <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500">
              <Send className="h-4 w-4" strokeWidth={1.75} /> Preview public warning
            </button>
            {previewed && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200" role="status">
                <div className="font-semibold">{headline}</div>
                <div>{instruction}</div>
                <div className="text-xs">
                  Preview only: nothing was sent. Responders issue real alerts from the{' '}
                  <Link to="/alerts" className="inline-flex items-center gap-0.5 font-semibold underline">Alerts page <ArrowRight className="h-3 w-3" /></Link>.
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </section>
  );
};

const Kpi: React.FC<{ label: string; icon: React.ReactNode; value: number; unit: string; hint: string; tone?: string }> = ({ label, icon, value, unit, hint, tone = 'text-gray-900 dark:text-white' }) => (
  <div className="flex flex-col gap-2 rounded-xl border bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/40">
    <div className="flex items-start justify-between gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
      <span className="leading-snug">{label}</span>
      <span className="shrink-0">{icon}</span>
    </div>
    <div>
      <span className={`text-3xl font-bold ${tone}`}>{value}</span>
      <span className="ml-1.5 text-sm text-gray-500 dark:text-gray-400">{unit}</span>
    </div>
    <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>
  </div>
);

export default IncidentOperations;
