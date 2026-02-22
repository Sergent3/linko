/**
 * Hybrid Tag Engine
 *
 * Fase 1 — Regex su dominio (gratuita, istantanea):
 *   Copre la maggior parte dei siti comuni con tag predefiniti.
 *
 * Fase 2 — AI tagging (placeholder, futura):
 *   Verrà chiamata solo per bookmark non coperti dalla Fase 1,
 *   minimizzando i costi API.
 */

interface DomainRule {
  pattern: RegExp;
  tags: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Regole Fase 1
// ─────────────────────────────────────────────────────────────────────────────
const DOMAIN_RULES: DomainRule[] = [
  // Dev & Code
  { pattern: /github\.com|gitlab\.com|bitbucket\.org/, tags: ['dev', 'code', 'git'] },
  { pattern: /stackoverflow\.com|stackexchange\.com/, tags: ['dev', 'q&a'] },
  { pattern: /npmjs\.com/, tags: ['dev', 'package', 'npm'] },
  { pattern: /developer\.mozilla\.org|mdn\.dev/, tags: ['dev', 'docs', 'web'] },
  { pattern: /codepen\.io|codesandbox\.io|jsfiddle\.net/, tags: ['dev', 'playground'] },
  { pattern: /arxiv\.org|semanticscholar\.org/, tags: ['research', 'academic', 'paper'] },
  { pattern: /scholar\.google\.com/, tags: ['research', 'academic'] },
  // Docs generici (sottodominio docs. o path /docs/)
  { pattern: /docs\.|\/docs\/|documentation\.|\/documentation\//, tags: ['docs', 'reference'] },
  // Media
  { pattern: /youtube\.com|youtu\.be|vimeo\.com/, tags: ['video', 'media'] },
  { pattern: /spotify\.com|soundcloud\.com|bandcamp\.com/, tags: ['audio', 'music', 'media'] },
  { pattern: /twitch\.tv/, tags: ['video', 'stream', 'gaming'] },
  // Social
  { pattern: /twitter\.com|x\.com/, tags: ['social', 'microblog'] },
  { pattern: /linkedin\.com/, tags: ['social', 'professional'] },
  { pattern: /reddit\.com/, tags: ['social', 'forum', 'community'] },
  { pattern: /instagram\.com/, tags: ['social', 'photo'] },
  // Contenuto
  { pattern: /medium\.com|dev\.to|hashnode\.dev|substack\.com/, tags: ['article', 'blog'] },
  { pattern: /news\.ycombinator\.com|hn\.algolia\.com/, tags: ['news', 'tech', 'community'] },
  { pattern: /bbc\.com|cnn\.com|reuters\.com|theguardian\.com|nytimes\.com/, tags: ['news'] },
  // Produttività & Design
  { pattern: /figma\.com|sketch\.com|adobe\.com/, tags: ['design', 'tool'] },
  { pattern: /notion\.so|obsidian\.md|roamresearch\.com/, tags: ['productivity', 'notes'] },
  // Shopping
  { pattern: /amazon\.|ebay\.com|etsy\.com/, tags: ['shopping', 'ecommerce'] },
];

/**
 * Fase 1: tagging gratuito basato su pattern regex sul dominio.
 */
export function getTagsByDomain(url: string): string[] {
  const tags = new Set<string>();
  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(url)) {
      rule.tags.forEach((t) => tags.add(t));
    }
  }
  return Array.from(tags);
}

/**
 * Fase 2: AI tagging — placeholder.
 *
 * Quando implementato, questa funzione chiamerà il Claude API
 * per categorizzare bookmark non coperti dalla Fase 1.
 * La logica di chiamata è separata qui per rendere la sostituzione banale.
 */
export async function getTagsByAI(
  _url: string,
  _title: string,
  _description: string,
): Promise<string[]> {
  // TODO: Integrare Claude API
  // Esempio:
  //   const msg = await anthropic.messages.create({ model: 'claude-opus-4-6', ... });
  //   return extractTagsFromResponse(msg.content);
  return [];
}

/** Unisce array di tag eliminando duplicati. */
export function mergeTags(...tagArrays: string[][]): string[] {
  return [...new Set(tagArrays.flat())];
}
