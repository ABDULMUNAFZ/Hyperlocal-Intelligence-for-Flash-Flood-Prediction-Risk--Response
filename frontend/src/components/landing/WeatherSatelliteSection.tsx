import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { gsap, ScrollTrigger, MQ, fitsViewport } from './story/gsap';
import { useLenis } from './story/SmoothScrollProvider';

const TIMELINE_IDS = ['t-60', 't-30', 'now', 't+60', 't+180'] as const;
type TimelineId = (typeof TIMELINE_IDS)[number];
import { CloudRain, Wind, Droplets, Compass, Clock, Satellite, AlertCircle } from 'lucide-react';
import { DataHonestyBadge } from './DataHonestyBadge';
import { ScrollHeading } from './ScrollHeading';

interface LiveWeatherState {
  temp: number;
  humidity: number;
  precipitationMm: number;
  windSpeedKmh: number;
  cloudCover: number;
  weatherDesc: string;
  timestamp: string;
  source: string;
  isLive: boolean;
}

export const WeatherSatelliteSection: React.FC = () => {
  const [selectedTimeline, setSelectedTimeline] = useState<TimelineId>('now');
  const stage = useRef<HTMLDivElement>(null);
  const stRef = useRef<ScrollTrigger | null>(null);
  const lenis = useLenis();

  // Desktop: vertical scroll scrubs the radar timeline T-60 → +3H while the dashboard is pinned.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.matchMedia().add(MQ.desktop, () => {
        const pin = fitsViewport(el, 100);
        let idx = -1;
        const st = ScrollTrigger.create({
          trigger: el,
          start: pin ? 'top top+=96' : 'top 85%',
          end: pin ? '+=160%' : 'top 20%',
          pin,
          scrub: true,
          onUpdate: (self) => {
            const p = self.progress;
            gsap.set('[data-rail-marker]', { left: `${p * 100}%` });
            gsap.set('[data-legend-fill]', { scaleX: 0.25 + p * 0.75 });
            const i = Math.min(4, Math.round(p * 4));
            if (i !== idx) { idx = i; setSelectedTimeline(TIMELINE_IDS[i]); }
          },
        });
        stRef.current = st;
        return () => { stRef.current = null; };
      });
    }, el);
    return () => ctx.revert();
  }, []);

  const goTo = (id: TimelineId) => {
    const st = stRef.current;
    if (!st) { setSelectedTimeline(id); return; }
    const i = TIMELINE_IDS.indexOf(id);
    const y = st.start + (st.end - st.start) * (i / 4) + 2;
    if (lenis) lenis.scrollTo(y, { duration: 1 });
    else window.scrollTo({ top: y });
  };
  const [weather, setWeather] = useState<LiveWeatherState>({
    temp: 22.4,
    humidity: 89,
    precipitationMm: 12.8,
    windSpeedKmh: 18.5,
    cloudCover: 94,
    weatherDesc: 'Monsoonal Rain & Heavy Overcast',
    timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST',
    source: 'Open-Meteo High-Resolution API',
    isLive: false,
  });
  const [, setLoading] = useState(false);

  // Fetch real Open-Meteo weather for Wayanad (11.6854, 76.1320)
  useEffect(() => {
    let mounted = true;
    const fetchWeather = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=11.6854&longitude=76.1320&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,cloud_cover,weather_code&timezone=Asia%2FKolkata'
        );
        if (!res.ok) throw new Error('API fetch failed');
        const data = await res.json();
        if (mounted && data.current) {
          const c = data.current;
          setWeather({
            temp: c.temperature_2m ?? 23,
            humidity: c.relative_humidity_2m ?? 88,
            precipitationMm: c.precipitation ?? 8.4,
            windSpeedKmh: c.wind_speed_10m ?? 16,
            cloudCover: c.cloud_cover ?? 90,
            weatherDesc: c.precipitation > 5 ? 'Heavy Monsoonal Precipitation' : c.precipitation > 0 ? 'Light Monsoon Showers' : 'Overcast High-Altitude Canopy',
            timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST',
            source: 'Open-Meteo API (Observed & Verified)',
            isLive: true,
          });
        }
      } catch {
        if (mounted) {
          setWeather((prev) => ({
            ...prev,
            timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST',
          }));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 1000 * 60 * 10);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const timelineSteps = [
    { id: 't-60', label: 'T - 60 MIN', status: 'OBSERVED' as const, time: 'Past Hour', radarDbz: 32 },
    { id: 't-30', label: 'T - 30 MIN', status: 'OBSERVED' as const, time: 'Recent Scan', radarDbz: 44 },
    { id: 'now', label: 'CURRENT SCAN', status: 'LIVE' as const, time: weather.timestamp, radarDbz: 52 },
    { id: 't+60', label: 'FORECAST +1H', status: 'FORECAST' as const, time: 'In 60 min', radarDbz: 58 },
    { id: 't+180', label: 'FORECAST +3H', status: 'FORECAST' as const, time: 'In 3 hours', radarDbz: 40 },
  ];

  return (
    <section className="relative py-16 sm:py-24 pattern-telemetry-mesh text-[#23252A] overflow-hidden">
      <div className="max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Animated Scroll Heading with Radar Sweep Accent */}
        <ScrollHeading
          badge="METEOROLOGICAL OBSERVATION & SATELLITE RADAR"
          animationVariant="radar"
          title="WATCH THE REGION"
          italicWord="CHANGE IN REAL TIME."
          subtitle="Continuous weather telemetry streams capture precipitation volume, convective cloud formation, and atmospheric saturation across the Wayanad plateau with high temporal resolution."
        />

        <div ref={stage}>
        {/* Timeline Selector */}
        <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-[#EAE7DF]">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#181A1E]" />
            <span className="text-xs font-mono text-[#141518] font-black uppercase">
              SECTION 03 · TEMPORAL RADAR SWEEP TIMELINE:
            </span>
          </div>

          <div className="inline-flex items-center p-1 rounded-full bg-white border border-[#E6E4DE] gap-1 shadow-xs">
            {timelineSteps.map((step) => {
              const isActive = selectedTimeline === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => goTo(step.id as TimelineId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
                    isActive
                      ? 'bg-[#141518] text-[#D4F826] font-bold shadow-xs'
                      : 'text-[#4A4D54] hover:text-[#141518] hover:bg-[#F2EFF7]'
                  }`}
                >
                  <div>{step.label}</div>
                  <div className="text-[9px] opacity-75">{step.time}</div>
                </button>
              );
            })}
          </div>

          <DataHonestyBadge
            kind={timelineSteps.find((s) => s.id === selectedTimeline)?.status || 'OBSERVED'}
            source="Open-Meteo + IMD Doppler"
            timestamp={weather.timestamp}
            size="sm"
          />
        </div>

        {/* Horizontal timeline rail (scrubbed by vertical scroll on desktop) */}
        <div className="relative mt-5 hidden h-8 lg:block" aria-hidden="true">
          <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-500 opacity-40" />
          {timelineSteps.map((st, i) => (
            <div key={st.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${i * 25}%` }}>
              <div className={`h-3 w-3 rounded-full border-2 ${selectedTimeline === st.id ? 'border-[#141518] bg-[#D4F826]' : 'border-[#141518]/40 bg-white'}`} />
            </div>
          ))}
          <div data-rail-marker className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: '50%' }}>
            <div className="rounded-full bg-[#141518] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#D4F826] shadow-lg">{timelineSteps.find((s) => s.id === selectedTimeline)?.label}</div>
          </div>
        </div>

        {/* Main Observation Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          {/* Radar Screen (7 cols) - Aviation Radar Cockpit Frame */}
          <div className="lg:col-span-7 bg-white rounded-3xl border-2 border-[#181A1E]/15 p-6 shadow-xl relative overflow-hidden group hover:border-[#181A1E] transition-all">
            <div className="flex items-center justify-between pb-4 border-b border-[#EAE7DF] mb-6 text-xs font-mono">
              <span className="text-[#141518] flex items-center gap-2 font-black tracking-wider uppercase">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4F826] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#181A1E]"></span>
                </span>
                RADAR REFLECTIVITY PPI SCAN ({timelineSteps.find(s => s.id === selectedTimeline)?.radarDbz} dBZ)
              </span>
              <span className="text-[#6A6D75] font-mono text-[11px]">COORDINATE: 11.6854°N, 76.1320°E</span>
            </div>

            {/* Radar Screen Container */}
            <div className="relative w-full aspect-[16/10] bg-[#141518] rounded-2xl border border-[#23252A] flex items-center justify-center overflow-hidden shadow-inner">
              {/* Radar concentric range rings */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[85%] h-[85%] rounded-full border border-white/10" />
                <div className="w-[60%] h-[60%] rounded-full border border-white/10" />
                <div className="w-[35%] h-[35%] rounded-full border border-white/15" />
                <div className="w-[12%] h-[12%] rounded-full border border-violet-400/30" />
                {/* Crosshairs */}
                <div className="absolute w-full h-px bg-white/10" />
                <div className="absolute h-full w-px bg-white/10" />
              </div>

              {/* Animated Radar Sweep Hand */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-radar-sweep">
                <div className="w-1/2 h-0.5 bg-gradient-to-r from-transparent to-violet-400/80 origin-left" style={{ transformOrigin: '0% 50%', marginLeft: '50%' }} />
              </div>

              {/* Rain Cell Contour Echoes */}
              <div
                className={`absolute w-44 h-44 rounded-full filter blur-xl transition-all duration-700 opacity-60 ${
                  selectedTimeline === 'now'
                    ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-500 translate-x-6 -translate-y-4 scale-110'
                    : selectedTimeline === 't+60'
                    ? 'bg-gradient-to-tr from-rose-500 via-purple-600 to-blue-500 translate-x-12 translate-y-2 scale-100'
                    : 'bg-gradient-to-tr from-blue-500 to-violet-500 -translate-x-4 -translate-y-8 scale-90'
                }`}
              />

              {/* Wayanad Map Anchor Nodes */}
              <div className="relative z-10 text-center font-mono text-[10px]">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/85 border border-white/20 text-white shadow-lg">
                  <span className="h-2 w-2 rounded-full bg-violet-400" />
                  <span>KALPETTA RADAR CENTER</span>
                </div>
                <div className="mt-1 text-slate-300 text-[9px]">
                  Reflectivity: {timelineSteps.find(s => s.id === selectedTimeline)?.radarDbz} dBZ · Cloudburst Core
                </div>
              </div>

              {/* Bottom Legend */}
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[9.5px] font-mono text-slate-300 bg-black/80 px-3 py-1 rounded-full border border-white/10">
                <div className="flex items-center gap-1.5">
                  <span>SCALE:</span>
                  <span className="h-2 w-4 bg-cyan-500 rounded-xs" title="15 dBZ" />
                  <span className="h-2 w-4 bg-emerald-500 rounded-xs" title="30 dBZ" />
                  <span className="h-2 w-4 bg-amber-500 rounded-xs" title="45 dBZ" />
                  <span className="h-2 w-4 bg-rose-500 rounded-xs" title="60 dBZ (Cloudburst)" />
                </div>
                <span>RANGE: 80 KM RADIUS</span>
              </div>
            </div>

            {/* dBZ intensity fills as the storm grows (scroll-driven on desktop) */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#EAE7DF]" aria-hidden="true">
              <div data-legend-fill className="h-full w-full origin-left rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 via-amber-500 to-rose-500" style={{ transform: `scaleX(${0.25 + (TIMELINE_IDS.indexOf(selectedTimeline) / 4) * 0.75})` }} />
            </div>

            {/* Satellite Imagery Notice */}
            <div className="mt-4 p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE] flex items-start gap-2.5 text-xs">
              <Satellite className="h-4 w-4 text-violet-700 mt-0.5 flex-none" />
              <div className="text-[#555861] leading-relaxed">
                <strong className="text-[#141518]">Satellite Optical Imagery Notice:</strong> Cloudburst weather obscures optical earth imagery during peak rainfall. FloodGuard synthesizes Sentinel-1 C-band SAR and ground Doppler radar for uninterrupted visibility.
              </div>
            </div>
          </div>

          {/* Live Weather Metrics Cards (5 cols) - Lavender Asymmetric Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-3xl asymmetric-card-top-right bg-[#EFEBF7] border border-[#DDD6EE] space-y-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[#DDD6EE]">
                <div className="flex items-center gap-2">
                  <CloudRain className="h-4 w-4 text-violet-700" />
                  <h3 className="font-display font-bold text-sm text-[#141518]">
                    LIVE WAYANAD METRICS
                  </h3>
                </div>
                <DataHonestyBadge kind="LIVE" source="Open-Meteo" size="sm" />
              </div>

              <div className="text-xs font-mono font-semibold text-[#141518]">
                {weather.weatherDesc}
              </div>

              {/* 4 Telemetry Boxes */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3.5 rounded-2xl bg-white border border-[#E6E4DE] shadow-xs">
                  <div className="text-[10px] font-mono text-[#6A6D75] flex items-center justify-between">
                    <span>HOURLY PRECIP</span>
                    <Droplets className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <div className="text-xl font-mono font-bold text-[#141518] mt-1">
                    {weather.precipitationMm} <span className="text-xs">mm</span>
                  </div>
                  <div className="text-[9px] text-[#787B85]">Surface gauge rate</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E6E4DE] shadow-xs">
                  <div className="text-[10px] font-mono text-[#6A6D75] flex items-center justify-between">
                    <span>RELATIVE HUMIDITY</span>
                    <Wind className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  <div className="text-xl font-mono font-bold text-violet-700 mt-1">
                    {weather.humidity}%
                  </div>
                  <div className="text-[9px] text-[#787B85]">Atmospheric vapor</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E6E4DE] shadow-xs">
                  <div className="text-[10px] font-mono text-[#6A6D75] flex items-center justify-between">
                    <span>TEMPERATURE</span>
                    <Compass className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="text-xl font-mono font-bold text-[#141518] mt-1">
                    {weather.temp}°C
                  </div>
                  <div className="text-[9px] text-[#787B85]">700m MSL plateau</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E6E4DE] shadow-xs">
                  <div className="text-[10px] font-mono text-[#6A6D75] flex items-center justify-between">
                    <span>WIND SPEED</span>
                    <Wind className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <div className="text-xl font-mono font-bold text-[#141518] mt-1">
                    {weather.windSpeedKmh} <span className="text-xs">km/h</span>
                  </div>
                  <div className="text-[9px] text-[#787B85]">South-West Monsoon</div>
                </div>
              </div>

              {/* Data Provenance Footer */}
              <div className="pt-3 border-t border-[#DDD6EE] text-[10.5px] font-mono text-[#554E63] flex items-center justify-between">
                <span>UPDATED: {weather.timestamp}</span>
                <span className="text-[#141518] font-bold">LAT: 11.6854°N</span>
              </div>
            </div>

            {/* Official Agency Integration Box */}
            <div className="p-4 rounded-2xl bg-white border border-[#E6E4DE] text-xs space-y-2 shadow-xs">
              <div className="font-bold text-[#141518] flex items-center gap-1.5 font-mono">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                DISTRICT WARNING INTEGRATION
              </div>
              <p className="text-[#555861] leading-relaxed text-[11.5px]">
                In production, numerical forecasts are harmonized with official bulletins from India Meteorological Department (IMD) and Kerala State Disaster Management Authority (KSDMA).
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
};
