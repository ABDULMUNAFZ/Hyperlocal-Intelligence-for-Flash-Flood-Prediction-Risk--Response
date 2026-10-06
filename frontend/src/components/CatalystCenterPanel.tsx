// Cisco Catalyst Center network-infrastructure panel for the dashboard. Renders only what the backend
// proxy returns from Catalyst Center (public, aggregate-only endpoints); when the controller is
// unreachable or unconfigured it says so instead of showing numbers.
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Network, RefreshCw, Server, Settings2, WifiOff } from 'lucide-react';
import {
  catalystCenterApi,
  type CatalystCenterHealth,
  type CatalystDeviceHealthItem,
} from '../services/catalystCenterApi';

const REFRESH_MS = 60_000;

const STATUS_STYLE: Record<CatalystDeviceHealthItem['status'], { label: string; chip: string; bar: string }> = {
  healthy: { label: 'Healthy', chip: 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400', bar: 'bg-green-500' },
  warning: { label: 'Warning', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400', bar: 'bg-amber-500' },
  critical: { label: 'Critical', chip: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400', bar: 'bg-red-500' },
  unknown: { label: 'No data', chip: 'bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-500/10 dark:text-gray-400', bar: 'bg-gray-300 dark:bg-gray-600' },
};

const timeOf = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

// Catalyst Center reports reachability in upper case (e.g. REACHABLE); show it as a readable word.
const titleCase = (text: string | null) => (text ? text.charAt(0) + text.slice(1).toLowerCase() : '—');

const scoreTone = (pct: number | null | undefined) =>
  pct === null || pct === undefined ? 'text-gray-400' : pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500';

export const CatalystCenterPanel: React.FC = () => {
  const health = useQuery({
    queryKey: ['catalystCenter', 'health'],
    queryFn: catalystCenterApi.health,
    refetchInterval: REFRESH_MS,
    staleTime: 30_000,
    retry: 1,
  });
  const events = useQuery({
    queryKey: ['catalystCenter', 'events'],
    queryFn: catalystCenterApi.events,
    refetchInterval: REFRESH_MS,
    staleTime: 30_000,
    retry: 1,
    enabled: health.data?.connected === true,
  });

  const data = health.data;
  const connected = data?.connected === true;
  const notConfigured = !!data && !data.configured;
  const refresh = () => { void health.refetch(); void events.refetch(); };

  const pill = health.isLoading
    ? { text: 'Connecting…', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', dot: 'bg-gray-400' }
    : connected
      ? { text: 'Connected', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400', dot: 'bg-green-500' }
      : notConfigured
        ? { text: 'Not configured', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', dot: 'bg-gray-400' }
        : { text: 'Offline', cls: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400', dot: 'bg-red-500' };

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900" aria-labelledby="cisco-cc-title">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-r from-sky-50 via-white to-white px-6 py-4 dark:border-gray-700 dark:from-sky-500/10 dark:via-gray-900 dark:to-gray-900">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
            <Network className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-400">Cisco Catalyst Center</div>
            <h2 id="cisco-cc-title" className="text-lg font-semibold text-gray-900 dark:text-white">Network Infrastructure</h2>
            <div className="font-mono text-xs text-gray-500 dark:text-gray-400">{data?.controller ?? 'controller not set'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${pill.cls}`} aria-live="polite">
            <span className="relative flex h-2 w-2">
              {connected && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${pill.dot}`} />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${pill.dot}`} />
            </span>
            {pill.text}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={health.isFetching}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            aria-label="Refresh Catalyst Center data"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${health.isFetching ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {health.isLoading ? (
          <Skeleton />
        ) : connected && data ? (
          <ConnectedView data={data} openIssues={events.data?.connected ? events.data.count ?? 0 : null} />
        ) : (
          <StatusMessage
            icon={notConfigured ? Settings2 : WifiOff}
            title={notConfigured ? 'Catalyst Center is not configured' : 'Cannot reach Catalyst Center'}
            detail={
              notConfigured
                ? 'Set the CATALYST_CENTER_* settings on the FloodGuard backend to show live network status.'
                : health.isError
                  ? 'The FloodGuard API did not respond. Flood monitoring is not affected.'
                  : `${sentence(data?.error ?? 'The controller did not respond')} Flood monitoring is not affected.`
            }
            onRetry={notConfigured ? undefined : refresh}
            retrying={health.isFetching}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-gray-50 px-6 py-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
        <span>Live from the Cisco Catalyst Center Intent API · refreshes every 60 s · kept separate from flood prediction</span>
        <span className="font-mono">Last sync {timeOf(data?.retrieved_at)}</span>
      </div>
    </section>
  );
};

const ConnectedView: React.FC<{ data: CatalystCenterHealth; openIssues: number | null }> = ({ data, openIssues }) => {
  const d = data.devices;
  const site = data.sites?.[0];
  const networkScore = data.network?.health_score ?? null;
  const siteScore = site?.network_health_score ?? null;
  const segments = d
    ? ([
        ['healthy', d.healthy],
        ['warning', d.warning],
        ['critical', d.critical],
        ['unknown', d.unknown],
      ] as const)
    : [];

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Network devices" icon={<Server className="h-4 w-4" strokeWidth={1.75} />}>
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{d?.total ?? '—'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">managed by Catalyst Center</span>
        </Tile>
        <Tile label="Network health">
          <Gauge value={networkScore} />
        </Tile>
        <Tile label={site?.name ? `Site health · ${site.name}` : 'Site health'}>
          <Gauge value={siteScore} />
        </Tile>
        <Tile
          label="Open issues"
          icon={openIssues ? <AlertTriangle className="h-4 w-4 text-amber-500" strokeWidth={1.75} /> : <CheckCircle2 className="h-4 w-4 text-green-500" strokeWidth={1.75} />}
        >
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{openIssues ?? '—'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{openIssues === 0 ? 'no active issues' : 'reported by Assurance'}</span>
        </Tile>
      </div>

      {/* Device health distribution */}
      {d && d.total > 0 && (
        <div>
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Device health</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">Catalyst Center score bands: 8–10 healthy · 4–7 warning · 1–3 critical</span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" role="img" aria-label={`${d.healthy} healthy, ${d.warning} warning, ${d.critical} critical, ${d.unknown} without data`}>
            {segments.map(([key, n]) => n > 0 && (
              <span key={key} className={STATUS_STYLE[key].bar} style={{ width: `${(n / d.total) * 100}%` }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {segments.map(([key, n]) => (
              <span key={key} className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_STYLE[key].bar}`} />
                {STATUS_STYLE[key].label} <span className="font-semibold text-gray-900 dark:text-white">{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Device table */}
      {d && d.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Device</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Health</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Reachability</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {d.items.map((item, i) => {
                const style = STATUS_STYLE[item.status];
                const score = item.health_score;
                return (
                  <tr key={`${item.name}-${i}`} className="text-gray-700 dark:text-gray-200">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{item.family ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${score && score > 0 ? Math.min(score, 10) * 10 : 0}%` }} />
                        </div>
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{score && score > 0 ? `${Math.round(score)}/10` : '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.chip}`}>{style.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{titleCase(item.reachability)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.errors && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Some Catalyst Center views were unavailable: {Object.entries(data.errors).map(([k, v]) => `${k} (${v})`).join(', ')}.
        </p>
      )}
    </div>
  );
};

const Tile: React.FC<{ label: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div className="flex flex-col gap-2 rounded-xl border bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/40">
    <div className="flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
      <span className="truncate">{label}</span>
      {icon}
    </div>
    <div className="flex flex-col">{children}</div>
  </div>
);

/** Ring gauge for a 0–100 health percentage; shows "—" when Catalyst Center reports no value. */
const Gauge: React.FC<{ value: number | null }> = ({ value }) => {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="6" className="stroke-gray-200 dark:stroke-gray-700" />
        <circle
          cx="28" cy="28" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className={`stroke-current ${scoreTone(value)}`}
          strokeDasharray={`${(pct / 100) * c} ${c}`}
        />
      </svg>
      <div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{value === null ? '—' : `${Math.round(value)}%`}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{value === null ? 'no score' : value >= 80 ? 'good' : value >= 50 ? 'fair' : 'poor'}</div>
      </div>
    </div>
  );
};

const StatusMessage: React.FC<{
  icon: React.ElementType;
  title: string;
  detail: string;
  onRetry?: () => void;
  retrying?: boolean;
}> = ({ icon: Icon, title, detail, onRetry, retrying }) => (
  <div className="flex flex-col items-center gap-3 py-8 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      <Icon className="h-6 w-6" strokeWidth={1.5} />
    </span>
    <div>
      <div className="font-semibold text-gray-900 dark:text-white">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} strokeWidth={1.75} /> Try again
      </button>
    )}
  </div>
);

const Skeleton: React.FC = () => (
  <div className="animate-pulse space-y-4" aria-hidden="true">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />)}
    </div>
    <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800" />
    <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800" />
  </div>
);

export default CatalystCenterPanel;
