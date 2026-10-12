import type { WatchItem } from '@/types/api';

/** Discussione XenForo a cui appartiene un URL (senza pagina, post o ancora). */
const THREAD_RE = /^(https?:\/\/[^?#]+?\/threads\/(?:[^/?#]*\.)?\d+)(?:[/?#]|$)/i;

export function threadOf(url: string): string | null {
  return url.match(THREAD_RE)?.[1] ?? null;
}

function normalizeTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface ItemGroup {
  key: string;
  /** Elementi del gruppo, dal più recente */
  items: WatchItem[];
  /** Post della stessa discussione (altrimenti: aggiornamenti con lo stesso titolo) */
  thread: boolean;
  /** Novità del giorno di una fonte in riepilogo giornaliero */
  digest?: boolean;
  title: string;
}

/**
 * Accorpa gli aggiornamenti uguali: i post della stessa discussione di un forum
 * e gli elementi con lo stesso titolo (lo stesso articolo da più feed, link
 * ripetuti). L'ordine segue il primo elemento di ogni gruppo.
 */
export function groupItems(items: WatchItem[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>();
  for (const it of items) {
    // Fonti in riepilogo: tutte le novità del giorno in una sola riga
    if (it.source.delivery === 'DIGEST') {
      const key = `d:${it.sourceId}`;
      const g = groups.get(key);
      if (g) g.items.push(it);
      else groups.set(key, { key, items: [it], thread: false, digest: true, title: `Riepilogo · ${it.source.name}` });
      continue;
    }
    const thread = threadOf(it.url);
    const norm = normalizeTitle(it.title);
    const key = thread ? `t:${thread}` : `n:${norm || it.url}`;
    const g = groups.get(key);
    if (g) {
      g.items.push(it);
      continue;
    }
    groups.set(key, {
      key,
      items: [it],
      thread: !!thread,
      // I post di una discussione seguita hanno come titolo "autore: testo": il nome giusto è quello della fonte
      title: thread && it.source.mode === 'THREAD' ? it.source.name : it.title,
    });
  }
  return [...groups.values()];
}
