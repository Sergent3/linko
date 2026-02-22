import { createHash } from 'crypto';

/**
 * Normalizza un URL per un hashing consistente:
 * - Schema e hostname in lowercase
 * - Rimuove trailing slash sul root path
 * - Preserva path, query string e fragment
 *
 * Lancia se l'URL non è valido.
 */
export function normalizeUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname === '/') url.pathname = '';
  return url.toString();
}

/** SHA-256 hex dell'URL (già normalizzato). */
export function hashUrl(normalizedUrl: string): string {
  return createHash('sha256').update(normalizedUrl).digest('hex');
}

/**
 * Normalizza e calcola l'hash in un unico passaggio.
 * Usato nel service per la de-duplicazione.
 */
export function normalizeAndHash(raw: string): { normalized: string; hash: string } {
  const normalized = normalizeUrl(raw);
  return { normalized, hash: hashUrl(normalized) };
}
