/**
 * Estrazione elementi da un'area di pagina e suggerimento automatico delle aree.
 *
 * Un "elemento" è un link significativo (titolo + URL) dentro un blocco che si
 * ripete: righe di una lista, card di una griglia, thread di un forum.
 */

import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

export interface ExtractedItem {
  title: string;
  url: string;
  publishedAt?: string; // ISO, se la pagina espone <time datetime>
}

export interface SuggestedArea {
  selector: string;
  label: string;
  itemCount: number;
  sample: ExtractedItem[];
  /** true se l'area sta in header/nav/footer/aside: probabilmente un menu. */
  isNavigation: boolean;
}

const MIN_TITLE_LEN = 3;
const MIN_REPEATED = 3;

// Le sidebar (aside) non sono navigazione: spesso contengono proprio liste utili
// come "Ultimi post" o "Più letti".
const NAV_TAGS = new Set(['nav', 'header', 'footer']);
// Parola chiave come token di classe/id, anche dentro nomi composti (p-navSticky, main-menu, sectionLinks)
const NAV_HINT = /(?:^|[\s_-])(?:nav(?:bar|igation)?|menu|breadcrumbs?|footer|header|pagination|pager|social|share|cookie|sectionLinks)(?=$|[\s_A-Z-])/;

function absUrl(href: string | undefined, baseUrl: string): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(h)) return null;
  try {
    const u = new URL(h, baseUrl);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Primo link "significativo" dentro un blocco: quello col testo più lungo. */
function bestLink($: cheerio.CheerioAPI, block: AnyNode, baseUrl: string): ExtractedItem | null {
  let best: ExtractedItem | null = null;
  $(block)
    .find('a[href]')
    .addBack('a[href]')
    .each((_, a) => {
      const $a = $(a);
      const url = absUrl($a.attr('href'), baseUrl);
      if (!url) return;
      const title = cleanText($a.attr('title') && $a.text().trim().length < MIN_TITLE_LEN ? $a.attr('title')! : $a.text());
      if (title.length < MIN_TITLE_LEN) return;
      if (!best || title.length > best.title.length) best = { title: title.slice(0, 300), url };
    });
  if (!best) return null;
  const dt = $(block).find('time[datetime]').first().attr('datetime');
  if (dt && !Number.isNaN(Date.parse(dt))) (best as ExtractedItem).publishedAt = new Date(dt).toISOString();
  return best;
}

/** Firma strutturale di un elemento: tag + classi ordinate (senza classi di stato). */
function signature(el: Element): string {
  const cls = (el.attribs?.class ?? '')
    .split(/\s+/)
    .filter((c) => c && !/^(is-|has-|active|selected|odd|even|first|last|new|unread|read|sticky)/i.test(c))
    .sort()
    .join('.');
  return `${el.tagName}${cls ? '.' + cls : ''}`;
}

function childElements(el: Element): Element[] {
  return el.children.filter((c): c is Element => c.type === 'tag');
}

/** Rilevanza di una lista: più elementi e titoli più lunghi = più probabile che sia contenuto. */
function contentScore(items: ExtractedItem[]): number {
  if (items.length === 0) return 0;
  const avgLen = items.reduce((s, i) => s + i.title.length, 0) / items.length;
  // Titoli molto corti (nomi utente, voci di menu, "123 comments") pesano poco
  const shortPenalty = avgLen < 15 ? 0.3 : 1;
  return items.length * Math.min(avgLen, 60) * shortPenalty;
}

function itemsFromBlocks($: cheerio.CheerioAPI, blocks: Element[], baseUrl: string): ExtractedItem[] {
  const seen = new Set<string>();
  const items: ExtractedItem[] = [];
  for (const b of blocks) {
    const item = bestLink($, b, baseUrl);
    if (item && !seen.has(item.url)) {
      seen.add(item.url);
      items.push(item);
    }
  }
  return items;
}

/**
 * Elementi estratti da un contenitore. I figli vengono raggruppati per firma
 * strutturale; si usa il gruppo ripetuto con il contenuto migliore, non il più
 * numeroso: in tabelle come Hacker News le righe "titolo" e le righe "autore,
 * commenti" si alternano e hanno la stessa numerosità.
 */
function itemsFromContainer($: cheerio.CheerioAPI, el: Element, baseUrl: string): ExtractedItem[] {
  const groups = new Map<string, Element[]>();
  for (const c of childElements(el)) {
    const sig = signature(c);
    groups.set(sig, [...(groups.get(sig) ?? []), c]);
  }
  let best: ExtractedItem[] | null = null;
  for (const g of groups.values()) {
    if (g.length < MIN_REPEATED) continue;
    const items = itemsFromBlocks($, g, baseUrl);
    if (!best || contentScore(items) > contentScore(best)) best = items;
  }
  return best ?? itemsFromBlocks($, childElements(el), baseUrl);
}

/** true se il contenitore ha almeno un gruppo di figli ripetuti. */
function hasRepeatedChildren(el: Element): boolean {
  const counts = new Map<string, number>();
  for (const c of childElements(el)) counts.set(signature(c), (counts.get(signature(c)) ?? 0) + 1);
  return [...counts.values()].some((n) => n >= MIN_REPEATED);
}

/** Estrae gli elementi dall'area indicata dal selettore (tutte le corrispondenze). */
export function extractItems(html: string, baseUrl: string, selector: string): ExtractedItem[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: ExtractedItem[] = [];
  $(selector).each((_, el) => {
    if (el.type !== 'tag') return;
    for (const item of itemsFromContainer($, el, baseUrl)) {
      if (!seen.has(item.url)) {
        seen.add(item.url);
        out.push(item);
      }
    }
  });
  return out;
}

function cssEscape(s: string): string {
  return s.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}

/**
 * Selettore CSS stabile per un elemento: risale fino a un id (o al body)
 * usando tag + prima classe significativa, con :nth-of-type solo se ambiguo.
 */
export function cssPath($: cheerio.CheerioAPI, el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.type === 'tag' && cur.tagName !== 'html') {
    const id = cur.attribs?.id;
    if (id && /^[A-Za-z][\w-]*$/.test(id) && !/\d{4,}/.test(id)) {
      parts.unshift(`#${cssEscape(id)}`);
      break;
    }
    if (cur.tagName === 'body') {
      parts.unshift('body');
      break;
    }
    const cls = (cur.attribs?.class ?? '').split(/\s+/).find((c) => /^[A-Za-z][\w-]{1,40}$/.test(c));
    let part = cls ? `${cur.tagName}.${cssEscape(cls)}` : cur.tagName;
    const parent: Element | null = cur.parent && cur.parent.type === 'tag' ? (cur.parent as Element) : null;
    if (parent) {
      const same = childElements(parent).filter((s) => $(s).is(part));
      if (same.length > 1) part += `:nth-of-type(${childElements(parent).filter((s) => s.tagName === cur!.tagName).indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = parent;
  }
  return parts.join(' > ');
}

function isNavigation($: cheerio.CheerioAPI, el: Element): boolean {
  let cur: Element | null = el;
  while (cur && cur.type === 'tag') {
    if (NAV_TAGS.has(cur.tagName)) return true;
    const hint = `${cur.attribs?.id ?? ''} ${cur.attribs?.class ?? ''} ${cur.attribs?.role ?? ''}`;
    if (NAV_HINT.test(hint) || cur.attribs?.role === 'navigation') return true;
    cur = cur.parent && cur.parent.type === 'tag' ? (cur.parent as Element) : null;
  }
  return false;
}

/** Etichetta leggibile: titolo più vicino che precede l'area, o aria-label/id. */
function areaLabel($: cheerio.CheerioAPI, el: Element): string {
  const aria = el.attribs?.['aria-label'];
  if (aria) return cleanText(aria).slice(0, 80);
  let cur: Element | null = el;
  for (let depth = 0; cur && depth < 4; depth++) {
    const heading = $(cur).prevAll('h1,h2,h3,h4,h5,h6').first().text() || $(cur).children('h1,h2,h3,h4').first().text();
    if (cleanText(heading)) return cleanText(heading).slice(0, 80);
    cur = cur.parent && cur.parent.type === 'tag' ? (cur.parent as Element) : null;
  }
  return el.attribs?.id ?? signature(el);
}

/**
 * Suggerisce le aree della pagina che contengono liste di elementi.
 * Ordinate per rilevanza: prima i contenuti, poi la navigazione.
 */
export function suggestAreas(html: string, baseUrl: string, limit = 6): SuggestedArea[] {
  const $ = cheerio.load(html);
  $('script, style, noscript, template, svg').remove();

  const candidates: Array<SuggestedArea & { score: number; el: Element }> = [];
  $('body *').each((_, node) => {
    if (node.type !== 'tag') return;
    const el = node as Element;
    if (!hasRepeatedChildren(el)) return;
    const items = itemsFromContainer($, el, baseUrl);
    if (items.length < MIN_REPEATED) return;
    const nav = isNavigation($, el);
    const score = contentScore(items) * (nav ? 0.2 : 1);
    candidates.push({
      el,
      score,
      selector: cssPath($, el),
      label: areaLabel($, el),
      itemCount: items.length,
      sample: items.slice(0, 5),
      isNavigation: nav,
    });
  });

  // Scarta i contenitori annidati in un candidato migliore con gli stessi elementi
  candidates.sort((a, b) => b.score - a.score);
  const chosen: typeof candidates = [];
  for (const c of candidates) {
    const urls = new Set(c.sample.map((i) => i.url));
    const dup = chosen.some((k) => k.sample.some((i) => urls.has(i.url)));
    if (!dup) chosen.push(c);
    if (chosen.length >= limit) break;
  }
  return chosen.map(({ score: _s, el: _e, ...area }) => area);
}
