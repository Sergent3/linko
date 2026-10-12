/**
 * Consegna delle novità fuori da Linko (Telegram):
 * - subito, per le fonti "INSTANT" e per gli elementi che contengono una parola chiave;
 * - una volta al giorno, in un unico riepilogo, per le fonti "DIGEST".
 * Un errore di invio non deve mai far fallire il controllo della fonte.
 */
import { prisma } from '../lib/prisma';
import { decrypt, loadKey } from '../lib/secret-box';
import { config } from '../config';
import { applyFilter, parseFilter } from './filter';
import { formatDigest, formatInstant, nextDigestTime, sendMessage, type NotifyItem } from './telegram';

const DIGEST_BATCH = 20;
const DIGEST_MAX_ITEMS = 300;

let key: Buffer | undefined;
const secretKey = () => (key ??= loadKey(config.WATCH_SECRET_KEY));

function linko(path: string): string | undefined {
  return config.LINKO_PUBLIC_URL ? `${config.LINKO_PUBLIC_URL.replace(/\/$/, '')}${path}` : undefined;
}

async function telegramOf(userId: string) {
  const s = await prisma.notificationSettings.findUnique({ where: { userId } });
  if (!s?.telegramTokenEnc || !s.telegramChatId) return null;
  return { settings: s, token: decrypt(s.telegramTokenEnc, secretKey()), chatId: s.telegramChatId };
}

/** Novità appena trovate da un controllo (già escluso il punto di partenza del primo controllo). */
export async function notifyNew(
  source: { id: string; userId: string; name: string; delivery: 'NORMAL' | 'INSTANT' | 'DIGEST' },
  items: { title: string; url: string }[],
): Promise<void> {
  if (items.length === 0) return;
  try {
    const tg = await telegramOf(source.userId);
    if (!tg) return;
    const terms = parseFilter(tg.settings.keywords);
    const hasKeywords = terms.some((t) => !t.exclude);
    const toSend: NotifyItem[] = [];
    for (const it of items) {
      const kw = hasKeywords ? applyFilter(terms, { title: it.title }).matchedTerms : [];
      // Le parole chiave valgono per tutte le fonti, anche quelle in riepilogo
      if (source.delivery === 'INSTANT' || kw.length > 0) toSend.push({ ...it, keywords: kw });
    }
    if (toSend.length === 0) return;
    await sendMessage(tg.token, tg.chatId, formatInstant(source.name, toSend, linko(`/updates?source=${source.id}`)));
  } catch (err) {
    console.warn(`[notify] invio non riuscito per la fonte ${source.id}: ${(err as Error).message}`);
  }
}

/** Riepiloghi giornalieri arrivati all'ora scelta (chiamato a ogni tick). */
export async function runDigests(now = new Date()): Promise<void> {
  const due = await prisma.notificationSettings.findMany({
    where: {
      telegramTokenEnc: { not: null },
      telegramChatId: { not: null },
      OR: [{ nextDigestAt: null }, { nextDigestAt: { lte: now } }],
    },
    take: DIGEST_BATCH,
  });
  for (const s of due) {
    const next = nextDigestTime(s.digestHour, now);
    // Primo giro (o ora cambiata): si fissa solo il prossimo orario
    if (!s.nextDigestAt) {
      await prisma.notificationSettings.update({ where: { id: s.id }, data: { nextDigestAt: next } });
      continue;
    }
    const since = s.lastDigestAt ?? new Date(now.getTime() - 86_400_000);
    // Si aggiorna prima di inviare: un errore non deve produrre riepiloghi doppi
    await prisma.notificationSettings.update({ where: { id: s.id }, data: { lastDigestAt: now, nextDigestAt: next } });
    try {
      const items = await prisma.watchItem.findMany({
        where: { userId: s.userId, isHidden: false, isRead: false, firstSeenAt: { gt: since }, source: { delivery: 'DIGEST' } },
        include: { source: { select: { id: true, name: true } } },
        orderBy: { firstSeenAt: 'desc' },
        take: DIGEST_MAX_ITEMS,
      });
      if (items.length === 0) continue;
      const bySource = new Map<string, { sourceName: string; url?: string; items: NotifyItem[] }>();
      for (const it of items) {
        const g = bySource.get(it.source.id) ?? { sourceName: it.source.name, url: linko(`/updates?source=${it.source.id}`), items: [] };
        g.items.push({ title: it.title, url: it.url });
        bySource.set(it.source.id, g);
      }
      const groups = [...bySource.values()].sort((a, b) => b.items.length - a.items.length);
      await sendMessage(decrypt(s.telegramTokenEnc!, secretKey()), s.telegramChatId!, formatDigest(groups, linko('/updates')));
    } catch (err) {
      console.warn(`[notify] riepilogo non inviato per ${s.userId}: ${(err as Error).message}`);
    }
  }
}
