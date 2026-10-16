/**
 * Siti che cambiano dominio (frequente per i siti di download: eurekaddl.living → .beer).
 *
 * Due segnali, raccolti durante i controlli delle fonti:
 *   - redirect: la fonte risponde ma da un altro dominio con lo stesso nome
 *     (o lo stesso percorso) → il sito si è spostato e lo dice;
 *   - DNS: il dominio non esiste più → si prova lo stesso nome con le estensioni
 *     più usate e si accetta un candidato solo se la sua pagina porta il nome
 *     del sito nel titolo.
 * Il risultato è una proposta (DomainMove) che l'utente applica o ignora.
 */
import { promises as dnsPromises } from 'dns';
import { prisma } from '../lib/prisma';
import { fetchPage, type FetchedPage } from './http';
import { looksLikeFeed } from './feed';
import { sendPush } from './push';

// Estensioni in cui di solito ricompaiono i siti che cambiano dominio
export const CANDIDATE_TLDS = [
  'com', 'net', 'org', 'info', 'biz', 'io', 'co', 'me', 'to', 'cc', 'tv', 'ws', 'eu', 'it', 'xyz', 'top',
  'site', 'online', 'club', 'live', 'life', 'living', 'beer', 'lol', 'fun', 'pro', 'one', 'app', 'click',
  'link', 'space', 'store', 'shop', 'world', 'today', 'icu', 'cfd', 'sbs', 'bar', 'rest', 'buzz', 'mom',
  'boo', 'quest', 'cyou', 'monster', 'skin', 'hair', 'autos', 'homes', 'lat', 'wtf', 'zip', 'mov', 'nl',
  'ru', 'su', 'is', 'ag', 'la', 'li', 'mx', 'sx', 'gg', 'ac', 'vip', 'win', 'bid', 'pw', 'ninja', 'red',
];

// Domini di secondo livello generici: in forum.example.co.uk il nome è "example"
const SECOND_LEVEL = /^(co|com|net|org|gov|edu|ac|or|ne|go)$/;

const CANDIDATE_TIMEOUT_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// Una ricerca per dominio al giorno: i controlli falliti si ripetono ogni pochi minuti
const SEARCH_EVERY_MS = 24 * 3600_000;
const lastSearch = new Map<string, number>();

/** Host senza "www." e in minuscolo. */
export function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

export function hostOf(url: string): string | null {
  try {
    return bareHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** Parti di un host: sottodominio, nome del sito, estensione (forums.example.co.uk → forums. / example / co.uk). */
export function splitHost(host: string): { sub: string; label: string; suffix: string } | null {
  const parts = bareHost(host).split('.');
  if (parts.length < 2) return null;
  const tldLen = parts.length >= 3 && parts[parts.length - 1].length === 2 && SECOND_LEVEL.test(parts[parts.length - 2]) ? 2 : 1;
  const label = parts[parts.length - tldLen - 1];
  if (!label) return null;
  return {
    sub: parts.slice(0, parts.length - tldLen - 1).map((p) => `${p}.`).join(''),
    label,
    suffix: parts.slice(parts.length - tldLen).join('.'),
  };
}

/**
 * Il redirect da `from` a `to` è un trasloco del sito? Sì se il dominio cambia
 * e resta il nome del sito (eurekaddl.living → eurekaddl.beer) oppure lo stesso
 * percorso (non la home: molti siti rimandano la home a pagine di login altrove).
 */
export function isDomainMove(from: string, to: string): boolean {
  let a: URL;
  let b: URL;
  try {
    a = new URL(from);
    b = new URL(to);
  } catch {
    return false;
  }
  const ha = bareHost(a.hostname);
  const hb = bareHost(b.hostname);
  if (ha === hb) return false;
  // Sottodomini dello stesso sito (m.example.com, forum.example.com) non sono traslochi
  const sa = splitHost(ha);
  const sb = splitHost(hb);
  if (!sa || !sb) return false;
  if (sa.label === sb.label && sa.suffix === sb.suffix) return false;
  if (sa.label === sb.label) return true;
  return a.pathname.length > 1 && a.pathname === b.pathname;
}

/** Il titolo della pagina contiene il nome del sito (spazi e trattini ignorati)? */
export function titleMatches(html: string, label: string): boolean {
  const title = html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? '';
  const norm = (s: string) => s.toLowerCase().replace(/[\s._-]+/g, '');
  return label.length >= 3 && norm(title).includes(norm(label));
}

/** Cosa deve funzionare sul nuovo dominio: la stessa pagina (o lo stesso feed) della fonte. */
export interface Probe {
  path: string; // percorso + query, es. "/movies/feed/"
  feed: boolean;
}

/** Probe di una fonte: il percorso del feed per le fonti a feed, altrimenti della pagina. */
export function probeFor(source: { mode: string; url: string; feedUrl: string | null }): Probe {
  const target = source.mode === 'FEED' && source.feedUrl ? source.feedUrl : source.url;
  try {
    const u = new URL(target);
    return { path: `${u.pathname}${u.search}`, feed: source.mode === 'FEED' };
  } catch {
    return { path: '/', feed: false };
  }
}

/**
 * La pagina del candidato è quella del sito? Feed: deve essere un feed vero.
 * Home: il nome del sito nel titolo (le pagine "dominio in vendita" spesso lo hanno,
 * ma rimandano a un altro dominio e vengono scartate dopo). Altre pagine: il nome
 * del sito deve comparire almeno nel contenuto.
 */
export function pageMatches(page: FetchedPage, label: string, probe: Probe): boolean {
  if (page.status >= 400) return false;
  if (probe.feed) return looksLikeFeed(page.html);
  if (probe.path === '/' || probe.path === '') return titleMatches(page.html, label);
  return titleMatches(page.html, label) || page.html.toLowerCase().includes(label.toLowerCase());
}

export interface FoundMove {
  newHost: string;
  evidence: string;
}

interface SearchDeps {
  resolve: (host: string) => Promise<string[]>;
  fetch: (url: string) => Promise<FetchedPage>;
}

const defaultDeps: SearchDeps = {
  resolve: (host) => dnsPromises.resolve4(host),
  fetch: (url) => fetchPage(url),
};

/**
 * Cerca dove si è spostato un sito il cui dominio non esiste più: stesso nome con
 * altre estensioni, accettato solo se sul candidato funziona la stessa pagina
 * (o lo stesso feed) della fonte: i cloni e le pagine "dominio in vendita" no.
 */
export async function searchMovedDomain(
  oldHost: string,
  probe: Probe = { path: '/', feed: false },
  deps: SearchDeps = defaultDeps,
): Promise<FoundMove | null> {
  const parts = splitHost(oldHost);
  if (!parts) return null;
  const candidates = CANDIDATE_TLDS
    .filter((tld) => tld !== parts.suffix)
    .map((tld) => `${parts.sub}${parts.label}.${tld}`);

  const resolved = (await Promise.all(
    candidates.map(async (host) => ((await deps.resolve(host).catch(() => [])).length ? host : null)),
  )).filter((h): h is string => !!h);

  // In parallelo, ciascuno con un tempo massimo: alcuni candidati passano dal
  // browser di riserva (verifica anti-bot) e uno alla volta ci vorrebbero minuti
  const checks = await Promise.all(resolved.map(async (host): Promise<FoundMove | null> => {
    try {
      const page = await withTimeout(deps.fetch(`https://${host}${probe.path}`), CANDIDATE_TIMEOUT_MS);
      if (!pageMatches(page, parts.label, probe)) return null;
      // Se la home rimanda altrove (parcheggio, altro sito) conta il dominio finale
      const finalHost = hostOf(page.url) ?? host;
      if (splitHost(finalHost)?.label !== parts.label || finalHost === bareHost(oldHost)) return null;
      const title = page.html.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() ?? '';
      return {
        newHost: finalHost,
        evidence: probe.feed ? `Feed trovato: https://${finalHost}${probe.path}` : `Pagina trovata: "${title.slice(0, 120)}"`,
      };
    } catch {
      return null; // candidato irraggiungibile o troppo lento
    }
  }));
  // Più candidati validi (mirror che rimandano tutti allo stesso sito): vince il dominio più indicato
  const found = checks.filter((c): c is FoundMove => !!c);
  if (found.length === 0) return null;
  const votes = new Map<string, number>();
  for (const f of found) votes.set(f.newHost, (votes.get(f.newHost) ?? 0) + 1);
  return found.sort((x, y) => (votes.get(y.newHost)! - votes.get(x.newHost)!))[0];
}

/** true se per questo dominio non si è cercato nelle ultime 24 ore (e segna la ricerca). */
export function shouldSearch(host: string, now = Date.now()): boolean {
  const last = lastSearch.get(host);
  if (last !== undefined && now - last < SEARCH_EVERY_MS) return false;
  lastSearch.set(host, now);
  return true;
}

/**
 * Registra la proposta di trasloco e avvisa l'utente (campanella e push) la prima
 * volta. Le proposte già ignorate o applicate non vengono riproposte.
 */
export async function recordMove(
  userId: string,
  oldHost: string,
  newHost: string,
  reason: 'REDIRECT' | 'DNS',
  evidence: string,
): Promise<void> {
  const existing = await prisma.domainMove.findUnique({ where: { userId_oldHost_newHost: { userId, oldHost, newHost } } });
  if (existing) return;
  // Una sola proposta aperta per vecchio dominio
  const open = await prisma.domainMove.findFirst({ where: { userId, oldHost, status: 'PENDING' } });
  if (open) return;
  await prisma.domainMove.create({ data: { userId, oldHost, newHost, reason, evidence } });

  const title = `${oldHost} si è spostato su ${newHost}?`;
  const body = reason === 'REDIRECT'
    ? `Il sito ora rimanda a ${newHost}. Aggiorna le fonti con un clic in Aggiornamenti.`
    : `${oldHost} non esiste più; ${newHost} ha lo stesso nome. Controlla e aggiorna le fonti in Aggiornamenti.`;
  const n = await prisma.appNotification.create({ data: { userId, kind: 'domain_move', title, body, url: '/updates' } });
  await sendPush(userId, { id: n.id, title, body, url: '/updates' }).catch(() => {});
}
