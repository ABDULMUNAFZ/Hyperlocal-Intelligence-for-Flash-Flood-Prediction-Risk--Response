// Client for FloodGuard's Cisco Catalyst Center proxy. The browser only talks to the FloodGuard
// backend; Catalyst Center credentials and tokens never leave the server. The summary endpoints used
// here are public and aggregate-only (no management IPs).
import { api } from './api';

export interface CatalystCenterEnvelope {
  source: 'cisco_catalyst_center';
  source_label: string;
  controller: string | null;
  configured: boolean;
  connected: boolean;
  retrieved_at: string;
  error?: string;
}

export interface CatalystDeviceHealthItem {
  name: string | null;
  family: string | null;
  location: string | null;
  health_score: number | null;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  reachability: string | null;
  issue_count: number | null;
}

export interface CatalystDeviceHealth {
  items: CatalystDeviceHealthItem[];
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
}

export interface CatalystNetworkHealth {
  health_score: number | null;
  measured_at: string | null;
}

export interface CatalystSiteHealth {
  name: string | null;
  site_type: string | null;
  network_health_score: number | null;
  healthy_network_device_pct: number | null;
  network_device_count: number | null;
}

export interface CatalystCenterHealth extends CatalystCenterEnvelope {
  devices?: CatalystDeviceHealth | null;
  network?: CatalystNetworkHealth | null;
  sites?: CatalystSiteHealth[] | null;
  errors?: Record<string, string> | null;
}

export interface CatalystCenterEvents extends CatalystCenterEnvelope {
  count?: number;
}

export const catalystCenterApi = {
  health: async () => (await api.get<CatalystCenterHealth>('/catalyst-center/health')).data,
  events: async () => (await api.get<CatalystCenterEvents>('/catalyst-center/events')).data,
};
