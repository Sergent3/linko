/**
 * Feed RSS 2.0, RSS 1.0 (RDF) e Atom: lettura e scoperta.
 */

import * as cheerio from 'cheerio';

export interface FeedItem {
  title: string;
  url: string;
  publishedAt?: string;
  /** Categorie del feed: usate dai termini #tag del filtro. */
  tags: string[];
  /** Identificativo stabile: guid/id se presente, altrimenti l'URL. */
  key: string;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

/** Percorsi comuni da provare quando la pagina non dichiara un feed. */
export const COMMON_FEED_PATHS = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml', '/feeds/posts/default'];

const MAX_ITEMS = 200;

function clean(s: string | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function toIso(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = Date.parse(s.trim());
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.trim(), base);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/** true se il contenuto è un feed (e non una pagina HTML). */
export function looksLikeFeed(body: string): boolean {
  return /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 3_000));
}

/** Testo decodificato: i titoli nei feed sono spesso HTML con entità. */
function decodeHtml(s: string): string {
  return clean(cheerio.load(`<p>${s}</p>`)('p').text());
}

/** Legge un feed. Restituisce null se il contenuto non è un feed riconosciuto. */
export function parseFeed(xml: string, baseUrl: string): ParsedFeed | null {
  if (!looksLikeFeed(xml)) return null;
  const $ = cheerio.load(xml, { xml: true });

  const isAtom = $('feed').length > 0;
  const entries = isAtom ? $('feed > entry') : $('item');
  const feedTitle = decodeHtml(isAtom ? $('feed > title').first().text() : $('channel > title').first().text());

  const items: FeedItem[] = [];
  const seen = new Set<string>();
  entries.slice(0, MAX_ITEMS).each((_, el) => {
    const $e = $(el);
    let url: string | null;
    let key: string;
    let date: string | undefined;
    let tags: string[];

    if (isAtom) {
      // Preferisce rel="alternate" (o senza rel) rispetto a self/edit/replies
      const link =
        $e.children('link[rel="alternate"]').first().attr('href') ??
        $e.children('link:not([rel])').first().attr('href') ??
        $e.children('link').first().attr('href');
      url = absolute(link, baseUrl);
      key = clean($e.children('id').first().text()) || url || '';
      date = toIso($e.children('updated').first().text()) ?? toIso($e.children('published').first().text());
      tags = $e.children('category').map((_, c) => clean($(c).attr('term') ?? $(c).text())).get();
    } else {
      url = absolute(clean($e.children('link').first().text()) || $e.children('link').first().attr('href'), baseUrl);
      key = clean($e.children('guid').first().text()) || url || '';
      date = toIso($e.children('pubDate').first().text()) ?? toIso($e.children('dc\\:date').first().text());
      tags = $e.children('category').map((_, c) => clean($(c).text())).get();
    }

    const title = decodeHtml($e.children('title').first().text());
    if (!url || !title || seen.has(key)) return;
    seen.add(key);
    items.push({ title: title.slice(0, 300), url, ...(date && { publishedAt: date }), tags: tags.filter(Boolean), key });
  });

  return { title: feedTitle, items };
}

/** Feed dichiarati dalla pagina con <link rel="alternate" type="application/rss+xml|atom+xml">. */
export function declaredFeeds(html: string, baseUrl: string): Array<{ url: string; title: string }> {
  const $ = cheerio.load(html);
  const out: Array<{ url: string; title: string }> = [];
  $('link[rel~="alternate"]').each((_, el) => {
    const type = ($(el).attr('type') ?? '').toLowerCase();
    if (!/application\/(rss|atom)\+xml|application\/feed\+json/.test(type) || type.includes('json')) return;
    const url = absolute($(el).attr('href'), baseUrl);
    if (url && !out.some((f) => f.url === url)) out.push({ url, title: clean($(el).attr('title')) });
  });
  return out;
}

/**
 * URL da provare per trovare un feed: prima quelli dichiarati, poi i percorsi
 * comuni sulla radice del sito. Senza duplicati.
 */
export function feedCandidates(html: string, pageUrl: string, max = 6): string[] {
  const urls = declaredFeeds(html, pageUrl).map((f) => f.url);
  const origin = new URL(pageUrl).origin;
  for (const p of COMMON_FEED_PATHS) urls.push(origin + p);
  return [...new Set(urls)].slice(0, max);
}
