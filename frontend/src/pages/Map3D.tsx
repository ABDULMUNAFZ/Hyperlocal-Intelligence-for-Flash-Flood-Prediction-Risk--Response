// FloodGuard 3D Map Page
import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const Map3D: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const { data: regions, isLoading } = useQuery({
    queryKey: ['regions', 'tree'],
    queryFn: () => api.getRegionTree(),
  });

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [77.5, 13.5],
      zoom: 5.5,
      pitch: 45,
      bearing: 0,
      antialias: true,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      if (regions) {
        addRegionLayers(map, regions);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [regions]);

  const addRegionLayers = (map: maplibregl.Map, regionTree: any[]) => {
    const getStateGeometries = (regions: any[]): any[] => {
      const geoms: any[] = [];
      regions.forEach(region => {
        if (region.level === 1 && region.geometry) {
          geoms.push({
            ...region,
            geometry: region.geometry,
          });
        }
        if (region.children) {
          geoms.push(...getStateGeometries(region.children));
        }
      });
      return geoms;
    };

    const stateGeoms = getStateGeometries(regionTree);

    map.addSource('states', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: stateGeoms.map(r => ({
          type: 'Feature',
          geometry: r.geometry,
          properties: {
            name: r.name,
            state_code: r.state_code,
            level: r.level,
          },
        })),
      },
    });

    map.addLayer({
      id: 'state-boundaries',
      type: 'line',
      source: 'states',
      paint: {
        'line-color': '#1e40af',
        'line-width': 2,
        'line-opacity': 0.8,
      },
    });

    map.addLayer({
      id: 'state-fills',
      type: 'fill',
      source: 'states',
      paint: {
        'fill-color': [
          'match',
          ['get', 'state_code'],
          'KA', '#3b82f6',
          'KL', '#10b981',
          'TN', '#f59e0b',
          'AP', '#ef4444',
          'TG', '#8b5cf6',
          '#6b7280',
        ],
        'fill-opacity': 0.3,
      },
    });

    map.addLayer({
      id: 'state-labels',
      type: 'symbol',
      source: 'states',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 14,
        'text-font': ['Open Sans Bold'],
        'text-anchor': 'center',
      },
      paint: {
        'text-color': '#1f2937',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">3D South India Map</h1>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Zoom: {mapRef.current?.getZoom().toFixed(1) || '-'}</span>
          <span>Pitch: {mapRef.current?.getPitch().toFixed(0) || '-'}</span>
        </div>
      </div>
      <div className="flex-1 relative" ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default Map3D;