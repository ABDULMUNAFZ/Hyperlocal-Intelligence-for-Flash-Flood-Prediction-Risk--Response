// FloodGuard Alerts Page
import React, { useState } from 'react';

const Alerts: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'subscriptions' | 'templates'>('active');

  const mockActiveAlerts = [
    { id: '1', alertId: 'FLDG-20240120-A1B2', title: 'Flash Flood Warning - Kerala Coast', severity: 'severe', type: 'flash_flood', onset: '2024-01-20T10:30:00Z', expires: '2024-01-20T22:00:00Z', regions: ['Kerala'], status: 'active' },
    { id: '2', alertId: 'FLDG-20240120-B3C4', title: 'Heavy Rainfall Watch - Western Ghats', severity: 'watch', type: 'flood_risk', onset: '2024-01-20T08:00:00Z', expires: '2024-01-21T08:00:00Z', regions: ['Karnataka', 'Kerala'], status: 'active' },
    { id: '3', alertId: 'FLDG-20240119-C5D6', title: 'River Flood Warning - Cauvery Basin', severity: 'warning', type: 'river_flood', onset: '2024-01-19T14:00:00Z', expires: '2024-01-21T14:00:00Z', regions: ['Tamil Nadu', 'Karnataka'], status: 'active' },
  ];

  const mockHistoryAlerts = [
    { id: '4', alertId: 'FLDG-20240115-E7F8', title: 'Cyclone Michaung Flood Alert', severity: 'severe', type: 'flood_risk', status: 'expired', sentAt: '2024-01-15T06:00:00Z', regions: ['Andhra Pradesh', 'Tamil Nadu'] },
    { id: '5', alertId: 'FLDG-20240110-G9H0', title: 'Dam Release Warning - Almatti', severity: 'warning', type: 'dam_break', status: 'cancelled', sentAt: '2024-01-10T12:00:00Z', regions: ['Karnataka'] },
  ];

  const severityColors = {
    extreme: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    severe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    warning: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    watch: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };

  const severityOrder = { extreme: 5, severe: 4, warning: 3, watch: 2, info: 1 };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Alerts & Warnings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time flood alerts and warning management</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Issue Alert</button>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4" aria-label="Alert tabs">
          {(['active', 'history', 'subscriptions', 'templates'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'active' && `Active Alerts (${mockActiveAlerts.length})`}
              {tab === 'history' && 'Alert History'}
              {tab === 'subscriptions' && 'My Subscriptions'}
              {tab === 'templates' && 'Templates'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'active' && (
        <div className="space-y-4">
          {mockActiveAlerts.map(alert => (
            <div key={alert.id} className="rounded-lg border p-4 bg-white dark:bg-gray-800">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{alert.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${severityColors[alert.severity as keyof typeof severityColors]}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {alert.type.replace('_', ' ')}
                    </span>
                    <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono">
                      {alert.alertId}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                    {alert.type === 'flash_flood' && 'Immediate flash flooding expected. Seek higher ground immediately.'}
                    {alert.type === 'river_flood' && 'River levels rising. Evacuate low-lying areas near rivers.'}
                    {alert.type === 'flood_risk' && 'Elevated flood risk due to heavy rainfall. Monitor conditions.'}
                    {alert.type === 'dam_break' && 'Potential dam failure. Follow evacuation orders immediately.'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  <div className="text-right text-sm text-gray-500">
                    <div>Onset: {new Date(alert.onset).toLocaleString()}</div>
                    <div>Expires: {new Date(alert.expires).toLocaleString()}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Details</button>
                    <button className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Acknowledge</button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-gray-500 mt-3 pt-3 border-t">
                <span>Regions: {alert.regions.join(', ')}</span>
                <span>Status: <span className="font-medium capitalize">{alert.status}</span></span>
                <span>Source: FloodGuard System</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Alert ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Severity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Sent At</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Regions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {mockHistoryAlerts.map(alert => (
                <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono text-sm">{alert.alertId}</td>
                  <td className="px-4 py-3">{alert.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${severityColors[alert.severity as keyof typeof severityColors]}`}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{alert.type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      alert.status === 'expired' ? 'bg-gray-100 text-gray-700' :
                      alert.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {alert.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(alert.sentAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{alert.regions.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">My Alert Subscriptions</h2>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Kerala State - All Alerts</h3>
                  <p className="text-sm text-gray-500">Minimum severity: Watch | Channels: Push, Email, SMS</p>
                </div>
                <button className="px-3 py-1 text-sm border rounded hover:bg-gray-100">Edit</button>
              </div>
            </div>
            <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Karnataka Western Ghats - Severe Only</h3>
                  <p className="text-sm text-gray-500">Minimum severity: Severe | Channels: Push, SMS</p>
                </div>
                <button className="px-3 py-1 text-sm border rounded hover:bg-gray-100">Edit</button>
              </div>
            </div>
          </div>
          <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Subscription</button>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'Flash Flood Warning', type: 'flash_flood', severity: 'severe', channels: ['push', 'sms', 'email', 'siren'] },
            { name: 'River Flood Warning', type: 'river_flood', severity: 'warning', channels: ['push', 'email', 'siren'] },
            { name: 'Evacuation Order', type: 'evacuation', severity: 'severe', channels: ['push', 'sms', 'siren', 'radio'] },
            { name: 'Shelter Open Notice', type: 'shelter_open', severity: 'info', channels: ['push', 'email'] },
            { name: 'Dam Break Alert', type: 'dam_break', severity: 'extreme', channels: ['push', 'sms', 'email', 'siren', 'radio', 'tv'] },
            { name: 'Heavy Rainfall Watch', type: 'flood_risk', severity: 'watch', channels: ['push', 'email'] },
          ].map(template => (
            <div key={template.name} className="rounded-lg border p-4 bg-white dark:bg-gray-800">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{template.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${severityColors[template.severity as keyof typeof severityColors]}`}>
                  {template.severity}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-2">Type: {template.type.replace('_', ' ')}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {template.channels.map(c => (
                  <span key={c} className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{c}</span>
                ))}
              </div>
              <button className="w-full px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Use Template</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Alerts;