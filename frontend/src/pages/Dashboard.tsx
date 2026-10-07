// FloodGuard command dashboard: incident operations, data sources, network infrastructure and AI model
// observability on one page. /admin redirects here.
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Compass, Map as MapIcon, Route as RouteIcon, Terminal, Waves } from 'lucide-react';
import { DataStatusPanel } from '../components/DataStatusPanel';
import { CatalystCenterPanel } from '../components/CatalystCenterPanel';
import { ModelObservabilityPanel } from '../components/ModelObservabilityPanel';
import { IncidentOperations } from '../components/dashboard/IncidentOperations';

const QUICK_ACTIONS = [
  { to: '/app/map', icon: MapIcon, title: '3D Wayanad command map', detail: 'Terrain, rainfall, risk zones and infrastructure' },
  { to: '/simulations', icon: Waves, title: 'Run flood simulation', detail: 'Configure what-if rainfall scenarios' },
  { to: '/evacuation', icon: RouteIcon, title: 'Check evacuation routes', detail: 'Safe routes to the nearest shelters' },
  { to: '/ai', icon: Bot, title: 'AI disaster assistant', detail: 'Ask about risk, evacuation and preparedness' },
];

const Dashboard: React.FC = () => {
  useEffect(() => {
    document.title = 'Command Dashboard — FloodGuard';
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            FloodGuard operations
          </div>
          <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">Command Dashboard</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Incidents, data sources, network infrastructure and AI model health in one place
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <IstClock />
          <Link
            to="/app/map"
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Compass className="h-4 w-4 text-sky-500" strokeWidth={1.75} /> 3D command map
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
          >
            <Terminal className="h-4 w-4" strokeWidth={1.75} /> Situational console
          </Link>
        </div>
      </div>

      <IncidentOperations />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DataStatusPanel compact />

        <section className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900" aria-labelledby="quick-actions-title">
          <h2 id="quick-actions-title" className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quick actions</h2>
          <div className="space-y-3">
            {QUICK_ACTIONS.map(({ to, icon: Icon, title, detail }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-4 rounded-xl border bg-gray-50/60 p-4 transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-900 dark:text-white">{title}</span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400">{detail}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-blue-500" strokeWidth={1.75} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <CatalystCenterPanel />

      <ModelObservabilityPanel />

      <section className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900" aria-labelledby="overview-title">
        <h2 id="overview-title" className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">System overview</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Active data sources" value="8/10" trend="up" />
          <StatCard label="Rainfall stations" value="1,247" trend="up" />
          <StatCard label="Weather grid points" value="2,156" trend="stable" />
          <StatCard label="IoT sensors" value="5 (demo)" trend="new" />
        </div>
      </section>
    </div>
  );
};

const IstClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="rounded-lg border bg-white px-3 py-2 font-mono text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
      {now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST
    </span>
  );
};

const TREND: Record<'up' | 'down' | 'stable' | 'new', { icon: string; cls: string }> = {
  up: { icon: '↑', cls: 'text-green-600' },
  down: { icon: '↓', cls: 'text-red-600' },
  stable: { icon: '→', cls: 'text-gray-500' },
  new: { icon: '★', cls: 'text-blue-600' },
};

const StatCard: React.FC<{ label: string; value: string; trend: keyof typeof TREND }> = ({ label, value, trend }) => (
  <div className="rounded-xl border bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/40">
    <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
    <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    <div className={`mt-1 text-xs ${TREND[trend].cls}`}>
      {TREND[trend].icon} {trend}
    </div>
  </div>
);

export default Dashboard;
