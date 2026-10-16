import { describe, expect, it } from 'vitest';
import { parseBookmarksHtml } from './parser';

const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Caff&egrave; &amp; t&egrave;</H3>
  <DL><p>
    <DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="1700000000">Tom &amp; Jerry &quot;HD&quot; &lt;3</A>
    <DT><A HREF="https://example.com/x">&lt;script&gt;alert(1)&lt;/script&gt;Titolo</A>
    <DT><A HREF="javascript:alert(1)">Cattivo</A>
  </DL><p>
</DL>`;

describe('parseBookmarksHtml', () => {
  const r = parseBookmarksHtml(html);

  it('decodifica le entità in titoli e cartelle', () => {
    expect(r.bookmarks[0].title).toBe('Tom & Jerry "HD" <3');
    expect(r.bookmarks[0].url).toBe('https://example.com/?a=1&b=2');
    expect(r.folders[0].name).toBe('Caffè & tè');
  });

  it('toglie i tag dai titoli e scarta gli URL non http', () => {
    expect(r.bookmarks[1].title).not.toContain('<script');
    expect(r.bookmarks.map((b) => b.url)).not.toContain('javascript:alert(1)');
    expect(r.stats.totalBookmarks).toBe(2);
  });
});
