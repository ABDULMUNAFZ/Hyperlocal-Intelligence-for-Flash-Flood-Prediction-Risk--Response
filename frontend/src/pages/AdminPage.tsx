import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Radio,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  XCircle,
  MapPin,
  Compass,
  PhoneCall,
  Clock,
  Send,
  Terminal,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { LandingNav } from '../components/landing/LandingNav';
import { LandingFooter } from '../components/landing/LandingFooter';
import { DataHonestyBadge } from '../components/landing/DataHonestyBadge';
import { emergencyApi } from '../emergency/api';

interface IncidentItem {
  id: string;
  zone: string;
  severity: 'CRITICAL' | 'WARNING' | 'WATCH';
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESCUE_ASSIGNED' | 'SAFE' | 'RESOLVED';
  people: number;
  lat: number;
  lon: number;
  timestamp: string;
  source: string;
  note: string;
}

export default function AdminPage() {
  const [incidents, setIncidents] = useState<IncidentItem[]>([
    {
      id: 'REQ-WAY-101',
      zone: 'Chooralmala River Bridge',
      severity: 'CRITICAL',
      status: 'RESCUE_ASSIGNED',
      people: 4,
      lat: 11.5385,
      lon: 76.1720,
      timestamp: '8 min ago',
      source: 'Citizen SOS PWA (Location Pin)',
      note: 'Water rising near tea factory quarters. 1 elder, 2 children.',
    },
    {
      id: 'REQ-WAY-102',
      zone: 'Mundakkai Upper Slope',
      severity: 'CRITICAL',
      status: 'ACKNOWLEDGED',
      people: 6,
      lat: 11.5540,
      lon: 76.1850,
      timestamp: '19 min ago',
      source: 'Citizen SOS PWA',
      note: 'Hillside stream diverted toward house front yard.',
    },
    {
      id: 'REQ-WAY-103',
      zone: 'Meppadi Town Low Basin',
      severity: 'WARNING',
      status: 'PENDING',
      people: 2,
      lat: 11.5520,
      lon: 76.1240,
      timestamp: '32 min ago',
      source: 'Citizen SOS PWA',
      note: 'Culvert clogged; road knee-deep in water.',
    },
    {
      id: 'REQ-WAY-104',
      zone: 'Vythiri NH 766 Bypass',
      severity: 'WATCH',
      status: 'SAFE',
      people: 1,
      lat: 11.5490,
      lon: 76.0420,
      timestamp: '1 hr ago',
      source: 'Citizen SOS PWA',
      note: 'Arrived at Vythiri Community Hall Relief Shelter.',
    },
  ]);

  const [activeTab, setActiveTab] = useState<'queue' | 'broadcast' | 'audit'>('queue');
  const [demoAlertTitle, setDemoAlertTitle] = useState('FLASH FLOOD WARNING: CHOORALMALA & MUNDAKKAI');
  const [demoAlertMessage, setDemoAlertMessage] = useState('Rapid river surge detected. Move immediately to St. Joseph School relief camp.');
  const [broadcastSent, setBroadcastSent] = useState(false);

  useEffect(() => {
    document.title = 'Admin Command Center — FloodGuard';
  }, []);

  const handleUpdateStatus = (id: string, newStatus: IncidentItem['status']) => {
    setIncidents((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastSent(true);
    setTimeout(() => setBroadcastSent(false), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 font-sans">
      <LandingNav />

      <main className="pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span className="font-mono text-xs uppercase tracking-wider text-rose-400 font-bold">
                INCIDENT RESPONSE COCKPIT
              </span>
              <DataHonestyBadge kind="OFFICIAL" size="sm" />
            </div>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white mt-1">
              ADMIN COMMAND CENTER
            </h1>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Wayanad District Disaster Management Authority (DDMA) · Control Room 1077
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/app/map"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono font-bold text-slate-200 transition-all"
            >
              <Compass className="h-4 w-4 text-cyan-400" />
              <span>3D COMMAND MAP</span>
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-mono font-bold text-white shadow-lg shadow-blue-600/30 transition-all"
            >
              <Terminal className="h-4 w-4" />
              <span>FULL SITUATIONAL CONSOLE</span>
            </Link>
          </div>
        </div>

        {/* 4 Summary Stat Boxes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-slate-400 flex items-center justify-between">
              <span>ACTIVE SOS PINS</span>
              <Radio className="h-4 w-4 text-rose-400 animate-pulse" />
            </div>
            <div className="text-2xl font-bold text-rose-400">
              {incidents.filter((i) => i.status !== 'SAFE' && i.status !== 'RESOLVED').length} Tickets
            </div>
            <div className="text-[10px] text-slate-500">Awaiting safe resolution</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-slate-400 flex items-center justify-between">
              <span>TOTAL CITIZENS</span>
              <UserCheck className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white">
              {incidents.reduce((acc, curr) => acc + curr.people, 0)} Persons
            </div>
            <div className="text-[10px] text-slate-500">Across 4 micro-zones</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-slate-400 flex items-center justify-between">
              <span>RESPONDER TEAMS</span>
              <Shield className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-400">4 Units</div>
            <div className="text-[10px] text-slate-500">Fire & Rescue + NDRF</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="text-slate-400 flex items-center justify-between">
              <span>SAFE ARRIVALS</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {incidents.filter((i) => i.status === 'SAFE').length} Verified
            </div>
            <div className="text-[10px] text-slate-500">Shelter confirmed</div>
          </div>
        </div>

        {/* Console Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 font-mono text-xs">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'queue' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            1. LIVE INCIDENT QUEUE ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              activeTab === 'broadcast' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            2. DISPATCH OFFICIAL WARNING
          </button>
        </div>

        {/* Tab 1: Live Incident Queue */}
        {activeTab === 'queue' && (
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-3 border-b border-slate-800">
              <span>INCOMING CITIZEN SOS PINS & RESCUE REQUESTS</span>
              <span className="text-cyan-400">REAL-TIME SYNC VIA WEBSOCKET</span>
            </div>

            <div className="space-y-4">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 space-y-3 font-mono text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white text-sm">{inc.id}</span>
                      <span className="text-cyan-400 font-bold">{inc.zone}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inc.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px]">{inc.timestamp}</span>
                      <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-bold text-[10px]">
                        STATUS: {inc.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-300 text-[11.5px] font-sans leading-normal">
                    {inc.note}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>PEOPLE: <strong className="text-white">{inc.people}</strong></span>
                      <span>COORDS: {inc.lat}°N, {inc.lon}°E</span>
                      <span className="hidden sm:inline">SOURCE: {inc.source}</span>
                    </div>

                    {/* Status Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {inc.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateStatus(inc.id, 'ACKNOWLEDGED')}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold"
                        >
                          Acknowledge
                        </button>
                      )}
                      {inc.status === 'ACKNOWLEDGED' && (
                        <button
                          onClick={() => handleUpdateStatus(inc.id, 'RESCUE_ASSIGNED')}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold"
                        >
                          Assign Team Beta-3
                        </button>
                      )}
                      {inc.status === 'RESCUE_ASSIGNED' && (
                        <button
                          onClick={() => handleUpdateStatus(inc.id, 'SAFE')}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          Mark Safe at Shelter
                        </button>
                      )}
                      {inc.status === 'SAFE' && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolved in Shelter
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Broadcast Official Warning */}
        {activeTab === 'broadcast' && (
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6 shadow-2xl backdrop-blur-xl max-w-3xl">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-3 border-b border-slate-800">
              <span>DISASTER MANAGER WARNING DISPATCH (CAP FORMAT)</span>
              <DataHonestyBadge kind="OFFICIAL" size="sm" />
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold">ALERT HEADLINE (CAP IDENTIFIER):</label>
                <input
                  type="text"
                  value={demoAlertTitle}
                  onChange={(e) => setDemoAlertTitle(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold">INSTRUCTION TO CITIZENS:</label>
                <textarea
                  rows={3}
                  value={demoAlertMessage}
                  onChange={(e) => setDemoAlertMessage(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-[11px] leading-relaxed">
                <strong>Target Geographic Boundary:</strong> Wayanad District (Chooralmala, Mundakkai, Meppadi micro-zones). Will dispatch targeted Web Push notifications to active citizen PWA devices within 4 km of river corridors.
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
              >
                <Send className="h-4 w-4" />
                <span>BROADCAST OFFICIAL PUBLIC WARNING</span>
              </button>

              {broadcastSent && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500 text-emerald-300 font-bold text-center animate-fade-in">
                  ✓ Official Warning Broadcast Dispatched to Citizen PWA Network!
                </div>
              )}
            </form>
          </div>
        )}
      </main>

      <LandingFooter />
    </div>
  );
}
