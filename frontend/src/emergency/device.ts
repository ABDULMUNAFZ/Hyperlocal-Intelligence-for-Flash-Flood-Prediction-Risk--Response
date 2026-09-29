// Real device capabilities: service worker, install prompt, push subscription, geolocation.
// Nothing here fakes a capability — every function reports the browser's actual state.

export type LocationState = 'CONNECTED' | 'STALE' | 'PERMISSION_REQUIRED' | 'DENIED' | 'UNSUPPORTED';

export interface DeviceFix {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  captured_at: string; // ISO timestamp from the device position
}

// ------------------------------------------------------------------ service worker + install

let deferredPrompt: any = null;
const installListeners = new Set<() => void>();

export function initPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our own INSTALL FLOODGUARD button
    deferredPrompt = e;
    installListeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((f) => f());
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => console.warn('FloodGuard: service worker registration failed', err));
  }
}

export function onInstallChange(f: () => void) {
  installListeners.add(f);
  return () => { installListeners.delete(f); };
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function isIOS(): boolean {
  if (/android/i.test(navigator.userAgent)) return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports MacIntel
}

export function canPromptInstall(): boolean {
  return !!deferredPrompt;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome;
}

// ------------------------------------------------------------------ notifications / push

export function pushSupport(): { supported: boolean; reason?: string } {
  if (!window.isSecureContext) return { supported: false, reason: 'Push needs HTTPS (or localhost).' };
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'This browser has no service worker support.' };
  if (!('PushManager' in window)) {
    return { supported: false, reason: isIOS() && !isStandalone() ? 'On iPhone/iPad, add FloodGuard to the Home Screen first (iOS 16.4+), then open it from there.' : 'This browser does not support Web Push.' };
  }
  if (typeof Notification === 'undefined') return { supported: false, reason: 'Notifications are not supported.' };
  return { supported: true };
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export function b64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Must be called from a user gesture. Returns the browser PushSubscription (JSON) or throws with a clear reason. */
export async function subscribePush(vapidPublicKey: string): Promise<PushSubscriptionJSON> {
  const sup = pushSupport();
  if (!sup.supported) throw new Error(sup.reason);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications are blocked. Enable them for this site in your browser/phone settings.' : 'Notification permission was not granted.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const current = sub.options?.applicationServerKey ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer) : null;
    const wanted = b64ToUint8(vapidPublicKey);
    if (!current || current.length !== wanted.length || current.some((v, i) => v !== wanted[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidPublicKey) });
  return sub.toJSON();
}

export async function currentPushSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupport().supported) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? sub.toJSON() : null;
}

// ------------------------------------------------------------------ geolocation

export async function locationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return (st?.state as any) ?? 'prompt';
  } catch {
    return 'prompt'; // Safari < 16 has no Permissions API for geolocation
  }
}

export class GeoError extends Error {
  code: 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' | 'UNSUPPORTED' | 'INSECURE';
  constructor(code: GeoError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

function toFix(p: GeolocationPosition): DeviceFix {
  return { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_m: Math.round(p.coords.accuracy * 10) / 10, captured_at: new Date(p.timestamp).toISOString() };
}

function geoError(e: GeolocationPositionError): GeoError {
  if (e.code === e.PERMISSION_DENIED) return new GeoError('DENIED', 'Location permission is denied. Enable Location for this site in your browser or phone settings.');
  if (e.code === e.TIMEOUT) return new GeoError('TIMEOUT', 'Timed out waiting for GPS. Move to open sky and try again.');
  return new GeoError('UNAVAILABLE', 'Unable to obtain GPS location. Please enable Location Services.');
}

/** One fresh high-accuracy device position (no cached positions). */
export function getFix(timeoutMs = 25000): Promise<DeviceFix> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new GeoError('INSECURE', 'Location needs HTTPS (or localhost).'));
    if (!('geolocation' in navigator)) return reject(new GeoError('UNSUPPORTED', 'This device cannot share location.'));
    navigator.geolocation.getCurrentPosition((p) => resolve(toFix(p)), (e) => reject(geoError(e)), { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 });
  });
}

/** Foreground-only live tracking while the journey screen is open. Returns a stop function. */
export function watchFix(onFix: (f: DeviceFix) => void, onError: (e: GeoError) => void): () => void {
  if (!('geolocation' in navigator)) { onError(new GeoError('UNSUPPORTED', 'This device cannot share location.')); return () => undefined; }
  const id = navigator.geolocation.watchPosition((p) => onFix(toFix(p)), (e) => onError(geoError(e)), { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  return () => navigator.geolocation.clearWatch(id);
}

export function freshness(capturedAt: string | null | undefined, staleMinutes = 15): LocationState {
  if (!capturedAt) return 'PERMISSION_REQUIRED';
  return Date.now() - new Date(capturedAt).getTime() <= staleMinutes * 60_000 ? 'CONNECTED' : 'STALE';
}

export function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6371008.8, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r);
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

export const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

export function fmtDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} sec ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min ago`;
}
