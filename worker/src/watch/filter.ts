/**
 * Filtro tag per le fonti monitorate.
 *
 * Sintassi di un termine:
 *   docker          → parola nel titolo
 *   "zfs pool"      → frase esatta nel titolo
 *   #proxmox        → tag nativo dell'elemento (es. tag XenForo/Discourse)
 *   -request        → esclude gli elementi che contengono la parola
 *   -"for sale"     → esclude gli elementi che contengono la frase
 *
 * Il confronto ignora maiuscole e accenti. Le parole sono confrontate a
 * confine di parola: "art" non corrisponde a "article".
 */

export type TermKind = 'word' | 'phrase' | 'tag';

export interface FilterTerm {
  kind: TermKind;
  value: string;      // normalizzato
  exclude: boolean;
  raw: string;        // come scritto dall'utente, per mostrarlo in UI
}

export interface FilterTarget {
  title: string;
  tags?: string[];
}

export interface FilterResult {
  matched: boolean;
  /** Termini inclusivi che hanno fatto scattare la corrispondenza (raw). */
  matchedTerms: string[];
}

/** Minuscolo, senza accenti, spazi compattati. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Converte una stringa di filtro (termini separati da spazi o virgole) in termini. */
export function parseFilter(input: string): FilterTerm[] {
  const terms: FilterTerm[] = [];
  // -?  #?  ( "frase" | parola )
  const re = /(-)?(#)?(?:"([^"]+)"|([^\s,"]+))/g;
  for (const m of input.matchAll(re)) {
    const [raw, minus, hash, phrase, word] = m;
    const text = normalize(phrase ?? word ?? '');
    if (!text) continue;
    const kind: TermKind = hash ? 'tag' : phrase ? 'phrase' : 'word';
    terms.push({ kind, value: text, exclude: !!minus, raw });
  }
  return terms;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWords(haystack: string, needle: string): boolean {
  // Confine di parola Unicode-safe: inizio/fine stringa o carattere non alfanumerico
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}($|[^\\p{L}\\p{N}])`, 'u');
  return re.test(haystack);
}

function termMatches(term: FilterTerm, title: string, tags: string[]): boolean {
  if (term.kind === 'tag') return tags.includes(term.value);
  return containsWords(title, term.value);
}

/**
 * Applica i termini a un elemento.
 * - Nessun termine inclusivo → passa tutto (salvo esclusioni).
 * - Basta un termine inclusivo (OR) per passare.
 * - Un qualsiasi termine di esclusione scarta l'elemento.
 */
export function applyFilter(terms: FilterTerm[], target: FilterTarget): FilterResult {
  const title = normalize(target.title);
  const tags = (target.tags ?? []).map(normalize);

  for (const t of terms) {
    if (t.exclude && termMatches(t, title, tags)) return { matched: false, matchedTerms: [] };
  }

  const includes = terms.filter((t) => !t.exclude);
  if (includes.length === 0) return { matched: true, matchedTerms: [] };

  const matchedTerms = includes.filter((t) => termMatches(t, title, tags)).map((t) => t.raw);
  return { matched: matchedTerms.length > 0, matchedTerms };
}
