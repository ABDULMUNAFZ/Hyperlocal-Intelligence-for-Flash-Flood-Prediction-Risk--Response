// Client for FloodGuard's Cisco Catalyst Center proxy. The browser only talks to the FloodGuard
// backend; Catalyst Center credentials and tokens never leave the server.
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

export interface CatalystDeviceHealth {
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
  network_health_score: number | null;
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
