/**
 * Discussioni dei forum (XenForo): segue le nuove risposte di un singolo thread.
 *
 * Il thread si legge da "<thread>/latest", che XenForo reindirizza all'ultima
 * pagina: lì ci sono sempre i post più recenti, comunque cresca la discussione.
 * Ogni post è un elemento con chiave stabile (il suo permalink "post-<id>").
 */
import * as cheerio from 'cheerio';
import type { ExtractedItem } from './extract';

const THREAD_RE = /^(https?:\/\/[^?#]+?\/threads\/(?:[^/?#]*\.)?\d+)(?:[/?#]|$)/i;
const SNIPPET_CHARS = 140;

/** URL base della discussione XenForo (senza pagina né ancora), o null se non è un thread. */
export function threadBase(url: string): string | null {
  return url.match(THREAD_RE)?.[1] ?? null;
}

/** Pagina da scaricare per vedere gli ultimi post. */
export function latestUrl(base: string): string {
  return `${base}/latest`;
}

export interface ThreadPage {
  title: string;
  posts: ExtractedItem[];
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Post della pagina, dal più vecchio al più recente. */
export function parseThread(html: string, pageUrl: string): ThreadPage | null {
  const base = threadBase(pageUrl);
  if (!base) return null;
  const $ = cheerio.load(html);
  const posts: ExtractedItem[] = [];

  $('article.message[data-content^="post-"], article.message[id^="js-post-"]').each((_, el) => {
    const $el = $(el);
    const id = ($el.attr('data-content') ?? $el.attr('id') ?? '').match(/(\d+)$/)?.[1];
    if (!id) return;
    const author = clean($el.attr('data-author') ?? $el.find('.message-name').first().text()) || 'Anonimo';
    const $body = $el.find('.message-body .bbWrapper').first().clone();
    $body.find('blockquote, script, style, .bbCodeSpoiler-button').remove();
    const text = clean($body.text());
    const media = $el.find('.message-body img, .message-body video, .message-body iframe, .message-body a.link--external').length;
    const snippet = text
      ? text.length > SNIPPET_CHARS ? `${text.slice(0, SNIPPET_CHARS)}…` : text
      : media > 0 ? `${media} ${media === 1 ? 'contenuto multimediale o link' : 'contenuti multimediali o link'}` : 'nuovo post';
    const time = $el.find('time[datetime]').first().attr('datetime');
    posts.push({
      url: `${base}/post-${id}`,
      title: `${author}: ${snippet}`,
      ...(time && !Number.isNaN(Date.parse(time)) && { publishedAt: new Date(time).toISOString() }),
    });
  });

  if (posts.length === 0) return null;
  const title = clean($('h1.p-title-value').first().text()) || clean($('title').first().text());
  return { title, posts };
}
