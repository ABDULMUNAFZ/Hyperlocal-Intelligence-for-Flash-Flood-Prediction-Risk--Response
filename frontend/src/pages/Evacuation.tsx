// FloodGuard Evacuation Page
import React, { useState } from 'react';
import { DataStatusPanel } from '../components/DataStatusPanel';

const Evacuation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'zones' | 'routes' | 'shelters' | 'plans'>('zones');

  const mockZones = [
    { id: '1', name: 'Immediate Evacuation - Kerala Coast', type: 'immediate', priority: 1, population: 45000, eta: 30 },
    { id: '2', name: 'High Risk - Western Ghats Slopes', type: 'high', priority: 2, population: 120000, eta: 60 },
    { id: '3', name: 'Moderate Risk - Lowland Areas', type: 'moderate', priority: 3, population: 380000, eta: 120 },
    { id: '4', name: 'Low Risk - Elevated Areas', type: 'low', priority: 4, population: 520000, eta: 180 },
    { id: '5', name: 'Safe Zone - High Ground', type: 'safe', priority: 5, population: 120000, eta: 0 },
  ];

  const mockShelters = [
    { id: '1', name: 'Government High School, Alappuzha', type: 'school', capacity: 2000, occupancy: 150, facilities: ['water', 'toilets', 'medical', 'power'] },
    { id: '2', name: 'Community Hall, Wayanad', type: 'community_hall', capacity: 800, occupancy: 0, facilities: ['water', 'toilets', 'power'] },
    { id: '3', name: 'Stadium Complex, Kochi', type: 'stadium', capacity: 5000, occupancy: 200, facilities: ['water', 'toilets', 'medical', 'power', 'kitchen'] },
    { id: '4', name: 'Engineering College, Thrissur', type: 'school', capacity: 1500, occupancy: 300, facilities: ['water', 'toilets', 'medical', 'power'] },
  ];

  const mockRoutes = [
    { id: '1', from: 'Immediate Evacuation Zone', to: 'Govt High School, Alappuzha', distance: '12.5 km', time: '25 min', status: 'Clear', capacity: 500 },
    { id: '2', from: 'High Risk Zone', to: 'Community Hall, Wayanad', distance: '8.2 km', time: '18 min', status: 'Partial Flooding', capacity: 300 },
    { id: '3', from: 'Moderate Risk Zone', to: 'Stadium Complex, Kochi', distance: '15.3 km', time: '35 min', status: 'Clear', capacity: 1000 },
  ];

  const typeColors = {
    immediate: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    safe: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Evacuation Planning</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Zones, routes, shelters, and evacuation plans</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Generate Plan</button>
      </div>

      <DataStatusPanel />

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4" aria-label="Evacuation tabs">
          {(['zones', 'routes', 'shelters', 'plans'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'zones' && 'Evacuation Zones'}
              {tab === 'routes' && 'Routes'}
              {tab === 'shelters' && 'Shelters'}
              {tab === 'plans' && 'Plans'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'zones' && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Zone</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Population</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Est. Evacuation Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {mockZones.map(zone => (
                <tr key={zone.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{zone.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${typeColors[zone.type as keyof typeof typeColors]}`}>
                      {zone.type.charAt(0).toUpperCase() + zone.type.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{zone.priority}</td>
                  <td className="px-4 py-3">{zone.population.toLocaleString()}</td>
                  <td className="px-4 py-3">{zone.eta} min</td>
                  <td className="px-4 py-3">
                    {zone.type === 'safe' ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Safe</span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Evacuate</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'shelters' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockShelters.map(shelter => (
            <div key={shelter.id} className="rounded-lg border p-4 bg-white dark:bg-gray-800">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{shelter.name}</h3>
                <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700">{shelter.type}</span>
              </div>
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <div className="flex justify-between">
                  <span>Capacity:</span>
                  <span className="font-medium">{shelter.capacity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Occupancy:</span>
                  <span className="font-medium">{shelter.occupancy.toLocaleString()} ({(shelter.occupancy/shelter.capacity*100).toFixed(0)}%)</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {shelter.facilities.map(f => (
                  <span key={f} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">From Zone</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">To Shelter</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Distance</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Time</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Capacity (veh/hr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {mockRoutes.map(route => (
                <tr key={route.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{route.from}</td>
                  <td className="px-4 py-3">{route.to}</td>
                  <td className="px-4 py-3">{route.distance}</td>
                  <td className="px-4 py-3">{route.time}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      route.status === 'Clear' ? 'bg-green-100 text-green-700' :
                      route.status === 'Partial Flooding' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {route.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{route.capacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">Evacuation Plans</h2>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold">Kerala State Evacuation Plan v2.1</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Approved by State Disaster Management Authority</p>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">Active</span>
                <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">Last Updated: 2024-01-15</span>
              </div>
            </div>
            <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold">Karnataka Western Ghats Plan v1.3</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Focus on landslide-prone taluks</p>
              <div className="mt-2 flex gap-2">
                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-700">Active</span>
                <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">Last Updated: 2024-01-10</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Evacuation;