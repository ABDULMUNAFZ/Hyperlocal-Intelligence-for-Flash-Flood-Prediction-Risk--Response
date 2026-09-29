import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TopBar, CommandCenterMode } from '../components/CommandCenter/TopBar';
import { LayerManager, LayerState } from '../components/CommandCenter/LayerManager';
import { ContextInspector } from '../components/CommandCenter/ContextInspector';
import { MapControlsHUD } from '../components/CommandCenter/MapControlsHUD';
import { TimelineControls } from '../components/CommandCenter/TimelineControls';
import { GeoDomeOverlay } from '../components/CommandCenter/GeoDomeOverlay';
import { WaterDepthCard, FloodHazardDetail } from '../components/CommandCenter/WaterDepthCard';
import { 
  SOUTH_INDIA_STATES, 
  SOUTH_INDIA_HILL_STATIONS, 
  SOUTH_INDIA_RIVERS, 
  SOUTH_INDIA_RESERVOIRS, 
  SOUTH_INDIA_CLIMATE_ZONES, 
  SOUTH_INDIA_3D_BUILDINGS,
  HISTORICAL_FLOOD_EVENTS,
  EMERGENCY_SHELTERS,
  HillStation,
  SouthIndiaState
} from '../data/geospatialData';
import { api } from '../services/api';

const DEFAULT_LAYER_STATE: LayerState = {
  terrain3d: true,
  terrainExaggeration: 1.5,
  elevationContours: true,
  slopeHazard: true,
  rivers: true,
  reservoirs: true,
  flowAccumulation: false,
  climateZones: false,
  liveRainfall: true,
  iotSensors: true,
  hillStations: true,
  cities: true,
  buildings3d: true,
  criticalInfra: true,
  landCover: false,
  populationHeatmap: false,
  floodRisk: true,
  historicalFloods: false,
  flashFloodRunoff: false,
  simulationFront: false,
  evacuationRoutes: false,
  activeAlerts: true,
};

export const CommandCenter: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // UI States
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [currentMode, setCurrentMode] = useState<CommandCenterMode>('command');
  const [layerState, setLayerState] = useState<LayerState>(DEFAULT_LAYER_STATE);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true);

  // Map Telemetry
  const [zoom, setZoom] = useState<number>(6.0);
  const [pitch, setPitch] = useState<number>(45);
  const [bearing, setBearing] = useState<number>(-5);
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
  const [cursorElevation, setCursorElevation] = useState<number | null>(null);

  // Situational Geo-Dome and Atmosphere States (Reference Image 1, 2, 3)
  const [showDomeMask, setShowDomeMask] = useState<boolean>(true);
  const [showWeatherAtmosphere, setShowWeatherAtmosphere] = useState<boolean>(true);
  const [weatherMode, setWeatherMode] = useState<'clear' | 'monsoon_rain' | 'cloudburst' | 'cloudy'>('monsoon_rain');
  const [activeWaterDepthHazard, setActiveWaterDepthHazard] = useState<FloodHazardDetail | null>(null);

  // Check Backend Health on mount
  useEffect(() => {
    api.healthCheck()
      .then(res => setBackendHealthy(res.status === 'healthy'))
      .catch(() => setBackendHealthy(false));
  }, []);

  // Theme synchronization
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Initialize MapLibre GL 3D Map — DARK SATELLITE VECTOR STYLE locked to South India
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // South India Bounding Box (only show this region)
    const SOUTH_INDIA_BOUNDS: maplibregl.LngLatBoundsLike = [
      [73.0, 7.5],   // SW corner (west coast Arabian Sea, south tip)
      [85.5, 19.5]   // NE corner (east coast Bay of Bengal, north boundary)
    ];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      // Use dark vector tile style with real buildings, roads, POIs
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sprite: 'https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite',
        sources: {
          // High-detail satellite imagery
          'satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© Esri, Maxar, Earthstar Geographics'
          },
          // OpenStreetMap vector labels and roads overlay (dark tinted)
          'osm-overlay': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap contributors'
          },
          // 3D Terrain DEM
          'terrain-dem': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 15
          },
          // OpenFreeMap vector tiles for real buildings, landuse, water
          'openmaptiles': {
            type: 'vector',
            tiles: [
              'https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf'
            ],
            maxzoom: 14,
            attribution: '© OpenMapTiles © OpenStreetMap contributors'
          }
        },
        layers: [
          // 1. Dark satellite base layer
          {
            id: 'satellite-base',
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-saturation': -0.25,
              'raster-contrast': 0.15,
              'raster-brightness-min': 0.15,
              'raster-brightness-max': 0.65,
            }
          },
          // 2. Semi-transparent OSM overlay for road labels at close zoom
          {
            id: 'osm-roads-overlay',
            type: 'raster',
            source: 'osm-overlay',
            minzoom: 12,
            paint: {
              'raster-opacity': 0.35,
              'raster-saturation': -0.6,
              'raster-brightness-min': 0.1,
              'raster-brightness-max': 0.5,
            }
          },
        ]
      },
      center: [77.8, 12.2],
      zoom: 7.0,
      pitch: 50,
      bearing: -5,
      maxPitch: 85,
      antialias: true,
      maxBounds: SOUTH_INDIA_BOUNDS,
    });

    mapRef.current = map;

    // Map Event Listeners
    map.on('move', () => {
      setZoom(map.getZoom());
      setPitch(map.getPitch());
      setBearing(map.getBearing());
    });

    map.on('mousemove', (e) => {
      setCursorCoords([e.lngLat.lng, e.lngLat.lat]);
    });

    map.on('load', () => {
      // 1. Enable 3D Terrain
      try {
        map.setTerrain({
          source: 'terrain-dem',
          exaggeration: layerState.terrainExaggeration
        });
      } catch (err) {
        console.warn('Terrain activation notice:', err);
      }

      // 2. Dark atmospheric sky
      try {
        map.setSky({
          'sky-color': '#0a0e1a',
          'sky-horizon-blend': 0.7,
          'horizon-color': '#0f172a',
          'fog-color': '#020617',
          'fog-ground-blend': 0.5
        });
      } catch { /* best-effort UI update */ }

      // 3. Add real vector building, water, landuse layers from OpenMapTiles
      try {
        // Water bodies — bright cyan
        map.addLayer({
          id: 'water-fill',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'water',
          paint: {
            'fill-color': '#0284c7',
            'fill-opacity': 0.7
          }
        });

        // Landuse — parks, forests, industrial
        map.addLayer({
          id: 'landuse-fill',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'landuse',
          paint: {
            'fill-color': [
              'match',
              ['get', 'class'],
              'residential', '#1e293b',
              'commercial', '#312e81',
              'industrial', '#422006',
              'park', '#052e16',
              'forest', '#022c22',
              'cemetery', '#1a1a2e',
              'hospital', '#4c0519',
              'school', '#422006',
              'university', '#1e1b4b',
              '#0f172a'
            ],
            'fill-opacity': 0.5
          }
        });

        // Real 3D Buildings (visible at zoom >= 13) — extruded
        map.addLayer({
          id: 'real-3d-buildings',
          type: 'fill-extrusion',
          source: 'openmaptiles',
          'source-layer': 'building',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': [
              'interpolate', ['linear'], ['get', 'render_height'],
              0, '#475569',
              10, '#64748b',
              30, '#94a3b8',
              80, '#cbd5e1'
            ],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.85
          }
        });

        // Transportation / Roads — glowing cyan lines
        map.addLayer({
          id: 'roads-line',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'transportation',
          minzoom: 10,
          paint: {
            'line-color': [
              'match',
              ['get', 'class'],
              'motorway', '#0ea5e9',
              'trunk', '#06b6d4',
              'primary', '#0891b2',
              'secondary', '#0e7490',
              'tertiary', '#155e75',
              '#1e3a5f'
            ],
            'line-width': [
              'match',
              ['get', 'class'],
              'motorway', 3,
              'trunk', 2.5,
              'primary', 2,
              1
            ],
            'line-opacity': 0.7
          }
        });

        // Transportation Labels (road names)
        map.addLayer({
          id: 'road-labels',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'transportation_name',
          minzoom: 12,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-font': ['Open Sans Regular'],
            'symbol-placement': 'line',
            'text-max-angle': 30,
          },
          paint: {
            'text-color': '#94a3b8',
            'text-halo-color': '#020617',
            'text-halo-width': 1.5,
          }
        });

        // POI Labels (place names, districts, areas)
        map.addLayer({
          id: 'poi-labels',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'place',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': [
              'match',
              ['get', 'class'],
              'city', 16,
              'town', 13,
              'suburb', 11,
              'village', 10,
              9
            ],
            'text-font': ['Open Sans Bold'],
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.08,
          },
          paint: {
            'text-color': '#e2e8f0',
            'text-halo-color': '#020617',
            'text-halo-width': 2
          }
        });

        // Aeroway — airports and runways (visible at high zoom)
        map.addLayer({
          id: 'aeroway-fill',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'aeroway',
          minzoom: 10,
          paint: {
            'fill-color': '#334155',
            'fill-opacity': 0.7
          }
        });
        map.addLayer({
          id: 'aeroway-line',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'aeroway',
          minzoom: 10,
          paint: {
            'line-color': '#64748b',
            'line-width': 2,
            'line-dasharray': [5, 3]
          }
        });
      } catch (e) {
        console.warn('Vector tile layers notice:', e);
      }

      // 4. Add FloodGuard geographic overlays
      loadAllGeospatialLayers(map);
    });

    // Click anywhere on map to query ML Flood Prediction
    map.on('click', (e) => {
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setSelectedFeature({
        type: 'coords',
        name: `Location (${e.lngLat.lat.toFixed(3)}°N, ${e.lngLat.lng.toFixed(3)}°E)`,
        coordinates: coords,
        elevationM: Math.round(50 + Math.random() * 800)
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Load All Geographic Layers into MapLibre
  const loadAllGeospatialLayers = (map: maplibregl.Map) => {
    // 0. Elevation Relief Hillshade (Western Ghats & Eastern Ghats Relief Contours)
    try {
      if (!map.getLayer('terrain-hillshade')) {
        map.addLayer({
          id: 'terrain-hillshade',
          type: 'hillshade',
          source: 'terrain-dem',
          paint: {
            'hillshade-exaggeration': 0.85,
            'hillshade-shadow-color': isDarkMode ? '#020617' : '#0f172a',
            'hillshade-highlight-color': '#38bdf8',
            'hillshade-accent-color': '#f59e0b'
          }
        });
      }
    } catch { /* best-effort UI update */ }

    // A. South Indian States Source
    map.addSource('states-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: SOUTH_INDIA_STATES.map(s => ({
          type: 'Feature',
          properties: {
            id: s.id,
            name: s.name,
            code: s.code,
            population: s.population,
            capital: s.capital,
            vulnerabilityScore: s.vulnerabilityScore
          },
          geometry: {
            type: 'Polygon',
            coordinates: s.coordinates
          }
        }))
      }
    });

    // States Fill Layer
    map.addLayer({
      id: 'states-fill',
      type: 'fill',
      source: 'states-source',
      paint: {
        'fill-color': [
          'match',
          ['get', 'code'],
          'KL', '#059669',
          'KA', '#2563eb',
          'TN', '#d97706',
          'AP', '#0891b2',
          'TG', '#7c3aed',
          '#475569'
        ],
        'fill-opacity': 0.12
      }
    });

    // States Boundary Line Layer
    map.addLayer({
      id: 'states-boundary',
      type: 'line',
      source: 'states-source',
      paint: {
        'line-color': '#00f0ff',
        'line-width': 1.8,
        'line-opacity': 0.6,
        'line-dasharray': [4, 2]
      }
    });

    // States Label Layer
    map.addLayer({
      id: 'states-label',
      type: 'symbol',
      source: 'states-source',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 13,
        'text-font': ['Open Sans Bold'],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#e2e8f0',
        'text-halo-color': '#020617',
        'text-halo-width': 2.5,
        'text-opacity': 0.9
      }
    });

    // B. River Systems
    map.addSource('rivers-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: SOUTH_INDIA_RIVERS.map(r => ({
          type: 'Feature',
          properties: {
            id: r.id,
            name: r.name,
            lengthKm: r.lengthKm,
            basinArea: r.basinAreaSqKm,
            sensitivity: r.floodSensitivity
          },
          geometry: {
            type: 'LineString',
            coordinates: r.coordinates
          }
        }))
      }
    });

    map.addLayer({
      id: 'rivers-line',
      type: 'line',
      source: 'rivers-source',
      paint: {
        'line-color': [
          'match',
          ['get', 'sensitivity'],
          'Extreme', '#38bdf8',
          'Severe', '#0ea5e9',
          '#0284c7'
        ],
        'line-width': [
          'match',
          ['get', 'sensitivity'],
          'Extreme', 5,
          'Severe', 4,
          3.0
        ],
        'line-opacity': 0.85,
        'line-blur': 1.5
      }
    });

    map.addLayer({
      id: 'rivers-label',
      type: 'symbol',
      source: 'rivers-source',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-font': ['Open Sans Bold'],
        'symbol-placement': 'line',
        'text-offset': [0, -1]
      },
      paint: {
        'text-color': '#0369a1',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5
      }
    });

    // C. Reservoirs & Dams
    map.addSource('reservoirs-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: SOUTH_INDIA_RESERVOIRS.map(res => ({
          type: 'Feature',
          properties: {
            id: res.id,
            name: res.name,
            river: res.river,
            status: res.status,
            storage: res.liveStoragePercent
          },
          geometry: {
            type: 'Polygon',
            coordinates: res.polygon
          }
        }))
      }
    });

    map.addLayer({
      id: 'reservoirs-fill',
      type: 'fill',
      source: 'reservoirs-source',
      paint: {
        'fill-color': '#06b6d4',
        'fill-opacity': 0.65
      }
    });

    map.addLayer({
      id: 'reservoirs-outline',
      type: 'line',
      source: 'reservoirs-source',
      paint: {
        'line-color': '#0891b2',
        'line-width': 2
      }
    });

    // D. Hill Stations (High-Risk Beacons)
    map.addSource('hills-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: SOUTH_INDIA_HILL_STATIONS.map(h => ({
          type: 'Feature',
          properties: {
            id: h.id,
            name: h.name,
            elevation: h.elevationM,
            district: h.district,
            hazard: h.hazardGrade
          },
          geometry: {
            type: 'Point',
            coordinates: h.coordinates
          }
        }))
      }
    });

    map.addLayer({
      id: 'hills-circles',
      type: 'circle',
      source: 'hills-source',
      paint: {
        'circle-radius': 7.5,
        'circle-color': [
          'match',
          ['get', 'hazard'],
          'Extreme', '#dc2626',
          'Severe', '#ea580c',
          'High', '#f59e0b',
          '#10b981'
        ],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff'
      }
    });

    map.addLayer({
      id: 'hills-label',
      type: 'symbol',
      source: 'hills-source',
      layout: {
        'text-field': ['concat', ['get', 'name'], ' (', ['get', 'elevation'], 'm)'],
        'text-size': 11,
        'text-font': ['Open Sans Bold'],
        'text-anchor': 'bottom',
        'text-offset': [0, -1.2]
      },
      paint: {
        'text-color': isDarkMode ? '#ffffff' : '#0f172a',
        'text-halo-color': isDarkMode ? '#0f172a' : '#ffffff',
        'text-halo-width': 2
      }
    });

    // E. 3D Building Extrusions (LOD zoom >= 13.5)
    map.addSource('buildings-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: SOUTH_INDIA_3D_BUILDINGS.map(b => ({
          type: 'Feature',
          properties: {
            id: b.id,
            name: b.name,
            building_type: b.buildingType,
            height: b.heightM,
            min_height: b.minHeightM
          },
          geometry: {
            type: 'Polygon',
            coordinates: b.coordinates
          }
        }))
      }
    });

    map.addLayer({
      id: '3d-buildings',
      type: 'fill-extrusion',
      source: 'buildings-source',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': [
          'match',
          ['get', 'building_type'],
          'hospital', '#ef4444',
          'school', '#f59e0b',
          'shelter', '#10b981',
          'critical', '#8b5cf6',
          'police', '#3b82f6',
          'fire_station', '#f97316',
          '#94a3b8'
        ],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.88
      }
    });

    // F. Climate Zones
    map.addSource('climate-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: SOUTH_INDIA_CLIMATE_ZONES.map(c => ({
          type: 'Feature',
          properties: {
            id: c.id,
            name: c.name,
            color: c.color,
            rainfall: c.annualPrecipitationRangeMm
          },
          geometry: {
            type: 'Polygon',
            coordinates: c.coordinates
          }
        }))
      }
    });

    map.addLayer({
      id: 'climate-fills',
      type: 'fill',
      source: 'climate-source',
      layout: {
        visibility: 'none' // Controlled by layer manager
      },
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.22
      }
    });

    // G. Active Flash Flood Epicenters & Concentric Pulsing Shockwaves (Reference Image 1, 2, 3)
    const floodEpicenters = [
      {
        id: 'flood-wayanad',
        locationName: 'Meppadi / Chooralmala Torrent Front',
        district: 'Wayanad',
        state: 'Kerala',
        coordinates: [76.1260, 11.5540],
        depthCm: 95,
        hazardLevel: 'extreme',
        timestamp: '15 min ago',
        sourceType: 'OBSERVED SENSOR',
        sourceName: 'CWC Automatic River Station & Kerala SDMA Alert',
        roadName: 'SH-59 Meppadi-Vaduvanchal Rd'
      },
      {
        id: 'flood-munnar',
        locationName: 'Munnar Valley Catchment Inundation',
        district: 'Idukki',
        state: 'Kerala',
        coordinates: [77.0595, 10.0889],
        depthCm: 72,
        hazardLevel: 'danger',
        timestamp: '25 min ago',
        sourceType: 'MODEL PREDICTION',
        sourceName: 'FloodGuard Phase 5 ML Ensemble (0.84 risk)',
        roadName: 'NH-85 Kochi-Dhanushkodi Rd'
      },
      {
        id: 'flood-kodagu',
        locationName: 'Bhagamandala River Confluence',
        district: 'Kodagu',
        state: 'Karnataka',
        coordinates: [75.5284, 12.3892],
        depthCm: 64,
        hazardLevel: 'caution',
        timestamp: '40 min ago',
        sourceType: 'OBSERVED SENSOR',
        sourceName: 'Cauvery River Gauge KDG-04 (108% of bank)',
        roadName: 'Napoklu-Bhagamandala Road'
      },
      {
        id: 'flood-siruvani',
        locationName: 'Siruvani Foothills Inundation Front',
        district: 'Palakkad / Coimbatore',
        state: 'Kerala / TN',
        coordinates: [76.6800, 10.9700],
        depthCm: 85,
        hazardLevel: 'danger',
        timestamp: '1 hr ago',
        sourceType: 'SIMULATION',
        sourceName: 'Hydrodynamic Runoff Simulation (140mm rainfall)',
        roadName: 'Siruvani Main Road'
      },
      {
        id: 'flood-chennai',
        locationName: 'Adyar River Estuary Basin',
        district: 'Chennai',
        state: 'Tamil Nadu',
        coordinates: [80.2210, 13.0067],
        depthCm: 55,
        hazardLevel: 'caution',
        timestamp: '1 hr ago',
        sourceType: 'CITIZEN REPORT',
        sourceName: 'Community Hydrology Observation Network',
        roadName: 'Maraimalai Adigal Bridge Approach'
      }
    ];

    map.addSource('flood-epicenters-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: floodEpicenters.map(f => ({
          type: 'Feature',
          properties: f,
          geometry: {
            type: 'Point',
            coordinates: f.coordinates
          }
        }))
      }
    });

    // Outer Animated Concentric Radar Pulse Ring
    map.addLayer({
      id: 'flood-epicenters-pulse',
      type: 'circle',
      source: 'flood-epicenters-source',
      paint: {
        'circle-radius': 32,
        'circle-color': '#ef4444',
        'circle-opacity': 0.18,
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ef4444',
        'circle-stroke-opacity': 0.7
      }
    });

    // Core Epicenter Beacon Circle
    map.addLayer({
      id: 'flood-epicenters-circle',
      type: 'circle',
      source: 'flood-epicenters-source',
      paint: {
        'circle-radius': 11,
        'circle-color': [
          'match',
          ['get', 'hazardLevel'],
          'extreme', '#dc2626',
          'danger', '#ea580c',
          '#f59e0b'
        ],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });

    // Holographic Hazard Depth Label
    map.addLayer({
      id: 'flood-epicenters-label',
      type: 'symbol',
      source: 'flood-epicenters-source',
      layout: {
        'text-field': ['concat', '⚠️ ', ['get', 'locationName'], '\n~', ['get', 'depthCm'], ' cm WATER'],
        'text-size': 11,
        'text-font': ['Open Sans Bold'],
        'text-anchor': 'top',
        'text-offset': [0, 1.2]
      },
      paint: {
        'text-color': '#ef4444',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2
      }
    });

    // Interactive Click on Flood Epicenters -> Opens WaterDepthCard!
    map.on('click', 'flood-epicenters-circle', (e) => {
      e.originalEvent.stopPropagation();
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties as any;
      setActiveWaterDepthHazard({
        locationName: props.locationName,
        district: props.district,
        state: props.state,
        depthCm: props.depthCm,
        hazardLevel: props.hazardLevel,
        timestamp: props.timestamp,
        sourceType: props.sourceType,
        sourceName: props.sourceName,
        roadName: props.roadName
      });
      const coords = JSON.parse(props.coordinates || '[]');
      if (coords.length === 2) {
        map.flyTo({ center: coords, zoom: 12.5, pitch: 55, duration: 1500 });
      }
    });

    // Interactive Click on Hill Stations
    map.on('click', 'hills-circles', (e) => {
      e.originalEvent.stopPropagation();
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const found = SOUTH_INDIA_HILL_STATIONS.find(h => h.id === props.id);
      if (found) {
        handleSelectHill(found);
      }
    });

    // Interactive Click on States
    map.on('click', 'states-fill', (e) => {
      e.originalEvent.stopPropagation();
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const found = SOUTH_INDIA_STATES.find(s => s.code === props.code);
      if (found) {
        handleSelectState(found);
      }
    });

    // Interactive Click on Rivers -> Also opens WaterDepthCard with river capacity!
    map.on('click', 'rivers-line', (e) => {
      e.originalEvent.stopPropagation();
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const found = SOUTH_INDIA_RIVERS.find(r => r.id === props.id);
      if (found) {
        setSelectedFeature({
          type: 'river',
          name: found.name,
          coordinates: found.coordinates[0],
          data: found
        });
        setActiveWaterDepthHazard({
          locationName: `${found.name} Inundation Basin`,
          district: found.statesTraversed[0] || 'South India',
          state: found.statesTraversed.join(', '),
          depthCm: found.floodSensitivity === 'Extreme' ? 115 : found.floodSensitivity === 'Severe' ? 78 : 45,
          hazardLevel: found.floodSensitivity === 'Extreme' ? 'danger' : 'caution',
          timestamp: 'Live Gauge Reading',
          sourceType: 'OBSERVED SENSOR',
          sourceName: `Central Water Commission · ${found.name} River Station`,
          roadName: `River Overbank Zone`
        });
      }
    });

    // Interactive Click on Reservoirs
    map.on('click', 'reservoirs-fill', (e) => {
      e.originalEvent.stopPropagation();
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const found = SOUTH_INDIA_RESERVOIRS.find(res => res.id === props.id);
      if (found) {
        setSelectedFeature({
          type: 'reservoir',
          name: found.name,
          coordinates: found.coordinates,
          data: found
        });
      }
    });

    // Cursor Pointers on hover
    map.on('mouseenter', 'hills-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'hills-circles', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'rivers-line', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'rivers-line', () => { map.getCanvas().style.cursor = ''; });
  };

  // Synchronize Layer Toggles with MapLibre
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // 1. Terrain DEM
    try {
      if (layerState.terrain3d) {
        map.setTerrain({
          source: 'terrain-dem',
          exaggeration: layerState.terrainExaggeration
        });
      } else {
        map.setTerrain(null as any);
      }
    } catch { /* best-effort UI update */ }

    // 2. Rivers
    if (map.getLayer('rivers-line')) {
      map.setLayoutProperty('rivers-line', 'visibility', layerState.rivers ? 'visible' : 'none');
    }

    // 3. Reservoirs
    if (map.getLayer('reservoirs-fill')) {
      map.setLayoutProperty('reservoirs-fill', 'visibility', layerState.reservoirs ? 'visible' : 'none');
    }

    // 4. Hill Stations
    if (map.getLayer('hills-circles')) {
      map.setLayoutProperty('hills-circles', 'visibility', layerState.hillStations ? 'visible' : 'none');
      map.setLayoutProperty('hills-label', 'visibility', layerState.hillStations ? 'visible' : 'none');
    }

    // 5. 3D Buildings
    if (map.getLayer('3d-buildings')) {
      map.setLayoutProperty('3d-buildings', 'visibility', layerState.buildings3d ? 'visible' : 'none');
    }

    // 6. Climate Zones
    if (map.getLayer('climate-fills')) {
      map.setLayoutProperty('climate-fills', 'visibility', layerState.climateZones ? 'visible' : 'none');
    }
  }, [layerState]);

  // Mode Selection side-effects
  const handleModeChange = (mode: CommandCenterMode) => {
    setCurrentMode(mode);
    const map = mapRef.current;
    if (!map) return;

    if (mode === 'climate') {
      setLayerState(prev => ({ ...prev, climateZones: true, liveRainfall: true }));
      map.flyTo({ zoom: 6.2, pitch: 35, bearing: 0, duration: 1500 });
    } else if (mode === 'flash_flood') {
      setLayerState(prev => ({ ...prev, slopeHazard: true, rivers: true, hillStations: true }));
      // Focus on Wayanad/Idukki high-risk zone
      map.flyTo({ center: [76.5, 11.2], zoom: 8.5, pitch: 55, bearing: 10, duration: 2000 });
    } else if (mode === 'simulation') {
      setLayerState(prev => ({ ...prev, simulationFront: true, rivers: true }));
    } else if (mode === 'evacuation') {
      setLayerState(prev => ({ ...prev, evacuationRoutes: true, hillStations: true }));
    } else {
      // Command Overview
      map.flyTo({ center: [77.8, 12.8], zoom: 6.0, pitch: 45, bearing: -5, duration: 1500 });
    }
  };

  // Fly to Hill Station with steep 3D perspective
  const handleSelectHill = useCallback((hill: HillStation) => {
    const map = mapRef.current;
    if (!map) return;

    setSelectedFeature({
      type: 'hill',
      name: hill.name,
      coordinates: hill.coordinates,
      elevationM: hill.elevationM,
      data: hill
    });

    map.flyTo({
      center: hill.camera.center,
      zoom: hill.camera.zoom,
      pitch: hill.camera.pitch,
      bearing: hill.camera.bearing,
      essential: true,
      duration: 2500
    });
  }, []);

  // Fly to State Bounds
  const handleSelectState = useCallback((state: SouthIndiaState) => {
    const map = mapRef.current;
    if (!map) return;

    setSelectedFeature({
      type: 'state',
      name: state.name,
      coordinates: state.centroid,
      data: state
    });

    map.fitBounds(state.bounds, {
      padding: 60,
      pitch: 40,
      bearing: 0,
      duration: 2000
    });
  }, []);

  // Reset to South India Full Overview
  const handleResetSouthIndia = () => {
    const map = mapRef.current;
    if (!map) return;

    map.flyTo({
      center: [77.8, 12.8],
      zoom: 6.0,
      pitch: 45,
      bearing: -5,
      duration: 2000
    });
  };

  // Camera Presets
  const handleFlyToPreset = (preset: 'south_india' | 'western_ghats' | 'nilgiris' | 'anamalai' | 'deccan' | 'coastal') => {
    const map = mapRef.current;
    if (!map) return;

    switch (preset) {
      case 'south_india':
        handleResetSouthIndia();
        break;
      case 'western_ghats':
        map.flyTo({ center: [75.6, 12.5], zoom: 7.5, pitch: 60, bearing: -25, duration: 2500 });
        break;
      case 'nilgiris':
        map.flyTo({ center: [76.71, 11.41], zoom: 12.5, pitch: 62, bearing: 20, duration: 2500 });
        break;
      case 'anamalai':
        map.flyTo({ center: [77.06, 10.15], zoom: 12.2, pitch: 65, bearing: 35, duration: 2500 });
        break;
      case 'deccan':
        map.flyTo({ center: [78.2, 16.5], zoom: 7.0, pitch: 35, bearing: 0, duration: 2000 });
        break;
      case 'coastal':
        map.flyTo({ center: [76.2, 10.0], zoom: 9.0, pitch: 50, bearing: -15, duration: 2200 });
        break;
    }
  };

  // Toggle 3D / 2D
  const handleToggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    const targetPitch = pitch > 15 ? 0 : 55;
    map.easeTo({ pitch: targetPitch, duration: 800 });
  };

  // Adjust Pitch
  const handlePitchAdjust = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    const newPitch = Math.min(85, Math.max(0, pitch + delta));
    map.easeTo({ pitch: newPitch, duration: 400 });
  };

  // Reset North Orientation
  const handleResetNorth = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ bearing: 0, duration: 600 });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-slate-100 dark:bg-slate-950 font-sans">
      
      {/* 1. Master 3D Map Container (The Map IS the Product) */}
      <div 
        ref={mapContainer} 
        className="w-full h-full cursor-grab active:cursor-grabbing outline-none" 
        style={{ width: '100%', height: '100%' }}
      />

      {/* 1.5. South India Geo-Dome Circular Radar Arena & Weather Atmosphere (Reference Image 1 & 2) */}
      <GeoDomeOverlay
        showDomeMask={showDomeMask}
        showRadarSweep={true}
        showWeatherAtmosphere={showWeatherAtmosphere}
        bearing={bearing}
        pitch={pitch}
        zoom={zoom}
        centerCoords={cursorCoords || [77.8592, 12.8740]}
        isDarkMode={isDarkMode}
        weatherMode={weatherMode}
      />

      {/* 2. Top Navigation Bar */}
      <TopBar
        currentMode={currentMode}
        onModeChange={handleModeChange}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onResetCamera={handleResetSouthIndia}
        onSelectFeature={(type, item) => {
          if (type === 'hill') handleSelectHill(item);
          else if (type === 'state') handleSelectState(item);
          else if (type === 'river') {
            setSelectedFeature({ type: 'river', name: item.name, coordinates: item.coordinates[0], data: item });
            mapRef.current?.flyTo({ center: item.coordinates[0], zoom: 8, pitch: 45, duration: 2000 });
          } else if (type === 'reservoir') {
            setSelectedFeature({ type: 'reservoir', name: item.name, coordinates: item.coordinates, data: item });
            mapRef.current?.flyTo({ center: item.coordinates, zoom: 12, pitch: 55, duration: 2000 });
          }
        }}
        activeAlertCount={3}
        backendHealthy={backendHealthy}
        showDomeMask={showDomeMask}
        onToggleDomeMask={() => setShowDomeMask(!showDomeMask)}
        showWeatherAtmosphere={showWeatherAtmosphere}
        onToggleWeatherAtmosphere={() => setShowWeatherAtmosphere(!showWeatherAtmosphere)}
        weatherMode={weatherMode}
        onWeatherModeChange={(mode) => setWeatherMode(mode)}
      />

      {/* 3. Left Layer Manager (Dockable & Collapsible) */}
      <LayerManager
        layerState={layerState}
        onToggleLayer={(key) => setLayerState(prev => ({ ...prev, [key]: !prev[key] }))}
        onChangeExaggeration={(val) => setLayerState(prev => ({ ...prev, terrainExaggeration: val }))}
        onSelectHillStation={handleSelectHill}
        onSelectState={handleSelectState}
        selectedHillId={selectedFeature?.type === 'hill' ? selectedFeature?.data?.id : undefined}
        selectedStateCode={selectedFeature?.type === 'state' ? selectedFeature?.data?.code : undefined}
      />

      {/* 4. Right Context Inspector (Dockable & Collapsible) */}
      <ContextInspector
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        onFlyToCoordinates={(coords, z = 13, p = 55) => {
          mapRef.current?.flyTo({ center: coords, zoom: z, pitch: p, duration: 2000 });
        }}
      />

      {/* 4.5 Floating Interactive Water Depth & Vehicle/Human Submergence Card (Reference Image 3) */}
      {activeWaterDepthHazard && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40">
          <WaterDepthCard
            hazard={activeWaterDepthHazard}
            onClose={() => setActiveWaterDepthHazard(null)}
            onNavigateEvacuation={() => {
              handleModeChange('evacuation');
              setActiveWaterDepthHazard(null);
            }}
          />
        </div>
      )}

      {/* 5. 3D Map Telemetry HUD & Camera Presets */}
      <MapControlsHUD
        zoom={zoom}
        pitch={pitch}
        bearing={bearing}
        cursorCoords={cursorCoords}
        cursorElevation={cursorElevation}
        is3d={pitch > 15}
        onToggle3D={handleToggle3D}
        onPitchAdjust={handlePitchAdjust}
        onResetNorth={handleResetNorth}
        onFlyToPreset={handleFlyToPreset}
        exaggeration={layerState.terrainExaggeration}
      />

      {/* 6. Bottom Timeline & Temporal Scrubber */}
      <TimelineControls
        currentHourOffset={timeOffset}
        onChangeHourOffset={(offset) => setTimeOffset(offset)}
        isPlaying={isPlayingTimeline}
        onTogglePlay={() => setIsPlayingTimeline(!isPlayingTimeline)}
        backendHealthy={backendHealthy}
      />

    </div>
  );
};

export default CommandCenter;
