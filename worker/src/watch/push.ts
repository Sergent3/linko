/**
 * Web Push verso i dispositivi iscritti dalla campanella di Linko (solo HTTPS).
 * Chiavi VAPID in AppSetting "vapid" (create dal backend, privata cifrata).
 */
import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { decrypt, loadKey } from '../lib/secret-box';
import { config } from '../config';

let vapid: { publicKey: string; privateKey: string; subject: string } | undefined;

async function loadVapid() {
  if (vapid) return vapid;
  const row = await prisma.appSetting.findUnique({ where: { key: 'vapid' } });
  if (!row) throw new Error('Chiavi VAPID non ancora create');
  const v = JSON.parse(row.value) as { publicKey: string; privateKeyEnc: string; subject: string };
  vapid = { publicKey: v.publicKey, privateKey: decrypt(v.privateKeyEnc, loadKey(config.WATCH_SECRET_KEY)), subject: v.subject };
  return vapid;
}

/** Invia a tutti i dispositivi dell'utente; le iscrizioni scadute vengono tolte. */
export async function sendPush(userId: string, payload: Record<string, string>): Promise<{ sent: number; removed: number }> {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return { sent: 0, removed: 0 };
  const v = await loadVapid();
  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { vapidDetails: v, TTL: 24 * 3600, urgency: 'normal', timeout: 10_000 },
      );
      sent++;
      await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410: il dispositivo ha revocato l'iscrizione
      if (status === 404 || status === 410) {
        removed++;
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      } else {
        console.warn('[push] invio non riuscito', status ?? (err as Error).message);
      }
    }
  }));
  return { sent, removed };
}
