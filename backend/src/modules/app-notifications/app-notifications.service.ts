/**
 * Avvisi in-app (campanella) e Web Push. Il backend salva l'avviso e accoda l'invio:
 * le chiamate ai servizi push (Google, Apple, Mozilla) le fa il worker.
 */
import { createHash, generateKeyPairSync, timingSafeEqual } from 'crypto';
import { prisma } from '../../lib/prisma';
import { watchQueue } from '../../lib/queue';
import { AppError } from '../../middleware/error.middleware';
import { config } from '../../config';
import { encrypt, loadKey } from '../../utils/secret-box';
import type { InternalNotifyDto } from './app-notifications.schema';

const KEEP = 200; // avvisi tenuti per utente
const secretKey = loadKey(config.WATCH_SECRET_KEY);

/**
 * Chiavi VAPID dell'istanza, create al primo uso. La privata è cifrata con
 * WATCH_SECRET_KEY e la usa solo il worker. Il "subject" richiesto dai servizi
 * push è l'indirizzo HTTPS di Linko da cui è arrivata la prima iscrizione.
 */
export async function vapidPublicKey(origin?: string): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key: 'vapid' } });
  if (row) return (JSON.parse(row.value) as { publicKey: string }).publicKey;
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  // Formato Web Push: punto non compresso (0x04 || x || y) e d, in base64url
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, 'base64url'), Buffer.from(pub.y!, 'base64url')]);
  const subject = origin && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin) ? origin : 'mailto:linko@example.com';
  const value = JSON.stringify({ publicKey: raw.toString('base64url'), privateKeyEnc: encrypt(priv.d!, secretKey), subject });
  try {
    await prisma.appSetting.create({ data: { key: 'vapid', value } });
  } catch {
    // Creata nel frattempo da un'altra richiesta: si usa quella
  }
  return vapidPublicKey(origin);
}

export async function list(userId: string) {
  const [items, unread] = await Promise.all([
    prisma.appNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.appNotification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markRead(userId: string, id: string) {
  await prisma.appNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}

export async function markAllRead(userId: string) {
  await prisma.appNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}

/** Salva l'avviso, tiene solo gli ultimi KEEP e lo invia ai dispositivi iscritti. */
export async function create(dto: InternalNotifyDto) {
  const user = await prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
  if (!user) throw new AppError(404, 'Utente non trovato');
  const n = await prisma.appNotification.create({
    data: { userId: dto.userId, kind: dto.kind, title: dto.title, body: dto.body, url: dto.url ?? null },
  });
  const old = await prisma.appNotification.findMany({
    where: { userId: dto.userId }, orderBy: { createdAt: 'desc' }, skip: KEEP, select: { id: true },
  });
  if (old.length) await prisma.appNotification.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  await queuePush(dto.userId, { id: n.id, title: n.title, body: n.body, url: n.url ?? '/' });
  return n;
}

async function queuePush(userId: string, payload: Record<string, string>) {
  if (!(await prisma.pushSubscription.count({ where: { userId } }))) return;
  await watchQueue.add('push', { type: 'push', userId, payload }, {
    attempts: 2, backoff: { type: 'fixed', delay: 10_000 }, removeOnComplete: { age: 3600 }, removeOnFail: { age: 86400 },
  });
}

export async function subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) },
  });
  return { ok: true };
}

export async function unsubscribe(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return { ok: true };
}

export async function sendTest(userId: string) {
  if (!(await prisma.pushSubscription.count({ where: { userId } }))) throw new AppError(400, 'Nessun dispositivo iscritto');
  await queuePush(userId, { id: 'test', title: 'Linko', body: 'Le notifiche su questo dispositivo funzionano.', url: '/bookmarks' });
  return { ok: true };
}

/**
 * Segreto dei servizi interni: nel database c'è solo il suo SHA-256
 * (AppSetting "internal_notify_sha256"), il valore sta nel .env del servizio.
 */
export async function checkInternalSecret(secret: string | undefined): Promise<boolean> {
  if (!secret || secret.length < 32) return false;
  const row = await prisma.appSetting.findUnique({ where: { key: 'internal_notify_sha256' } });
  if (!row) return false;
  const got = createHash('sha256').update(secret).digest();
  const want = Buffer.from(row.value, 'hex');
  return want.length === got.length && timingSafeEqual(got, want);
}
