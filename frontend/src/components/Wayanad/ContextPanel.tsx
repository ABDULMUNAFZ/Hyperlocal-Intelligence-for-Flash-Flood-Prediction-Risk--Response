import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ExternalLink, Crosshair, Bot, Route, Video, Building2, Waves, MapPin, History, Mountain, ShieldAlert, CloudRain, Thermometer } from 'lucide-react';
import { geoApi } from '../../services/geoApi';
import { panel, KV, Card, SectionTitle, Spinner, Unavailable, Caveat, ProvenanceLine, Bars, Btn, riskTone, StatusBadge } from './ui';
import { POI_STYLE } from './icons';
import { fmt, fmtCoord, haversineKm, pointInGeometry, distanceToLineKm } from './geo';
import type { Camera, FeatureCollection, LngLat, Prediction, Selection, ZoneOsm, ZoneRisk, ZoneTerrain } from '../../types/geo';

interface Props {
  selection: Selection;
  onClose: () => void;
  pois: FeatureCollection | null;
  places: FeatureCollection | null;
  cameras: Camera[];
  zoneRisk: ZoneRisk | null;
  zoneTerrain: ZoneTerrain | null;
  zoneOsm: ZoneOsm | null;
  climateOn: boolean;
  onMakeZone: (center: LngLat, radiusKm: number, name: string) => void;
  onAskAI: (q: string) => void;
  onEvacuateFrom: (ll: LngLat) => void;
  onPrediction: (p: Prediction | null) => void;
  onOpenCamera: (c: Camera) => void;
  onFlyTo: (ll: LngLat, zoom: number) => void;
  responder?: boolean;
  onReportStatus?: (id: string, status: string) => void;
}

const CRITICAL = ['hospital', 'clinic', 'fire_station', 'police', 'emergency_service', 'school', 'college', 'community', 'government'];

export interface NearbyFacility {
  id: string;
  name?: string;
  category: string;
  lngLat: LngLat;
  distance_km: number;
  [k: string]: any;
}

export function nearestFacilities(pois: FeatureCollection | null, ll: LngLat, n = 6, cats = CRITICAL): NearbyFacility[] {
  if (!pois) return [];
  return pois.features
    .filter((f) => cats.includes(f.properties.category))
    .map((f): NearbyFacility => ({ ...(f.properties as any), lngLat: f.geometry.coordinates as LngLat, distance_km: haversineKm(ll, f.geometry.coordinates) }))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, n);
}

function nearestPlace(places: FeatureCollection | null, ll: LngLat) {
  if (!places) return null;
  let best: any = null;
  for (const f of places.features) {
    if (!['town', 'village', 'hamlet', 'suburb'].includes(f.properties.place)) continue;
    const d = haversineKm(ll, f.geometry.coordinates);
    if (!best || d < best.d) best = { d, name: f.properties.name, place: f.properties.place };
  }
  return best;
}

function riskCellAt(risk: ZoneRisk | null, ll: LngLat) {
  if (!risk?.available || !risk.geojson) return null;
  return risk.geojson.features.find((f) => pointInGeometry(ll, f.geometry))?.properties ?? null;
}

export function ContextPanel(p: Props) {
  const s = p.selection;
  if (s.kind === 'camera' || s.kind === 'rescue' || s.kind === 'safe_location') return null; // rendered by RescuePanels
  const ll: LngLat = s.lngLat;
  const header = {
    location: { icon: MapPin, label: 'Location' },
    building: { icon: Building2, label: 'Building' },
    river: { icon: Waves, label: 'Waterway' },
    road: { icon: Route, label: 'Road' },
    poi: { icon: MapPin, label: POI_STYLE[(s as any).props?.category]?.label ?? 'Facility' },
    place: { icon: MapPin, label: 'Settlement' },
    risk_cell: { icon: ShieldAlert, label: 'Model risk cell' },
    event: { icon: History, label: 'Historical event' },
    sign: { icon: ShieldAlert, label: 'Map sign' },
    report: { icon: MapPin, label: 'Citizen report' },
    live_alert: { icon: ShieldAlert, label: 'FloodGuard alert' },
  }[s.kind]!;
  const Icon = header.icon;
  const near = nearestPlace(p.places, ll);
  const title =
    s.kind === 'location' ? (near ? `Near ${near.name}` : 'Selected point')
      : s.kind === 'event' ? s.event.title
        : s.kind === 'risk_cell' ? `${s.props.risk_level?.replace('_', ' ')} · ${Math.round(s.props.probability * 100)}%`
        : s.kind === 'sign' ? `${s.props.title} · ${s.props.value}`
        : s.kind === 'report' ? `${s.props.people_count} people · ${s.props.label}`
        : s.kind === 'live_alert' ? `${s.props.level} · ${s.props.area_name}`
          : (s as any).props?.name || (s as any).props?.['name:en'] || (s.kind === 'building' ? (s.props.building_type ?? 'Mapped structure') : s.kind === 'river' ? ((s.props.class === 'river' ? 'River' : 'Stream') + ' (unnamed in OSM)') : 'Unnamed');

  return (
    <aside className={`${panel} pointer-events-auto flex max-h-full w-full md:w-[380px] flex-col overflow-hidden rounded-2xl`}>
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2 border-b border-slate-200/80 dark:border-white/10">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] uppercase text-sky-700 dark:text-sky-300"><Icon className="h-3.5 w-3.5" />{header.label}</div>
          <h3 className="mt-0.5 text-[17px] font-semibold leading-tight truncate">{title}</h3>
          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{fmtCoord(ll)}{near && s.kind !== 'location' ? ` · ${fmt(near.d, 1, 'km')} from ${near.name}` : ''}</div>
        </div>
        <button onClick={p.onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
      <div className="overflow-y-auto p-3.5 space-y-3">
        {s.kind === 'event' && <EventView {...p} />}
        {s.kind === 'building' && <BuildingView {...p} />}
        {s.kind === 'river' && <RiverView {...p} />}
        {s.kind === 'road' && <RoadView {...p} />}
        {s.kind === 'poi' && <PoiView {...p} />}
        {s.kind === 'place' && <PlaceView {...p} />}
        {s.kind === 'risk_cell' && <RiskCellView {...p} />}
        {s.kind === 'sign' && <SignView {...p} />}
        {s.kind === 'report' && <ReportView {...p} />}
        {s.kind === 'live_alert' && <LiveAlertView {...p} />}
        {(s.kind === 'location' || s.kind === 'place' || s.kind === 'poi') && <PredictionBlock ll={ll} onPrediction={p.onPrediction} onAskAI={p.onAskAI} />}
        {!['event', 'risk_cell', 'sign', 'live_alert'].includes(s.kind) && <TerrainBlock ll={ll} />}
        {!['event', 'sign', 'live_alert'].includes(s.kind) && <WeatherBlock ll={ll} />}
        {(s.kind === 'location' || p.climateOn) && !['event', 'sign', 'report', 'live_alert'].includes(s.kind) && <ClimateBlock ll={ll} auto={p.climateOn} />}
        {!['event', 'sign', 'live_alert'].includes(s.kind) && <NearbyBlock {...p} ll={ll} />}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Btn onClick={() => p.onMakeZone(ll, 1, near ? `${near.name} (1 km)` : 'Micro-zone (1 km)')}><Crosshair className="h-3.5 w-3.5" />Micro-zone 1 km</Btn>
          <Btn onClick={() => p.onMakeZone(ll, 2, near ? `${near.name} (2 km)` : 'Micro-zone (2 km)')}><Crosshair className="h-3.5 w-3.5" />2 km</Btn>
          <Btn onClick={() => p.onEvacuateFrom(ll)}><Route className="h-3.5 w-3.5" />Evacuation from here</Btn>
          <Btn onClick={() => p.onAskAI('Why is this area at high flash-flood risk?')}><Bot className="h-3.5 w-3.5" />Ask AI</Btn>
        </div>
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ blocks

function PredictionBlock({ ll, onPrediction, onAskAI }: { ll: LngLat; onPrediction: (p: Prediction | null) => void; onAskAI: (q: string) => void }) {
  const q = useQuery({
    queryKey: ['predict', ll[0].toFixed(4), ll[1].toFixed(4)],
    queryFn: async () => { const r = await geoApi.predict(ll[1], ll[0]); onPrediction(r); return r; },
    staleTime: 10 * 60_000,
    retry: 0,
  });
  const d = q.data;
  return (
    <Card>
      <SectionTitle right={<span className="text-[9.5px] font-mono text-slate-400">POST /prediction/predict</span>}>Flash-flood prediction</SectionTitle>
      {q.isLoading && <Spinner label="Assembling real inputs (weather, DEM, land cover, population) and running model…" />}
      {q.isError && <Unavailable>Prediction service unavailable: {(q.error as Error).message}</Unavailable>}
      {d && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className={`rounded-lg px-2.5 py-1 text-[13px] font-bold tracking-wider ${riskTone[d.risk_level] ?? 'bg-slate-500 text-white'}`}>{d.risk_level.replace('_', ' ')}</span>
            <div className="text-[12px] leading-tight">
              <div><b className="text-[18px]">{Math.round(d.risk_probability * 100)}%</b> <span className="text-slate-500">model probability · score {d.risk_score}/100</span></div>
              <div className="text-slate-500 text-[11px]">Data quality <b>{d.data_quality}</b> · {d.model_version} · {new Date(d.timestamp + 'Z').toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' })} IST</div>
            </div>
          </div>
          {d.model_provenance?.warning && <Caveat tone="rose"><b>Unvalidated model.</b> {d.model_provenance.warning}</Caveat>}
          <details className="text-[11.5px]">
            <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">Model inputs ({d.features.length}) · {d.imputed_features.length} imputed</summary>
            <table className="mt-1.5 w-full text-[11px]">
              <tbody>
                {d.features.map((f) => (
                  <tr key={f.name} className="border-t border-slate-100 dark:border-white/5">
                    <td className="py-1 pr-2 text-slate-500">{f.label}</td>
                    <td className="py-1 pr-2 text-right font-mono">{f.value === null ? <span className="text-rose-500">—</span> : `${f.value}${f.unit ? ' ' + f.unit : ''}`}</td>
                    <td className="py-1"><StatusBadge status={f.status === 'IMPUTED' ? 'UNAVAILABLE' : f.status === 'MODEL_ANALYSIS' ? 'LIVE' : f.status === 'DERIVED' ? 'DERIVED' : 'HISTORICAL'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1 text-[10px] text-slate-500">Sources: {d.data_sources.join(' · ')}</div>
          </details>
          {d.contributing_factors.length > 0 && (
            <div>
              <div className="text-[10.5px] font-semibold text-slate-500 mb-1">Most influential inputs · {d.explanation_method}</div>
              {d.contributing_factors.map((c) => (
                <div key={c.feature} className="flex items-center gap-2 text-[11px] py-0.5">
                  <span className="w-40 truncate">{c.label ?? c.feature}</span>
                  <div className="flex-1 h-1.5 rounded bg-slate-200 dark:bg-white/10"><div className="h-full rounded bg-sky-500" style={{ width: `${Math.min(100, (c.importance ?? 0) * 400)}%` }} /></div>
                  <span className="w-14 text-right font-mono">{c.value ?? 'imputed'}</span>
                </div>
              ))}
            </div>
          )}
          <Btn tone="ghost" onClick={() => onAskAI('What factors are causing the risk?')}><Bot className="h-3.5 w-3.5" />Explain these factors</Btn>
        </div>
      )}
    </Card>
  );
}

function TerrainBlock({ ll }: { ll: LngLat }) {
  const q = useQuery({ queryKey: ['terrain', ll[0].toFixed(4), ll[1].toFixed(4)], queryFn: () => geoApi.terrain(ll[1], ll[0]), staleTime: Infinity, retry: 1 });
  const t = q.data;
  return (
    <Card>
      <SectionTitle right={<Mountain className="h-3.5 w-3.5 text-slate-400" />}>Terrain</SectionTitle>
      {q.isLoading && <Spinner label="Reading Copernicus GLO-30…" />}
      {q.isError && <Unavailable>Terrain data unavailable.</Unavailable>}
      {t && !t.available && <Unavailable>Terrain data unavailable at this point{t.error ? ` (${t.error})` : ''}.</Unavailable>}
      {t?.available && (
        <>
          <div className="grid grid-cols-2 gap-x-4">
            <KV k="Elevation" v={`${fmt(t.elevation_m, 0)} m`} />
            <KV k="Slope" v={`${fmt(t.slope_deg)}°`} />
            <KV k="Aspect" v={`${t.aspect} (${fmt(t.aspect_deg, 0)}°)`} />
            <KV k="TWI" v={fmt(t.twi ?? null, 2)} hint="Topographic wetness index, D8 on GLO-30 in a 2.2 km window" />
          </div>
          <KV k="Landform" v={t.terrain_class} />
          <KV k="Land cover (2021)" v={t.landcover?.label ?? '—'} />
          <KV k="Population density" v={t.population_density_per_km2 != null ? `${fmt(t.population_density_per_km2, 0)} /km²` : '—'} hint="HRSL v1.5 in a 1 km² window" />
          <ProvenanceLine p={t.provenance} />
        </>
      )}
    </Card>
  );
}

function WeatherBlock({ ll }: { ll: LngLat }) {
  const q = useQuery({ queryKey: ['weather', ll[0].toFixed(3), ll[1].toFixed(3)], queryFn: () => geoApi.weather(ll[1], ll[0]), staleTime: 10 * 60_000 });
  const w = q.data;
  return (
    <Card>
      <SectionTitle right={<CloudRain className="h-3.5 w-3.5 text-slate-400" />}>Weather & rainfall</SectionTitle>
      {q.isLoading && <Spinner />}
      {(q.isError || (w && !w.available)) && <Unavailable>Weather data unavailable.</Unavailable>}
      {w?.available && w.current && (
        <>
          <div className="flex items-center gap-3 mb-1">
            <Thermometer className="h-5 w-5 text-amber-500" />
            <div className="text-[22px] font-semibold">{w.current.temperature_c}°C</div>
            <div className="text-[11.5px] text-slate-500 leading-tight">{w.current.condition}<br />feels {w.current.apparent_temperature_c}°C · {w.current.relative_humidity_pct}% RH</div>
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <KV k="Wind" v={`${w.current.wind_speed_kmh} km/h · ${w.current.wind_direction_deg}°`} />
            <KV k="Gusts" v={`${w.current.wind_gusts_kmh} km/h`} />
            <KV k="Pressure (MSL)" v={`${w.current.pressure_msl_hpa} hPa`} />
            <KV k="Cloud" v={`${w.current.cloud_cover_pct}%`} />
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1 text-center">
            {(['rain_1h_mm', 'rain_3h_mm', 'rain_6h_mm', 'rain_24h_mm', 'rain_72h_mm'] as const).map((k) => (
              <div key={k} className="rounded-md bg-sky-50 dark:bg-sky-500/10 py-1">
                <div className="text-[13px] font-semibold">{w.rainfall_recent?.[k] ?? '—'}</div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500">{k.split('_')[1]}</div>
              </div>
            ))}
          </div>
          <div className="text-[10.5px] text-slate-500 mt-1">Recent rainfall (mm) · IMD category 24 h: <b>{w.rainfall_recent?.imd_category_24h}</b> · <StatusBadge status="LIVE" /> model analysis</div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10.5px] mb-1">
              <span className="font-semibold">FORECAST next 48 h (mm/h)</span>
              <span className="text-slate-500">24 h total <b>{w.rainfall_forecast?.next_24h_mm ?? '—'} mm</b> · max P {w.rainfall_forecast?.max_probability_pct ?? '—'}%</span>
            </div>
            <Bars values={(w.series?.next_48h ?? []).map((x) => x.precipitation_mm)} labels={(w.series?.next_48h ?? []).map((x) => x.time.slice(11, 16))} unit=" mm" color="#4c6ef5" />
          </div>
          <ProvenanceLine p={w.provenance} />
        </>
      )}
    </Card>
  );
}

function ClimateBlock({ ll, auto }: { ll: LngLat; auto: boolean }) {
  const [enabled, setEnabled] = React.useState(auto);
  const q = useQuery({ queryKey: ['climate', ll[0].toFixed(1), ll[1].toFixed(1)], queryFn: () => geoApi.climate(ll[1], ll[0]), enabled, staleTime: Infinity, retry: 0 });
  const c = q.data;
  return (
    <Card>
      <SectionTitle right={<StatusBadge status="HISTORICAL" />}>Climate normals (1991–2020)</SectionTitle>
      {!enabled && <Btn onClick={() => setEnabled(true)}>Load ERA5 climate normals</Btn>}
      {q.isLoading && enabled && <Spinner label="Aggregating 30 years of ERA5 (first load can take ~30 s)…" />}
      {(q.isError || (c && !c.available)) && <Unavailable>Climate data unavailable.</Unavailable>}
      {c?.available && c.monthly && c.summary && (
        <>
          <Bars values={c.monthly.map((m) => m.precipitation_mm)} labels={c.monthly.map((m) => m.month)} color="#1864ab" unit=" mm" height={56} />
          <div className="grid grid-cols-2 gap-x-4 mt-2">
            <KV k="Annual rainfall" v={`${fmt(c.summary.annual_precipitation_mm, 0)} mm`} />
            <KV k="Wettest month" v={c.summary.wettest_month} />
            <KV k="SW monsoon share" v={`${c.summary.southwest_monsoon_share_pct}%`} />
            <KV k="NE monsoon share" v={`${c.summary.northeast_monsoon_share_pct}%`} />
            <KV k="Mean temperature" v={`${c.summary.mean_temperature_c}°C`} />
            <KV k="Annual range" v={`${fmt(c.summary.annual_precipitation_min_mm, 0)}–${fmt(c.summary.annual_precipitation_max_mm, 0)} mm`} />
          </div>
          <KV k="Wettest day in record" v={`${c.summary.max_daily_precipitation_mm} mm (${c.summary.max_daily_precipitation_date})`} />
          <ProvenanceLine p={c.provenance} />
        </>
      )}
    </Card>
  );
}

function NearbyBlock(p: Props & { ll: LngLat }) {
  const fac = useMemo(() => nearestFacilities(p.pois, p.ll), [p.pois, p.ll]);
  const cams = p.cameras.filter((c) => haversineKm(p.ll, c.location) < 10);
  return (
    <Card>
      <SectionTitle>Nearby critical infrastructure (OSM)</SectionTitle>
      {fac.length === 0 && <div className="text-[12px] text-slate-500">No mapped facilities.</div>}
      {fac.map((f) => (
        <button key={f.id} onClick={() => p.onFlyTo(f.lngLat, 16)} className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-slate-100 dark:hover:bg-white/5">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: POI_STYLE[f.category]?.color }} />
          <span className="flex-1 truncate text-[12px]">{f.name || POI_STYLE[f.category]?.label}</span>
          <span className="text-[10px] text-slate-400">{POI_STYLE[f.category]?.label.split(' ')[0]}</span>
          <span className="w-14 text-right font-mono text-[11px]">{fmt(f.distance_km, 2)} km</span>
        </button>
      ))}
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold"><Video className="h-3.5 w-3.5" />Live camera</div>
        {cams.length ? cams.map((c) => <Btn key={c.id} tone="danger" onClick={() => p.onOpenCamera(c)}>● LIVE · {c.name}</Btn>)
          : <div className="text-[11.5px] text-slate-500">No public live camera available for this location.</div>}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ selection-specific views

function BuildingView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'building' }>;
  const ll = s.lngLat;
  const lookup = useQuery({ queryKey: ['building', ll[0].toFixed(5), ll[1].toFixed(5)], queryFn: () => geoApi.building(ll[1], ll[0]), staleTime: Infinity, retry: 0 });
  const b = lookup.data;
  const zoneProps = s.source === 'zone' ? s.props : null;
  const src = b?.available ? b : zoneProps;
  const cell = riskCellAt(p.zoneRisk, ll);
  const river = useMemo(() => {
    const ws = p.zoneOsm?.waterways?.features ?? [];
    let best: any = null;
    for (const w of ws) {
      const d = distanceToLineKm(ll, w.geometry.coordinates);
      if (!best || d < best.d) best = { d, name: w.properties.name, kind: w.properties.waterway };
    }
    return best;
  }, [p.zoneOsm, ll]);
  return (
    <Card>
      <SectionTitle>Structure</SectionTitle>
      {lookup.isLoading && !zoneProps && <Spinner label="Looking up OSM building…" />}
      {src ? (
        <>
          <KV k="Type" v={<span className="capitalize">{src.building_type}</span>} />
          {src.building_tag && <KV k="OSM building tag" v={src.building_tag} mono />}
          <KV k="Height" v={src.height_m ? `${src.height_m} m` : 'Unavailable'} />
          <KV k="Height source" v={<span className="text-[11px]">{src.height_source}</span>} />
          <div className="flex justify-end -mt-0.5 mb-1"><StatusBadge status={src.height_status === 'SOURCE' ? 'RECENT' : src.height_status === 'ESTIMATED' ? 'DERIVED' : 'UNAVAILABLE'} /></div>
          {src.levels != null && <KV k="Levels" v={src.levels} />}
          <KV k="Footprint" v={`${fmt(src.footprint_m2, 0)} m²`} />
          {b?.last_edit && <KV k="Last OSM edit" v={b.last_edit.slice(0, 10)} />}
          <KV k="Model risk cell" v={cell ? `${cell.risk_level} (${Math.round(cell.probability * 100)}%, unvalidated)` : 'No zone risk grid here'} />
          <KV k="Nearest mapped waterway" v={river ? `${river.name ?? river.kind} · ${fmt(river.d * 1000, 0)} m` : 'Select a zone to compute'} />
          <KV k="Data quality" v={src.height_status === 'SOURCE' ? 'Good (mapped height)' : src.height_status === 'ESTIMATED' ? 'Fair (levels-derived)' : 'Footprint only'} />
          {(b?.osm_url || src.osm_id) && (
            <a className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline" href={b?.osm_url ?? `https://www.openstreetmap.org/way/${src.osm_id}`} target="_blank" rel="noreferrer">
              Open in OpenStreetMap <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </>
      ) : lookup.data && !lookup.data.available ? (
        <>
          <Unavailable>{lookup.data.reason}</Unavailable>
          <KV k="Render height (tiles)" v={`${s.props.render_height ?? '—'} m`} hint="OpenMapTiles render_height; provenance cannot be determined from the tile" />
        </>
      ) : null}
    </Card>
  );
}

function RiverView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'river' }>;
  const near = useMemo(() => (p.places?.features ?? [])
    .map((f) => ({ name: f.properties.name, place: f.properties.place, d: haversineKm(s.lngLat, f.geometry.coordinates) }))
    .filter((x) => x.d < 3).sort((a, b) => a.d - b.d).slice(0, 6), [p.places, s.lngLat]);
  const channel = useMemo(() => {
    const ch = p.zoneTerrain?.drainage?.features ?? [];
    let best: any = null;
    for (const c of ch) {
      const d = distanceToLineKm(s.lngLat, c.geometry.coordinates);
      if (!best || d < best.d) best = { d, area: c.properties.max_contributing_area_km2 };
    }
    return best && best.d < 0.15 ? best : null;
  }, [p.zoneTerrain, s.lngLat]);
  const cell = riskCellAt(p.zoneRisk, s.lngLat);
  return (
    <Card>
      <SectionTitle>Waterway</SectionTitle>
      <KV k="Name" v={s.props['name:en'] || s.props.name || 'Not named in OSM'} />
      <KV k="Class" v={<span className="capitalize">{s.props.class}</span>} />
      {s.props.intermittent === 1 && <KV k="Flow" v="Intermittent (OSM)" />}
      {s.props.brunnel && <KV k="Structure" v={s.props.brunnel} />}
      <KV k="Upstream contributing area" v={channel ? `${channel.area} km² (D8, GLO-30)` : 'Select a zone containing this reach'} />
      <KV k="Model risk here" v={cell ? `${cell.risk_level} (unvalidated)` : '—'} />
      <div className="mt-2 text-[10.5px] font-semibold text-slate-500">Settlements within 3 km</div>
      {near.length ? near.map((n) => <KV key={n.name} k={n.name} v={`${fmt(n.d, 1)} km · ${n.place}`} />) : <div className="text-[11.5px] text-slate-500">None mapped.</div>}
      <div className="mt-1 text-[10px] text-slate-500">Geometry & name: OpenStreetMap (ODbL) via OpenFreeMap tiles.</div>
    </Card>
  );
}

function RoadView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'road' }>;
  const cell = riskCellAt(p.zoneRisk, s.lngLat);
  return (
    <Card>
      <SectionTitle>Road segment</SectionTitle>
      <KV k="Name" v={s.props['name:en'] || s.props.name || '—'} />
      {s.props.ref && <KV k="Reference" v={s.props.ref} />}
      <KV k="Class" v={<span className="capitalize">{s.props.class}{s.props.subclass ? ` / ${s.props.subclass}` : ''}</span>} />
      {s.props.surface && <KV k="Surface" v={s.props.surface} />}
      {s.props.brunnel && <KV k="Structure" v={<span className="capitalize">{s.props.brunnel}</span>} />}
      <KV k="Model risk here" v={cell ? `${cell.risk_level} (unvalidated)` : '—'} />
      <KV k="Blockage / closure" v="Data unavailable" />
      <div className="mt-1 text-[10px] text-slate-500">OpenStreetMap via OpenFreeMap tiles. No live road-condition feed is connected.</div>
    </Card>
  );
}

function PoiView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'poi' }>;
  const pr = s.props;
  const skip = new Set(['id', 'osm_type', 'osm_id', 'category', 'source', 'name']);
  return (
    <Card>
      <SectionTitle>OpenStreetMap record</SectionTitle>
      {Object.entries(pr).filter(([k]) => !skip.has(k)).map(([k, v]) => <KV key={k} k={k} v={String(v)} mono />)}
      {pr.category === 'shelter_structure' && <Caveat>OSM amenity=shelter is typically a bus or rain shelter. It is not a designated relief camp.</Caveat>}
      {pr.category === 'peak' && pr.ele && <div className="text-[10.5px] text-slate-500">Peak elevation from OSM `ele` tag; DEM value shown under Terrain.</div>}
      <a className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline" href={`https://www.openstreetmap.org/${pr.osm_type}/${pr.osm_id}`} target="_blank" rel="noreferrer">
        Open in OpenStreetMap <ExternalLink className="h-3 w-3" />
      </a>
    </Card>
  );
}

function PlaceView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'place' }>;
  return (
    <Card>
      <SectionTitle>Settlement</SectionTitle>
      <KV k="Name" v={s.props.name} />
      {s.props.name_ml && <KV k="Malayalam" v={s.props.name_ml} />}
      <KV k="OSM place type" v={<span className="capitalize">{s.props.place}</span>} />
      {s.props.population_osm && <KV k="Population (OSM tag)" v={`${s.props.population_osm}${s.props.population_osm_date ? ` (${s.props.population_osm_date})` : ''}`} />}
      <div className="mt-1.5 flex gap-1.5">
        <Btn onClick={() => p.onFlyTo(s.lngLat, 15)}>Fly to</Btn>
        <Btn tone="danger" onClick={() => p.onMakeZone(s.lngLat, 1.5, `${s.props.name} (1.5 km)`)}><Crosshair className="h-3.5 w-3.5" />Set incident zone</Btn>
      </div>
    </Card>
  );
}

function RiskCellView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'risk_cell' }>;
  const pr = s.props;
  return (
    <Card>
      <SectionTitle>Model output for this cell</SectionTitle>
      <KV k="Risk level" v={<span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${riskTone[pr.risk_level]}`}>{pr.risk_level}</span>} />
      <KV k="Probability" v={`${(pr.probability * 100).toFixed(1)}%`} />
      <KV k="Mean elevation" v={`${pr.elevation_m} m`} />
      <KV k="Mean slope" v={`${pr.slope_deg}°`} />
      <KV k="TWI (75th pct)" v={pr.twi} />
      <KV k="Dominant land cover" v={pr.landcover ?? '—'} />
      <KV k="Population in cell (HRSL)" v={fmt(pr.population_hrsl, 0)} />
      <Caveat tone="rose">Output of the unvalidated FloodGuard ensemble (synthetic training data; fails rainfall sanity check). Terrain inputs are real; the probability is not a validated hazard estimate.</Caveat>
    </Card>
  );
}

function EventView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'event' }>;
  const e = s.event;
  return (
    <>
      <Card>
        <SectionTitle right={<StatusBadge status="HISTORICAL" />}>{e.event_type}</SectionTitle>
        <KV k="Date" v={e.date} />
        {e.time_local && <KV k="Time" v={e.time_local} />}
        <div className="text-[12px] mt-1"><span className="text-slate-500">Location · </span>{e.location}</div>
        {e.rivers.length > 0 && <KV k="Rivers" v={e.rivers.join(', ')} />}
        <div className="text-[12px] mt-1.5"><span className="text-slate-500">Rainfall · </span>{e.rainfall_reported}</div>
        <div className="text-[12px] mt-1.5"><span className="text-slate-500">Impact · </span>{e.impact}</div>
        <div className="text-[10.5px] text-slate-500 mt-1.5">Marker: {e.position_basis}</div>
        <div className="mt-2 space-y-0.5">
          {e.sources.map((src) => (
            <a key={src.url} href={src.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-sky-600 hover:underline">{src.label}<ExternalLink className="h-3 w-3" /></a>
          ))}
        </div>
      </Card>
      {e.related_places.length > 0 && (
        <Card>
          <SectionTitle>Affected places (OSM nodes)</SectionTitle>
          {e.related_places.map((rp) => (
            <button key={rp.name} onClick={() => p.onFlyTo(rp.coordinates, 15)} className="flex w-full justify-between py-0.5 text-[12px] hover:text-sky-600">
              <span>{rp.name}</span><span className="font-mono text-[10.5px] text-slate-400">{rp.coordinates[1].toFixed(4)}, {rp.coordinates[0].toFixed(4)}</span>
            </button>
          ))}
        </Card>
      )}
    </>
  );
}

function SignView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'sign' }>;
  const pr = s.props;
  return (
    <Card>
      <SectionTitle right={<StatusBadge status={pr.status ?? 'MODEL'} />}>{pr.title}</SectionTitle>
      <div className="text-[26px] font-semibold leading-tight">{pr.value}</div>
      {pr.sub && <div className="text-[12px] text-slate-500">{pr.sub}</div>}
      <KV k="Basis" v={<span className="text-[11px]">{pr.basis}</span>} />
      {pr.time && <KV k="Time" v={pr.time} />}
      {pr.note && <Caveat tone={pr.status === 'SIMULATION' || pr.status === 'MODEL' ? 'amber' : 'slate'}>{pr.note}</Caveat>}
    </Card>
  );
}

const REPORT_LABEL: Record<string, string> = {
  NEED_RESCUE: 'Need rescue', TRAPPED: 'Trapped', FLOODING: 'Flooding', ROAD_BLOCKED: 'Road blocked', LANDSLIDE: 'Landslide',
  MEDICAL: 'Medical emergency', SAFE: 'Safe', EVACUATING: 'Evacuating', OTHER: 'Other',
};
export { REPORT_LABEL };

function ReportView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'report' }>;
  const r = s.props;
  const mins = Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000));
  return (
    <Card>
      <SectionTitle right={<StatusBadge status={r.is_demo ? 'MODEL' : 'LIVE'} />}>{r.is_demo ? 'DEMO report' : 'User-provided report'}</SectionTitle>
      <div className="flex items-center gap-3">
        <div className="text-[30px] font-bold leading-none">{r.people_count}</div>
        <div className="text-[12px]"><div className="font-semibold">{REPORT_LABEL[r.report_type] ?? r.report_type}</div><div className="text-slate-500">people reported by the sender</div></div>
      </div>
      <KV k="Status" v={<span className="capitalize">{r.status}</span>} />
      <KV k="Severity" v={<span className="capitalize">{r.severity}</span>} />
      <KV k="Location" v={`${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}`} mono />
      {r.accuracy_m && <KV k="GPS accuracy" v={`±${Math.round(r.accuracy_m)} m`} />}
      <KV k="Reported" v={`${mins} min ago`} />
      {r.message && <div className="mt-1 rounded-md bg-slate-50 dark:bg-white/5 p-2 text-[12px]">“{r.message}”</div>}
      {p.responder && p.onReportStatus && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['acknowledged', 'dispatched', 'resolved'].map((st) => (
            <Btn key={st} tone={st === 'dispatched' ? 'danger' : 'default'} disabled={r.status === st} onClick={() => p.onReportStatus!(r.id, st)}>{st}</Btn>
          ))}
          <Btn onClick={() => p.onFlyTo(s.lngLat, 17)}>Focus</Btn>
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-slate-500">People count is entered by the reporter, not inferred. Reports are kept for 72 h, then deleted.</div>
    </Card>
  );
}

function LiveAlertView(p: Props) {
  const s = p.selection as Extract<Selection, { kind: 'live_alert' }>;
  const a = s.props;
  return (
    <Card>
      <SectionTitle right={<StatusBadge status={a.is_demo ? 'MODEL' : 'LIVE'} />}>{a.is_demo ? 'DEMO / SIMULATION alert' : 'FloodGuard responder alert'}</SectionTitle>
      <div className="text-[15px] font-semibold">{a.title}</div>
      <div className="text-[12.5px] mt-1">{a.message}</div>
      <KV k="Level" v={a.level} />
      <KV k="Area" v={a.area_name} />
      <KV k="Basis" v={<span className="text-[11px]">{a.basis}</span>} />
      <KV k="Issued" v={new Date(a.sent_at).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })} />
      <KV k="Expires" v={new Date(a.expires).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata' })} />
      {a.recommended_action && <Caveat tone="rose"><b>Recommended action:</b> {a.recommended_action}</Caveat>}
    </Card>
  );
}
