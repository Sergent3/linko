/**
 * Accessi ai siti con login (SiteCredential): caricamento dei cookie decifrati
 * e riconoscimento della scadenza.
 *
 * Un cookie è considerato scaduto quando, usandolo, il sito risponde 401/403,
 * rimanda alla pagina di login o mostra la pagina da ospite (vedi session.ts).
 * In quel caso l'accesso passa a EXPIRED: le fonti del dominio smettono di
 * interrogare il sito e mostrano l'errore finché l'utente non aggiorna il cookie.
 */
import { prisma } from '../lib/prisma';
import { decrypt, loadKey } from '../lib/secret-box';
import { config } from '../config';
import { authFor, type FetchedPage, type SiteAuth } from './http';
import { detectSession, type SessionState } from './session';

// Caricata al primo uso (il formato è già validato all'avvio da config.ts)
let key: Buffer | null = null;
const secretKey = () => (key ??= loadKey(config.WATCH_SECRET_KEY));

export interface LoadedAuth extends SiteAuth {
  status: 'UNVERIFIED' | 'OK' | 'EXPIRED';
}

export class AuthExpiredError extends Error {
  constructor(public readonly domain: string, reason: string) {
    super(`Accesso a ${domain} scaduto (${reason}): aggiorna il cookie in “Accessi ai siti”`);
  }
}

export function expiredMessage(domain: string): string {
  return `Accesso a ${domain} scaduto: aggiorna il cookie in “Accessi ai siti”`;
}

/** Cookie decifrati dell'utente; un cookie illeggibile (chiave cambiata) viene ignorato. */
export async function loadAuths(userId: string, onlyId?: string): Promise<LoadedAuth[]> {
  const rows = await prisma.siteCredential.findMany({ where: { userId, ...(onlyId && { id: onlyId }) } });
  const out: LoadedAuth[] = [];
  for (const r of rows) {
    try {
      out.push({ id: r.id, domain: r.domain, cookie: decrypt(r.cookieEnc, secretKey()), userAgent: r.userAgent, status: r.status });
    } catch {
      console.error(`[watch] Cookie di ${r.domain} non decifrabile: WATCH_SECRET_KEY cambiata?`);
    }
  }
  return out;
}

/** Accesso già noto come scaduto per l'host di questo URL. */
export function expiredAuthFor(rawUrl: string, auths: LoadedAuth[]): LoadedAuth | undefined {
  try {
    const a = authFor(new URL(rawUrl).hostname, auths) as LoadedAuth | undefined;
    return a?.status === 'EXPIRED' ? a : undefined;
  } catch {
    return undefined;
  }
}

export interface AuthOutcome {
  domain: string;
  state: SessionState;
  status: number;
}

/**
 * Valuta la risposta ottenuta con un cookie: aggiorna lo stato dell'accesso e,
 * se il cookie non è più valido, lancia AuthExpiredError.
 */
export async function assessAuth(page: FetchedPage, auths: LoadedAuth[]): Promise<AuthOutcome | undefined> {
  if (!page.authId) return undefined;
  const auth = auths.find((a) => a.id === page.authId);
  if (!auth) return undefined;

  const state = page.status === 401 || page.status === 403 ? 'out' : detectSession(page.html, page.url);
  const now = new Date();

  if (state === 'out') {
    const reason = page.status === 401 || page.status === 403
      ? `il sito risponde HTTP ${page.status}`
      : 'il sito mostra la pagina da ospite';
    await prisma.siteCredential.update({
      where: { id: auth.id },
      data: {
        status: 'EXPIRED',
        lastError: reason,
        lastStatus: page.status,
        lastUsedAt: now,
        ...(auth.status !== 'EXPIRED' && { expiredAt: now }),
      },
    });
    auth.status = 'EXPIRED';
    throw new AuthExpiredError(auth.domain, reason);
  }

  if (page.status < 400) {
    await prisma.siteCredential.update({
      where: { id: auth.id },
      data: { status: 'OK', lastError: null, lastStatus: page.status, lastUsedAt: now, expiredAt: null },
    });
    auth.status = 'OK';
  }
  return { domain: auth.domain, state, status: page.status };
}
