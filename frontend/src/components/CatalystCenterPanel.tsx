// Cisco Catalyst Center network-infrastructure card for the dashboard. Shows only what the backend
// proxy returns from Catalyst Center; when the controller is unreachable or unconfigured it says so.
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { catalystCenterApi } from '../services/catalystCenterApi';

const REFRESH_MS = 60_000;

const timeOf = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

const fmt = (n: number | null | undefined, suffix = '') => (n === null || n === undefined ? '—' : `${Math.round(n)}${suffix}`);

export const CatalystCenterPanel: React.FC = () => {
  const health = useQuery({
    queryKey: ['catalystCenter', 'health'],
    queryFn: catalystCenterApi.health,
    refetchInterval: REFRESH_MS,
    staleTime: 30_000,
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 401) && count < 1,
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
  // The proxy routes are for signed-in users only.
  const needsLogin = isAxiosError(health.error) && health.error.response?.status === 401;
  const state = health.isLoading
    ? { label: 'Checking…', dot: 'bg-gray-400' }
    : needsLogin
      ? { label: 'Sign in required', dot: 'bg-gray-400' }
      : connected
      ? { label: 'Connected', dot: 'bg-green-500' }
      : data && !data.configured
        ? { label: 'Not configured', dot: 'bg-gray-400' }
        : { label: 'Offline', dot: 'bg-red-500' };
  const reason = needsLogin
    ? 'Sign in to FloodGuard to see network status'
    : health.isError
      ? 'FloodGuard API unreachable'
      : !connected
        ? data?.error
        : undefined;
  const devices = data?.devices;
  const site = data?.sites?.[0];

  return (
    <div className="rounded-lg border p-6" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Cisco Catalyst Center
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Network Infrastructure</h2>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <span className={`h-2.5 w-2.5 rounded-full ${state.dot}`} aria-hidden="true" />
          {state.label}
        </span>
      </div>

      <dl className="mt-4 space-y-1 text-sm text-gray-600 dark:text-gray-300">
        <div className="flex gap-2">
          <dt className="text-gray-500 dark:text-gray-400">Controller:</dt>
          <dd>Cisco Catalyst Center{data?.controller ? ` (${data.controller})` : ''}</dd>
        </div>
        {reason && (
          <div className="flex gap-2">
            <dt className="text-gray-500 dark:text-gray-400">Status:</dt>
            <dd>{reason}</dd>
          </div>
        )}
      </dl>

      {connected && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Devices" value={fmt(devices?.total)} />
            <Stat label="Healthy" value={fmt(devices?.healthy)} tone="text-green-600" />
            <Stat label="Warning" value={fmt(devices?.warning)} tone="text-yellow-600" />
            <Stat label="Critical" value={fmt(devices?.critical)} tone="text-red-600" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Network health" value={fmt(data?.network?.health_score, '%')} />
            <Stat label={site?.name ? `Site · ${site.name}` : 'Site health'} value={fmt(site?.network_health_score, '%')} />
            <Stat label="Open issues" value={events.data?.connected ? fmt(events.data.count) : '—'} />
          </div>
        </>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Source: Cisco Catalyst Center · not used in flood prediction</span>
        <span className="font-mono">Last sync {timeOf(data?.retrieved_at)}</span>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone = 'text-gray-900 dark:text-white' }) => (
  <div className="rounded-lg border bg-gray-50 p-3 dark:bg-gray-800/50">
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className={`mt-0.5 text-lg font-bold ${tone}`}>{value}</div>
  </div>
);

export default CatalystCenterPanel;
