/**
 * Pulizia del contenuto di un articolo o di un post prima di mostrarlo in Linko.
 * Restano solo testo, link, immagini e video; niente script, stili, iframe,
 * moduli o attributi di evento. I link si aprono in una nuova scheda.
 */
import sanitizeHtml from 'sanitize-html';

const MAX_HTML = 300_000;

export function sanitizeContent(html: string, baseUrl: string): string {
  const abs = (u: string | undefined): string | undefined => {
    if (!u) return undefined;
    try {
      const url = new URL(u, baseUrl);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
    } catch {
      return undefined;
    }
  };

  return sanitizeHtml(html.slice(0, MAX_HTML), {
    allowedTags: [
      'p', 'br', 'hr', 'div', 'span', 'a', 'img', 'figure', 'figcaption', 'picture',
      'blockquote', 'q', 'cite', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'small', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
      'video', 'source', 'details', 'summary',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'referrerpolicy'],
      video: ['src', 'poster', 'controls', 'preload', 'width', 'height'],
      source: ['src', 'type'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      blockquote: ['data-author'],
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesAppliedToAttributes: ['href', 'src', 'poster'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tag, attribs) => {
        const href = abs(attribs.href);
        return {
          tagName: 'a',
          attribs: href ? { href, ...(attribs.title && { title: attribs.title }), target: '_blank', rel: 'noopener noreferrer nofollow' } : {},
        };
      },
      img: (tag, attribs) => ({
        tagName: 'img',
        attribs: {
          ...(abs(attribs.src) && { src: abs(attribs.src)! }),
          alt: attribs.alt ?? '',
          ...(attribs.width && { width: attribs.width }),
          ...(attribs.height && { height: attribs.height }),
          loading: 'lazy',
          // Molti siti bloccano le immagini richieste da altri domini se ricevono il referrer
          referrerpolicy: 'no-referrer',
        },
      }),
      video: (tag, attribs) => ({
        tagName: 'video',
        attribs: {
          ...(abs(attribs.src) && { src: abs(attribs.src)! }),
          ...(abs(attribs.poster) && { poster: abs(attribs.poster)! }),
          controls: '',
          preload: 'metadata',
        },
      }),
      source: (tag, attribs) => ({ tagName: 'source', attribs: { ...(abs(attribs.src) && { src: abs(attribs.src)! }), ...(attribs.type && { type: attribs.type }) } }),
    },
    // Immagini senza indirizzo valido: inutili
    exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
  });
}
