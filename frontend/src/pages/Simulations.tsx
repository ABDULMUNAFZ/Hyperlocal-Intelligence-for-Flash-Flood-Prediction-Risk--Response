// FloodGuard Simulations Page
import React, { useState } from 'react';

const Simulations: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'what-if'>('list');

  const mockSimulations = [
    { id: '1', name: 'Kerala 2018 Replay', status: 'completed', type: 'historical', created: '2024-01-15', duration: '24h' },
    { id: '2', name: 'Monsoon Forecast 72h', status: 'running', type: 'forecast', created: '2024-01-20', progress: 65 },
    { id: '3', name: 'Extreme Event Scenario', status: 'queued', type: 'what_if', created: '2024-01-21' },
  ];

  const whatIfScenarios = [
    { id: '1', name: '100-year Design Storm', category: 'design_storm', region: 'Kerala' },
    { id: '2', name: 'Climate Change +2°C', category: 'climate_change', region: 'All States' },
    { id: '3', name: 'Dam Break Scenario', category: 'dam_break', region: 'Karnataka' },
    { id: '4', name: 'Urbanization Impact', category: 'urbanization', region: 'Bangalore' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Flood Simulations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Run and manage flood simulation scenarios</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          New Simulation
        </button>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4" aria-label="Simulation tabs">
          {(['list', 'create', 'what-if'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'list' && 'Simulations'}
              {tab === 'create' && 'Create New'}
              {tab === 'what-if' && 'What-If Scenarios'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'list' && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {mockSimulations.map(sim => (
                <tr key={sim.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{sim.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {sim.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {sim.status === 'running' && sim.progress !== undefined ? (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${sim.progress}%` }} />
                        </div>
                        <span className="text-sm text-blue-600">{sim.progress}%</span>
                      </div>
                    ) : (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        sim.status === 'completed' ? 'bg-green-100 text-green-700' :
                        sim.status === 'running' ? 'bg-blue-100 text-blue-700' :
                        sim.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      } dark:bg-green-900/30 dark:text-green-300`}>
                        {sim.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{sim.created}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{sim.duration}</td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Create New Simulation</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Simulation Name</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" placeholder="e.g., Monsoon 2024 Forecast" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scenario Type</label>
                <select className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800">
                  <option value="forecast">Weather Forecast</option>
                  <option value="historical">Historical Event</option>
                  <option value="what_if">What-If Scenario</option>
                  <option value="design_storm">Design Storm</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Grid Resolution (m)</label>
                  <input type="number" className="w-full px-3 py-2 border rounded-lg" defaultValue={30} min={5} max={500} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Duration (hours)</label>
                  <input type="number" className="w-full px-3 py-2 border rounded-lg" defaultValue={24} min={1} max={168} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model Type</label>
                <select className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800">
                  <option value="shallow_water_2d">2D Shallow Water Equations</option>
                  <option value="kinematic_wave">Kinematic Wave</option>
                  <option value="diffusive_wave">Diffusive Wave</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Simulation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'what-if' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {whatIfScenarios.map(scenario => (
            <div key={scenario.id} className="rounded-lg border p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{scenario.name}</h3>
                <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700">{scenario.category}</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">Region: {scenario.region}</p>
              <button className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Run Scenario
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Simulations;