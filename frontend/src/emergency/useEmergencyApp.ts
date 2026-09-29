// Citizen emergency-app state: session, /emergency/me, own rescue-request updates (SSE), push opens.
import { useCallback, useEffect, useRef, useState } from 'react';
import { emergencyApi, type MeDTO, type RescueRequestDTO } from './api';
import { authToken, useLiveStream, type StreamEvent } from '../services/liveApi';
import { sound } from '../components/Wayanad/sound';
import { currentPushSubscription, isStandalone, locationPermission, notificationPermission } from './device';

export function useEmergencyApp() {
  const [token, setToken] = useState<string | null>(authToken());
  const [me, setMe] = useState<MeDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!authToken());
  const [request, setRequest] = useState<RescueRequestDTO | null>(null);
  const [focusAlertId, setFocusAlertId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<{ title: string; body: string; is_demo: boolean; level?: string } | null>(null);
  const seenAlerts = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!authToken()) return null;
    try {
      const m = await emergencyApi.me();
      setMe(m);
      setRequest(m.active_request);
      setLoadError(null);
      return m;
    } catch (e: any) {
      if (e?.response?.status !== 401) setLoadError(e?.response ? `Server error (${e.response.status}).` : 'Cannot reach FloodGuard. Check your connection.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (token) refresh(); else { setMe(null); setRequest(null); setLoading(false); } }, [token, refresh]);

  useEffect(() => {
    const out = () => { setToken(null); setMe(null); setRequest(null); };
    window.addEventListener('fg-signed-out', out);
    return () => window.removeEventListener('fg-signed-out', out);
  }, []);

  // Report real permission / install state to the profile (so responders know who can be reached).
  useEffect(() => {
    if (!me) return;
    (async () => {
      const loc = await locationPermission();
      const push = notificationPermission();
      const inst = isStandalone();
      if (me.permissions.location !== loc || me.permissions.push !== push || me.permissions.installed_pwa !== inst) {
        emergencyApi.profile({ location_permission: loc, push_permission: push === 'unsupported' ? 'unsupported' : push, installed_pwa: inst })
          .then(setMe).catch(() => undefined);
      }
      // Re-sync an existing browser push subscription (it may have rotated since last visit).
      if (me.push.configured && push === 'granted') {
        const sub = await currentPushSubscription().catch(() => null);
        if (sub) emergencyApi.subscribe(sub).catch(() => undefined);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.user.id]);

  // Opened from a push notification: /emergency?alert=<id>&d=<delivery id>
  useEffect(() => {
    if (!me) return;
    const q = new URLSearchParams(window.location.search);
    const d = q.get('d');
    const a = q.get('alert');
    if (a) setFocusAlertId(a);
    if (d) emergencyApi.opened(d).catch(() => undefined);
    if (a || d) window.history.replaceState(null, '', '/emergency');
  }, [me]);

  const onAlert = useCallback(async (title: string, body: string, isDemo: boolean, level?: string) => {
    setIncoming({ title, body, is_demo: isDemo, level });
    if (level === 'CRITICAL') sound.critical(); else if (level === 'WARNING') sound.warning(); else sound.notify();
    try { navigator.vibrate?.([600, 200, 600, 200, 900]); } catch { /* not supported */ }
    await refresh();
  }, [refresh]);

  const onEvent = useCallback((e: StreamEvent) => {
    if (e.event.startsWith('rescue.')) {
      setRequest(e.data as RescueRequestDTO);
      if (e.event === 'rescue.assigned') { sound.notify(); try { navigator.vibrate?.([300, 120, 300]); } catch { /* */ } }
      return;
    }
    if (e.event === 'alert.published') {
      const a = e.data as any;
      if (seenAlerts.current.has(a.id)) return;
      seenAlerts.current.add(a.id);
      // Only alerts whose area covers this user's stored location appear in /me — refresh decides relevance.
      refresh().then((m) => {
        const near = m?.alerts_nearby.find((x) => x.id === a.id);
        if (near) onAlert(near.title, near.recommended_action ?? near.message, near.is_demo, near.level);
      });
    }
    if (e.event === 'alert.cancelled') refresh();
  }, [refresh, onAlert]);

  const stream = useLiveStream(token, onEvent);

  // Push received while the app is open (service worker relays it).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const h = (m: MessageEvent) => {
      if (m.data?.type === 'fg-push') {
        const p = m.data.payload || {};
        if (p.alert_id) seenAlerts.current.add(p.alert_id);
        if (p.kind !== 'TEST') onAlert(p.title, p.body, !!p.is_demo, p.level);
        if (p.alert_id) setFocusAlertId(p.alert_id);
      }
      if (m.data?.type === 'fg-open') {
        const u = new URL(m.data.url, window.location.origin);
        if (u.searchParams.get('alert')) setFocusAlertId(u.searchParams.get('alert'));
        const d = u.searchParams.get('d');
        if (d) emergencyApi.opened(d).catch(() => undefined);
      }
    };
    navigator.serviceWorker.addEventListener('message', h);
    return () => navigator.serviceWorker.removeEventListener('message', h);
  }, [onAlert]);

  const signIn = async (email: string, password: string) => {
    const t = await emergencyApi.login(email, password);
    localStorage.setItem('access_token', t.access_token);
    if (t.refresh_token) localStorage.setItem('refresh_token', t.refresh_token);
    setLoading(true);
    setToken(t.access_token);
  };
  const signOut = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setToken(null);
  };

  return { token, me, setMe, loading, loadError, refresh, request, setRequest, signIn, signOut, stream, focusAlertId, setFocusAlertId, incoming, setIncoming };
}
