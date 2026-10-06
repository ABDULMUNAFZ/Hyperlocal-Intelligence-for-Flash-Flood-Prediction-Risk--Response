// FloodGuard Dashboard Page
import React from 'react';
import { DataStatusPanel } from '../components/DataStatusPanel';
import { CatalystCenterPanel } from '../components/CatalystCenterPanel';
import { Layout } from '../components/Layout';

const Dashboard: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              FloodGuard Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real-time data source status for South India flood prediction
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span id="current-time" className="font-mono"></span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DataStatusPanel />
          <CatalystCenterPanel />
          
          <div className="rounded-lg border p-6 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <button className="w-full p-4 text-left rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="font-medium text-gray-900 dark:text-white">View 3D South India Map</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Explore terrain, rainfall, and infrastructure</div>
              </button>
              <button className="w-full p-4 text-left rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="font-medium text-gray-900 dark:text-white">Run Flood Simulation</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Configure what-if scenarios</div>
              </button>
              <button className="w-full p-4 text-left rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="font-medium text-gray-900 dark:text-white">Check Evacuation Routes</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Find safe routes to shelters</div>
              </button>
              <button className="w-full p-4 text-left rounded-lg border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="font-medium text-gray-900 dark:text-white">AI Disaster Assistant</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Ask about risk, evacuation, preparedness</div>
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          System Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Data Sources" value="8/10" trend="up" />
          <StatCard label="Rainfall Stations" value="1,247" trend="up" />
          <StatCard label="Weather Grid Points" value="2,156" trend="stable" />
          <StatCard label="IoT Sensors" value="5 (demo)" trend="new" />
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; trend: 'up' | 'down' | 'stable' | 'new' }> = ({
  label,
  value,
  trend,
}) => {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    stable: 'text-gray-500',
    new: 'text-blue-600',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    stable: '→',
    new: '★',
  };

  return (
    <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</div>
      <div className={`text-xs ${trendColors[trend]} mt-1`}>
        {trendIcons[trend]} {trend}
      </div>
    </div>
  );
};

const trendIcons = {
  up: '↑',
  down: '↓',
  stable: '→',
  new: '★',
};

export default Dashboard;