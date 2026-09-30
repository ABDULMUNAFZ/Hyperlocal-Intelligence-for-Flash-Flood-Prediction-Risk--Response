import React, { useState } from 'react';
import {
  Bell,
  MapPin,
  Compass,
  CheckCircle2,
  Navigation,
  ShieldCheck,
  Radio,
  ArrowRight,
  PhoneCall,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DataHonestyBadge } from './DataHonestyBadge';
import { ScrollHeading } from './ScrollHeading';

export const MobileJourneySection: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLocating, setIsLocating] = useState(false);
  const [pinnedCoords, setPinnedCoords] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
    time: string;
  }>({
    lat: 11.5385,
    lon: 76.1720,
    accuracy: 8,
    time: 'Just now',
  });

  const steps = [
    {
      num: 1,
      title: 'Alert Received',
      tag: 'PREDICTIVE WARNING',
      desc: 'Citizen phone receives targeted high-priority notification: "Predictive flood surge expected in Chooralmala valley within 45 min."',
    },
    {
      num: 2,
      title: 'Citizen Opens Map',
      tag: 'ZONE OVERVIEW',
      desc: 'Map immediately displays: YOU (current location), RED DANGER ZONE (flood buffer), and GREEN SAFE AREA (high ground relief camp).',
    },
    {
      num: 3,
      title: 'Pin Location',
      tag: 'GPS FIX',
      desc: 'Citizen taps "PIN MY LOCATION". Browser Geolocation API captures high-accuracy latitude, longitude, altitude, and timestamp.',
    },
    {
      num: 4,
      title: 'Location Pinned',
      tag: 'COORDINATES SECURED',
      desc: 'Device confirms: "Location Pinned ±8m accuracy". User receives visual confirmation and emergency battery conservation tips.',
    },
    {
      num: 5,
      title: 'Admin Receives SOS',
      tag: 'DISPATCH QUEUE',
      desc: 'District Disaster Management Command Center receives emergency pin with exact coordinates, altitude, risk zone, and timestamp.',
    },
    {
      num: 6,
      title: 'Triage & Verification',
      tag: 'OFFICER TRIAGE',
      desc: 'Admin dashboard confirms citizen presence in imminent inundation cell and validates against live Doppler radar velocity.',
    },
    {
      num: 7,
      title: 'Rescue Assigned',
      tag: 'UNIT EN ROUTE',
      desc: 'Command center dispatches nearest Kerala Fire & Rescue or NDRF unit to the coordinates. Citizen phone updates: "Rescue Assigned".',
    },
    {
      num: 8,
      title: 'Evacuation Route',
      tag: 'TURN-BY-TURN',
      desc: 'Citizen screen displays dynamic high-ground route away from active stream channels toward Meppadi St. Joseph Relief Shelter.',
    },
    {
      num: 9,
      title: 'Moving to Safety',
      tag: 'LIVE TRACKING',
      desc: 'Device streams breadcrumb telemetry to rescue teams showing progress along designated safe ridge paths.',
    },
    {
      num: 10,
      title: 'Safe Arrival',
      tag: 'STATUS RESOLVED',
      desc: 'Citizen safely reaches relief shelter. GPS geofence confirms arrival. Emergency status transitions to SAFE.',
    },
  ];

  const handlePinLocation = () => {
    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPinnedCoords({
            lat: Math.round(pos.coords.latitude * 10000) / 10000,
            lon: Math.round(pos.coords.longitude * 10000) / 10000,
            accuracy: Math.round(pos.coords.accuracy),
            time: new Date().toLocaleTimeString(),
          });
          setIsLocating(false);
          setCurrentStep(4);
        },
        () => {
          // Fallback coordinates
          setPinnedCoords({
            lat: 11.5385,
            lon: 76.1720,
            accuracy: 8,
            time: new Date().toLocaleTimeString(),
          });
          setIsLocating(false);
          setCurrentStep(4);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setIsLocating(false);
      setCurrentStep(4);
    }
  };

  return (
    <section id="mobile-journey" className="relative py-20 sm:py-28 pattern-mobile-pathway border-t border-[#DDD9CE] text-[#181A1E] overflow-hidden">
      <div className="max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header (Authentic Clinical Capsule Style) */}
        <div className="max-w-3xl mb-10 space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#DDD9CE] shadow-2xs text-[#23252A]">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4F826] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#9BBD00]"></span>
              </span>
              <span className="text-[11px] font-mono font-semibold tracking-wider uppercase">
                SECTION 08 · CITIZEN LIFELINE · RAPID EVACUATION LOOP
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#7A7D87] border-l border-[#DDD9CE] pl-2 hidden sm:inline">
              OFFLINE-CAPABLE PWA · MULTI-LINGUAL (ENG / MALAYALAM)
            </span>
          </div>

          <h2 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-[#141518] tracking-tight leading-[1.08]">
            FROM WARNING TO SAFETY: <br />
            <span className="italic font-normal font-serif text-[#4A4740] underline decoration-[#D4F826] decoration-4 underline-offset-8">
              THE 10-STEP LIFESAVING LOOP.
            </span>
          </h2>

          <p className="font-sans text-base sm:text-lg text-[#4A4D54] leading-relaxed pt-1">
            The FloodGuard Citizen PWA gives residents immediate, actionable guidance: from the first predictive push notification, 
            to pinning exact GPS coordinates for rescue teams, to turn-by-turn safe navigation away from rising water.
          </p>
        </div>

        {/* Interactive Step Stepper & Phone Mockup Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Stepper Navigation Column (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE7DF] text-xs font-mono text-[#5A5D66]">
              <span>INTERACTIVE STEP-BY-STEP SIMULATION</span>
              <span>STEP {currentStep} OF 10</span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 no-scrollbar">
              {steps.map((st) => {
                const isActive = currentStep === st.num;
                const isPassed = currentStep > st.num;

                return (
                  <button
                    key={st.num}
                    onClick={() => setCurrentStep(st.num)}
                    className={`w-full p-3.5 rounded-2xl border text-left font-mono transition-all flex items-start gap-3 ${
                      isActive
                        ? 'bg-[#DDD6EE] border-[#C8BEE2] text-[#141518] shadow-xs'
                        : isPassed
                        ? 'bg-white border-[#E6E4DE] text-[#4A4D54] hover:bg-[#FAF9F6]'
                        : 'bg-white/60 border-[#E6E4DE]/60 text-[#828690] hover:bg-white'
                    }`}
                  >
                    <span
                      className={`flex-none w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive
                          ? 'bg-[#141518] text-white'
                          : isPassed
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isPassed ? '✓' : st.num}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isActive ? 'text-[#141518]' : 'text-[#333740]'}`}>
                          STEP {st.num}: {st.title}
                        </span>
                        <span className="text-[9.5px] opacity-75 font-sans font-semibold">
                          {st.tag}
                        </span>
                      </div>
                      <div className="text-[11px] font-sans text-[#52555E] mt-1 leading-normal line-clamp-2">
                        {st.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
                disabled={currentStep === 1}
                className="px-4 py-2 rounded-full bg-white hover:bg-[#FAF9F6] disabled:opacity-30 border border-[#E6E4DE] text-xs font-mono text-[#141518] shadow-xs"
              >
                Previous Step
              </button>
              <button
                onClick={() => setCurrentStep((p) => Math.min(10, p + 1))}
                disabled={currentStep === 10}
                className="px-5 py-2 rounded-full bg-[#141518] hover:bg-[#252830] disabled:opacity-30 text-xs font-mono font-bold text-white shadow-xs"
              >
                Next Step ➜
              </button>
              <button
                onClick={() => setCurrentStep(1)}
                className="p-2 rounded-full bg-white hover:bg-[#FAF9F6] border border-[#E6E4DE] text-[#6A6D75] hover:text-[#141518] shadow-xs"
                title="Restart simulation"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Realistic Mobile Device Mockup (6 cols) */}
          <div className="lg:col-span-6 flex justify-center">
            {/* Phone Outer Shell */}
            <div className="relative w-[310px] sm:w-[340px] aspect-[9/18.5] bg-[#141518] rounded-[44px] p-3.5 shadow-2xl border-4 border-[#23252A] ring-4 ring-[#E6E4DE]">
              {/* Dynamic Island / Speaker Notch */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-slate-800 mr-2" />
                <div className="h-2 w-2 rounded-full bg-violet-900" />
              </div>

              {/* Screen Content Container */}
              <div className="w-full h-full bg-[#F6F5F2] rounded-[34px] overflow-hidden flex flex-col justify-between relative pt-8 pb-4 px-3.5 border border-[#E6E4DE] text-[#141518]">
                {/* Device Status Bar */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[#6A6D75] pb-2 border-b border-[#E6E4DE]">
                  <span>09:41 AM</span>
                  <span className="flex items-center gap-1.5">
                    <span>5G</span>
                    <span className="text-emerald-700 font-bold">92%</span>
                  </span>
                </div>

                {/* Device Screen Body depending on Current Step */}
                <div className="flex-1 flex flex-col justify-center py-4 space-y-4">
                  {/* STEP 1: Incoming Alert */}
                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-rose-600 text-white shadow-xl space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <Radio className="h-3 w-3 animate-ping" /> EMERGENCY ALERT
                          </span>
                          <span>IMMEDIATE</span>
                        </div>
                        <div className="font-bold text-sm leading-tight">
                          PREDICTIVE FLASH-FLOOD WARNING
                        </div>
                        <div className="text-xs text-rose-100 leading-normal">
                          Risk rapidly escalating near Chooralmala bridge. Torrential surge expected within 45 min.
                        </div>
                        <button
                          onClick={() => setCurrentStep(2)}
                          className="w-full py-2.5 rounded-full bg-white text-rose-950 font-bold text-xs shadow-md mt-2 flex items-center justify-center gap-1.5"
                        >
                          <span>TAP TO OPEN EMERGENCY MAP</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Map Overview */}
                  {currentStep === 2 && (
                    <div className="space-y-3">
                      <div className="text-xs font-mono font-bold text-[#141518]">
                        EMERGENCY MAP OVERVIEW
                      </div>
                      <div className="relative aspect-[4/3] bg-white rounded-2xl border border-[#E6E4DE] p-3 flex flex-col justify-between overflow-hidden shadow-inner">
                        <div className="absolute inset-0 light-contour-lines opacity-40" />

                        {/* Visual Danger Zone */}
                        <div className="absolute inset-x-4 top-8 bottom-12 rounded-2xl bg-rose-500/15 border-2 border-dashed border-rose-500 flex items-center justify-center">
                          <span className="text-[10px] font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                            FLOOD DANGER ZONE
                          </span>
                        </div>

                        {/* User Pin */}
                        <div className="relative z-10 flex items-center gap-1.5 text-xs text-[#141518]">
                          <span className="h-3 w-3 rounded-full bg-rose-600 animate-ping" />
                          <span className="font-bold font-mono text-[11px]">YOU (LOW-LYING GROUND)</span>
                        </div>

                        {/* Safe Camp Pin */}
                        <div className="relative z-10 self-end flex items-center gap-1.5 text-xs text-emerald-800 font-mono font-bold">
                          <ShieldCheck className="h-4 w-4" />
                          <span>ST. JOSEPH RELIEF CAMP (650m)</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setCurrentStep(3)}
                        className="w-full py-2.5 rounded-full bg-[#141518] hover:bg-[#252830] text-white font-mono font-bold text-xs shadow-md transition-all"
                      >
                        PROCEED TO LOCATION PIN ➜
                      </button>
                    </div>
                  )}

                  {/* STEP 3 & 4: Pin My Location */}
                  {(currentStep === 3 || currentStep === 4) && (
                    <div className="space-y-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-[#DDD6EE] text-[#141518] flex items-center justify-center mx-auto">
                        <MapPin className="h-6 w-6" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-[#141518] text-sm">
                          {currentStep === 3 ? 'PIN RESCUE LOCATION' : 'LOCATION PINNED SECURELY'}
                        </h4>
                        <p className="text-xs text-[#52555E] leading-normal">
                          {currentStep === 3
                            ? 'Capture your high-precision device coordinates to alert emergency responders.'
                            : 'Coordinates locked with verified GPS fix. Transmitting to District EOC.'}
                        </p>
                      </div>

                      {currentStep === 3 ? (
                        <button
                          onClick={handlePinLocation}
                          disabled={isLocating}
                          className="w-full py-3 rounded-full bg-[#141518] hover:bg-[#252830] text-white font-mono font-bold text-xs shadow-md flex items-center justify-center gap-2"
                        >
                          <Compass className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />
                          <span>{isLocating ? 'LOCKING SATELLITES...' : 'PIN MY LOCATION'}</span>
                        </button>
                      ) : (
                        <div className="p-3 rounded-2xl bg-white border border-[#DDD6EE] text-left font-mono text-[11px] space-y-1 shadow-xs">
                          <div className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> PIN SECURED
                          </div>
                          <div className="text-[#333740]">LAT: {pinnedCoords.lat}° N</div>
                          <div className="text-[#333740]">LON: {pinnedCoords.lon}° E</div>
                          <div className="text-[#6A6D75] text-[10px]">ACCURACY: ±{pinnedCoords.accuracy}m · {pinnedCoords.time}</div>
                          <button
                            onClick={() => setCurrentStep(5)}
                            className="w-full mt-2 py-2 rounded-full bg-emerald-700 text-white font-bold text-[11px]"
                          >
                            CONFIRM & DISPATCH SOS ➜
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 5 & 6: Dispatch Sync & Admin View */}
                  {(currentStep === 5 || currentStep === 6) && (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="p-4 rounded-2xl bg-white border border-[#E6E4DE] space-y-2 shadow-xs">
                        <div className="text-[#6A6D75] text-[10px]">DISPATCH CONSOLE #WAY-EOC</div>
                        <div className="text-[#141518] font-bold text-sm">EMERGENCY SOS RECEIVED</div>
                        <div className="text-[#4A4D54] space-y-1 text-[11px]">
                          <div>USER: Citizen (Wayanad PWA)</div>
                          <div>LOCATION: {pinnedCoords.lat}°N, {pinnedCoords.lon}°E</div>
                          <div>RISK ZONE: Chooralmala Core</div>
                          <div>STATUS: <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.5 rounded-full">PINNED</span></div>
                        </div>
                      </div>

                      <button
                        onClick={() => setCurrentStep(7)}
                        className="w-full py-2.5 rounded-full bg-[#141518] text-white font-bold text-xs shadow-md"
                      >
                        SIMULATE RESCUE ASSIGNMENT ➜
                      </button>
                    </div>
                  )}

                  {/* STEP 7: Rescue Assigned */}
                  {currentStep === 7 && (
                    <div className="space-y-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-[#DDD6EE] text-[#141518] flex items-center justify-center mx-auto">
                        <UserCheck className="h-6 w-6" />
                      </div>

                      <div>
                        <h4 className="font-bold text-[#141518] text-sm">RESCUE TEAM ASSIGNED</h4>
                        <p className="text-xs text-[#52555E] mt-1">
                          Kerala Fire & Rescue Team Beta-3 dispatched to your quadrant.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-white border border-[#E6E4DE] text-left text-xs font-mono space-y-1 shadow-xs">
                        <div className="text-emerald-700 font-bold">TEAM: Beta-3 (4 Responders)</div>
                        <div className="text-[#333740]">ESTIMATED ETA: ~18 min</div>
                        <div className="text-[#6A6D75] text-[10px]">VEHICLE: 4x4 Quick Response Unit</div>
                      </div>

                      <button
                        onClick={() => setCurrentStep(8)}
                        className="w-full py-2.5 rounded-full bg-[#141518] text-white font-mono font-bold text-xs shadow-md"
                      >
                        VIEW SAFE EVACUATION ROUTE ➜
                      </button>
                    </div>
                  )}

                  {/* STEP 8 & 9: Moving to Safety */}
                  {(currentStep === 8 || currentStep === 9) && (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="p-4 rounded-2xl bg-white border border-[#E6E4DE] space-y-2 shadow-xs">
                        <div className="flex items-center justify-between text-violet-700 font-bold">
                          <span className="flex items-center gap-1.5">
                            <Navigation className="h-4 w-4" /> SAFE NAVIGATION
                          </span>
                          <span>420m LEFT</span>
                        </div>
                        <div className="text-[#141518] text-sm font-bold">
                          HEAD NORTH-EAST TO ELEVATED RIDGE
                        </div>
                        <div className="text-[#52555E] text-[11px]">
                          Avoid bridge underpass. Take high tea garden path to St. Joseph School.
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
                          <div className="h-full bg-emerald-600 w-3/4 animate-pulse" />
                        </div>
                      </div>

                      <button
                        onClick={() => setCurrentStep(10)}
                        className="w-full py-2.5 rounded-full bg-emerald-700 text-white font-bold text-xs shadow-md"
                      >
                        MARK ARRIVED AT SAFE DESTINATION ➜
                      </button>
                    </div>
                  )}

                  {/* STEP 10: Safe */}
                  {currentStep === 10 && (
                    <div className="space-y-4 text-center">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto border-2 border-emerald-500">
                        <ShieldCheck className="h-8 w-8" />
                      </div>

                      <div>
                        <h4 className="font-display font-extrabold text-[#141518] text-base">
                          YOU ARE SAFE
                        </h4>
                        <p className="text-xs text-[#52555E] mt-1">
                          Arrived at St. Joseph High School Relief Center. District EOC marked incident status as SAFE.
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-white border border-[#DDD6EE] font-mono text-[11px] text-emerald-800 shadow-xs">
                        Incident #WAY-2026-0819 marked RESOLVED in audit database.
                      </div>

                      <button
                        onClick={() => setCurrentStep(1)}
                        className="w-full py-2 rounded-full bg-[#141518] text-white hover:bg-[#252830] text-xs font-mono"
                      >
                        Restart 10-Step Journey Simulation
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom App Bar */}
                <div className="pt-2 border-t border-[#E6E4DE] flex items-center justify-around text-[#6A6D75] text-[10px] font-mono">
                  <span className="text-[#141518] font-bold">EMERGENCY PWA</span>
                  <span>·</span>
                  <Link to="/emergency" className="text-rose-700 font-bold hover:underline">
                    OPEN REAL CITIZEN APP ↗
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
