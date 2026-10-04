import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap, MQ, fitsViewport } from './story/gsap';
import {
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Send,
  Eye,
  Activity,
  History,
} from 'lucide-react';
import { DataHonestyBadge } from './DataHonestyBadge';
import { ScrollHeading } from './ScrollHeading';

export const HumanInTheLoopSection: React.FC = () => {
  const [decisionState, setDecisionState] = useState<'pending' | 'approved' | 'rejected' | 'escalated'>('pending');
  const [auditLog, setAuditLog] = useState<string[]>([]);

  const handleDecision = (action: 'approved' | 'rejected' | 'escalated') => {
    setDecisionState(action);
    const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    if (action === 'approved') {
      setAuditLog((prev) => [
        `[${time} IST] Officer Verified: ALERT-WAY-049 broadcast to 1,420 citizen devices in Chooralmala micro-zone.`,
        ...prev,
      ]);
    } else if (action === 'escalated') {
      setAuditLog((prev) => [
        `[${time} IST] Escalated to Wayanad District Disaster Management Authority (DDMA / 1077 EOC).`,
        ...prev,
      ]);
    } else {
      setAuditLog((prev) => [
        `[${time} IST] Alert ticket dismissed as transient surface spray / false positive.`,
        ...prev,
      ]);
    }
  };

  const handleReset = () => {
    setDecisionState('pending');
  };

  // Split-screen scene: the AI flag (left) arrives, then the officer console (right), then the VERIFIED stamp.
  const split = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = split.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(MQ.desktop, () => {
        const pin = fitsViewport(el, 100);
        gsap.set('[data-stamp]', { opacity: 0, scale: 2.4, rotate: -24 });
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: el, start: pin ? 'top top+=96' : 'top 85%', end: pin ? '+=110%' : 'top 20%', scrub: 0.7, pin },
        });
        tl.from('[data-ai-side]', { xPercent: -14, opacity: 0, filter: 'blur(8px)', duration: 0.6 })
          .from('[data-ai-row]', { y: 24, opacity: 0, stagger: 0.12, duration: 0.4 }, '<0.2')
          .from('[data-officer-side]', { xPercent: 14, opacity: 0, filter: 'blur(8px)', duration: 0.6 }, '-=0.2')
          .to('[data-stamp]', { opacity: 1, scale: 1, rotate: -12, duration: 0.4, ease: 'back.out(2.2)' }, '+=0.15')
          .to({}, { duration: 0.4 });
      });
      mm.add(MQ.mobile, () => {
        gsap.from('[data-stamp]', { opacity: 0, scale: 2, rotate: -24, duration: 0.6, ease: 'back.out(2)', scrollTrigger: { trigger: el, start: 'top 40%', once: true } });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative py-16 sm:py-24 pattern-triage-blueprint text-[#181A1E] overflow-hidden">
      <div className="max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Animated Scroll Heading with Human Verification Seal Accent */}
        <ScrollHeading
          badge="GOVERNANCE PRINCIPLE · HUMAN DECISION INTEGRITY"
          animationVariant="stamp"
          title="AI DETECTS."
          italicWord="HUMANS DECIDE."
          subtitle="Machine intelligence flags patterns, calculates overland velocities, and spots anomalies. Certified disaster-response officers review, verify, and authorize every single public alert before it reaches citizens."
        />

        {/* Governance Pipeline Flow Visualization */}
        <div data-reveal className="mb-12 p-6 rounded-3xl bg-white border border-[#E6E4DE] shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-center text-center text-xs font-mono">
            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
              <Eye className="h-4 w-4 text-violet-700 mx-auto mb-1.5" />
              <div className="text-[#141518] font-bold">1. SENSORS</div>
              <div className="text-[10px] text-[#6A6D75]">Cameras & Gauges</div>
            </div>

            <div className="hidden lg:flex justify-center text-[#A4A7B0]">➜</div>

            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
              <Activity className="h-4 w-4 text-blue-600 mx-auto mb-1.5" />
              <div className="text-[#141518] font-bold">2. CV ANOMALY</div>
              <div className="text-[10px] text-[#6A6D75]">92%+ Confidence</div>
            </div>

            <div className="hidden lg:flex justify-center text-[#A4A7B0]">➜</div>

            <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
              <ShieldAlert className="h-4 w-4 text-rose-600 mx-auto mb-1.5" />
              <div className="text-[#141518] font-bold">3. RISK ENGINE</div>
              <div className="text-[10px] text-[#6A6D75]">Cell Inundation Calc</div>
            </div>

            <div className="hidden lg:flex justify-center text-[#A4A7B0]">➜</div>

            <div className="p-3.5 rounded-2xl bg-[#DDD6EE] border border-[#C5BAE0] text-[#141518] shadow-xs font-bold">
              <UserCheck className="h-4 w-4 text-[#141518] mx-auto mb-1.5" />
              <div>4. ADMIN REVIEW</div>
              <div className="text-[10px] text-[#4A4356]">Certified Officer</div>
            </div>
          </div>
        </div>

        {/* Interactive Admin Verification Simulator */}
        <div ref={split} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Incident Dossier Evidence (7 cols) - White Porcelain Card */}
          <div data-ai-side className="relative lg:col-span-7 bg-white rounded-3xl border border-[#E6E4DE] p-6 space-y-5 shadow-sm">
            {/* VERIFIED stamp — lands at the end of the scene */}
            <div data-stamp className="pointer-events-none absolute right-6 top-16 z-10 rotate-[-12deg] rounded-2xl border-4 border-emerald-600 bg-white/85 px-4 py-2 text-center font-mono text-emerald-700 shadow-lg backdrop-blur-sm" aria-hidden="true">
              <div className="text-2xl font-black tracking-[0.2em]">VERIFIED</div>
              <div className="text-[9px] font-bold tracking-widest">BY A CERTIFIED OFFICER</div>
            </div>
            <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-ping" />
                <span className="font-mono font-bold text-sm text-[#141518]">
                  INCIDENT TICKET #WAY-2026-0819
                </span>
              </div>
              <DataHonestyBadge kind="MODEL" source="ML Ensemble + Radar" size="sm" />
            </div>

            {/* Target Area Details */}
            <div data-ai-row className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                <div className="text-[10px] text-[#6A6D75]">LOCATION ZONE</div>
                <div className="text-[#141518] font-bold mt-1">Chooralmala Bridge</div>
                <div className="text-[10px] text-[#6A6D75]">Vellarimala Drainage</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                <div className="text-[10px] text-[#6A6D75]">SURFACE RAIN RATE</div>
                <div className="text-violet-700 font-bold mt-1">82.5 mm / hr</div>
                <div className="text-[10px] text-[#6A6D75]">IMD AWS Station</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE] col-span-2 sm:col-span-1">
                <div className="text-[10px] text-[#6A6D75]">WATER LEVEL SURGE</div>
                <div className="text-rose-700 font-bold mt-1">+0.48m in 15m</div>
                <div className="text-[10px] text-[#6A6D75]">Acoustic River Gauge</div>
              </div>
            </div>

            {/* Correlated Evidence Matrix */}
            <div data-ai-row className="p-4 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE] space-y-3">
              <div className="text-xs font-mono font-bold text-[#141518] flex items-center justify-between">
                <span>MULTI-SIGNAL CORRELATION REPORT</span>
                <span className="text-emerald-700 font-bold">MATCH CONFIDENCE: 94.2%</span>
              </div>

              <div className="space-y-2 text-xs text-[#4A4D54]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-none" />
                  <span><strong>Optical Camera CAM-03:</strong> Optical velocity tracking detects rapid turbid water rise approaching bridge soffit.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-none" />
                  <span><strong>Doppler Radar Reflectivity:</strong> 52 dBZ convective cloud cell hovering stationary over Chembra watershed.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-none" />
                  <span><strong>Historical Analogy Engine:</strong> 89% topological correlation with the July 2024 Chooralmala flash event.</span>
                </div>
              </div>
            </div>

            {/* Exposure Assessment */}
            <div data-ai-row className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
              <div className="text-rose-950">
                <strong className="text-rose-800">Estimated Exposed Population:</strong> 1,420 residents · 380 homes within 400m stream buffer
              </div>
              <div className="font-mono text-rose-700 font-bold">HIGH RISK</div>
            </div>
          </div>

          {/* Officer Decision Console (5 cols) - Lavender Asymmetric Card */}
          <div data-officer-side className="lg:col-span-5 bg-[#EFEBF7] rounded-3xl asymmetric-card-top-right border border-[#DDD6EE] p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD6EE]">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-violet-700" />
                <h3 className="font-display font-bold text-sm text-[#141518]">
                  DISASTER OFFICER DECISION
                </h3>
              </div>
              <span className="text-[10px] font-mono text-white bg-[#141518] px-2.5 py-0.5 rounded-full font-bold">
                AUTH: CERTIFIED
              </span>
            </div>

            {decisionState === 'pending' ? (
              <div className="space-y-4">
                <div className="text-xs text-[#4A4D54] leading-relaxed">
                  Review the evidence on the left. Certified officers have sole authority to dispatch warnings or declare false alarms:
                </div>

                <div className="space-y-2.5">
                  {/* Option 1: Approve and Broadcast (Obsidian pill button) */}
                  <button
                    onClick={() => handleDecision('approved')}
                    className="w-full flex items-center justify-between p-4 rounded-full bg-[#141518] hover:bg-[#252830] text-white font-bold text-xs shadow-md transition-all text-left"
                  >
                    <div>
                      <div>APPROVE & BROADCAST WARNING</div>
                      <div className="text-[10px] font-normal opacity-80">
                        Dispatches push alert to 1,420 citizen phones in zone
                      </div>
                    </div>
                    <Send className="h-4 w-4" />
                  </button>

                  {/* Option 2: Escalate to District Collectorate */}
                  <button
                    onClick={() => handleDecision('escalated')}
                    className="w-full flex items-center justify-between p-3.5 rounded-full bg-white hover:bg-[#FAF9F6] border border-[#DDD6EE] text-[#141518] font-bold text-xs shadow-xs transition-all text-left"
                  >
                    <div>
                      <div>ESCALATE TO DISTRICT DDMA (1077)</div>
                      <div className="text-[10px] font-normal text-[#6A6D75]">
                        Routes to Kerala State Disaster Management Authority
                      </div>
                    </div>
                    <AlertOctagon className="h-4 w-4 text-amber-600" />
                  </button>

                  {/* Option 3: Dismiss as False Positive */}
                  <button
                    onClick={() => handleDecision('rejected')}
                    className="w-full flex items-center justify-between p-3 rounded-full hover:bg-white/60 text-[#6A6D75] hover:text-[#141518] font-mono text-xs transition-all text-left"
                  >
                    <div>
                      <div>DISMISS (FALSE POSITIVE)</div>
                      <div className="text-[9.5px] opacity-75">
                        Log non-emergency anomaly for model recalibration
                      </div>
                    </div>
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Decision Confirmation State */
              <div className="p-5 rounded-2xl bg-white border border-[#DDD6EE] text-center space-y-3 shadow-xs">
                <div
                  className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center ${
                    decisionState === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : decisionState === 'escalated'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {decisionState === 'approved' ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : decisionState === 'escalated' ? (
                    <AlertOctagon className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                </div>

                <div className="font-display font-bold text-[#141518] text-base">
                  {decisionState === 'approved' && 'EARLY WARNING BROADCAST ACTIVATED'}
                  {decisionState === 'escalated' && 'ESCALATED TO DISTRICT EOC (1077)'}
                  {decisionState === 'rejected' && 'TICKET DISMISSED & LOGGED'}
                </div>

                <div className="text-xs text-[#52555E]">
                  {decisionState === 'approved' &&
                    'Citizen PWA phones in Chooralmala micro-zone receive targeted turn-by-turn evacuation route to St. Joseph High School Relief Center.'}
                  {decisionState === 'escalated' &&
                    'Incident packet transmitted to District Collectorate and Kerala Fire & Rescue services.'}
                  {decisionState === 'rejected' &&
                    'Model flagged false alarm to prevent emergency alert fatigue among residents.'}
                </div>

                <button
                  onClick={handleReset}
                  className="px-5 py-2 rounded-full bg-[#141518] text-white hover:bg-[#252830] text-xs font-mono transition-all"
                >
                  Test Another Verification Scenario
                </button>
              </div>
            )}

            {/* Audit Log Box */}
            <div className="pt-3 border-t border-[#DDD6EE] text-[10.5px] font-mono space-y-1.5">
              <div className="text-[#6A6D75] flex items-center gap-1 font-bold">
                <History className="h-3 w-3 text-[#141518]" /> IMMUTABLE AUDIT LOG (POSTGRESQL):
              </div>
              {auditLog.length > 0 ? (
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {auditLog.map((log, i) => (
                    <div key={i} className="text-[#141518] font-medium leading-tight">
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[#92959E] italic">No action logged yet. Awaiting officer review.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
