import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap, MQ } from './story/gsap';
import { CountUp } from './story/CountUp';
import { Link } from 'react-router-dom';
import { MapPin, Compass, Building, Users, Mountain, ArrowRight, Droplets } from 'lucide-react';
import { DataHonestyBadge } from './DataHonestyBadge';
import { ScrollHeading } from './ScrollHeading';

interface PlaceStory {
  id: string;
  name: string;
  malayalam: string;
  elevationM: number;
  slopeRange: string;
  riverBasin: string;
  exposedPop: string;
  criticalPOIs: string;
  floodVulnerability: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  historicalEvent: string;
  primaryRiskFactor: string;
  evacuationDestination: string;
  coordinates: [number, number]; // [lon, lat]
}

const PLACES: PlaceStory[] = [
  {
    id: 'chooralmala',
    name: 'Chooralmala',
    malayalam: 'ചൂരൽമല',
    elevationM: 730,
    slopeRange: '32° – 54° steep slopes',
    riverBasin: 'Vellarimala Tributary of Chaliyar River',
    exposedPop: '~1,850 residents',
    criticalPOIs: 'Chooralmala School, Bridge Junction, Primary Health Center',
    floodVulnerability: 'CRITICAL',
    historicalEvent: 'Catastrophic debris avalanche & bridge destruction (July 2024)',
    primaryRiskFactor: 'High-velocity debris flow from Vellarimala crest channelized into narrow bridge constriction.',
    evacuationDestination: 'Meppadi Higher Secondary School & St. Joseph Relief Center (High Ground)',
    coordinates: [76.1598, 11.4992],
  },
  {
    id: 'mundakkai',
    name: 'Mundakkai',
    malayalam: 'മുണ്ടക്കൈ',
    elevationM: 920,
    slopeRange: '38° – 58° upper escarpment',
    riverBasin: 'Upper Catchment of Iruvanjippuzha basin',
    exposedPop: '~1,200 residents',
    criticalPOIs: 'Tea estate worker quarters, Upper primary school, Juma Masjid',
    floodVulnerability: 'CRITICAL',
    historicalEvent: 'Massive landslide scar & torrential flash flood origin (July 2024)',
    primaryRiskFactor: 'Intense orographic precipitation exceeding 300 mm/24h on steep saturated soil mantle.',
    evacuationDestination: 'Vellarimala Valley Relief Outpost via elevated tea trail',
    coordinates: [76.1680, 11.5120],
  },
  {
    id: 'meppadi',
    name: 'Meppadi',
    malayalam: 'മേപ്പാടി',
    elevationM: 780,
    slopeRange: '15° – 30° valley floor',
    riverBasin: 'Chaliyar River Headwaters',
    exposedPop: '~28,500 residents',
    criticalPOIs: 'Meppadi Community Health Centre, Govt Higher Secondary School, Police Station',
    floodVulnerability: 'HIGH',
    historicalEvent: 'Central coordination depot and regional transit bottleneck',
    primaryRiskFactor: 'Runoff convergence from Chembra, Mundakkai, and Chooralmala streams.',
    evacuationDestination: 'Meppadi Higher Ground Transit Camp',
    coordinates: [76.1260, 11.5540],
  },
  {
    id: 'kalpetta',
    name: 'Kalpetta',
    malayalam: 'കൽപ്പറ്റ',
    elevationM: 780,
    slopeRange: '10° – 25° urban valley',
    riverBasin: 'Kabini & Chaliyar Watershed Divide',
    exposedPop: '~35,000 residents',
    criticalPOIs: 'District Collectorate, General Hospital, Civil Station, Fire Station',
    floodVulnerability: 'MODERATE',
    historicalEvent: 'Localized drainage overflow in commercial market and Pinangode Road',
    primaryRiskFactor: 'Impermeable urban runoff and secondary stream backup during continuous downpour.',
    evacuationDestination: 'Civil Station Relief Headquarters',
    coordinates: [76.0830, 11.6080],
  },
  {
    id: 'vythiri',
    name: 'Vythiri',
    malayalam: 'വൈത്തിരി',
    elevationM: 700,
    slopeRange: '25° – 45° gateway pass',
    riverBasin: 'Punnappuzha & Chaliyar Subcatchment',
    exposedPop: '~16,200 residents',
    criticalPOIs: 'Vythiri Taluk Hospital, Police Station, Pookode Lake Outlet',
    floodVulnerability: 'HIGH',
    historicalEvent: 'Severe inundation of NH-766 ghat pass cut off district access',
    primaryRiskFactor: 'Pookode lake natural overflow meeting steep terrain runoff.',
    evacuationDestination: 'Vythiri Community Hall High Ridge',
    coordinates: [76.0420, 11.5490],
  },
  {
    id: 'lakkidi',
    name: 'Lakkidi',
    malayalam: 'ലക്കിടി',
    elevationM: 700,
    slopeRange: '35° – 60° gateway escarpment',
    riverBasin: 'Thamarassery Ghat Gorge',
    exposedPop: '~4,800 residents',
    criticalPOIs: 'Thamarassery Churam Gateway, Chain Tree, Viewpoint',
    floodVulnerability: 'HIGH',
    historicalEvent: 'Highest rainfall station in Kerala (>4,000 mm annual) & slope washouts',
    primaryRiskFactor: 'Steep road embankment failure and cascading overland flow across hairpin bends.',
    evacuationDestination: 'Adivaram Safe Transit Camp (Foothills)',
    coordinates: [76.0240, 11.5170],
  },
  {
    id: 'mananthavady',
    name: 'Mananthavady',
    malayalam: 'മാനന്തവാടി',
    elevationM: 760,
    slopeRange: '8° – 20° northern plains',
    riverBasin: 'Mananthavady River (Major Kabini Tributary)',
    exposedPop: '~45,000 residents',
    criticalPOIs: 'Taluk Hospital, Valliyoorkavu Temple Ground, Pazhassi Tomb',
    floodVulnerability: 'MODERATE',
    historicalEvent: 'Riverbank overflow during reservoir release (Banasura Sagar Dam)',
    primaryRiskFactor: 'Kabini tributary swelling and low-gradient flood plain inundation.',
    evacuationDestination: 'St. Patrick Higher Secondary School Camp',
    coordinates: [76.0020, 11.8020],
  },
  {
    id: 'sulthan_bathery',
    name: 'Sulthan Bathery',
    malayalam: 'സുൽത്താൻ ബത്തേരി',
    elevationM: 930,
    slopeRange: '5° – 15° eastern tableland',
    riverBasin: 'Nugu / Kabini Plateau Basin',
    exposedPop: '~42,000 residents',
    criticalPOIs: 'Taluk Hospital, Interstate Transit Hub, Jain Temple Heritage',
    floodVulnerability: 'LOW',
    historicalEvent: 'Localized agricultural water accumulation in paddy wetlands',
    primaryRiskFactor: 'Slow drainage exit towards Karnataka border tablelands.',
    evacuationDestination: 'Government Sarvajana High School Camp',
    coordinates: [76.2820, 11.6620],
  },
];

const VULN_COLORS: Record<string, string> = {
  CRITICAL: 'bg-rose-100 text-rose-800 border-rose-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MODERATE: 'bg-amber-100 text-amber-800 border-amber-300',
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

/** Full micro-zone dossier for one place (used by the desktop card stack and the mobile selector). */
const PlaceDossier: React.FC<{ place: PlaceStory; index?: number; total?: number }> = ({ place, index, total }) => (
  <div className="bg-white rounded-[2rem] border border-[#E6E4DE] p-6 sm:p-8 space-y-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]">
    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EAE7DF]">
      <div>
        <div className="flex items-center gap-2.5">
          {index !== undefined && (
            <span className="rounded-full bg-[#141518] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#D4F826]">
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          )}
          <h3 className="font-display font-extrabold text-2xl sm:text-3xl text-[#141518]">{place.name}</h3>
          <span className="text-sm font-sans text-[#6A6D75]">({place.malayalam})</span>
        </div>
        <div className="text-xs font-mono text-violet-700 mt-1">
          COORDINATES: {place.coordinates[1]}° N, {place.coordinates[0]}° E · {place.elevationM}m MSL
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full border text-xs font-mono font-bold ${VULN_COLORS[place.floodVulnerability]}`}>
          VULNERABILITY: {place.floodVulnerability}
        </span>
        <DataHonestyBadge kind="OBSERVED" source="OSM 2026 + Copernicus" size="sm" />
      </div>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
        <div className="text-[10px] font-mono text-[#6A6D75] flex items-center gap-1"><Mountain className="h-3 w-3 text-violet-700" /> SLOPE GRADIENT</div>
        <div className="text-sm font-mono font-bold text-[#141518] mt-1">{place.slopeRange}</div>
      </div>
      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
        <div className="text-[10px] font-mono text-[#6A6D75] flex items-center gap-1"><Droplets className="h-3 w-3 text-blue-600" /> DRAINAGE BASIN</div>
        <div className="text-xs font-mono font-medium text-[#141518] mt-1 truncate" title={place.riverBasin}>{place.riverBasin}</div>
      </div>
      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
        <div className="text-[10px] font-mono text-[#6A6D75] flex items-center gap-1"><Users className="h-3 w-3 text-emerald-600" /> EXPOSED POP</div>
        <div className="text-sm font-mono font-bold text-emerald-800 mt-1">{place.exposedPop}</div>
      </div>
      <div className="p-3.5 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
        <div className="text-[10px] font-mono text-[#6A6D75] flex items-center gap-1"><Building className="h-3 w-3 text-indigo-600" /> CRITICAL POIs</div>
        <div className="text-xs font-mono font-medium text-[#141518] mt-1 truncate" title={place.criticalPOIs}>{place.criticalPOIs}</div>
      </div>
    </div>

    <div className="space-y-3 p-4 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE] text-xs leading-relaxed">
      <div>
        <strong className="text-violet-800 font-mono">PRIMARY FLOOD DYNAMICS:</strong>
        <p className="text-[#4A4D54] mt-1">{place.primaryRiskFactor}</p>
      </div>
      <div className="pt-2 border-t border-[#EAE7DF]">
        <strong className="text-amber-800 font-mono">HISTORICAL CONTEXT:</strong>
        <p className="text-[#4A4D54] mt-1">{place.historicalEvent}</p>
      </div>
      <div className="pt-2 border-t border-[#EAE7DF]">
        <strong className="text-emerald-800 font-mono">PLANNED EVACUATION DESTINATION:</strong>
        <p className="text-[#141518] font-semibold mt-1">{place.evacuationDestination}</p>
      </div>
    </div>

    <div className="flex items-center justify-between pt-2">
      <span className="text-[11px] font-mono text-[#6A6D75]">Explore elevation contours and building layers in 3D:</span>
      <Link
        to="/app/map"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#141518] hover:bg-[#252830] text-white font-mono text-xs font-bold shadow-xs transition-all"
      >
        <span>LAUNCH IN 3D MAP</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  </div>
);

const DistrictMetrics: React.FC = () => (
  <div className="p-6 rounded-3xl asymmetric-card-top-right bg-[#EFEBF7] border border-[#DDD6EE] space-y-4 shadow-sm">
    <h4 className="font-display font-bold text-sm text-[#141518] flex items-center gap-2">
      <Compass className="h-4 w-4 text-violet-700" />
      WAYANAD DISTRICT METRICS
    </h4>
    <div className="space-y-2 text-xs font-mono">
      <div className="flex justify-between p-2.5 rounded-2xl bg-white border border-[#E6E4DE]">
        <span className="text-[#6A6D75]">TOTAL LOCALITIES:</span>
        <span className="text-[#141518] font-bold"><CountUp value={461} /> Places</span>
      </div>
      <div className="flex justify-between p-2.5 rounded-2xl bg-white border border-[#E6E4DE]">
        <span className="text-[#6A6D75]">SHELTER CAPACITY:</span>
        <span className="text-emerald-700 font-bold"><CountUp value={379} /> Buildings</span>
      </div>
      <div className="flex justify-between p-2.5 rounded-2xl bg-white border border-[#E6E4DE]">
        <span className="text-[#6A6D75]">BRIDGES MONITORED:</span>
        <span className="text-violet-700 font-bold"><CountUp value={221} /> Crossings</span>
      </div>
      <div className="flex justify-between p-2.5 rounded-2xl bg-white border border-[#E6E4DE]">
        <span className="text-[#6A6D75]">HEALTH CENTERS:</span>
        <span className="text-indigo-700 font-bold"><CountUp value={211} /> Hospitals/Clinics</span>
      </div>
    </div>
    <div className="text-[10px] text-[#6A6D75] leading-normal border-t border-[#DDD6EE] pt-3">
      Source: Real Overpass API extraction of OpenStreetMap relation 2018203 (Wayanad District, Kerala).
    </div>
  </div>
);

export const PlaceIntelligenceSection: React.FC = () => {
  const [selectedPlace, setSelectedPlace] = useState<PlaceStory>(PLACES[0]);
  const stack = useRef<HTMLDivElement>(null);

  // Desktop sticky card stack: as the next card slides over, the one beneath shrinks back and dims.
  useLayoutEffect(() => {
    const el = stack.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.matchMedia().add(MQ.desktop, () => {
        const cards = gsap.utils.toArray<HTMLElement>('[data-place-card]');
        cards.forEach((card, i) => {
          const next = cards[i + 1];
          if (!next) return;
          gsap.to(card.firstElementChild, {
            scale: 0.92, opacity: 0.35, filter: 'blur(1px)', ease: 'none', transformOrigin: '50% 0%',
            scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top+=130', scrub: true },
          });
        });
      });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative py-16 sm:py-24 pattern-topo-grid text-[#23252A] overflow-clip">
      <div className="max-w-7xl 2xl:max-w-[1680px] 3xl:max-w-[1980px] 4xl:max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollHeading
          badge="LOCALIZED HYDRO-INTELLIGENCE · PLACE PROFILES"
          animationVariant="depth"
          title="EVERY PLACE"
          italicWord="HAS A DIFFERENT FLOOD STORY."
          subtitle="Flash flood risk in Wayanad varies dramatically between a steep escarpment at 1,000m and a river confluence at 700m. FloodGuard models every village and micro-zone against its distinct topography, drainage network, and community footprint."
        />

        {/* Desktop: sticky stack of micro-zone cards */}
        <div ref={stack} className="hidden lg:grid grid-cols-12 gap-8 items-start">
          <div className="col-span-8">
            {PLACES.map((place, i) => (
              <div
                key={place.id}
                data-place-card
                className="sticky"
                style={{ top: 120 + i * 10, marginBottom: i === PLACES.length - 1 ? 0 : '26vh' }}
              >
                <div className="will-change-transform">
                  <PlaceDossier place={place} index={i} total={PLACES.length} />
                </div>
              </div>
            ))}
          </div>
          <div className="col-span-4 sticky top-[120px]">
            <DistrictMetrics />
            <div className="mt-4 rounded-3xl border border-[#E6E4DE] bg-white/80 p-4 font-mono text-[11px] text-[#52555E]">
              Scroll to move through {PLACES.length} micro-zones, from the critical escarpments to the eastern tableland.
            </div>
          </div>
        </div>

        {/* Mobile / tablet: tap to select */}
        <div className="lg:hidden">
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar">
            {PLACES.map((place) => {
              const isSelected = selectedPlace.id === place.id;
              return (
                <button
                  key={place.id}
                  onClick={() => setSelectedPlace(place)}
                  className={`flex-none px-4 py-2 rounded-full border text-xs font-mono transition-all flex items-center gap-2 ${
                    isSelected ? 'bg-[#141518] border-[#141518] text-white font-bold shadow-xs' : 'bg-white border-[#E6E4DE] text-[#4A4D54] hover:bg-[#FAF9F6]'
                  }`}
                >
                  <MapPin className={`h-3.5 w-3.5 ${isSelected ? 'text-violet-300' : 'text-[#828690]'}`} />
                  <span>{place.name}</span>
                  <span className="text-[10px] opacity-70 font-sans">{place.malayalam}</span>
                </button>
              );
            })}
          </div>
          <div className="space-y-6">
            <PlaceDossier place={selectedPlace} />
            <DistrictMetrics />
          </div>
        </div>
      </div>
    </section>
  );
};
