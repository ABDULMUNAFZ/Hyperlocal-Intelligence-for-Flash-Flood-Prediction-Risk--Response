// FloodGuard Settings Page
import React, { useState } from 'react';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'map' | 'data' | 'api' | 'about'>('profile');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your FloodGuard preferences</p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 overflow-x-auto" aria-label="Settings tabs">
          {(['profile', 'notifications', 'map', 'data', 'api', 'about'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            <form className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" defaultValue="Demo User" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" defaultValue="demo@floodguard.in" disabled />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Organization</label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" placeholder="e.g., State Disaster Management Authority" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input type="tel" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" placeholder="+91 XXXXX XXXXX" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Preferred Language</label>
                <select className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800">
                  <option value="en">English</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="ta">Tamil (தமிழ்)</option>
                  <option value="kn">Kannada (ಕನ್ನಡ)</option>
                  <option value="ml">Malayalam (മലയാളം)</option>
                  <option value="te">Telugu (తెలుగు)</option>
                </select>
              </div>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
            </form>
          </div>

          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Change Password</h2>
            <form className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Current Password</label>
                <input type="password" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <input type="password" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                <input type="password" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" />
              </div>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Update Password</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Alert Preferences</h2>
            <div className="space-y-4">
              {[
                { id: 'email', label: 'Email Notifications', desc: 'Receive alerts via email' },
                { id: 'push', label: 'Push Notifications', desc: 'Browser push notifications for urgent alerts' },
                { id: 'sms', label: 'SMS Alerts', desc: 'Critical alerts via SMS (requires phone number)' },
                { id: 'sound', label: 'Alert Sounds', desc: 'Play sound when new alert arrives' },
              ].map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <h3 className="font-medium">{item.label}</h3>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={item.id !== 'sms'} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Severity Thresholds</h2>
            <p className="text-sm text-gray-500 mb-4">Minimum severity to notify via each channel</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['email', 'push', 'sms'].map(channel => (
                <div key={channel} className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="font-medium capitalize mb-2">{channel}</h3>
                  <select defaultValue="warning" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800">
                    <option value="info">Info & Above</option>
                    <option value="watch">Watch & Above</option>
                    <option value="warning">Warning & Above</option>
                    <option value="severe">Severe Only</option>
                    <option value="extreme">Extreme Only</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'map' && (
        <div className="space-y-6">
          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Map Display</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Default View</label>
                <select className="w-full max-w-xs px-3 py-2 border rounded-lg bg-white dark:bg-gray-800">
                  <option value="south_india">South India Overview</option>
                  <option value="kerala">Kerala</option>
                  <option value="karnataka">Karnataka</option>
                  <option value="tamil_nadu">Tamil Nadu</option>
                  <option value="andhra_pradesh">Andhra Pradesh</option>
                  <option value="telangana">Telangana</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Terrain Exaggeration</label>
                <input type="range" min={0.5} max={3} step={0.1} defaultValue={1.5} className="w-full" />
                <p className="text-sm text-gray-500 mt-1">Current: 1.5x</p>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                <div>
                  <h3 className="font-medium">3D Buildings</h3>
                  <p className="text-sm text-gray-500">Show building extrusions (requires OSM data)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                <div>
                  <h3 className="font-medium">Rainfall Animation</h3>
                  <p className="text-sm text-gray-500">Animate rainfall accumulation over time</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Layer Visibility Defaults</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                'Rainfall', 'Weather', 'Terrain', 'Rivers', 'Roads', 'Buildings',
                'Land Cover', 'Population', 'Historical Floods', 'Risk Zones',
                'Evacuation Zones', 'Shelters'
              ].map(layer => (
                <label key={layer} className="flex items-center gap-2 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/50 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 border-gray-300 rounded" defaultChecked={['Rainfall', 'Terrain', 'Rivers', 'Risk Zones'].includes(layer)} />
                  <span className="text-sm">{layer}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Data Source Management</h2>
            <p className="text-sm text-gray-500 mb-4">Configure which data sources to use and their priority</p>
            <div className="space-y-2">
              {[
                { name: 'Open-Meteo Rainfall', type: 'rainfall', enabled: true, priority: 1 },
                { name: 'CHIRPS', type: 'rainfall', enabled: false, priority: 2 },
                { name: 'NASA GPM IMERG', type: 'rainfall', enabled: false, priority: 3 },
                { name: 'Open-Meteo Forecast', type: 'weather', enabled: true, priority: 1 },
                { name: 'NOAA GFS', type: 'weather', enabled: false, priority: 2 },
                { name: 'Copernicus GLO-30', type: 'dem', enabled: true, priority: 1 },
                { name: 'SoilGrids', type: 'soil', enabled: true, priority: 1 },
                { name: 'ESA WorldCover', type: 'landcover', enabled: true, priority: 1 },
                { name: 'OpenStreetMap', type: 'infrastructure', enabled: true, priority: 1 },
                { name: 'WorldPop', type: 'population', enabled: true, priority: 1 },
              ].map((source, i) => (
                <div key={source.name} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 text-blue-600" defaultChecked={source.enabled} />
                    <div>
                      <h3 className="font-medium">{source.name}</h3>
                      <p className="text-xs text-gray-500">Type: {source.type} | Priority: {source.priority}</p>
                    </div>
                  </div>
                  <button className="px-2 py-1 text-xs border rounded hover:bg-gray-100">Configure</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Cache Settings</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Cache TTL (minutes)</label>
                <input type="number" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" defaultValue={60} min={5} max={1440} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Cache Size (MB)</label>
                <input type="number" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" defaultValue={500} min={100} max={5000} />
              </div>
            </div>
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Clear All Cache</button>
          </div>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="space-y-6">
          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">API Keys</h2>
            <p className="text-sm text-gray-500 mb-4">Manage your API keys for external service access</p>
            <div className="space-y-3">
              {[
                'Open-Meteo (no key required)',
                'IMD API (requires registration)',
                'MOSDAC/ISRO (requires registration)',
                'Bhuvan/NRSC (requires registration)',
                'NASA Earthdata (requires registration)',
                'EM-DAT (requires registration)',
              ].map((service, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/50">
                  <span className="font-medium">{service}</span>
                  <button className="px-3 py-1 text-sm border rounded hover:bg-gray-100">Configure</button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Rate Limits</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Requests per Minute</label>
                <input type="number" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" defaultValue={100} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Burst Allowance</label>
                <input type="number" className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800" defaultValue={200} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="space-y-6">
          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800 text-center">
            <h2 className="text-2xl font-bold mb-2">FloodGuard</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Flash Flood Prediction System for Hilly Regions
            </p>
            <p className="text-sm text-gray-500">SIH 26192 - Smart India Hackathon 2024</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 bg-white dark:bg-gray-800">
              <h3 className="font-semibold mb-2">Version</h3>
              <p className="text-gray-600 dark:text-gray-400">1.0.0 (Development)</p>
            </div>
            <div className="rounded-lg border p-4 bg-white dark:bg-gray-800">
              <h3 className="font-semibold mb-2">Build Date</h3>
              <p className="text-gray-600 dark:text-gray-400">2024-01-20</p>
            </div>
            <div className="rounded-lg border p-4 bg-white dark:bg-gray-800">
              <h3 className="font-semibold mb-2">Backend</h3>
              <p className="text-gray-600 dark:text-gray-400">FastAPI + PostgreSQL/PostGIS</p>
            </div>
            <div className="rounded-lg border p-4 bg-white dark:bg-gray-800">
              <h3 className="font-semibold mb-2">Frontend</h3>
              <p className="text-gray-600 dark:text-gray-400">React + TypeScript + MapLibre</p>
            </div>
          </div>

          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">Data Sources & Attribution</h2>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>• Open-Meteo: <a href="https://open-meteo.com" className="text-blue-600 hover:underline" target="_blank" rel="noopener">open-meteo.com</a> (CC-BY-4.0)</p>
              <p>• Copernicus DEM: <a href="https://spacedata.copernicus.eu" className="text-blue-600 hover:underline" target="_blank" rel="noopener">spacedata.copernicus.eu</a> (Copernicus Free License)</p>
              <p>• SoilGrids: <a href="https://soilgrids.org" className="text-blue-600 hover:underline" target="_blank" rel="noopener">soilgrids.org</a> (CC-BY-4.0, ISRIC)</p>
              <p>• ESA WorldCover: <a href="https://viewer.esa-worldcover.org" className="text-blue-600 hover:underline" target="_blank" rel="noopener">esa-worldcover.org</a> (CC-BY-4.0)</p>
              <p>• OpenStreetMap: <a href="https://openstreetmap.org" className="text-blue-600 hover:underline" target="_blank" rel="noopener">openstreetmap.org</a> (ODbL)</p>
              <p>• WorldPop: <a href="https://worldpop.org" className="text-blue-600 hover:underline" target="_blank" rel="noopener">worldpop.org</a> (CC-BY-4.0)</p>
              <p>• EM-DAT: <a href="https://emdat.be" className="text-blue-600 hover:underline" target="_blank" rel="noopener">emdat.be</a> (Open Access, CRED/UCLouvain)</p>
              <p>• GADM: <a href="https://gadm.org" className="text-blue-600 hover:underline" target="_blank" rel="noopener">gadm.org</a> (Free for non-commercial)</p>
            </div>
          </div>

          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-4">License</h2>
            <p className="text-gray-600 dark:text-gray-400">
              This project is developed for SIH 26192. All data sources retain their original licenses.
              Please refer to individual data source licenses for usage terms.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;