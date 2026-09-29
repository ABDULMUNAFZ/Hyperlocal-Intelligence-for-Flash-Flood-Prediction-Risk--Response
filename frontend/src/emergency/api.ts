// Emergency + rescue API client (uses the live client: token refresh, no /login redirects).
import { api } from '../services/api';
import { live } from '../services/liveApi';
import type { DeviceFix } from './device';
import type { RescueStatus } from './status';

export interface SafeLocation {
  id: string; name: string; type: string; address: string | null; capacity: number; occupancy?: number; contact_phone?: string | null;
  lon: number; lat: number; distance_m: number; bearing: string; bearing_deg?: number; is_demo: boolean; verification: string | null;
  route: { distance_m: number; duration_s: number; source: string } | null;
  routing: 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_REQUESTED';
  route_risk: { level: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN'; basis: string };
  designated_by?: string; designated_at?: string;
}

export interface RescueRequestDTO {
  id: string; status: RescueStatus; people_count: number; note: string | null; risk_level: string | null; is_demo: boolean; alert_id: string | null;
  location: { latitude: number; longitude: number; accuracy_m: number | null; captured_at: string; freshness: string };
  safe_location: null | { id: string; name: string; type: string; address: string | null; lon: number; lat: number; distance_m: number; bearing: string; is_demo: boolean; verification: string | null };
  journey: { status: string | null; started_at: string | null; start: [number, number] | null; arrived_at: string | null; arrival_distance_m: number | null;
    route: null | { geometry?: { type: 'LineString'; coordinates: [number, number][] }; distance_m?: number; duration_s?: number; source?: string; available?: false; message?: string; destination?: [number, number]; risk?: { level: string; basis: string } } };
  responder?: { id: string; name: string; phone: string | null } | null;
  person?: { user_id: string; name: string | null; phone: string | null; emergency_contact: { name: string | null; phone: string | null } | null };
  history?: Array<{ from: string | null; to: string; at: string; note: string | null }>;
  nearest_safe_location?: { id: string; name: string; distance_m: number } | null;
  assigned_at: string | null; resolved_at: string | null; created_at: string; updated_at: string;
}

export interface NearbyAlert {
  id: string; title: string; message: string; recommended_action: string | null; level: string; hazard: string; area_name: string;
  is_demo: boolean; kind: 'OFFICIAL' | 'RESPONDER' | 'DEMO'; basis: string; sent_at: string; expires: string; distance_m: number;
}

export interface MeDTO {
  user: { id: string; name: string | null; email: string; phone: string | null; role: string; responder: boolean };
  emergency_contact: { name: string | null; phone: string | null } | null;
  permissions: { location: string | null; push: string | null; installed_pwa: boolean | null };
  location: { latitude?: number; longitude?: number; accuracy_m?: number; captured_at?: string; freshness: string };
  push: { configured: boolean; active_subscriptions: number };
  active_request: RescueRequestDTO | null;
  alerts_nearby: NearbyAlert[];
  limits: { stale_minutes: number; arrival_radius_m: number };
}

export const emergencyApi = {
  register: async (b: { email: string; password: string; full_name: string; phone: string }) => (await api.client.post('/auth/register', b)).data,
  login: (email: string, password: string) => api.login(email, password),
  me: async () => (await live.get<MeDTO>('/emergency/me')).data,
  profile: async (b: Record<string, any>) => (await live.put<MeDTO>('/emergency/profile', b)).data,
  location: async (fix: DeviceFix) => (await live.post('/emergency/location', fix)).data,
  request: async (fix: DeviceFix, status: string, people_count: number, alert_id?: string | null, note?: string) =>
    (await live.post<RescueRequestDTO>('/emergency/request', { fix, status, people_count, alert_id: alert_id ?? undefined, note })).data,
  people: async (id: string, people_count: number) => (await live.post<RescueRequestDTO>(`/emergency/${id}/people`, { people_count })).data,
  status: async (id: string, status: string, fix?: DeviceFix) => (await live.post<RescueRequestDTO>(`/emergency/${id}/status`, { status, fix })).data,
  nearby: async (fix: DeviceFix) => (await live.post<{ safe_locations: SafeLocation[]; message?: string }>('/emergency/nearby-safe-locations', { fix, limit: 5 }, { timeout: 45000 })).data,
  start: async (id: string, safe_location_id: string, fix: DeviceFix) => (await live.post<RescueRequestDTO>(`/emergency/${id}/start-evacuation`, { safe_location_id, fix }, { timeout: 45000 })).data,
  reached: async (id: string, fix: DeviceFix) => (await live.post<RescueRequestDTO>(`/emergency/${id}/reached`, fix)).data,
  pushConfig: async () => (await live.get<{ configured: boolean; public_key: string | null; message: string | null }>('/push/config')).data,
  subscribe: async (sub: PushSubscriptionJSON) => (await live.post('/push/subscribe', { endpoint: sub.endpoint, keys: sub.keys, user_agent: navigator.userAgent.slice(0, 250) })).data,
  pushTest: async () => (await live.post<{ configured: boolean; results: Array<{ status: string; error: string | null }>; message?: string }>('/push/test')).data,
  opened: async (delivery_id: string) => (await live.post('/push/opened', { delivery_id })).data,
  // responders
  rescueActive: async (include_resolved = false) => (await live.get<{ requests: RescueRequestDTO[] }>('/rescue/active', { params: { include_resolved } })).data.requests,
  rescueSummary: async () => (await live.get<any>('/rescue/summary')).data,
  rescueDetail: async (id: string) => (await live.get<RescueRequestDTO>(`/rescue/${id}`)).data,
  rescueRoute: async (id: string) => (await live.get<any>(`/rescue/${id}/route`, { timeout: 45000 })).data,
  responders: async () => (await live.get<{ responders: Array<{ id: string; name: string; role: string }> }>('/rescue/responders')).data.responders,
  assign: async (id: string, responder_id?: string) => (await live.post<RescueRequestDTO>(`/rescue/${id}/assign`, { responder_id })).data,
  responderStatus: async (id: string, status: 'EVACUATING' | 'RESOLVED', note?: string) => (await live.post<RescueRequestDTO>(`/rescue/${id}/status`, { status, note })).data,
  safeLocations: async () => (await live.get<{ safe_locations: Array<Omit<SafeLocation, 'distance_m' | 'bearing' | 'route' | 'routing' | 'route_risk'>> }>('/safe-locations')).data.safe_locations,
  designateSafe: async (b: Record<string, any>) => (await live.post('/safe-locations', b)).data,
  deactivateSafe: async (id: string) => (await live.post(`/safe-locations/${id}/deactivate`)).data,
  previewAlert: async (b: Record<string, any>) => (await live.post<{ affected_users: number; reachable_by_push: number; push_configured: boolean }>('/live/alerts/preview', b)).data,
  deliveries: async (alertId: string) => (await live.get<any>(`/live/alerts/${alertId}/deliveries`)).data,
};

export function apiError(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  if (!d) return e?.message && !/status code/.test(e.message) ? e.message : fallback;
  if (typeof d === 'string') return d;
  if (d.message) return d.message;
  if (Array.isArray(d)) return d.map((x: any) => x.msg).join('; ');
  return fallback;
}
