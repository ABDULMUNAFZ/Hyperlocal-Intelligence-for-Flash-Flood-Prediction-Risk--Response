// FloodGuard Frontend - Data Status Panel Component
// Shows real-time status of all data sources

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export interface DataSourceStatus {
  source: string;
  status: 'fresh' | 'stale' | 'invalid' | 'unavailable' | 'degraded';
  last_update: string | null;
  record_count: number;
  age_hours: number | null;
  error?: string;
}

interface DataStatusPanelProps {
  className?: string;
  compact?: boolean;
}

export const DataStatusPanel: React.FC<DataStatusPanelProps> = ({
  className = '',
  compact = false,
}) => {
  const { data, isLoading, error, refetch } = useQuery<DataSourceStatus[]>({
    queryKey: ['dataStatus'],
    queryFn: async () => {
      const response = await api.get('/api/v1/data-sources/status');
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  // Group sources by type
  const sourceGroups = {
    rainfall: ['open_meteo_rainfall', 'chirps_rainfall', 'nasa_gpm_imerg', 'imd_aws_rainfall', 'mosdac_gsmap'],
    weather: ['open_meteo_forecast', 'noaa_gfs', 'imd_wrf'],
    dem: ['copernicus_glo30', 'copernicus_glo90', 'srtm_30m', 'alos_palsar'],
    soil: ['soilgrids', 'hw_sd'],
    landcover: ['esa_worldcover', 'modis_mcd12q1', 'bhuvan_lulc'],
    hydrology: ['hydrosheds', 'hydroatlas'],
    infrastructure: ['openstreetmap', 'microsoft_buildings'],
    population: ['worldpop', 'landscan'],
    historical_flood: ['emdat', 'dartmouth_flood', 'nidm_flood'],
    admin: ['gadm', 'census_india'],
  };

  const groupLabels: Record<string, string> = {
    rainfall: '🌧️ Rainfall',
    weather: '🌤️ Weather Forecast',
    dem: '🏔️ Elevation (DEM)',
    soil: '🌱 Soil',
    landcover: '🌲 Land Cover',
    hydrology: '🌊 Hydrology',
    infrastructure: '🏗️ Infrastructure',
    population: '👥 Population',
    historical_flood: '📜 Historical Floods',
    admin: '🗺️ Boundaries',
  };

  const statusColors = {
    fresh: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
    stale: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
    degraded: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
    invalid: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
    unavailable: 'text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800',
  };

  const statusLabels = {
    fresh: 'LIVE',
    stale: 'STALE',
    degraded: 'DEGRADED',
    invalid: 'INVALID',
    unavailable: 'UNAVAILABLE',
  };

  const statusIcons = {
    fresh: '●',
    stale: '◐',
    degraded: '◑',
    invalid: '✗',
    unavailable: '○',
  };

  if (isLoading) {
    return (
      <div className={`p-4 rounded-lg border ${className}`}>
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading data source status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 ${className}`}>
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>Failed to load data source status</span>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const sources = data || [];

  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Data Source Status</h3>
        <button
          onClick={() => refetch()}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {Object.entries(sourceGroups).map(([groupKey, sourceNames]) => {
        const groupSources = sources.filter(s => sourceNames.includes(s.source));
        if (groupSources.length === 0) return null;

        const hasLive = groupSources.some(s => s.status === 'fresh');
        const hasIssues = groupSources.some(s => s.status !== 'fresh' && s.status !== 'unavailable');

        return (
          <div key={groupKey} className="mb-4">
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              {groupLabels[groupKey] || groupKey}
              {hasLive && <span className="text-green-500 text-xs">● LIVE</span>}
              {hasIssues && !hasLive && <span className="text-yellow-500 text-xs">⚠ ISSUES</span>}
              {!hasLive && !hasIssues && <span className="text-gray-500 text-xs">○ OFFLINE</span>}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groupSources.map((source) => (
                <div
                  key={source.source}
                  className={`p-3 rounded border text-xs ${
                    source.status === 'fresh' ? 'border-green-200 bg-green-50 dark:bg-green-900/10' :
                    source.status === 'stale' ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10' :
                    source.status === 'degraded' ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10' :
                    source.status === 'invalid' ? 'border-red-200 bg-red-50 dark:bg-red-900/10' :
                    'border-gray-200 bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm">{source.source}</span>
                    <span className={`${statusColors[source.status]} px-2 py-0.5 rounded text-xs font-medium`}>
                      {statusIcons[source.status]} {statusLabels[source.status]}
                    </span>
                  </div>

                  {source.last_update && (
                    <div className="text-gray-600 dark:text-gray-400 mb-1">
                      Updated: {new Date(source.last_update).toLocaleString()}
                    </div>
                  )}

                  {source.age_hours !== null && source.age_hours !== undefined && (
                    <div className="text-gray-500 dark:text-gray-500 mb-1">
                      Age: {source.age_hours.toFixed(1)}h
                    </div>
                  )}

                  {source.record_count > 0 && (
                    <div className="text-gray-500 dark:text-gray-500 mb-1">
                      Records: {source.record_count.toLocaleString()}
                    </div>
                  )}

                  {source.error && (
                    <div className="text-red-600 dark:text-red-400 text-xs mt-1">
                      {source.error}
                    </div>
                  )}

                  {source.status === 'unavailable' && (
                    <div className="text-gray-500 dark:text-gray-500 text-xs mt-1 italic">
                      No data available
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DataStatusPanel;