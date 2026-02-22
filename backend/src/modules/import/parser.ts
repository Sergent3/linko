/**
 * Netscape Bookmark Format Parser
 *
 * Compatibile con: Chrome, Firefox, Edge, Safari.
 * Gestisce cartelle annidate, de-duplicazione via hash, sanitizing XSS.
 *
 * Formato atteso (Netscape Bookmark File-1):
 *   <DL>
 *     <DT><H3>Folder Name</H3>
 *     <DL>
 *       <DT><A HREF="url" ADD_DATE="ts" ICON="...">Title</A>
 *     </DL>
 *   </DL>
 *
 * Nota strutturale: in HTML5, <DT> è un void-like element senza closing tag,
 * quindi la <DL> di una sottocartella può comparire come fratello del <DT>
 * oppure come figlio (dipende dal parser HTML). Gestiamo entrambi i casi.
 */

import * as cheerio from 'cheerio';
import type { CheerioAPI, Element } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { createHash } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Tipi pubblici
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedBookmark {
  url: string;
  urlHash: string;
  title: string;
  addedAt: Date | null;
  iconUrl: string | null;   // Solo URL http/https, le data URI vengono scartate
  folderPath: string[];     // Breadcrumb es. ["Dev", "TypeScript"]
}

export interface ParsedFolder {
  name: string;
  path: string[];           // Breadcrumb completo
  bookmarks: ParsedBookmark[];
  children: ParsedFolder[];
}

export interface ParseResult {
  bookmarks: ParsedBookmark[];  // Lista flat — conveniente per l'import massivo
  folders: ParsedFolder[];      // Albero gerarchico — usato per ricostruire la struttura
  stats: {
    totalBookmarks: number;
    totalFolders: number;
    duplicatesSkipped: number;
    malformedSkipped: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitizing — Prevenzione XSS
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_ALL: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

/** Rimuove qualsiasi tag HTML dal testo. */
function sanitizeText(input: string | undefined | null): string {
  if (!input) return '';
  return sanitizeHtml(input.trim(), STRIP_ALL);
}

/**
 * Valida e normalizza un URL.
 * - Blocca protocolli pericolosi: javascript:, data:, vbscript:, blob:
 * - Normalizza schema e hostname in lowercase
 * - Rimuove trailing slash sul root path
 * Ritorna null se l'URL è malformato o pericoloso.
 */
function sanitizeAndNormalizeUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Blocco protocolli pericolosi prima del parsing (difesa in profondità)
  if (/^(javascript|data|vbscript|blob):/i.test(trimmed)) return null;

  // Firefox usa "place:" per i bookmark interni
  if (/^place:/i.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    // Secondo check dopo il parsing per sicurezza
    if (!['http:', 'https:', 'ftp:'].includes(url.protocol)) return null;
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname === '/') url.pathname = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** SHA-256 hex dell'URL normalizzato. */
function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigazione albero cartelle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Naviga l'albero di ParsedFolder seguendo il breadcrumb `path`.
 * Ritorna il nodo foglia o null se il percorso non esiste.
 */
function findFolderByPath(roots: ParsedFolder[], path: string[]): ParsedFolder | null {
  if (path.length === 0) return null;
  let nodes = roots;
  let found: ParsedFolder | null = null;

  for (const segment of path) {
    const match = nodes.find((f) => f.name === segment);
    if (!match) return null;
    found = match;
    nodes = match.children;
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Walker ricorsivo
// ─────────────────────────────────────────────────────────────────────────────

interface WalkContext {
  $: CheerioAPI;
  seenHashes: Set<string>;
  allBookmarks: ParsedBookmark[];
  rootFolders: ParsedFolder[];
  stats: ParseResult['stats'];
}

/**
 * Processa un elemento <A> (bookmark).
 */
function processLink(
  $el: cheerio.Cheerio<Element>,
  currentPath: string[],
  ctx: WalkContext,
): void {
  ctx.stats.totalBookmarks++;

  const rawUrl = $el.attr('href');
  const rawTitle = $el.text();
  const rawAddDate = $el.attr('add_date');
  const rawIcon = $el.attr('icon');

  const url = sanitizeAndNormalizeUrl(rawUrl);
  if (!url) {
    ctx.stats.malformedSkipped++;
    return;
  }

  const urlHash = hashUrl(url);
  if (ctx.seenHashes.has(urlHash)) {
    ctx.stats.duplicatesSkipped++;
    return;
  }
  ctx.seenHashes.add(urlHash);

  // Timestamp: il formato Netscape usa secondi Unix
  let addedAt: Date | null = null;
  if (rawAddDate) {
    const ts = parseInt(rawAddDate, 10);
    if (!isNaN(ts) && ts > 0) addedAt = new Date(ts * 1_000);
  }

  // Favicon: accettiamo solo URL http/https, le data URI (spesso >10KB) vengono scartate
  let iconUrl: string | null = null;
  if (rawIcon && /^https?:\/\//i.test(rawIcon)) {
    iconUrl = sanitizeAndNormalizeUrl(rawIcon);
  }

  const bookmark: ParsedBookmark = {
    url,
    urlHash,
    title: sanitizeText(rawTitle) || new URL(url).hostname,
    addedAt,
    iconUrl,
    folderPath: [...currentPath],
  };

  ctx.allBookmarks.push(bookmark);

  // Aggiungi il bookmark anche nel nodo dell'albero
  const folder = findFolderByPath(ctx.rootFolders, currentPath);
  if (folder) folder.bookmarks.push(bookmark);
}

/**
 * Processa un <DL> ricorsivamente.
 *
 * Strategia per gestire entrambe le varianti del formato:
 *   - <DT> con <DL> figlio  (htmlparser2 li nidifica a volte)
 *   - <DT><H3> seguito da <DL> come fratello (il più comune)
 */
function walkDL(dlEl: Element, currentPath: string[], ctx: WalkContext): void {
  const { $ } = ctx;
  const children = $(dlEl).children().toArray();

  for (let i = 0; i < children.length; i++) {
    const child = children[i] as Element;
    const tag = child.tagName?.toLowerCase();

    if (tag !== 'dt') continue;

    const $dt = $(child);
    const link = $dt.find('> a').first();
    const h3 = $dt.find('> h3').first();

    if (link.length > 0) {
      // ── Bookmark ──────────────────────────────────────────────────────────
      processLink(link, currentPath, ctx);
    } else if (h3.length > 0) {
      // ── Cartella ──────────────────────────────────────────────────────────
      const folderName = sanitizeText(h3.text());
      if (!folderName) continue;

      ctx.stats.totalFolders++;
      const newPath = [...currentPath, folderName];

      const folder: ParsedFolder = {
        name: folderName,
        path: newPath,
        bookmarks: [],
        children: [],
      };

      // Aggiungi cartella all'albero
      if (currentPath.length === 0) {
        ctx.rootFolders.push(folder);
      } else {
        const parent = findFolderByPath(ctx.rootFolders, currentPath);
        if (parent) parent.children.push(folder);
        else ctx.rootFolders.push(folder); // fallback: cartella orfana → root
      }

      // Cerca la <DL> figlia: prima come child del DT, poi come fratello
      const subDLChild = $dt.find('> dl').first();

      if (subDLChild.length > 0) {
        // Caso: <DL> è dentro il <DT>
        walkDL(subDLChild.get(0) as Element, newPath, ctx);
      } else {
        // Caso (più comune): <DL> è il prossimo fratello del <DT>
        const nextSibling = children[i + 1] as Element | undefined;
        if (nextSibling && nextSibling.tagName?.toLowerCase() === 'dl') {
          walkDL(nextSibling, newPath, ctx);
          i++; // Salta la DL che abbiamo già processato
        }
      }
    }
    // <HR> e altri elementi: ignorati silenziosamente
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point pubblico
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parsa un file HTML nel formato Netscape Bookmark File-1.
 *
 * @param html - Contenuto grezzo del file .html esportato dal browser
 * @returns ParseResult con lista flat dei bookmark, albero cartelle e statistiche
 *
 * @example
 * const html = fs.readFileSync('bookmarks.html', 'utf-8');
 * const { bookmarks, folders, stats } = parseBookmarksHtml(html);
 * console.log(`Importati ${stats.totalBookmarks} bookmark`);
 */
export function parseBookmarksHtml(html: string): ParseResult {
  const ctx: WalkContext = {
    $: cheerio.load(html, { xmlMode: false, decodeEntities: true }),
    seenHashes: new Set(),
    allBookmarks: [],
    rootFolders: [],
    stats: {
      totalBookmarks: 0,
      totalFolders: 0,
      duplicatesSkipped: 0,
      malformedSkipped: 0,
    },
  };

  // Troviamo il <DL> radice (il primo nel documento)
  const rootDL = ctx.$('dl').first();
  if (rootDL.length === 0) {
    console.warn('[parser] Nessun <DL> trovato nel documento — file valido?');
    return {
      bookmarks: [],
      folders: [],
      stats: ctx.stats,
    };
  }

  walkDL(rootDL.get(0) as Element, [], ctx);

  // Aggiorna il contatore finale (esclude i malformati già contati)
  ctx.stats.totalBookmarks = ctx.allBookmarks.length;

  return {
    bookmarks: ctx.allBookmarks,
    folders: ctx.rootFolders,
    stats: ctx.stats,
  };
}
