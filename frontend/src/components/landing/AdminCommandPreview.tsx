import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Compass,
  Terminal,
} from 'lucide-react';
import { DataHonestyBadge } from './DataHonestyBadge';

interface IncidentItem {
  id: string;
  location: string;
  source: string;
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'PENDING VERIFICATION' | 'DISPATCHED' | 'RESOLVED';
  timeAgo: string;
  people: number;
  flowRate: string;
}

const INCIDENTS: IncidentItem[] = [
  {
    id: 'INC-084',
    location: 'Chooralmala Riverbank Road (Ward 04)',
    source: 'Culvert Sensor Node & Camera 02',
    level: 'CRITICAL',
    status: 'DISPATCHED',
    timeAgo: '4 min ago',
    people: 85,
    flowRate: 'Rising +52 cm/h',
  },
  {
    id: 'INC-082',
    location: 'Mundakkai Escarpment Trail',
    source: 'Citizen SOS Geolocation Pin',
    level: 'CRITICAL',
    status: 'PENDING VERIFICATION',
    timeAgo: '11 min ago',
    people: 14,
    flowRate: 'Debris Flow Torrent',
  },
  {
    id: 'INC-079',
    location: 'Meppadi Primary Health Centre Road',
    source: 'Hydrological Simulation Grid Cell #182',
    level: 'HIGH',
    status: 'DISPATCHED',
    timeAgo: '28 min ago',
    people: 210,
    flowRate: 'Overtopping Culvert',
  },
  {
    id: 'INC-075',
    location: 'Vythiri Highland Access Bridge',
    source: 'AWS Rain Gauge (48mm/1h exceedance)',
    level: 'MEDIUM',
    status: 'RESOLVED',
    timeAgo: '1h 14m ago',
    people: 40,
    flowRate: 'Freeboard Normalizing',
  },
];

export const AdminCommandPreview: React.FC = () => {
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH'>('ALL');
  const [activeIncidents] = useState<IncidentItem[]>(INCIDENTS);

  const filtered =
    selectedRiskFilter === 'ALL'
      ? activeIncidents
      : activeIncidents.filter((i) => i.level === selectedRiskFilter);

  return (
    <section className="relative py-20 sm:py-28 bg-[#181A1E] border-t border-[#2A2D35] text-[#FAF9F6] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-10 space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 shadow-2xs text-white">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4F826] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#9BBD00]"></span>
              </span>
              <span className="text-[11px] font-mono font-semibold tracking-wider uppercase">
                ADMIN DISPATCH &amp; RESCUE INCIDENT CONSOLE
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 border-l border-white/20 pl-2 hidden sm:inline">
              DISTRICT EOC 1077 · DIRECT NDRF / KSDMA DISPATCH
            </span>
          </div>

          <h2 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.08]">
            OPERATIONAL <br />
            <span className="italic font-normal font-serif text-[#D4F826] underline decoration-white/30 decoration-4 underline-offset-8">
              COMMAND CENTER.
            </span>
          </h2>

          <p className="font-sans text-base sm:text-lg text-slate-300 leading-relaxed pt-1">
            Certified disaster managers triage live sensor anomalies, verify incoming citizen SOS pins, 
            and coordinate emergency response teams across the Wayanad topography in real time.
          </p>
        </div>

        {/* Command Center Mockup Screen - Tactical Dark Container */}
        <div className="rounded-3xl bg-[#121316] border border-[#2B2E37] p-6 sm:p-8 space-y-6 shadow-2xl">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
              </div>
              <div className="font-mono text-xs sm:text-sm font-bold text-white tracking-wider">
                DISTRICT EOC 1077 · DISASTER RESPONSE DASHBOARD
              </div>
            </div>

            {/* Risk Filters */}
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-slate-400 text-[10px] hidden sm:inline">FILTER RISK:</span>
              <button
                onClick={() => setSelectedRiskFilter('ALL')}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  selectedRiskFilter === 'ALL'
                    ? 'bg-white text-[#181A1E] font-bold'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                ALL (4)
              </button>
              <button
                onClick={() => setSelectedRiskFilter('CRITICAL')}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  selectedRiskFilter === 'CRITICAL'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                CRITICAL (2)
              </button>
              <button
                onClick={() => setSelectedRiskFilter('HIGH')}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  selectedRiskFilter === 'HIGH'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                HIGH (1)
              </button>
            </div>
          </div>

          {/* Incident Table */}
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase text-[10.5px]">
                  <th className="pb-3 font-semibold">TICKET &amp; LOCATION</th>
                  <th className="pb-3 font-semibold">SOURCE</th>
                  <th className="pb-3 font-semibold">SEVERITY</th>
                  <th className="pb-3 font-semibold">STATUS</th>
                  <th className="pb-3 font-semibold">EXPOSED POP</th>
                  <th className="pb-3 font-semibold">TELEMETRY</th>
                  <th className="pb-3 font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((inc) => (
                  <tr key={inc.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3.5 pl-0">
                      <div className="font-bold text-white">{inc.id}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{inc.location}</div>
                    </td>
                    <td className="p-3.5 text-slate-300">{inc.source}</td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          inc.level === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : inc.level === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-500/20 text-slate-300 border border-slate-500/40'
                        }`}
                      >
                        {inc.level}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {inc.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-200">{inc.people} persons</td>
                    <td className="p-3.5 text-slate-400">{inc.flowRate}</td>
                    <td className="p-3.5 text-right">
                      <Link
                        to="/app"
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors"
                      >
                        <span>Triage</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="text-xs font-mono text-slate-400">
              Live multi-agency feed connected to Wayanad District Control Room (1077).
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/app/map"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-mono text-xs font-bold transition-all border border-white/15"
              >
                <Compass className="h-3.5 w-3.5 text-[#D4F826]" />
                <span>3D SITUATIONAL MAP</span>
              </Link>

              <Link
                to="/app"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D4F826] hover:bg-[#c2e420] text-[#181A1E] font-mono text-xs font-bold shadow-md transition-all"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>LAUNCH COMMAND CENTER</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminCommandPreview;
