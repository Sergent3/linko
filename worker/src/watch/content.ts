/**
 * Contenuto leggibile di un elemento, per l'anteprima in Linko: il singolo post
 * di una discussione XenForo, oppure il corpo dell'articolo di una pagina.
 * L'HTML restituito è grezzo: il backend lo ripulisce prima di mostrarlo.
 */
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export interface ItemContent {
  url: string;
  title: string;
  author?: string;
  publishedAt?: string;
  image?: string;
  html: string;
}

const MAX_HTML = 250_000;
const POST_ID = /\/post-(\d+)(?:[/?#]|$)|#post-(\d+)$/;

const ARTICLE_ROOTS = [
  '[itemprop="articleBody"]',
  '.entry-content',
  '.post-content',
  '.article-content',
  '.article-body',
  '.article__body',
  '.post-body',
  '.story-body',
  'article',
  'main',
  '[role="main"]',
];

const NOISE = [
  'script', 'style', 'noscript', 'template', 'nav', 'aside', 'footer', 'form', 'button', 'svg', 'canvas',
  '.share', '.sharing', '.social', '.related', '.comments', '#comments', '.newsletter', '.advert', '.ads', '.ad',
  '[aria-hidden="true"]', '.sr-only', '.visually-hidden',
].join(', ');

function clean(s: string | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isoDate(s: string | undefined): string | undefined {
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : undefined;
}

/** Immagini caricate in differita, iframe trasformati in link: l'HTML resta leggibile senza script. */
function normalizeMedia($: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>): void {
  root.find('img').each((_, el) => {
    const $img = $(el);
    const lazy = $img.attr('data-src') ?? $img.attr('data-lazy-src') ?? $img.attr('data-url') ?? $img.attr('data-original');
    const srcset = ($img.attr('data-srcset') ?? $img.attr('srcset'))?.split(',')[0]?.trim().split(/\s+/)[0];
    const src = $img.attr('src');
    if (lazy) $img.attr('src', lazy);
    else if ((!src || src.startsWith('data:')) && srcset) $img.attr('src', srcset);
  });
  root.find('iframe').each((_, el) => {
    const src = $(el).attr('src') ?? $(el).attr('data-src');
    $(el).replaceWith(src ? `<p><a href="${src.replace(/"/g, '&quot;')}">Contenuto incorporato: apri</a></p>` : '');
  });
}

function postContent($: cheerio.CheerioAPI, id: string, pageUrl: string): ItemContent | null {
  const $post = $(`article[data-content="post-${id}"], #js-post-${id}, #post-${id}`).first();
  if ($post.length === 0) return null;
  const $body = $post.find('.message-body .bbWrapper, .message-userContent .bbWrapper').first();
  if ($body.length === 0) return null;
  $body.find('script, style, noscript, .bbCodeBlock-expandLink, .bbCodeBlock-shrinkLink, .js-unfurl-favicon').remove();
  // Citazioni: resta il nome dell'autore citato
  $body.find('blockquote').each((_, el) => {
    const who = $(el).attr('data-quote') ?? clean($(el).find('.bbCodeBlock-title').first().text()).replace(/ said:$/, '');
    $(el).find('.bbCodeBlock-title').remove();
    if (who) $(el).attr('data-author', who);
  });
  normalizeMedia($, $body);
  const thread = clean($('h1.p-title-value').first().text()) || clean($('title').text());
  return {
    url: pageUrl,
    title: thread,
    author: clean($post.attr('data-author') ?? $post.find('.message-name').first().text()) || undefined,
    publishedAt: isoDate($post.find('time[datetime]').first().attr('datetime')),
    html: ($body.html() ?? '').slice(0, MAX_HTML),
  };
}

function articleContent($: cheerio.CheerioAPI, pageUrl: string): ItemContent {
  const meta = (name: string) => $(`meta[property="${name}"], meta[name="${name}"]`).first().attr('content');
  const title = clean(meta('og:title')) || clean($('h1').first().text()) || clean($('title').text());

  // Corpo dell'articolo: tra i contenitori tipici, il più piccolo che contiene
  // quasi tutto il testo dei paragrafi (evita di prendere anche menu e correlati)
  const pText = (el: AnyNode) => $(el).find('p').toArray().reduce((n, p) => n + clean($(p).text()).length, 0);
  // Candidati: i contenitori tipici e i blocchi che racchiudono i paragrafi lunghi
  const pool = new Set<AnyNode>($(ARTICLE_ROOTS.join(', ')).toArray());
  $('p').filter((_, el) => clean($(el).text()).length > 80).each((_, el) => {
    for (const parent of $(el).parents().slice(0, 4).toArray()) pool.add(parent);
  });
  const candidates = [...pool]
    .filter((el) => !['html', 'body'].includes((el as { name?: string }).name ?? ''))
    .map((el) => ({ el, p: pText(el), size: ($(el).html() ?? '').length }))
    .filter((c) => c.p > 200);
  let $root: cheerio.Cheerio<AnyNode> | null = null;
  if (candidates.length) {
    const max = Math.max(...candidates.map((c) => c.p));
    const best = candidates.filter((c) => c.p >= max * 0.7).sort((x, y) => x.size - y.size)[0];
    $root = $(best.el);
  }
  // Ripiego: il blocco con più testo nei paragrafi diretti
  if (!$root) {
    let best: AnyNode | null = null;
    let bestLen = 0;
    $('div, section').each((_, el) => {
      const len = $(el).children('p').toArray().reduce((n, p) => n + clean($(p).text()).length, 0);
      if (len > bestLen) { bestLen = len; best = el; }
    });
    if (best && bestLen > 200) $root = $(best);
  }

  let html = '';
  if ($root) {
    const $c = $root.clone();
    $c.find(NOISE).remove();
    // Il titolo è già mostrato sopra il contenuto
    $c.find('h1').first().remove();
    normalizeMedia($, $c);
    html = $c.html() ?? '';
  }
  const description = clean(meta('og:description') ?? meta('description'));
  if (clean(cheerio.load(html).text()).length < 80 && description) html = `<p>${escapeHtml(description)}</p>${html}`;

  return {
    url: pageUrl,
    title,
    author: clean(meta('author') ?? meta('article:author')) || undefined,
    publishedAt: isoDate(meta('article:published_time') ?? $('time[datetime]').first().attr('datetime')),
    image: meta('og:image'),
    html: html.slice(0, MAX_HTML),
  };
}

export function extractContent(html: string, pageUrl: string, requestedUrl: string): ItemContent {
  const $ = cheerio.load(html);
  const m = requestedUrl.match(POST_ID) ?? pageUrl.match(POST_ID);
  const id = m?.[1] ?? m?.[2];
  if (id) {
    const post = postContent($, id, pageUrl);
    if (post) return post;
  }
  return articleContent($, pageUrl);
}
