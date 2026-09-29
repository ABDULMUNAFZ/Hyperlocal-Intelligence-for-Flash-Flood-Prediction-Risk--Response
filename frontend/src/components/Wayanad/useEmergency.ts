// Live emergency state: responder session, FloodGuard alerts (SSE), citizen reports, location, notifications.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { liveApi, useLiveStream, authToken, type CitizenReport, type LiveAlert, type StreamEvent } from '../../services/liveApi';
import { sound } from './sound';
import type { FeatureCollection, LngLat } from '../../types/geo';
import { distanceToAreaKm } from './EmergencyPanels';
import { REPORT_LABEL } from './ContextPanel';

const ACK_KEY = 'fg-acked-alerts';
const acked = (): string[] => JSON.parse(localStorage.getItem(ACK_KEY) ?? '[]');

export function useEmergency(opts: { onFocusAlert: (a: LiveAlert) => void; onOtherEvent?: (e: StreamEvent) => void }) {
  const [me, setMe] = useState<{ email: string; role: string; responder: boolean } | null>(null);
  const [token, setToken] = useState<string | null>(authToken());
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [banner, setBanner] = useState<LiveAlert | null>(null);
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [myReports, setMyReports] = useState<CitizenReport[]>([]);
  const [location, setLocation] = useState<{ lngLat: LngLat; accuracy: number; at: string } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const focusRef = useRef(opts.onFocusAlert);
  focusRef.current = opts.onFocusAlert;
  const otherRef = useRef(opts.onOtherEvent);
  otherRef.current = opts.onOtherEvent;

  // responder session (expired sessions quietly fall back to public mode)
  useEffect(() => {
    if (!token) { setMe(null); return; }
    liveApi.me().then(setMe).catch(() => { setMe(null); setToken(authToken()); });
  }, [token]);
  useEffect(() => {
    const onOut = () => { setToken(null); setMe(null); };
    window.addEventListener('fg-signed-out', onOut);
    return () => window.removeEventListener('fg-signed-out', onOut);
  }, []);

  const refreshReports = useCallback(() => {
    if (me?.responder) liveApi.allReports().then(setReports).catch(() => undefined);
  }, [me]);
  useEffect(() => { refreshReports(); if (!me?.responder) setReports([]); }, [me, refreshReports]);

  useEffect(() => {
    liveApi.activeAlerts().then((a) => {
      setAlerts(a);
      const pending = a.find((x) => !acked().includes(x.id));
      if (pending) setBanner(pending); // shown silently on load
    }).catch(() => undefined);
    liveApi.myReports().then((r) => setMyReports(r.reports)).catch(() => undefined);
  }, []);

  const deliver = useCallback((a: LiveAlert) => {
    setBanner(a);
    if (a.level === 'CRITICAL') sound.critical(); else if (a.level === 'WARNING') sound.warning(); else sound.notify();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(`⚠ FloodGuard ${a.level}${a.is_demo ? ' (DEMO)' : ''}: ${a.title}`, {
          body: `${a.area_name}, Wayanad — ${a.recommended_action ?? a.message}`, tag: a.id, requireInteraction: a.level === 'CRITICAL',
        });
        n.onclick = () => { window.focus(); focusRef.current(a); };
      } catch { /* notifications unavailable in this context */ }
    }
    if (a.level === 'CRITICAL' || a.level === 'WARNING') focusRef.current(a);
  }, []);

  const onEvent = useCallback((e: StreamEvent) => {
    switch (e.event) {
      case 'alert.published':
        if (!('geometry' in e.data)) {
          // Compact event (e.g. official SACHET alert from the worker): load the full record.
          liveApi.activeAlerts().then((a) => { setAlerts(a); const full = a.find((x) => x.id === e.data.id); if (full) deliver(full); }).catch(() => undefined);
          break;
        }
        setAlerts((xs) => [e.data, ...xs.filter((x) => x.id !== e.data.id)]);
        deliver(e.data);
        break;
      case 'alert.cancelled':
        setAlerts((xs) => xs.filter((x) => x.id !== e.data.id));
        setBanner((b) => (b?.id === e.data.id ? null : b));
        break;
      case 'alert.acknowledged':
        setAlerts((xs) => xs.map((x) => (x.id === e.data.id ? { ...x, acknowledged_count: e.data.count } : x)));
        break;
      case 'report.created':
        setReports((rs) => [e.data, ...rs.filter((r) => r.id !== e.data.id)]);
        sound.notify();
        break;
      case 'report.updated':
        setReports((rs) => rs.map((r) => (r.id === e.data.id ? e.data : r)));
        setMyReports((rs) => rs.map((r) => (r.id === e.data.id ? e.data : r)));
        break;
      case 'report.deleted':
        setReports((rs) => rs.filter((r) => r.id !== e.data.id));
        break;
      default:
        otherRef.current?.(e); // rescue.*, alert.delivery, safe_location.changed
    }
  }, [deliver]);

  const stream = useLiveStream(me?.responder ? token : null, onEvent);

  const login = async (email: string, password: string) => {
    const t = await liveApi.login(email, password);
    localStorage.setItem('access_token', t.access_token);
    if (t.refresh_token) localStorage.setItem('refresh_token', t.refresh_token);
    setToken(t.access_token);
  };
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setMe(null);
  };

  const acknowledge = async (a: LiveAlert) => {
    localStorage.setItem(ACK_KEY, JSON.stringify([...acked(), a.id].slice(-200)));
    sound.stopAlarm();
    setBanner(null);
    try { await liveApi.ackAlert(a.id); } catch { /* acknowledgement is best-effort */ }
  };

  /** Explicit, user-initiated geolocation. Never called in the background. */
  const locate = () => new Promise<void>((resolve) => {
    if (!('geolocation' in navigator)) { setLocError('This browser cannot share location.'); resolve(); return; }
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lngLat: [pos.coords.longitude, pos.coords.latitude], accuracy: pos.coords.accuracy, at: new Date().toISOString() }); resolve(); },
      (err) => { setLocError(err.code === err.PERMISSION_DENIED ? 'Location permission was denied. Nothing was shared.' : `Location unavailable: ${err.message}`); resolve(); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });

  const sendReport = async (body: Record<string, any>) => {
    const r = await liveApi.createReport(body);
    setMyReports((rs) => [r, ...rs]);
  };
  const deleteReport = async (id: string) => {
    await liveApi.deleteMyReport(id);
    setMyReports((rs) => rs.filter((r) => r.id !== id));
  };
  const enableNotify = async () => {
    if (typeof Notification === 'undefined') return;
    setNotifyPermission(await Notification.requestPermission());
  };
  const publish = async (body: Record<string, any>) => {
    const a = await liveApi.publishAlert(body);
    setAlerts((xs) => [a, ...xs.filter((x) => x.id !== a.id)]);
  };
  const cancel = async (id: string) => {
    await liveApi.cancelAlert(id);
    setAlerts((xs) => xs.filter((x) => x.id !== id));
  };
  const setReportStatus = async (id: string, status: string) => {
    const r = await liveApi.updateReport(id, status);
    setReports((rs) => rs.map((x) => (x.id === id ? r : x)));
  };

  const alertsFC = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: alerts.filter((a) => a.geometry).map((a) => ({ type: 'Feature', properties: { ...a, geometry: undefined }, geometry: a.geometry })),
  }), [alerts]);

  const reportsFC = useMemo<FeatureCollection | null>(() => (me?.responder ? {
    type: 'FeatureCollection',
    features: reports.filter((r) => r.status !== 'resolved').map((r) => ({
      type: 'Feature', properties: { ...r, label: `${REPORT_LABEL[r.report_type]?.toUpperCase() ?? r.report_type}${r.is_demo ? ' · DEMO' : ''}` },
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
    })),
  } : null), [reports, me]);

  const bannerDistance = banner && location ? distanceToAreaKm(location.lngLat, banner.geometry) : null;

  return {
    me, login, logout, alerts, alertsFC, banner, setBanner, acknowledge, deliver, reports, reportsFC, myReports, location, setLocation,
    locError, locate, sendReport, deleteReport, notifyPermission, enableNotify, publish, cancel, setReportStatus, stream, bannerDistance, refreshReports,
  };
}
