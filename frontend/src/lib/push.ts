/**
 * Notifiche push sul dispositivo (Web Push). Funzionano solo da Linko in HTTPS;
 * su iPhone/iPad solo con Linko aggiunto alla schermata Home (iOS 16.4+).
 */
import { appNotificationsApi } from './api';

export type PushState = 'unsupported' | 'ios-home' | 'denied' | 'off' | 'on';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function supported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIos() && !isStandalone() && window.isSecureContext) return 'ios-home';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Da chiamare dentro un tocco/clic: il browser chiede il permesso. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const { publicKey } = await appNotificationsApi.pushKey();
  let sub = await reg.pushManager.getSubscription();
  // Chiave cambiata (istanza ricreata): si rifà l'iscrizione
  if (sub && sub.options.applicationServerKey) {
    const current = new Uint8Array(sub.options.applicationServerKey);
    const wanted = keyBytes(publicKey);
    if (current.length !== wanted.length || current.some((b, i) => b !== wanted[i])) { await sub.unsubscribe(); sub = null; }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource });
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await appNotificationsApi.subscribe({ endpoint: json.endpoint, keys: json.keys });
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await appNotificationsApi.unsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
  return 'off';
}

/** Se il permesso c'è già, rinnova l'iscrizione in silenzio (es. dopo un nuovo login). */
export async function refreshPush(): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await appNotificationsApi.subscribe({ endpoint: json.endpoint, keys: json.keys }).catch(() => {});
}
