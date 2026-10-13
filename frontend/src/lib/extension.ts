/**
 * Dialogo con l'estensione Linko per Chrome/Brave (cartella frontend/extension).
 * Il content script dell'estensione (linko-bridge.js) ascolta window.postMessage
 * su questa pagina e gira le richieste al service worker.
 */
import type { FetchedPage } from '@/types/api';

/** Versione dell'estensione distribuita da questo Linko (per segnalare gli aggiornamenti). */
export { version as EXTENSION_VERSION } from '../../extension/manifest.json';

export interface ExtensionState {
  version: string;
  browser: string;
  connected: boolean;
  lastRun: string | null;
  lastError: string | null;
  needPermission: string[];
  challenged: string[];
  checked: number;
  linko: string;
}

export type ExtensionFetchResult =
  | { page: FetchedPage }
  | { error: 'permission'; origin: string }
  | { error: 'challenge' | 'network' | 'extension' | 'reload' | 'forbidden'; message?: string };

let seq = 0;

function call<T>(payload: Record<string, unknown>, timeoutMs: number): Promise<T | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const id = `${Date.now()}-${++seq}`;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => { window.removeEventListener('message', onMessage); resolve(null); }, timeoutMs);
    function onMessage(e: MessageEvent) {
      if (e.source !== window || e.origin !== window.location.origin) return;
      if (e.data?.type !== 'linko-ext:res' || e.data.id !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(e.data.result as T);
    }
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'linko-ext:req', id, payload }, window.location.origin);
  });
}

/** Stato dell'estensione, o null se non è installata (o non è per questo indirizzo di Linko). */
/** Risposta valida dell'estensione, o null (errore, estensione ricaricata, nessuna risposta). */
function asState(r: unknown): ExtensionState | null {
  const s = r as (ExtensionState & { error?: string }) | null;
  return s && !s.error && typeof s.version === 'string' ? s : null;
}

export async function detectExtension(): Promise<ExtensionState | null> {
  return asState(await call({ type: 'hello' }, 3000));
}

export const connectExtension = async (token: string) => asState(await call({ type: 'connect', token }, 5000));
export const disconnectExtension = async () => asState(await call({ type: 'disconnect' }, 5000));
export const pollExtension = async () => asState(await call({ type: 'poll' }, 120_000));
/** Apre il pannello dell'estensione per concedere il permesso a questi siti. */
export const grantExtension = (origins: string[]) => call<{ ok: boolean }>({ type: 'grant', origins }, 5000);

/** Scarica una pagina dal browser dell'utente (verifica anti-bot inclusa: se serve, l'utente spunta la casella). */
export async function fetchViaExtension(url: string): Promise<ExtensionFetchResult> {
  return (await call<ExtensionFetchResult>({ type: 'fetch', url }, 180_000)) ?? { error: 'extension', message: 'L\'estensione non ha risposto' };
}

/** Origine (protocollo + host) di un indirizzo, come la usa l'estensione per i permessi. */
export function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}
