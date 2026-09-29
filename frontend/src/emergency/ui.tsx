import React from 'react';

export function BigButton({ children, onClick, tone = 'navy', disabled, busy, className = '', type = 'button' }: {
  children: React.ReactNode; onClick?: () => void; tone?: 'red' | 'navy' | 'green' | 'orange' | 'white' | 'ghost'; disabled?: boolean; busy?: boolean; className?: string; type?: 'button' | 'submit';
}) {
  const tones = {
    red: 'bg-rose-600 text-white active:bg-rose-700 shadow-rose-900/30',
    navy: 'bg-[#0d2b59] text-white active:bg-[#0a2247]',
    green: 'bg-emerald-600 text-white active:bg-emerald-700',
    orange: 'bg-orange-500 text-white active:bg-orange-600',
    white: 'bg-white text-slate-900 active:bg-slate-100 border border-slate-200',
    ghost: 'bg-transparent text-slate-700 border border-slate-300',
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy}
      className={`flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[15px] font-extrabold tracking-wide shadow-md transition disabled:opacity-50 ${tones} ${className}`}>
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Chip({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'slate' | 'blue'; children: React.ReactNode }) {
  const t = { green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-900', red: 'bg-rose-100 text-rose-800', slate: 'bg-slate-100 text-slate-700', blue: 'bg-sky-100 text-sky-800' }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wider ${t}`}>{children}</span>;
}

/** Distinguishes OFFICIAL ALERT / MODEL PREDICTION / SIMULATION / USER REPORTED / RESPONDER ALERT / DEMO. */
export function KindBadge({ kind, isDemo }: { kind: string; isDemo?: boolean }) {
  if (isDemo || kind === 'DEMO') return <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-950">DEMO EMERGENCY — NOT A REAL WARNING</span>;
  const map: Record<string, [string, string]> = {
    OFFICIAL: ['OFFICIAL ALERT', 'bg-rose-700 text-white'],
    RESPONDER: ['RESPONDER ALERT', 'bg-orange-600 text-white'],
    MODEL: ['MODEL PREDICTION', 'bg-violet-600 text-white'],
    SIMULATION: ['SIMULATION', 'bg-amber-400 text-amber-950'],
    USER: ['USER REPORTED', 'bg-slate-600 text-white'],
  };
  const [label, cls] = map[kind] ?? [kind, 'bg-slate-600 text-white'];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider ${cls}`}>{label}</span>;
}

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-800 ring-1 ring-rose-200">{children}</div>;
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600 ring-1 ring-slate-200">{children}</div>;
}

export const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[#0d2b59] focus:ring-2 focus:ring-[#0d2b59]/20';
