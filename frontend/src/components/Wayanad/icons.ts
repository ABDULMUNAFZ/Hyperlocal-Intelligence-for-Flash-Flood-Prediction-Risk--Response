// Original FloodGuard map icons (SVG glyphs on a coloured badge), rasterised for MapLibre.
import type { Map as MLMap } from 'maplibre-gl';

export const POI_STYLE: Record<string, { color: string; label: string; glyph: string; minzoom: number }> = {
  hospital: { color: '#d6336c', label: 'Hospital', minzoom: 11, glyph: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>' },
  clinic: { color: '#e64980', label: 'Clinic / health centre', minzoom: 13, glyph: '<path d="M10.5 6h3v4.5H18v3h-4.5V18h-3v-4.5H6v-3h4.5z"/>' },
  school: { color: '#1c7ed6', label: 'School', minzoom: 13, glyph: '<path d="M12 5L2 10l10 5 8-4v6h2v-7zM6 13.2V17c2 2 10 2 12 0v-3.8l-6 3z"/>' },
  college: { color: '#1864ab', label: 'College / university', minzoom: 11, glyph: '<path d="M12 5L2 10l10 5 8-4v6h2v-7zM6 13.2V17c2 2 10 2 12 0v-3.8l-6 3z"/>' },
  police: { color: '#3b5bdb', label: 'Police', minzoom: 10.5, glyph: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>' },
  fire_station: { color: '#e03131', label: 'Fire & rescue', minzoom: 9.5, glyph: '<path d="M12 2c1 4 6 6 6 11a6 6 0 01-12 0c0-3 2-4.5 2.5-6.5 1 1.2 1.3 2.4 1.8 3.6C12 8 12.5 5 12 2z"/>' },
  government: { color: '#6741d9', label: 'Government office', minzoom: 13.5, glyph: '<path d="M3 9l9-5 9 5zM5 10h2.5v7H5zm5.75 0h2.5v7h-2.5zM16.5 10H19v7h-2.5zM3 18h18v2H3z"/>' },
  community: { color: '#0c8599', label: 'Community facility', minzoom: 13.5, glyph: '<circle cx="9" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M3 19c0-4 3-6 6-6s6 2 6 6zM15.5 19c0-2-.5-3.5-1.5-4.6 3.2-.9 7 .6 7 4.6z"/>' },
  emergency_refuge: { color: '#2b8a3e', label: 'Emergency assembly point (OSM)', minzoom: 10, glyph: '<path d="M12 3l9 7h-3v9H6v-9H3z"/>' },
  emergency_service: { color: '#c92a2a', label: 'Ambulance / emergency service', minzoom: 10, glyph: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>' },
  dam: { color: '#1971c2', label: 'Dam', minzoom: 9, glyph: '<path d="M3 5h6l2 14H3zM13 9c2 1.2 3 0 4-1s2 0 4 1v2.4c-2-1-3-2-4-1s-2 2-4 1zm0 5c2 1.2 3 0 4-1s2 0 4 1v2.4c-2-1-3-2-4-1s-2 2-4 1z"/>' },
  weir: { color: '#4dabf7', label: 'Weir / check dam', minzoom: 13.5, glyph: '<path d="M3 11h18v3H3zM4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0v2c-1 1-2 1.5-4 0s-4-1.5-6 0-4 1.5-6 0z"/>' },
  power: { color: '#f08c00', label: 'Power infrastructure', minzoom: 11, glyph: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>' },
  tourism: { color: '#2f9e44', label: 'Tourist location / viewpoint', minzoom: 10.5, glyph: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>' },
  peak: { color: '#7c5a3a', label: 'Peak', minzoom: 9, glyph: '<path d="M2 19l7-12 3.5 5.5L15 9l7 10z"/>' },
  bridge: { color: '#495057', label: 'Bridge', minzoom: 12.5, glyph: '<path d="M2 13h20v2.5H2zM4 13c2.5-5 13.5-5 16 0h-2.5c-2.5-3-8.5-3-11 0zM5 15.5h2V20H5zm12 0h2V20h-2z"/>' },
  religious: { color: '#868e96', label: 'Place of worship', minzoom: 14, glyph: '<circle cx="12" cy="12" r="4.5"/>' },
  shelter_structure: { color: '#adb5bd', label: 'Shelter structure (bus/rain shelter — not a relief camp)', minzoom: 15.5, glyph: '<path d="M3 11l9-6 9 6h-3v2H6v-2zM6 13h2v6H6zm10 0h2v6h-2z"/>' },
};

export const EXTRA_ICONS: Record<string, { color: string; glyph: string }> = {
  camera: { color: '#e03131', glyph: '<path d="M4 7h9a2 2 0 012 2v1.2L20 7v10l-5-3.2V15a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z"/>' },
  event: { color: '#862e9c', glyph: '<path fill-rule="evenodd" d="M12 3l10 18H2zm-1 6v6h2V9zm0 8v2h2v-2z"/>' },
  alert: { color: '#f03e3e', glyph: '<path fill-rule="evenodd" d="M12 3l10 18H2zm-1 6v6h2V9zm0 8v2h2v-2z"/>' },
  refuge: { color: '#2b8a3e', glyph: '<path d="M12 3l9 7h-3v9H6v-9H3z"/>' },
  origin: { color: '#111827', glyph: '<circle cx="12" cy="12" r="5"/>' },
};

function svg(color: string, glyph: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
<circle cx="24" cy="24" r="20.5" fill="${color}" stroke="white" stroke-width="3.5"/>
<g transform="translate(12 12)" fill="white">${glyph}</g></svg>`;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(48, 48);
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  });
}

export async function registerIcons(map: MLMap) {
  const all: Record<string, { color: string; glyph: string }> = {
    ...Object.fromEntries(Object.entries(POI_STYLE).map(([k, v]) => [`poi-${k}`, v])),
    ...Object.fromEntries(Object.entries(EXTRA_ICONS).map(([k, v]) => [`icon-${k}`, v])),
  };
  await Promise.all(
    Object.entries(all).map(async ([name, { color, glyph }]) => {
      if (!(map as any).style || map.hasImage(name)) return;
      const img = await load(svg(color, glyph));
      if ((map as any).style && !map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
    }),
  );
}

export function iconDataUrl(category: string): string {
  const s = POI_STYLE[category] ?? EXTRA_ICONS[category];
  if (!s) return '';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(s.color, s.glyph));
}
