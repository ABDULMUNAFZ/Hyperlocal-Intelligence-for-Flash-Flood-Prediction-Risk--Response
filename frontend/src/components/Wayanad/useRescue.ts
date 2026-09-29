// Responder rescue operations: people needing help (live), summary, responders, safe locations, alert delivery.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { emergencyApi, type RescueRequestDTO } from '../../emergency/api';
import { RescueStatus as S, STATUS_LABEL, statusTone } from '../../emergency/status';
import { ago } from '../../emergency/device';
import type { StreamEvent } from '../../services/liveApi';
import type { FeatureCollection } from '../../types/geo';
import { sound } from './sound';

export interface DeliverySummary { alert_id: string; targeted_users: number; sent: number; failed: number; expired: number; no_subscription: number; not_configured: number; push_configured?: boolean; at: string }
type SafeLoc = Awaited<ReturnType<typeof emergencyApi.safeLocations>>[number];

const PRIORITY: Record<string, number> = { RESCUE_REQUESTED: 0, RESPONDER_ASSIGNED: 1, NEEDS_ASSISTANCE: 2, EVACUATING: 3, EN_ROUTE_TO_SHELTER: 4, LOCATION_PINNED: 5, REACHED_SAFE_LOCATION: 6, SAFE: 7, RESOLVED: 8 };

export function useRescue(responder: boolean) {
  const [requests, setRequests] = useState<RescueRequestDTO[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [responders, setResponders] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [safe, setSafe] = useState<SafeLoc[]>([]);
  const [deliveries, setDeliveries] = useState<DeliverySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const loadSafe = useCallback(() => { emergencyApi.safeLocations().then(setSafe).catch(() => undefined); }, []);
  const refresh = useCallback(async () => {
    if (!responder) return;
    try {
      const [r, s] = await Promise.all([emergencyApi.rescueActive(), emergencyApi.rescueSummary()]);
      setRequests(r);
      setSummary(s);
      setError(null);
    } catch (e: any) {
      setError(e?.response?.status === 403 ? 'Responder role required.' : 'Rescue data unavailable (backend unreachable).');
    }
  }, [responder]);

  useEffect(() => { loadSafe(); }, [loadSafe]);
  useEffect(() => {
    if (!responder) { setRequests([]); setSummary(null); return; }
    refresh();
    emergencyApi.responders().then(setResponders).catch(() => undefined);
  }, [responder, refresh]);
  // "last seen" labels age in place
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);

  const summaryTimer = useMemo(() => ({ t: 0 as any }), []);
  const onEvent = useCallback((e: StreamEvent) => {
    if (e.event.startsWith('rescue.') && responder) {
      const r = e.data as RescueRequestDTO;
      setRequests((xs) => (r.status === S.RESOLVED ? xs.filter((x) => x.id !== r.id) : [r, ...xs.filter((x) => x.id !== r.id)]));
      if (e.event === 'rescue.created' || (e.event === 'rescue.updated' && r.status === S.RESCUE_REQUESTED)) {
        if (r.status === S.RESCUE_REQUESTED) sound.warning(); else sound.notify();
      }
      clearTimeout(summaryTimer.t);
      summaryTimer.t = setTimeout(() => emergencyApi.rescueSummary().then(setSummary).catch(() => undefined), 600);
    } else if (e.event === 'alert.delivery') {
      setDeliveries((d) => [{ ...(e.data as any), at: new Date().toISOString() }, ...d.filter((x) => x.alert_id !== (e.data as any).alert_id)].slice(0, 10));
    } else if (e.event === 'safe_location.changed') {
      loadSafe();
    }
  }, [responder, loadSafe, summaryTimer]);

  const sorted = useMemo(() => [...requests].sort((a, b) => (PRIORITY[a.status] - PRIORITY[b.status]) || (b.updated_at > a.updated_at ? 1 : -1)), [requests]);

  const rescueFC = useMemo<FeatureCollection | null>(() => (responder ? {
    type: 'FeatureCollection',
    features: requests.map((r) => ({
      type: 'Feature',
      properties: {
        id: r.id, status: r.status, tone: statusTone(r.status), people_count: r.people_count, is_demo: r.is_demo,
        label: `${STATUS_LABEL[r.status as S]?.toUpperCase() ?? r.status}${r.is_demo ? ' · DEMO' : ''}`, captured_ago: ago(r.location.captured_at),
      },
      geometry: { type: 'Point', coordinates: [r.location.longitude, r.location.latitude] },
    })),
  } : null), [requests, responder, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const safeFC = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: safe.map((s) => ({ type: 'Feature', properties: { ...s }, geometry: { type: 'Point', coordinates: [s.lon, s.lat] } })),
  }), [safe]);

  const replace = (r: RescueRequestDTO) => setRequests((xs) => (r.status === S.RESOLVED ? xs.filter((x) => x.id !== r.id) : xs.map((x) => (x.id === r.id ? r : x))));

  return { requests: sorted, summary, responders, safe, deliveries, error, refresh, onEvent, rescueFC, safeFC, replace, loadSafe };
}
