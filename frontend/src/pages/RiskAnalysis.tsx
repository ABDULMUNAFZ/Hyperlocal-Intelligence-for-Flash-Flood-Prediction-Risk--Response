// FloodGuard Risk Analysis Page
import React from 'react';
import { DataStatusPanel } from '../components/DataStatusPanel';

const RiskAnalysis: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Risk Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Hyperlocal flood risk estimation for South India
        </p>
      </div>

      <DataStatusPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border p-6 bg-gray-50 dark:bg-gray-800/50">
          <h2 className="text-xl font-semibold mb-4">Risk Map</h2>
          <div className="aspect-video rounded border bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
            Risk visualization map (MapLibre integration pending)
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h3 className="font-semibold mb-3">Risk Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>High Risk Areas</span><span className="font-medium text-red-600">12.5%</span></div>
              <div className="flex justify-between"><span>Moderate Risk</span><span className="font-medium text-yellow-600">28.3%</span></div>
              <div className="flex justify-between"><span>Low Risk</span><span className="font-medium text-green-600">59.2%</span></div>
            </div>
          </div>

          <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
            <h3 className="font-semibold mb-3">Top Risk Factors</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between"><span>Rainfall Intensity</span><span className="font-medium">45%</span></li>
              <li className="flex justify-between"><span>Steep Terrain</span><span className="font-medium">30%</span></li>
              <li className="flex justify-between"><span>Soil Saturation</span><span className="font-medium">15%</span></li>
              <li className="flex justify-between"><span>Land Cover</span><span className="font-medium">10%</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-6 bg-white dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-4">Regional Risk Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">State</th>
                <th className="pb-2">Max Risk</th>
                <th className="pb-2">Mean Risk</th>
                <th className="pb-2">High Risk %</th>
                <th className="pb-2">Affected Pop.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="py-2 font-medium">Kerala</td><td className="py-2">0.89</td><td className="py-2">0.42</td><td className="py-2 text-red-600">18.2%</td><td className="py-2">1.2M</td></tr>
              <tr><td className="py-2 font-medium">Karnataka</td><td className="py-2">0.82</td><td className="py-2">0.38</td><td className="py-2 text-red-600">14.5%</td><td className="py-2">980K</td></tr>
              <tr><td className="py-2 font-medium">Tamil Nadu</td><td className="py-2">0.76</td><td className="py-2">0.35</td><td className="py-2 text-yellow-600">11.8%</td><td className="py-2">850K</td></tr>
              <tr><td className="py-2 font-medium">Andhra Pradesh</td><td className="py-2">0.71</td><td className="py-2">0.31</td><td className="py-2 text-yellow-600">9.3%</td><td className="py-2">620K</td></tr>
              <tr><td className="py-2 font-medium">Telangana</td><td className="py-2">0.68</td><td className="py-2">0.29</td><td className="py-2 text-yellow-600">7.1%</td><td className="py-2">450K</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RiskAnalysis;