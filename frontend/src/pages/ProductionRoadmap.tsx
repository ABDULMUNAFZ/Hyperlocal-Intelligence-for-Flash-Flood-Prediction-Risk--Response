import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  Cloud,
  Database,
  Cpu,
  Layers,
  Shield,
  Activity,
  DollarSign,
  Sliders,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Satellite,
  Radio,
  Eye,
  Camera,
  Wifi,
  Sun,
  BatteryCharging,
  Terminal,
  Compass,
  ArrowUpRight,
} from 'lucide-react';
import { LandingNav } from '../components/landing/LandingNav';
import { LandingFooter } from '../components/landing/LandingFooter';
import { DataHonestyBadge, type DataStatusKind } from '../components/landing/DataHonestyBadge';

interface ConnectorSpec {
  source: string;
  dataType: string;
  frequency: string;
  status: DataStatusKind;
  lastUpdate: string;
  notes: string;
}

const CONNECTORS: ConnectorSpec[] = [
  {
    source: 'Open-Meteo High-Res Numerical API',
    dataType: 'Precipitation, Temperature, Wind, Cloud Cover, Humidity',
    frequency: 'Hourly numerical refresh (1 km grid)',
    status: 'LIVE',
    lastUpdate: 'Active live polling',
    notes: 'Used for real-time district forecasting & boundary conditions.',
  },
  {
    source: 'Copernicus Global DEM (30m GLO)',
    dataType: 'Elevation raster, derived slope, aspect, flow accumulation',
    frequency: 'Static baseline conditioned for hydrology',
    status: 'OBSERVED',
    lastUpdate: 'Baseline ingested',
    notes: 'Primary digital elevation dataset for Wayanad basin cell solver.',
  },
  {
    source: 'OpenStreetMap (OSM Overpass API)',
    dataType: '2,553 POIs, 461 places, waterways, bridges, roads',
    frequency: 'Periodic ingestion / sync',
    status: 'OBSERVED',
    lastUpdate: 'Ingested',
    notes: 'Ground infrastructure footprints & critical health centers.',
  },
  {
    source: 'IMD Doppler Radar (Kochi Station)',
    dataType: 'Precipitation reflectivity (dBZ) cloud echoes',
    frequency: '15-minute sweep cycle',
    status: 'PLANNED',
    lastUpdate: 'Mocked in demo / Planned production feed',
    notes: 'Direct API connection requires government inter-agency clearance.',
  },
  {
    source: 'NASA GPM IMERG Early Run',
    dataType: 'Multi-satellite precipitation estimates',
    frequency: '30-minute global latency',
    status: 'PLANNED',
    lastUpdate: 'Planned Q3 2026',
    notes: 'Regional backup for radar when mountainous shadowing occurs.',
  },
  {
    source: 'Autonomous Solar Camera Nodes (CAM-01 to 06)',
    dataType: 'Real-time Edge CV optical velocity & water rise anomalies',
    frequency: '15 FPS edge processing / 5-min heartbeat',
    status: 'PLANNED',
    lastUpdate: 'Prototype design complete / Hardware pending',
    notes: 'Physical field installation on bridge corridors and ghat slopes.',
  },
];

export default function ProductionRoadmap() {
  const [tier, setTier] = useState<'demo' | 'pilot' | 'regional'>('pilot');
  const [monitoredBasins, setMonitoredBasins] = useState(3); // e.g. Chaliyar, Kabini, Iruvanjippuzha
  const [cameraNodesCount, setCameraNodesCount] = useState(6);

  // AWS Pricing Model (Mumbai ap-south-1) based on official calculator formulas
  const costCalculations = useMemo(() => {
    if (tier === 'demo') {
      return {
        computeFargate: 42,
        databaseRds: 54,
        cacheValkey: 15,
        s3Storage: 8,
        monitoringCloudwatch: 12,
        albNetworking: 18,
        vercelFrontend: 20,
        camerasEdgeSimulated: 0,
        totalUsd: 169,
        inrEquivalent: '₹14,200 / mo',
        tierLabel: 'Developer / Pilot Demo Tier',
        targetScale: 'Single Subcatchment (Chooralmala Demo)',
      };
    } else if (tier === 'pilot') {
      const fargateUnits = 2 + Math.floor(monitoredBasins / 2);
      const fargateCost = fargateUnits * 48;
      const rdsCost = 140;
      const cacheCost = 35;
      const albCost = 28;
      const s3Cost = 25;
      const cloudwatchCost = 32;
      const cameraHardwareAmortized = cameraNodesCount * 38;
      const simConnectivity = cameraNodesCount * 4.5;
      const vercelCost = 20;

      const total = fargateCost + rdsCost + cacheCost + albCost + s3Cost + cloudwatchCost + cameraHardwareAmortized + simConnectivity + vercelCost;

      return {
        computeFargate: Math.round(fargateCost),
        databaseRds: rdsCost,
        cacheValkey: cacheCost,
        s3Storage: s3Cost,
        monitoringCloudwatch: cloudwatchCost,
        albNetworking: albCost,
        vercelFrontend: vercelCost,
        camerasEdgeSimulated: Math.round(cameraHardwareAmortized + simConnectivity),
        totalUsd: Math.round(total),
        inrEquivalent: `₹${Math.round(total * 84).toLocaleString()} / mo`,
        tierLabel: 'Wayanad District Pilot (Production)',
        targetScale: `${monitoredBasins} River Basins · ${cameraNodesCount} Solar Camera Nodes`,
      };
    } else {
      const fargateCost = 380;
      const rdsCost = 540;
      const cacheCost = 120;
      const albCost = 65;
      const s3Cost = 90;
      const cloudwatchCost = 110;
      const cameraHardwareAmortized = 24 * 38;
      const simConnectivity = 24 * 4.5;
      const vercelCost = 50;

      const total = fargateCost + rdsCost + cacheCost + albCost + s3Cost + cloudwatchCost + cameraHardwareAmortized + simConnectivity + vercelCost;

      return {
        computeFargate: fargateCost,
        databaseRds: rdsCost,
        cacheValkey: cacheCost,
        s3Storage: s3Cost,
        monitoringCloudwatch: cloudwatchCost,
        albNetworking: albCost,
        vercelFrontend: vercelCost,
        camerasEdgeSimulated: Math.round(cameraHardwareAmortized + simConnectivity),
        totalUsd: Math.round(total),
        inrEquivalent: `₹${Math.round(total * 84).toLocaleString()} / mo`,
        tierLabel: 'Western Ghats Regional Scale',
        targetScale: '3 Mountain Districts (Wayanad, Idukki, Nilgiris)',
      };
    }
  }, [tier, monitoredBasins, cameraNodesCount]);

  return (
    <div className="min-h-screen bg-[#F6F5F2] text-[#141518] selection:bg-[#DDD6EE] selection:text-[#141518] font-sans">
      <LandingNav />

      <main className="pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Page Title & Mission (4th Image Editorial Style) */}
        <div className="space-y-4 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[#141518] font-bold bg-[#DDD6EE] px-3.5 py-1 rounded-full border border-[#C5BADF]">
              DEPLOYMENT BLUEPRINT & COST ARCHITECTURE
            </span>
            <DataHonestyBadge kind="PLANNED" size="sm" />
          </div>

          <h1 className="font-display font-extrabold text-4xl sm:text-6xl text-[#141518] tracking-tight leading-[1.06]">
            FROM PROTOTYPE <br />
            <span className="italic font-serif font-normal text-[#4B435C] underline decoration-[#DDD6EE] decoration-4 underline-offset-8">
              TO REGIONAL PRODUCTION.
            </span>
          </h1>

          <p className="font-sans text-base sm:text-xl text-[#4A4D54] leading-relaxed pt-1">
            How FloodGuard transitions from our verified software engine to field-deployed physical sensors, 
            resilient cloud compute in AWS Mumbai (<code className="text-violet-700 font-mono text-sm">ap-south-1</code>), 
            and official integration with the Kerala State Disaster Management Authority.
          </p>
        </div>

        {/* 1. Seven-Layer System Architecture Diagram */}
        <section className="space-y-8">
          <div className="border-b border-[#E6E4DE] pb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-2xl text-[#141518] flex items-center gap-2.5">
              <Layers className="h-6 w-6 text-violet-700" />
              END-TO-END 7-LAYER SYSTEM PIPELINE
            </h2>
            <span className="text-xs font-mono text-[#6A6D75]">HIGH-THROUGHPUT · LOW-LATENCY</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Layer 1 */}
            <div className="p-5 rounded-3xl bg-white border border-[#E6E4DE] space-y-3 shadow-xs">
              <div className="text-xs font-mono text-violet-700 font-bold">LAYER 1 · INGESTION</div>
              <div className="text-sm font-bold text-[#141518]">Multi-Source Data Gateway</div>
              <p className="text-xs text-[#52555E] leading-normal">
                Continuous polling of IMD Doppler radar, Open-Meteo numerical forecasts, Copernicus DEM rasters, and AWS IoT Core MQTT feeds.
              </p>
              <div className="text-[10px] font-mono text-[#787B85]">Tech: Celery Beat, HTTPX, MQTT Broker</div>
            </div>

            {/* Layer 2 */}
            <div className="p-5 rounded-3xl bg-white border border-[#E6E4DE] space-y-3 shadow-xs">
              <div className="text-xs font-mono text-violet-700 font-bold">LAYER 2 · QUALITY & REPROJ</div>
              <div className="text-sm font-bold text-[#141518]">Spatial Validation Pipeline</div>
              <p className="text-xs text-[#52555E] leading-normal">
                Coordinate reprojection (WGS84 EPSG:4326 to UTM 43N), raster hydrological conditioning, nodata filling, and bounds verification.
              </p>
              <div className="text-[10px] font-mono text-[#787B85]">Tech: Rasterio, Shapely, PyProj, NumPy</div>
            </div>

            {/* Layer 3 */}
            <div className="p-5 rounded-3xl bg-white border border-[#E6E4DE] space-y-3 shadow-xs">
              <div className="text-xs font-mono text-violet-700 font-bold">LAYER 3 · GEOSPATIAL DB</div>
              <div className="text-sm font-bold text-[#141518]">PostGIS 16 Storage Engine</div>
              <p className="text-xs text-[#52555E] leading-normal">
                Spatial indexing via GiST, pgRouting for flood-aware escape route generation, polygon intersection for exposed population calculations.
              </p>
              <div className="text-[10px] font-mono text-[#787B85]">Tech: PostgreSQL 16 + PostGIS + pgRouting</div>
            </div>

            {/* Layer 4 */}
            <div className="p-5 rounded-3xl bg-white border border-[#E6E4DE] space-y-3 shadow-xs">
              <div className="text-xs font-mono text-violet-700 font-bold">LAYER 4 · ML RISK ENGINE</div>
              <div className="text-sm font-bold text-[#141518]">Calibrated Cell Infiltration</div>
              <p className="text-xs text-[#52555E] leading-normal">
                XGBoost classifier ensemble trained on soil AMC, cumulative 24h precipitation, and Manning kinematic wave overland runoff physics.
              </p>
              <div className="text-[10px] font-mono text-[#787B85]">Tech: XGBoost, Scipy, Scikit-learn</div>
            </div>

            {/* Layer 5 */}
            <div className="p-5 rounded-3xl bg-[#EFEBF7] border border-[#DDD6EE] space-y-3 shadow-xs">
              <div className="text-xs font-mono text-violet-900 font-bold">LAYER 5 · HUMAN REVIEW</div>
              <div className="text-sm font-bold text-[#141518]">Officer Verification Triage</div>
              <p className="text-xs text-[#52555E] leading-normal">
                Disaster manager dashboard with incident confirmation, multi-signal evidence checking, and cryptographic audit log commit.
              </p>
              <div className="text-[10px] font-mono text-[#787B85]">Tech: RBAC JWT, FastAPI, Audit Table</div>
            </div>

            {/* Layer 6 */}
            <div className="p-5 rounded-3xl bg-white border border-[#E6E4DE] space-y-3 shadow-xs">
              <div className="text-xs font-mono text-rose-700 font-bold">LAYER 6 · ALERT BROADCAST</div>
              <div className="text-sm font-bold text-[#141518]">Real-Time Notification Pipeline</div>
              <p className="text-xs text-[#52555E] leading-normal">
                Server-Sent Events (SSE), Web Push (VAPID encryption RFC 8291), CAP XML RSS feeds for official state emergency broadcasting.
              </p>
              <div className="text-[10px] font-mono text-[#787B85]">Tech: Redis Pub/Sub, pywebpush, SSE</div>
            </div>

            {/* Layer 7 */}
            <div className="p-5 rounded-3xl bg-white border border-[#E6E4DE] space-y-3 col-span-1 md:col-span-2 shadow-xs">
              <div className="text-xs font-mono text-violet-700 font-bold">LAYER 7 · CLIENT RUNTIMES</div>
              <div className="text-sm font-bold text-[#141518]">3D Situational Map & Citizen Emergency PWA</div>
              <p className="text-xs text-[#52555E] leading-normal">
                GPU-accelerated MapLibre 3D terrain command center for EOCs, and an offline-first mobile PWA for citizens with browser Geolocation API location pinning.
              </p>
              <div className="text-[10px] font-mono text-[#787B85]">Tech: MapLibre GL, React 18, ServiceWorker PWA, Vite</div>
            </div>
          </div>
        </section>

        {/* 2. Hardware Deployment Blueprint */}
        <section className="space-y-8">
          <div className="border-b border-[#E6E4DE] pb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-2xl text-[#141518] flex items-center gap-2.5">
              <Radio className="h-6 w-6 text-amber-600" />
              PHYSICAL HARDWARE DEPLOYMENT BLUEPRINT
            </h2>
            <DataHonestyBadge kind="PLANNED" size="sm" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-[#EFEBF7] asymmetric-card-top-right border border-[#DDD6EE] space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-full bg-white text-[#141518] flex items-center justify-center shadow-xs">
                <Sun className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#141518]">Autonomous Solar & Power</h3>
              <p className="text-xs text-[#4A4D54] leading-relaxed">
                60W Monocrystalline solar panel paired with a 12V 42Ah LiFePO4 battery pack, engineered for 72 hours of autonomous operation during continuous monsoon cloud overcast.
              </p>
              <div className="text-[11px] font-mono text-[#6A6D75] border-t border-[#DDD6EE] pt-2">
                Battery Chemistry: LiFePO4 (-10°C to 60°C rated)
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-[#E6E4DE] space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-full bg-[#EFEBF7] text-violet-700 flex items-center justify-center">
                <Wifi className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#141518]">Dual-Network Telemetry</h3>
              <p className="text-xs text-[#4A4D54] leading-relaxed">
                Industrial 4G/LTE Cat-1 gateway with dual eSIM failover (Jio + Airtel), backed by a long-range 868 MHz LoRaWAN transmitter to relay critical river level pulses if cellular towers lose power.
              </p>
              <div className="text-[11px] font-mono text-[#6A6D75] border-t border-[#E6E4DE] pt-2">
                Redundancy: Cellular LTE + LoRaWAN fallback
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-[#E6E4DE] space-y-4 shadow-xs">
              <div className="h-10 w-10 rounded-full bg-[#EFEBF7] text-indigo-700 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#141518]">IP68 Mountain Enclosure</h3>
              <p className="text-xs text-[#4A4D54] leading-relaxed">
                Die-cast aluminum casing with hydrophobic lens coating, internal desiccant breather to prevent condensation, and certified lightning surge arrestor rated to 10kA.
              </p>
              <div className="text-[11px] font-mono text-[#6A6D75] border-t border-[#E6E4DE] pt-2">
                Protection: IP68 submersion & IEC 61643 lightning surge
              </div>
            </div>
          </div>
        </section>

        {/* 3. Satellite & Weather Connector Architecture Matrix */}
        <section className="space-y-6">
          <div className="border-b border-[#E6E4DE] pb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-2xl text-[#141518] flex items-center gap-2.5">
              <Satellite className="h-6 w-6 text-blue-600" />
              SATELLITE, RADAR & WEATHER CONNECTOR MATRIX
            </h2>
            <span className="text-xs font-mono text-[#6A6D75]">DATA TRANSPARENCY REGISTRY</span>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-[#E6E4DE] bg-white shadow-xs">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#FAF9F6] text-[#6A6D75] uppercase text-[10.5px] border-b border-[#E6E4DE]">
                <tr>
                  <th className="p-3.5">SOURCE / FEED</th>
                  <th className="p-3.5">DATA TYPE</th>
                  <th className="p-3.5">FREQUENCY</th>
                  <th className="p-3.5">STATUS</th>
                  <th className="p-3.5">INTEGRATION ROLE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE7DF] text-[#333740]">
                {CONNECTORS.map((c, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF9F6] transition-colors">
                    <td className="p-3.5 font-bold text-[#141518]">{c.source}</td>
                    <td className="p-3.5 text-[#333740]">{c.dataType}</td>
                    <td className="p-3.5 text-[#6A6D75]">{c.frequency}</td>
                    <td className="p-3.5">
                      <DataHonestyBadge kind={c.status} size="sm" />
                    </td>
                    <td className="p-3.5 text-[#6A6D75]">{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Production Cost Breakdown (AWS Mumbai ap-south-1) */}
        <section className="space-y-8">
          <div className="border-b border-[#E6E4DE] pb-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-display font-bold text-2xl text-[#141518] flex items-center gap-2.5">
                <DollarSign className="h-6 w-6 text-emerald-700" />
                WHAT DOES IT COST TO RUN FLOODGUARD?
              </h2>
              <div className="text-xs font-mono text-[#6A6D75] mt-1">
                REGIONAL ESTIMATE MODEL BASED ON AWS MUMBAI (ap-south-1) OFFICIAL PRICING
              </div>
            </div>

            {/* Tier Selector */}
            <div className="inline-flex items-center p-1 rounded-full bg-white border border-[#E6E4DE] gap-1 font-mono text-xs shadow-xs">
              <button
                onClick={() => setTier('demo')}
                className={`px-4 py-1.5 rounded-full transition-all ${
                  tier === 'demo' ? 'bg-[#141518] text-white font-bold' : 'text-[#4A4D54] hover:text-[#141518]'
                }`}
              >
                1. Demo / Dev
              </button>
              <button
                onClick={() => setTier('pilot')}
                className={`px-4 py-1.5 rounded-full transition-all ${
                  tier === 'pilot' ? 'bg-[#141518] text-white font-bold' : 'text-[#4A4D54] hover:text-[#141518]'
                }`}
              >
                2. District Pilot
              </button>
              <button
                onClick={() => setTier('regional')}
                className={`px-4 py-1.5 rounded-full transition-all ${
                  tier === 'regional' ? 'bg-[#141518] text-white font-bold' : 'text-[#4A4D54] hover:text-[#141518]'
                }`}
              >
                3. Western Ghats Scale
              </button>
            </div>
          </div>

          {/* Interactive Parameters (for Pilot Tier) */}
          {tier === 'pilot' && (
            <div className="p-6 rounded-3xl bg-white border border-[#E6E4DE] grid grid-cols-1 sm:grid-cols-2 gap-6 shadow-xs">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-[#141518]">
                  <span>Monitored River Basins:</span>
                  <span className="text-violet-700 font-bold">{monitoredBasins} Basins</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={monitoredBasins}
                  onChange={(e) => setMonitoredBasins(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#DDD6EE] rounded-lg appearance-none cursor-pointer accent-[#141518]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-[#141518]">
                  <span>Planned Camera Nodes:</span>
                  <span className="text-amber-700 font-bold">{cameraNodesCount} Nodes</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="16"
                  value={cameraNodesCount}
                  onChange={(e) => setCameraNodesCount(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#DDD6EE] rounded-lg appearance-none cursor-pointer accent-amber-600"
                />
              </div>
            </div>
          )}

          {/* Cost Items Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Category Breakdown (7 cols) - White Porcelain Card */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-[#E6E4DE] p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DF] text-xs font-mono text-[#6A6D75]">
                <span>INFRASTRUCTURE CATEGORY</span>
                <span>ESTIMATED / MO (USD)</span>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                  <div>
                    <span className="text-[#141518] font-bold">1. Cloud Compute:</span> AWS ECS Fargate (ap-south-1)
                    <div className="text-[10px] text-[#787B85]">FastAPI backend + Celery workers (vCPU + RAM per second)</div>
                  </div>
                  <span className="text-violet-700 font-bold">${costCalculations.computeFargate}</span>
                </div>

                <div className="flex justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                  <div>
                    <span className="text-[#141518] font-bold">2. Geospatial Database:</span> Amazon RDS PostgreSQL 16 + PostGIS
                    <div className="text-[10px] text-[#787B85]">Multi-AZ redundancy, automated backups & pgRouting</div>
                  </div>
                  <span className="text-violet-700 font-bold">${costCalculations.databaseRds}</span>
                </div>

                <div className="flex justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                  <div>
                    <span className="text-[#141518] font-bold">3. Caching & PubSub:</span> Amazon ElastiCache Serverless (Valkey)
                    <div className="text-[10px] text-[#787B85]">Usage-based billing on data storage GB-hr + ECPUs</div>
                  </div>
                  <span className="text-violet-700 font-bold">${costCalculations.cacheValkey}</span>
                </div>

                <div className="flex justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                  <div>
                    <span className="text-[#141518] font-bold">4. Object Storage & CDN:</span> Amazon S3 + CloudFront
                    <div className="text-[10px] text-[#787B85]">Copernicus DEM tiles, model checkpoints & audit artifacts</div>
                  </div>
                  <span className="text-violet-700 font-bold">${costCalculations.s3Storage}</span>
                </div>

                <div className="flex justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                  <div>
                    <span className="text-[#141518] font-bold">5. Load Balancing & Network:</span> AWS ALB
                    <div className="text-[10px] text-[#787B85]">TLS 1.3 termination, DDOS mitigation & WebSocket proxy</div>
                  </div>
                  <span className="text-violet-700 font-bold">${costCalculations.albNetworking}</span>
                </div>

                <div className="flex justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                  <div>
                    <span className="text-[#141518] font-bold">6. Monitoring & Logging:</span> Amazon CloudWatch
                    <div className="text-[10px] text-[#787B85]">API latency alarms, task logs, worker health checks</div>
                  </div>
                  <span className="text-violet-700 font-bold">${costCalculations.monitoringCloudwatch}</span>
                </div>

                <div className="flex justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                  <div>
                    <span className="text-[#141518] font-bold">7. Edge Hardware Amortization:</span> Solar Nodes + SIM
                    <div className="text-[10px] text-[#787B85]">$450 per solar camera node amortized over 12 mo + 4G IoT SIMs</div>
                  </div>
                  <span className="text-amber-700 font-bold">${costCalculations.camerasEdgeSimulated}</span>
                </div>

                <div className="flex justify-between p-3 rounded-2xl bg-[#FAF9F6] border border-[#E6E4DE]">
                  <div>
                    <span className="text-[#141518] font-bold">8. Edge Frontend Hosting:</span> Vercel Pro
                    <div className="text-[10px] text-[#787B85]">Global edge caching, PWA assets, zero cold starts</div>
                  </div>
                  <span className="text-violet-700 font-bold">${costCalculations.vercelFrontend}</span>
                </div>
              </div>
            </div>

            {/* Total Budget Summary (5 cols) - Lavender Asymmetric Card from Image 4 */}
            <div className="lg:col-span-5 bg-[#DDD6EE] rounded-3xl asymmetric-card-top-right border border-[#C5BAE0] p-6 space-y-6 shadow-sm text-[#141518]">
              <div>
                <span className="text-xs font-mono text-[#3D3748] uppercase tracking-wider font-bold">
                  {costCalculations.tierLabel}
                </span>
                <div className="text-xs font-mono text-[#554E63] mt-0.5">
                  SCOPE: {costCalculations.targetScale}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/90 border border-[#C5BAE0] space-y-1 shadow-2xs">
                <div className="text-xs font-mono text-[#6A6D75]">TOTAL ESTIMATED MONTHLY RUN RATE:</div>
                <div className="text-3xl sm:text-4xl font-display font-extrabold text-[#141518]">
                  ${costCalculations.totalUsd} <span className="text-sm font-sans font-normal text-[#6A6D75]">/ month</span>
                </div>
                <div className="text-sm font-mono font-bold text-emerald-800">
                  Approx: {costCalculations.inrEquivalent}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/80 border border-[#C5BAE0] text-xs font-mono text-[#333740] space-y-2 leading-relaxed">
                <div className="font-bold text-[#141518] flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  COST HONESTY DISCLAIMER
                </div>
                <p className="text-[#555861] text-[11px]">
                  ESTIMATE ONLY. Actual cloud consumption depends on real-time invocation volume during monsoonal storm spikes, 
                  storage duration of high-resolution radar GeoTIFFs, and local telecom data tariffs in India.
                </p>
              </div>

              <Link
                to="/app"
                className="w-full py-3.5 rounded-full bg-[#141518] hover:bg-[#252830] text-white font-bold text-xs font-mono shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <Terminal className="h-4 w-4" />
                <span>EXPERIENCE RUNNING APPLICATION</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 5. Demo vs Production Capability Comparison Matrix */}
        <section className="space-y-6">
          <div className="border-b border-[#E6E4DE] pb-4">
            <h2 className="font-display font-bold text-2xl text-[#141518]">
              DEMO PROTOTYPE VS. PRODUCTION CAPABILITY
            </h2>
            <p className="text-xs font-mono text-[#6A6D75] mt-1">
              Clear technical differentiation between active workspace capabilities and planned field deployment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Demo */}
            <div className="p-6 rounded-3xl bg-white border border-[#E6E4DE] space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE7DF]">
                <span className="font-display font-bold text-lg text-emerald-800">CURRENT WORKSPACE</span>
                <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300 font-bold">
                  FULLY FUNCTIONAL
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-[#4A4D54]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-none" />
                  <span><strong>3D MapLibre Command Center:</strong> 3D elevation terrain, buildings, river tributaries, POIs for Wayanad.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-none" />
                  <span><strong>Hydrological Cell Solver:</strong> Live simulation of rainfall runoff, flow velocity, and water accumulation depth.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-none" />
                  <span><strong>Emergency SOS & Rescue Routing:</strong> PWA location pinning, rescue dispatch, and evacuation tracking.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-none" />
                  <span><strong>Live Weather Telemetry:</strong> Real Open-Meteo API integration with Doppler radar reflections.</span>
                </li>
              </ul>
            </div>

            {/* Production */}
            <div className="p-6 rounded-3xl bg-[#EFEBF7] border border-[#DDD6EE] space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDD6EE]">
                <span className="font-display font-bold text-lg text-violet-900">REGIONAL PRODUCTION DEPLOYMENT</span>
                <span className="text-xs font-mono bg-[#DDD6EE] text-[#141518] px-2.5 py-0.5 rounded-full border border-[#C5BAE0] font-bold">
                  PLANNED HORIZON
                </span>
              </div>
              <ul className="space-y-2.5 text-xs text-[#4A4D54]">
                <li className="flex items-start gap-2">
                  <Activity className="h-4 w-4 text-violet-700 mt-0.5 flex-none" />
                  <span><strong>Physical Solar Camera Nodes:</strong> IP68 edge camera hardware deployed on physical ghat bridges.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Activity className="h-4 w-4 text-violet-700 mt-0.5 flex-none" />
                  <span><strong>Continuous Radar Feed Pipeline:</strong> Dedicated direct fiber/VPN pipeline into IMD C-band radar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Activity className="h-4 w-4 text-violet-700 mt-0.5 flex-none" />
                  <span><strong>District EOC Integration:</strong> Official bilateral tie-up with Kerala State Disaster Management Authority.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Activity className="h-4 w-4 text-violet-700 mt-0.5 flex-none" />
                  <span><strong>Cell Broadcast SIREN:</strong> Direct integration with national Common Alerting Protocol (CAP) gateway.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
