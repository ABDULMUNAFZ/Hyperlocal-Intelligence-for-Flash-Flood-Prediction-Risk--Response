// FloodGuard original map style — natural-terrain light theme and operations dark theme.
// Base data: OpenFreeMap (OpenMapTiles schema, © OpenStreetMap contributors),
// terrain: Terrain Tiles on AWS Open Data (Mapzen/Tilezen terrarium; SRTM, GMTED2010, ETOPO1, NED …).
import type { StyleSpecification, Map as MLMap } from 'maplibre-gl';

export type Theme = 'light' | 'dark';

export const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const OVERLAY_ANCHOR = 'road-casing-minor'; // custom raster/fill overlays are inserted below roads

type Palette = Record<string, string | number>;

export const PALETTES: Record<Theme, Palette> = {
  light: {
    background: '#eceee6',
    wood: '#b9d3a0',
    grass: '#d8e6c2',
    farmland: '#e9e4c6',
    wetland: '#cde2da',
    rock: '#d9d3c7',
    residential: '#e8e0d4',
    water: '#8fc1e6',
    waterway: '#4f97d3',
    hillShadow: '#4a3b2a',
    hillHighlight: '#ffffff',
    hillAccent: '#6f5a40',
    roadCasing: '#b3aa9b',
    roadMinor: '#ffffff',
    roadMajor: '#fbe3a1',
    roadTrunk: '#f6c46b',
    track: '#b89f7a',
    building: '#d8cfc2',
    label: '#1d2630',
    labelHalo: 'rgba(255,255,255,0.92)',
    waterLabel: '#1f5f92',
    boundary: '#6b5d7a',
    sky: '#cfe3f5',
    horizon: '#eef3f7',
    fog: '#e8eef2',
  },
  dark: {
    background: '#0b1117',
    wood: '#14301f',
    grass: '#1a2a1d',
    farmland: '#23241a',
    wetland: '#132a2a',
    rock: '#22252a',
    residential: '#1b2027',
    water: '#0e2a45',
    waterway: '#2d7cc0',
    hillShadow: '#000000',
    hillHighlight: '#51606e',
    hillAccent: '#1d2631',
    roadCasing: '#0a0e13',
    roadMinor: '#3b4655',
    roadMajor: '#6a5a3a',
    roadTrunk: '#9a7a3a',
    track: '#4b4234',
    building: '#2e3946',
    label: '#dbe4ee',
    labelHalo: 'rgba(8,12,18,0.9)',
    waterLabel: '#7cb6e8',
    boundary: '#9b8cc0',
    sky: '#07101a',
    horizon: '#16263a',
    fog: '#0d1822',
  },
};

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

export function buildStyle(theme: Theme): StyleSpecification {
  const p = PALETTES[theme];
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      omt: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      },
      'terrain-dem': {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
        attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles on AWS</a> (Mapzen/Tilezen)',
      },
      'hillshade-dem': {
        type: 'raster-dem',
        tiles: [TERRAIN_TILES],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
      },
      imagery: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': p.background as string } },
      { id: 'imagery', type: 'raster', source: 'imagery', layout: { visibility: 'none' }, paint: { 'raster-opacity': 1, 'raster-saturation': -0.1 } },
      { id: 'landcover-wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': p.wood as string, 'fill-opacity': 0.85 } },
      { id: 'landcover-grass', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'grass'], paint: { 'fill-color': p.grass as string, 'fill-opacity': 0.8 } },
      { id: 'landcover-farmland', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'farmland'], paint: { 'fill-color': p.farmland as string, 'fill-opacity': 0.8 } },
      { id: 'landcover-wetland', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wetland'], paint: { 'fill-color': p.wetland as string, 'fill-opacity': 0.8 } },
      { id: 'landcover-rock', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['rock', 'sand']]], paint: { 'fill-color': p.rock as string, 'fill-opacity': 0.8 } },
      { id: 'landuse-residential', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial', 'retail']]], minzoom: 9, paint: { 'fill-color': p.residential as string, 'fill-opacity': 0.7 } },
      {
        id: 'hillshade', type: 'hillshade', source: 'hillshade-dem',
        paint: {
          'hillshade-shadow-color': p.hillShadow as string,
          'hillshade-highlight-color': p.hillHighlight as string,
          'hillshade-accent-color': p.hillAccent as string,
          'hillshade-exaggeration': theme === 'light' ? 0.45 : 0.6,
          'hillshade-illumination-direction': 315,
        },
      },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': p.water as string, 'fill-opacity': 0.95 } },
      {
        id: 'waterway-river', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'river'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.waterway as string, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 7, 0.8, 12, 2.5, 16, 7] },
      },
      {
        id: 'waterway-stream', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 10.5,
        filter: ['in', ['get', 'class'], ['literal', ['stream', 'canal', 'drain', 'ditch']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.waterway as string, 'line-opacity': ['case', ['==', ['get', 'intermittent'], 1], 0.5, 0.85], 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 15, 1.8, 18, 3] },
      },
      {
        id: 'road-casing-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12,
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.roadCasing as string, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 1.2, 16, 7, 18, 14] },
      },
      {
        id: 'road-track', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 13,
        filter: ['in', ['get', 'class'], ['literal', ['track', 'path']]],
        paint: { 'line-color': p.track as string, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 18, 2.2], 'line-dasharray': [2, 1.2] },
      },
      {
        id: 'road-minor', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.roadMinor as string, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 11, 0.5, 16, 5, 18, 11] },
      },
      {
        id: 'road-major-casing', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 7,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.roadCasing as string, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 7, 1, 12, 4, 16, 12, 18, 20] },
      },
      {
        id: 'road-major', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], p.roadTrunk as string, p.roadMajor as string],
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 6, 0.6, 12, 2.6, 16, 9, 18, 16],
        },
      },
      {
        id: 'road-bridge', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 13,
        filter: ['==', ['get', 'brunnel'], 'bridge'],
        layout: { 'line-cap': 'butt' },
        paint: { 'line-color': theme === 'light' ? '#6b5540' : '#c8a86a', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 10], 'line-opacity': 0.55, 'line-gap-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 8] },
      },
      {
        id: 'boundary-state', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': p.boundary as string, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.6], 'line-dasharray': [3, 2], 'line-opacity': 0.7 },
      },
      {
        id: 'building-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13.5,
        paint: {
          'fill-extrusion-color': p.building as string,
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13.5, 0, 14.5, ['coalesce', ['get', 'render_height'], 3]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.9,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'label-waterway', type: 'symbol', source: 'omt', 'source-layer': 'waterway', minzoom: 11, filter: ['has', 'name'],
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': FONT, 'text-size': 11, 'text-letter-spacing': 0.05 },
        paint: { 'text-color': p.waterLabel as string, 'text-halo-color': p.labelHalo as string, 'text-halo-width': 1.4 },
      },
      {
        id: 'label-road', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 12,
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name'], ['get', 'ref']], 'text-font': FONT, 'text-size': 10.5 },
        paint: { 'text-color': p.label as string, 'text-halo-color': p.labelHalo as string, 'text-halo-width': 1.4 },
      },
      {
        id: 'label-context-city', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 9,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'state']]],
        layout: {
          'text-field': ['case', ['==', ['get', 'class'], 'state'], ['upcase', ['coalesce', ['get', 'name:en'], ['get', 'name']]], ['coalesce', ['get', 'name:en'], ['get', 'name']]],
          'text-font': FONT_BOLD,
          'text-size': ['match', ['get', 'class'], 'state', 13, 'city', 12, 10],
          'text-letter-spacing': ['match', ['get', 'class'], 'state', 0.25, 0.02],
        },
        paint: { 'text-color': p.label as string, 'text-halo-color': p.labelHalo as string, 'text-halo-width': 1.5, 'text-opacity': 0.75 },
      },
    ],
  } as StyleSpecification;
}

/** Update the base style's colours in place (keeps custom layers and camera). */
export function applyTheme(map: MLMap, theme: Theme) {
  if (!(map as any).style?.stylesheet) return;
  const p = PALETTES[theme];
  const set = (id: string, prop: string, value: any) => {
    if (map.getLayer(id)) map.setPaintProperty(id, prop as any, value);
  };
  set('background', 'background-color', p.background);
  set('landcover-wood', 'fill-color', p.wood);
  set('landcover-grass', 'fill-color', p.grass);
  set('landcover-farmland', 'fill-color', p.farmland);
  set('landcover-wetland', 'fill-color', p.wetland);
  set('landcover-rock', 'fill-color', p.rock);
  set('landuse-residential', 'fill-color', p.residential);
  set('hillshade', 'hillshade-shadow-color', p.hillShadow);
  set('hillshade', 'hillshade-highlight-color', p.hillHighlight);
  set('hillshade', 'hillshade-accent-color', p.hillAccent);
  set('water', 'fill-color', p.water);
  set('waterway-river', 'line-color', p.waterway);
  set('waterway-stream', 'line-color', p.waterway);
  set('road-casing-minor', 'line-color', p.roadCasing);
  set('road-major-casing', 'line-color', p.roadCasing);
  set('road-minor', 'line-color', p.roadMinor);
  set('road-track', 'line-color', p.track);
  set('road-major', 'line-color', ['match', ['get', 'class'], ['motorway', 'trunk'], p.roadTrunk, p.roadMajor]);
  set('road-bridge', 'line-color', theme === 'light' ? '#6b5540' : '#c8a86a');
  set('boundary-state', 'line-color', p.boundary);
  set('building-3d', 'fill-extrusion-color', p.building);
  for (const id of ['label-waterway']) {
    set(id, 'text-color', p.waterLabel);
    set(id, 'text-halo-color', p.labelHalo);
  }
  for (const id of ['label-road', 'label-context-city', 'fg-place-label', 'fg-poi-label', 'fg-zone-label', 'fg-event-label', 'fg-taluk-label']) {
    set(id, 'text-color', p.label);
    set(id, 'text-halo-color', p.labelHalo);
  }
  if (!(map as any).style?.stylesheet) return; // map torn down (HMR / StrictMode remount)
  try {
    map.setSky({
    'sky-color': p.sky as string,
    'horizon-color': p.horizon as string,
    'fog-color': p.fog as string,
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.7,
    'fog-ground-blend': 0.35,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 12, 0.2] as any,
    });
  } catch (err) {
    console.warn('FloodGuard: sky/atmosphere not applied', err);
  }
}
