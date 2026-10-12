/**
 * Lettura dei cookie incollati dall'utente, in uno dei formati più comuni:
 *   - intestazione:  "Cookie: a=1; b=2"  oppure  "a=1; b=2"
 *   - cookies.txt (Netscape): righe separate da tab, 7 campi
 *   - JSON delle estensioni (Cookie-Editor e simili): [{ name, value, domain }]
 * Il risultato è il valore dell'intestazione Cookie da inviare al sito.
 */

const MAX_HEADER = 8_192;
// Nome cookie secondo RFC 6265 (token): niente spazi, separatori o controlli
const NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export class CookieInputError extends Error {}

export interface ParsedCookies {
  header: string;
  names: string[];
}

/** "https://www.Esempio.it/x" o "esempio.it" → "esempio.it" */
export function domainOf(input: string): string {
  const raw = input.trim().toLowerCase();
  let host: string;
  try {
    host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname;
  } catch {
    throw new CookieInputError('Dominio non valido');
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  if (!host.includes('.') || !/^[a-z0-9.-]+$/.test(host)) throw new CookieInputError('Dominio non valido');
  return host;
}

/** Il cookie di un file/estensione vale per questo dominio? (".esempio.it" vale anche per i sottodomini) */
function cookieDomainMatches(cookieDomain: string, domain: string): boolean {
  const d = cookieDomain.trim().toLowerCase().replace(/^\./, '').replace(/^www\./, '');
  return d === domain || domain.endsWith(`.${d}`) || d.endsWith(`.${domain}`);
}

function fromPairs(pairs: Array<[string, string]>): ParsedCookies {
  const map = new Map<string, string>();
  for (const [rawName, rawValue] of pairs) {
    const name = rawName.trim();
    const value = rawValue.trim();
    if (!name) continue;
    if (!NAME_RE.test(name)) throw new CookieInputError(`Nome di cookie non valido: "${name.slice(0, 40)}"`);
    // Il valore non può contenere separatori o caratteri di controllo (niente header injection)
    if (/[;\r\n\u0000-\u001f\u007f]/.test(value)) throw new CookieInputError(`Valore non valido nel cookie "${name}"`);
    map.set(name, value);
  }
  if (map.size === 0) throw new CookieInputError('Nessun cookie trovato nel testo incollato');
  const header = [...map].map(([n, v]) => `${n}=${v}`).join('; ');
  if (header.length > MAX_HEADER) throw new CookieInputError('Cookie troppo lunghi (massimo 8 KB)');
  return { header, names: [...map.keys()] };
}

export function parseCookieInput(input: string, domain: string): ParsedCookies {
  const text = input.trim();
  if (!text) throw new CookieInputError('Incolla i cookie del sito');

  // JSON delle estensioni
  if (text.startsWith('[') || text.startsWith('{')) {
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new CookieInputError('JSON dei cookie non valido'); }
    const list = (Array.isArray(data) ? data : [data]) as Array<Record<string, unknown>>;
    const pairs = list
      .filter((c) => typeof c?.name === 'string' && typeof c?.value === 'string')
      .filter((c) => typeof c.domain !== 'string' || cookieDomainMatches(c.domain, domain))
      .map((c) => [c.name as string, c.value as string] as [string, string]);
    if (pairs.length === 0) throw new CookieInputError(`Nel JSON non ci sono cookie per ${domain}`);
    return fromPairs(pairs);
  }

  // cookies.txt (Netscape): dominio \t flag \t path \t secure \t scadenza \t nome \t valore
  // "#HttpOnly_dominio" è una riga di dati, gli altri "#" sono commenti
  const isComment = (l: string) => l.startsWith('#') && !/^#HttpOnly_/i.test(l);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !isComment(l));
  const tabbed = lines.filter((l) => l.split('\t').length >= 7);
  if (tabbed.length > 0 && tabbed.length === lines.length) {
    const pairs = tabbed
      .map((l) => l.split('\t'))
      .filter((f) => cookieDomainMatches(f[0].replace(/^#HttpOnly_/i, ''), domain))
      .map((f) => [f[5], f.slice(6).join('\t')] as [string, string]);
    if (pairs.length === 0) throw new CookieInputError(`Nel file non ci sono cookie per ${domain}`);
    return fromPairs(pairs);
  }

  // Intestazione Cookie, anche su più righe
  const header = text.replace(/^cookie\s*:\s*/i, '').replace(/\r?\n/g, ';');
  const pairs = header
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf('=');
      if (i <= 0) throw new CookieInputError(`Formato non riconosciuto vicino a "${p.slice(0, 30)}"`);
      return [p.slice(0, i), p.slice(i + 1)] as [string, string];
    });
  return fromPairs(pairs);
}

/** User-Agent facoltativo: una sola riga, lunghezza ragionevole. */
export function cleanUserAgent(ua: string | undefined): string | null {
  const v = (ua ?? '').trim();
  if (!v) return null;
  if (v.length > 512 || /[\r\n\u0000-\u001f\u007f]/.test(v)) throw new CookieInputError('User-Agent non valido');
  return v;
}
