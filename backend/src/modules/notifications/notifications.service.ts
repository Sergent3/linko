import { prisma } from '../../lib/prisma';
import { watchQueue, watchQueueEvents } from '../../lib/queue';
import { AppError } from '../../middleware/error.middleware';
import { config } from '../../config';
import { encrypt, loadKey } from '../../utils/secret-box';
import type { UpdateSettingsDto } from './notifications.schema';

const JOB_TIMEOUT_MS = 20_000;
const secretKey = loadKey(config.WATCH_SECRET_KEY);

/** Le chiamate a Telegram le fa il worker: il backend non contatta servizi esterni. */
async function telegramJob<T>(data: Record<string, unknown>): Promise<T> {
  const job = await watchQueue.add('telegram', { type: 'telegram', ...data }, {
    removeOnComplete: { age: 60 }, removeOnFail: { age: 60 }, attempts: 1,
  });
  try {
    return await job.waitUntilFinished(watchQueueEvents, JOB_TIMEOUT_MS);
  } catch (err) {
    const msg = (err as Error).message;
    throw new AppError(/timed out/i.test(msg) ? 504 : 422, /timed out/i.test(msg) ? 'Telegram non ha risposto in tempo' : msg);
  }
}

export async function getSettings(userId: string) {
  const s = await prisma.notificationSettings.findUnique({ where: { userId } });
  const counts = await prisma.watchSource.groupBy({ by: ['delivery'], where: { userId }, _count: { _all: true } });
  const count = (d: string) => counts.find((c) => c.delivery === d)?._count._all ?? 0;
  return {
    telegram: {
      configured: !!s?.telegramTokenEnc,
      bot: s?.telegramBot ?? null,
      linked: !!s?.telegramChatId,
    },
    keywords: s?.keywords ?? '',
    digestHour: s?.digestHour ?? 8,
    nextDigestAt: s?.nextDigestAt ?? null,
    lastDigestAt: s?.lastDigestAt ?? null,
    instantSources: count('INSTANT'),
    digestSources: count('DIGEST'),
  };
}

export async function updateSettings(userId: string, dto: UpdateSettingsDto) {
  const current = await prisma.notificationSettings.findUnique({ where: { userId } });
  const data = {
    ...(dto.keywords !== undefined && { keywords: dto.keywords.trim() }),
    ...(dto.digestHour !== undefined && { digestHour: dto.digestHour }),
    // Ora cambiata: il worker ricalcola il prossimo riepilogo
    ...(dto.digestHour !== undefined && dto.digestHour !== current?.digestHour && { nextDigestAt: null }),
  };
  await prisma.notificationSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return getSettings(userId);
}

/** Verifica il token con Telegram e lo salva cifrato; la chat va ricollegata. */
export async function setTelegramToken(userId: string, token: string) {
  const { bot } = await telegramJob<{ bot: string }>({ action: 'verify', token });
  const data = { telegramTokenEnc: encrypt(token, secretKey), telegramBot: bot, telegramChatId: null };
  await prisma.notificationSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return getSettings(userId);
}

/** Cerca la chat in cui l'utente ha scritto al bot e la collega. */
export async function linkTelegram(userId: string) {
  const chat = await telegramJob<{ id: string; name: string }>({ action: 'link', userId });
  await prisma.notificationSettings.update({ where: { userId }, data: { telegramChatId: chat.id, nextDigestAt: null } });
  await telegramJob({ action: 'test', userId });
  return { ...(await getSettings(userId)), chatName: chat.name };
}

export async function testTelegram(userId: string) {
  await telegramJob({ action: 'test', userId });
  return { ok: true };
}

export async function removeTelegram(userId: string) {
  const s = await prisma.notificationSettings.findUnique({ where: { userId } });
  if (!s) throw new AppError(404, 'Telegram non è configurato');
  await prisma.notificationSettings.update({
    where: { userId },
    data: { telegramTokenEnc: null, telegramBot: null, telegramChatId: null, nextDigestAt: null },
  });
  return getSettings(userId);
}
