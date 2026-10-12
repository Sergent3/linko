/**
 * Browser di riserva per i siti protetti da verifiche anti-bot (Cloudflare
 * "Just a moment…", DDoS-Guard): quando una richiesta normale riceve la
 * pagina di verifica, la pagina viene aperta in un Chromium vero (servizio
 * "browser" di docker-compose, raggiunto via BROWSER_WS_URL).
 *
 * Sicurezza: ogni richiesta del browser (redirect, script, iframe…) passa da
 * assertPublicUrl, quindi il browser non può raggiungere servizi interni.
 * Immagini, video e font non vengono scaricati.
 */
import { chromium, type Browser, type Response } from 'playwright-core';
import { config } from '../config';
import { assertPublicUrl, authFor, SCRAPING_HEADERS, type FetchedPage, type SiteAuth } from './http';

const NAV_TIMEOUT_MS = 30_000;
const CHALLENGE_WAIT_MS = 20_000;
const MAX_PARALLEL = 2;
const SKIPPED_RESOURCES = new Set(['image', 'media', 'font']);

/** La risposta è la pagina di verifica di un sistema anti-bot? */
export function isChallenge(status: number, headers: Record<string, unknown>, html: string): boolean {
  if (status !== 403 && status !== 503 && status !== 429) return false;
  const server = String(headers['server'] ?? '').toLowerCase();
  if (headers['cf-mitigated'] === 'challenge') return true;
  if (server.includes('ddos-guard')) return true;
  return /<title>(Just a moment|Attention Required|Ci siamo quasi|DDoS-Guard)/i.test(html)
    || /challenge-platform|cf-browser-verification|__cf_chl_/i.test(html);
}

function stillChallenged(title: string, html: string): boolean {
  return /just a moment|ci siamo quasi|attention required|ddos-guard/i.test(title) || /challenge-platform\/h\/[bg]\/orchestrate/i.test(html);
}

let browserPromise: Promise<Browser> | null = null;
let active = 0;
const waiting: Array<() => void> = [];

async function getBrowser(): Promise<Browser> {
  if (!config.BROWSER_WS_URL) throw new Error('Browser non configurato (BROWSER_WS_URL)');
  if (!browserPromise) {
    browserPromise = chromium.connect(config.BROWSER_WS_URL, { timeout: 15_000 }).then((b) => {
      b.on('disconnected', () => { browserPromise = null; });
      return b;
    });
    browserPromise.catch(() => { browserPromise = null; });
  }
  return browserPromise;
}

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

export function browserAvailable(): boolean {
  return !!config.BROWSER_WS_URL;
}

/** Apre la pagina nel browser e restituisce l'HTML finale, dopo l'eventuale verifica. */
export async function fetchWithBrowser(rawUrl: string, auths: SiteAuth[] = []): Promise<FetchedPage> {
  const start = await assertPublicUrl(rawUrl);
  const auth = authFor(start.hostname, auths);

  return withSlot(async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: auth?.userAgent ?? SCRAPING_HEADERS['User-Agent'],
      locale: 'it-IT',
      extraHTTPHeaders: { 'Accept-Language': SCRAPING_HEADERS['Accept-Language'] },
      javaScriptEnabled: true,
    });
    try {
      if (auth) {
        await context.addCookies(
          auth.cookie.split(';').map((p) => p.trim()).filter((p) => p.includes('=')).map((p) => {
            const i = p.indexOf('=');
            return { name: p.slice(0, i), value: p.slice(i + 1), domain: `.${auth.domain}`, path: '/', secure: true };
          }),
        );
      }

      // Ogni richiesta del browser deve andare verso indirizzi pubblici
      await context.route('**/*', async (route) => {
        const req = route.request();
        if (SKIPPED_RESOURCES.has(req.resourceType())) return route.abort();
        try {
          await assertPublicUrl(req.url());
          return route.continue();
        } catch {
          return route.abort('blockedbyclient');
        }
      });

      const page = await context.newPage();
      // Ultima risposta del documento principale (dopo la verifica la pagina si ricarica)
      let lastNav: Response | null = null;
      page.on('response', (r) => {
        if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) lastNav = r;
      });
      const response = await page.goto(start.toString(), { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });


      // La verifica anti-bot si risolve da sola in qualche secondo e ricarica la pagina
      const deadline = Date.now() + CHALLENGE_WAIT_MS;
      let html = await page.content();
      while (stillChallenged(await page.title(), html) && Date.now() < deadline) {
        await page.waitForTimeout(1_000);
        html = await page.content();
      }
      if (stillChallenged(await page.title(), html)) {
        throw new Error('La verifica anti-bot del sito non si è risolta: il sito potrebbe richiedere un intervento manuale (captcha)');
      }
      // Dopo la verifica la pagina si ricarica: conta lo status dell'ultima risposta reale
      const final: Response | null = lastNav ?? response;
      const status = final?.status() ?? 0;

      // Feed RSS/Atom: serve il testo originale, non il DOM disegnato dal browser
      if (final && /xml|rss|atom/i.test(final.headers()['content-type'] ?? '')) {
        html = await final.text().catch(() => html);
      }

      return { url: page.url(), status, html, authId: auth?.id };
    } finally {
      await context.close().catch(() => {});
    }
  });
}
