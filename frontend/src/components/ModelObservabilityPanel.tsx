// "AI Model Intelligence" dashboard section. Shows the flood-risk model's production telemetry from the
// FloodGuard backend and its Arize AI export state. Drift is computed in Arize, so it is linked, not
// mirrored; nothing here is estimated client-side.
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BrainCircuit, ExternalLink, Gauge, LineChart, PlugZap, RefreshCw, ShieldAlert, Timer } from 'lucide-react';
import { modelObservabilityApi } from '../services/modelObservabilityApi';
import { CONNECT_PROMPT, deriveObservabilityView, type Tone } from '../services/modelObservabilityView';

const REFRESH_MS = 60_000;

const TONE: Record<Tone, { cls: string; dot: string }> = {
  good: { cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400', dot: 'bg-green-500' },
  warn: { cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', dot: 'bg-amber-500' },
  bad: { cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400', dot: 'bg-red-500' },
  neutral: { cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', dot: 'bg-gray-400' },
};

const timeOf = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

export const ModelObservabilityPanel: React.FC = () => {
  const summary = useQuery({
    queryKey: ['modelObservability', 'summary'],
    queryFn: modelObservabilityApi.summary,
    refetchInterval: REFRESH_MS,
    staleTime: 30_000,
    retry: 1,
  });

  const view = summary.data ? deriveObservabilityView(summary.data) : null;
  const pill = summary.isLoading
    ? { text: 'Loading…', ...TONE.neutral }
    : view
      ? { text: view.connection.label, ...TONE[view.connection.tone] }
      : { text: 'Unavailable', ...TONE.bad };

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900" aria-labelledby="model-obs-title">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-r from-violet-50 via-white to-white px-6 py-4 dark:border-gray-700 dark:from-violet-500/10 dark:via-gray-900 dark:to-gray-900">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
            <BrainCircuit className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">ML observability</div>
            <h2 id="model-obs-title" className="text-lg font-semibold text-gray-900 dark:text-white">AI Model Intelligence</h2>
            <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
              {view ? `${view.modelName} · ${view.modelVersion}` : 'flood-risk prediction model'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${pill.cls}`} aria-live="polite">
            <span className={`inline-flex h-2 w-2 rounded-full ${pill.dot}`} />
            {pill.text}
          </span>
          <button
            type="button"
            onClick={() => void summary.refetch()}
            disabled={summary.isFetching}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Refresh model observability"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${summary.isFetching ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-5 px-6 py-5">
        {summary.isLoading ? (
          <div className="grid animate-pulse grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />)}
          </div>
        ) : !view ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <ShieldAlert className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <div className="font-semibold text-gray-900 dark:text-white">Model telemetry is unavailable</div>
            <p className="mx-auto max-w-md text-sm text-gray-500 dark:text-gray-400">The FloodGuard API did not respond. Flood prediction is not affected.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile label="Predictions today" icon={<Activity className="h-4 w-4" strokeWidth={1.75} />} value={view.predictionsToday} hint="flood-risk scores served" />
              <Tile label="Avg inference latency" icon={<Timer className="h-4 w-4" strokeWidth={1.75} />} value={view.avgLatency} hint="model time per prediction" />
              <Tile label="High-risk share" icon={<Gauge className="h-4 w-4" strokeWidth={1.75} />} value={view.highRiskShare} hint="probability ≥ 0.6 today" />
              <Tile
                label="Feature drift"
                icon={<LineChart className="h-4 w-4" strokeWidth={1.75} />}
                value={view.drift.value}
                hint={view.drift.hint}
              />
            </div>

            {view.showConnectPrompt ? (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 p-4 dark:border-violet-500/30 dark:bg-violet-500/5">
                <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" strokeWidth={1.75} />
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">{CONNECT_PROMPT}</div>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">{view.connection.detail}. Predictions keep working without it.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-gray-50/60 p-4 text-sm dark:border-gray-700 dark:bg-gray-800/40">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{view.connection.detail}</div>
                  <div className="text-gray-500 dark:text-gray-400">
                    Last export {timeOf(summary.data?.arize.last_export_at)} · {summary.data?.arize.exported_records.toLocaleString('en-IN')} records exported
                  </div>
                </div>
                {view.arizeLink && (
                  <a
                    href={view.arizeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
                  >
                    Open in Arize <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                )}
              </div>
            )}

            {view.scopeNote && <p className="text-xs text-amber-700 dark:text-amber-400">{view.scopeNote}</p>}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-gray-50 px-6 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
        <span>Aggregate counts only · no locations or personal data · refreshes every 60 s · observability never alters predictions</span>
        <span className="font-mono">Last prediction {timeOf(view?.lastEvent)}</span>
      </div>
    </section>
  );
};

const Tile: React.FC<{ label: string; icon: React.ReactNode; value: string; hint: string }> = ({ label, icon, value, hint }) => (
  <div className="flex flex-col gap-2 rounded-xl border bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/40">
    <div className="flex items-start justify-between gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
      <span className="leading-snug">{label}</span>
      <span className="shrink-0">{icon}</span>
    </div>
    <div className="flex flex-col">
      <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{hint}</span>
    </div>
  </div>
);

export default ModelObservabilityPanel;
