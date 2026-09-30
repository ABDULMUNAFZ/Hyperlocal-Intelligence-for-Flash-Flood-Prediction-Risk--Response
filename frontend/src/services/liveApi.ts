// Live emergency operations: alerts, citizen reports, simulation and SSE stream.
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { api, API_BASE_URL } from './api';

/**
 * Client for responder/live calls. Unlike the app-wide client it never redirects to /login:
 * on 401 it tries the refresh token once, otherwise clears the session and the command
 * center simply continues in public mode.
 */
export const live = axios.create({ baseURL: API_BASE_URL, timeout: 30000, headers: { 'Content-Type': 'application/json' } });
live.interceptors.request.use((config) => {
  const t = localStorage.getItem('access_token');
  if (t && config.headers) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
live.interceptors.response.use((r) => r, async (error) => {
  const original = error.config;
  if (error.response?.status === 401 && !original?._retry) {
    original._retry = true;
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      try {
        const r = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refresh });
        localStorage.setItem('access_token', r.data.access_token);
        if (r.data.refresh_token) localStorage.setItem('refresh_token', r.data.refresh_token);
        original.headers.Authorization = `Bearer ${r.data.access_token}`;
        return live(original);
      } catch { /* fall through to sign-out */ }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.dispatchEvent(new Event('fg-signed-out'));
  }
  return Promise.reject(error);
});
import type { LngLat } from '../types/geo';

export type AlertLevel = 'INFO' | 'WATCH' | 'WARNING' | 'CRITICAL';

export interface LiveAlert {
  id: string;
  alert_id: string;
  title: string;
  message: string;
  recommended_action: string | null;
  hazard: string;
  level: AlertLevel;
  severity: string;
  status: string;
  area_name: string;
  basis: string;
  is_demo: boolean;
  kind?: 'OFFICIAL' | 'RESPONDER' | 'DEMO';
  onset: string;
  expires: string;
  sent_at: string;
  author: string | null;
  acknowledged_count: number;
  geometry: { type: string; coordinates: any } | null;
  source: string;
}

export type ReportType = 'NEED_RESCUE' | 'TRAPPED' | 'FLOODING' | 'ROAD_BLOCKED' | 'LANDSLIDE' | 'MEDICAL' | 'SAFE' | 'EVACUATING' | 'OTHER';

export interface CitizenReport {
  id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  report_type: ReportType;
  people_count: number;
  severity: string;
  message: string | null;
  status: 'new' | 'acknowledged' | 'dispatched' | 'resolved';
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

/** Random, anonymous per-browser token. Only its SHA-256 hash is stored server-side. */
export function sessionToken(): string {
  let t = localStorage.getItem('fg-session');
  if (!t) {
    const b = new Uint8Array(24);
    crypto.getRandomValues(b);
    t = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('fg-session', t);
  }
  return t;
}

export function authToken(): string | null {
  return localStorage.getItem('access_token');
}

const LONG = { timeout: 240_000 };

export const liveApi = {
  login: (email: string, password: string) => api.login(email, password),
  me: async () => (await live.get<{ email: string; role: string; responder: boolean }>('/live/me')).data,
  activeAlerts: async () => (await live.get<{ alerts: LiveAlert[] }>('/live/alerts/active')).data.alerts,
  publishAlert: async (body: Record<string, any>) => (await live.post<LiveAlert>('/live/alerts', body)).data,
  cancelAlert: async (id: string) => (await live.post(`/live/alerts/${id}/cancel`)).data,
  ackAlert: async (id: string) => (await live.post(`/live/alerts/${id}/ack`, { session_token: sessionToken() })).data,
  createReport: async (body: Record<string, any>) => (await live.post<CitizenReport>('/live/reports', { ...body, session_token: sessionToken() })).data,
  myReports: async () => (await live.get<{ reports: CitizenReport[]; retention_hours: number }>('/live/reports/mine', { params: { session_token: sessionToken() } })).data,
  deleteMyReport: async (id: string) => (await live.delete(`/live/reports/${id}`, { params: { session_token: sessionToken() } })).data,
  allReports: async () => (await live.get<{ reports: CitizenReport[] }>('/live/reports')).data.reports,
  updateReport: async (id: string, status: string) => (await live.patch<CitizenReport>(`/live/reports/${id}`, { status })).data,
  /** Runs a scenario as a background job (cold runs can take minutes) and polls until it finishes. */
  simulate: async (body: Record<string, any>) => {
    const start = (await api.post<any>('/geo/simulate/jobs', body)).data;
    if (start.status === 'done') return start.result;
    const t0 = Date.now();
    while (Date.now() - t0 < 15 * 60_000) {
      await new Promise((r) => setTimeout(r, 2500));
      const job = (await api.get<any>(`/geo/simulate/jobs/${start.job_id}`)).data;
      if (job.status === 'done') return job.result;
      if (job.status === 'error') {
        throw Object.assign(new Error(typeof job.error === 'string' ? job.error : 'Simulation failed'), { response: { status: job.http_status ?? 500, data: { detail: job.error } } });
      }
    }
    throw new Error('Simulation did not finish within 15 minutes');
  },
  simRoutes: async (simId: string, origin: LngLat, candidates: any[]) =>
    (await api.post<any>(`/geo/simulate/${simId}/routes`, { origin, candidates }, LONG)).data,
  riskSigns: async (points: Array<{ id: string; name: string; lon: number; lat: number }>) =>
    (await api.post<any>('/geo/risk-signs', { points }, LONG)).data,
};

export type StreamEvent =
  | { event: 'alert.published'; data: LiveAlert }
  | { event: 'alert.cancelled'; data: { id: string } }
  | { event: 'alert.acknowledged'; data: { id: string; count: number } }
  | { event: 'report.created' | 'report.updated'; data: CitizenReport }
  | { event: 'report.deleted'; data: { id: string } }
  | { event: 'rescue.created' | 'rescue.updated' | 'rescue.location' | 'rescue.journey' | 'rescue.reached' | 'rescue.assigned'; data: any }
  | { event: 'alert.delivery'; data: { alert_id: string; targeted_users: number; sent: number; failed: number; expired: number; no_subscription: number; not_configured: number } }
  | { event: 'safe_location.changed'; data: { id: string } };

export const STREAM_EVENTS = ['alert.published', 'alert.cancelled', 'alert.acknowledged', 'report.created', 'report.updated', 'report.deleted',
  'rescue.created', 'rescue.updated', 'rescue.location', 'rescue.journey', 'rescue.reached', 'rescue.assigned', 'alert.delivery', 'safe_location.changed'];

/** Server-Sent Events subscription with automatic reconnection. */
export function useLiveStream(token: string | null, onEvent: (e: StreamEvent) => void) {
  const [state, setState] = useState<{ connected: boolean; responder: boolean }>({ connected: false, responder: false });
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const connect = () => {
      const url = `${API_BASE_URL}/live/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      es = new EventSource(url);
      es.addEventListener('hello', (m) => {
        const d = JSON.parse((m as MessageEvent).data);
        setState({ connected: true, responder: !!d.responder });
      });
      for (const ev of STREAM_EVENTS) {
        es.addEventListener(ev, (m) => handler.current({ event: ev, data: JSON.parse((m as MessageEvent).data) } as StreamEvent));
      }
      es.onerror = () => {
        setState((s) => ({ ...s, connected: false }));
        es?.close();
        if (!closed) retry = setTimeout(connect, 4000);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, [token]);

  return state;
}
