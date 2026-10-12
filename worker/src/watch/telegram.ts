/**
 * Notifiche Telegram: un bot creato dall'utente (con @BotFather) gli scrive
 * in chat privata. Linko non ha un bot suo: token e chat sono dell'utente.
 */
import axios from 'axios';

const API = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;
// Telegram accetta messaggi fino a 4096 caratteri
const MAX_MESSAGE = 4000;
const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;

export class TelegramError extends Error {}

export function isTelegramToken(token: string): boolean {
  return TOKEN_RE.test(token.trim());
}

async function call<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  if (!isTelegramToken(token)) throw new TelegramError('Il token del bot non ha il formato giusto (es. 123456789:AA…)');
  const res = await axios.post(`${API}/bot${token.trim()}/${method}`, body ?? {}, { timeout: TIMEOUT_MS, validateStatus: () => true });
  const data = res.data as { ok: boolean; result?: T; description?: string };
  if (!data?.ok) {
    if (res.status === 401 || res.status === 404) throw new TelegramError('Telegram non riconosce il token: controlla di averlo copiato tutto da @BotFather');
    if (res.status === 403) throw new TelegramError('Il bot è stato bloccato o la chat non esiste più: riapri il bot su Telegram e premi Avvia');
    throw new TelegramError(`Telegram ha rifiutato la richiesta: ${data?.description ?? `HTTP ${res.status}`}`);
  }
  return data.result as T;
}

/** Username del bot, per verificare il token e mostrare il link t.me/… */
export async function botUsername(token: string): Promise<string> {
  const me = await call<{ username: string }>(token, 'getMe');
  return me.username;
}

/** Chat privata più recente in cui l'utente ha scritto al bot (es. premendo Avvia). */
export async function findPrivateChat(token: string): Promise<{ id: string; name: string } | null> {
  const updates = await call<Array<{ message?: { chat: { id: number; type: string; first_name?: string; username?: string } } }>>(
    token, 'getUpdates', { allowed_updates: ['message'], limit: 100 },
  );
  const chats = updates.map((u) => u.message?.chat).filter((c) => c && c.type === 'private');
  const last = chats[chats.length - 1];
  return last ? { id: String(last.id), name: last.first_name ?? last.username ?? 'chat' } : null;
}

export async function sendMessage(token: string, chatId: string, html: string): Promise<void> {
  await call(token, 'sendMessage', {
    chat_id: chatId,
    text: html.length > MAX_MESSAGE ? `${html.slice(0, html.lastIndexOf('\n', MAX_MESSAGE))}\n…` : html,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface NotifyItem { title: string; url: string; keywords?: string[] }

const MAX_INSTANT = 8;
const MAX_DIGEST_PER_SOURCE = 6;

function line(it: NotifyItem): string {
  const title = it.title.length > 160 ? `${it.title.slice(0, 160)}…` : it.title;
  const kw = it.keywords?.length ? ` 🔑 <i>${escapeHtml(it.keywords.join(', '))}</i>` : '';
  return `• <a href="${escapeHtml(it.url)}">${escapeHtml(title)}</a>${kw}`;
}

/** Messaggio per le novità di un controllo. */
export function formatInstant(sourceName: string, items: NotifyItem[], linkoUrl?: string): string {
  const shown = items.slice(0, MAX_INSTANT).map(line);
  const more = items.length - shown.length;
  const head = `🔔 <b>${escapeHtml(sourceName)}</b>${items.length > 1 ? ` · ${items.length} novità` : ''}`;
  const tail = [more > 0 ? `…e altre ${more}` : '', linkoUrl ? `<a href="${escapeHtml(linkoUrl)}">Apri in Linko</a>` : ''].filter(Boolean).join(' · ');
  return [head, ...shown, tail].filter(Boolean).join('\n');
}

/** Riepilogo giornaliero: per ogni fonte quante novità e le più recenti. */
export function formatDigest(groups: { sourceName: string; items: NotifyItem[]; url?: string }[], linkoUrl?: string): string {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const parts = [`📰 <b>Riepilogo di oggi</b> · ${total} ${total === 1 ? 'novità' : 'novità'}`];
  for (const g of groups) {
    const shown = g.items.slice(0, MAX_DIGEST_PER_SOURCE).map(line);
    const more = g.items.length - shown.length;
    const name = g.url ? `<a href="${escapeHtml(g.url)}">${escapeHtml(g.sourceName)}</a>` : escapeHtml(g.sourceName);
    parts.push('', `<b>${name}</b> (${g.items.length})`, ...shown, ...(more > 0 ? [`…e altre ${more}`] : []));
  }
  if (linkoUrl) parts.push('', `<a href="${escapeHtml(linkoUrl)}">Apri in Linko</a>`);
  return parts.join('\n');
}

/**
 * Prossimo orario del riepilogo (ora "hour" nel fuso indicato) dopo "from".
 * Calcolato con Intl, così l'ora legale è gestita correttamente.
 */
export function nextDigestTime(hour: number, from: Date, timeZone = 'Europe/Rome'): Date {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const parts = (t: number) => Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, Number(p.value)])) as Record<string, number>;
  const offset = (t: number) => {
    const p = parts(t);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
  };
  const local = parts(from.getTime());
  for (let addDays = 0; addDays < 3; addDays++) {
    const guess = Date.UTC(local.year, local.month - 1, local.day + addDays, hour);
    const t = guess - offset(guess);
    if (t > from.getTime()) return new Date(t);
  }
  return new Date(from.getTime() + 86_400_000);
}
