import React from 'react';
import { Loader2, ExternalLink, Info } from 'lucide-react';
import { STATUS_STYLE } from './constants';
import type { Provenance } from '../../types/geo';

export const panel =
  'bg-[#F6F5F2]/95 dark:bg-[#141518]/95 backdrop-blur-xl border border-[#E6E4DE] dark:border-white/10 shadow-[0_10px_40px_-12px_rgba(20,21,24,0.12)] text-[#141518] dark:text-[#FAF9F6]';

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[9.5px] font-semibold tracking-wider ring-1 ring-inset ${STATUS_STYLE[status] ?? STATUS_STYLE.HISTORICAL} ${className}`}>
      {status === 'LIVE' && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {status}
    </span>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-[#6A6D75] dark:text-slate-400">{children}</h4>
      {right}
    </div>
  );
}

export function KV({ k, v, mono = false, hint }: { k: React.ReactNode; v: React.ReactNode; mono?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] text-[12.5px]">
      <span className="text-[#6A6D75] dark:text-slate-400 shrink-0" title={hint}>{k}</span>
      <span className={`text-right text-[#141518] dark:text-slate-100 ${mono ? 'font-mono text-[12px]' : 'font-medium'}`}>{v}</span>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#E6E4DE] dark:border-white/10 bg-white dark:bg-white/[0.04] p-3.5 shadow-xs ${className}`}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {label ?? 'Loading…'}
    </div>
  );
}

export function Unavailable({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-dashed border-rose-300/70 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/5 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Caveat({ children, tone = 'amber' }: { children: React.ReactNode; tone?: 'amber' | 'rose' | 'slate' }) {
  const tones = {
    amber: 'border-amber-300/70 bg-amber-50/80 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    rose: 'border-rose-300/70 bg-rose-50/80 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
    slate: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
  };
  return <div className={`rounded-lg border px-3 py-2 text-[11.5px] leading-snug ${tones[tone]}`}>{children}</div>;
}

export function ProvenanceLine({ p }: { p?: Provenance | null }) {
  if (!p) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-slate-500 dark:text-slate-400">
      <StatusBadge status={p.status} />
      <span className="uppercase tracking-wider text-[9.5px] font-semibold">{p.kind.replace('_', ' ')}</span>
      <span>·</span>
      {p.url ? (
        <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline inline-flex items-center gap-0.5">{p.source}<ExternalLink className="h-2.5 w-2.5" /></a>
      ) : <span>{p.source}</span>}
      {p.reference && <span>· {p.reference}</span>}
      {p.notes && <div className="w-full text-[10.5px] italic opacity-90">{p.notes}</div>}
    </div>
  );
}

export function Bars({ values, labels, color = '#1c7ed6', height = 48, unit = '' }: { values: Array<number | null>; labels?: string[]; color?: string; height?: number; unit?: string }) {
  const max = Math.max(1e-6, ...values.map((v) => v ?? 0));
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="flex-1 rounded-t-sm" title={`${labels?.[i] ?? i}: ${v ?? '—'}${unit}`}
            style={{ height: `${Math.max(v ? 3 : 1, ((v ?? 0) / max) * 100)}%`, background: v ? color : 'rgba(148,163,184,0.35)' }} />
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex justify-between text-[9.5px] text-slate-400 font-mono">
          <span>{labels[0]}</span><span>{labels[Math.floor(labels.length / 2)]}</span><span>{labels[labels.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string; badge?: React.ReactNode }>; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-slate-200/80 dark:border-white/10 px-2">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`relative whitespace-nowrap px-2.5 py-2 text-[11px] font-semibold tracking-wider uppercase transition-colors ${value === t.id ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}>
          {t.label}{t.badge}
          {value === t.id && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded bg-sky-600 dark:bg-sky-400" />}
        </button>
      ))}
    </div>
  );
}

export function Btn({ children, onClick, tone = 'default', disabled, className = '', title }: {
  children: React.ReactNode; onClick?: () => void; tone?: 'default' | 'primary' | 'danger' | 'ghost' | 'lavender'; disabled?: boolean; className?: string; title?: string;
}) {
  const tones = {
    default: 'bg-white dark:bg-white/5 border border-[#E6E4DE] dark:border-white/10 hover:bg-[#EDEAE3] dark:hover:bg-white/10 text-[#141518] dark:text-slate-200',
    primary: 'bg-[#141518] hover:bg-[#252830] text-white border border-[#23252A] shadow-xs',
    lavender: 'bg-[#DDD6EE] hover:bg-[#CEC4E6] text-[#141518] border border-[#C5BAE0] font-semibold',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-700/40',
    ghost: 'hover:bg-[#EDEAE3] dark:hover:bg-white/10 text-[#555861] dark:text-slate-300',
  };
  return (
    <button title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold tracking-wide transition disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]} ${className}`}>
      {children}
    </button>
  );
}

export const riskTone: Record<string, string> = {
  CRITICAL: 'bg-rose-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MODERATE: 'bg-amber-400 text-amber-950',
  LOW: 'bg-emerald-400 text-emerald-950',
  VERY_LOW: 'bg-teal-500 text-white',
};

/** Minimal, safe markdown: **bold**, bullet lines and paragraphs. */
export function MiniMarkdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return <ul key={i} className="list-disc pl-4 space-y-0.5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(l.replace(/^#+\s*/, ''))}</React.Fragment>)}</p>;
      })}
    </div>
  );
}
