import { describe, expect, it } from 'vitest';
import { declaredFeeds, feedCandidates, looksLikeFeed, parseFeed } from './feed';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
  <title>Blog &amp; Notizie</title>
  <item>
    <title>Primo articolo &lt;b&gt;importante&lt;/b&gt;</title>
    <link>https://blog.example/primo</link>
    <guid isPermaLink="false">post-1</guid>
    <pubDate>Mon, 12 Oct 2026 08:00:00 GMT</pubDate>
    <category>Docker</category><category>Linux</category>
  </item>
  <item>
    <title><![CDATA[Secondo: CDATA & co]]></title>
    <link>/secondo</link>
    <dc:date>2026-10-11T10:00:00Z</dc:date>
  </item>
  <item><title>Senza link</title></item>
  <item><title>Duplicato</title><link>https://blog.example/primo</link><guid>post-1</guid></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Forum · Ultimi thread</title>
  <entry>
    <title type="html">Cluster &amp;amp; Ceph</title>
    <link rel="replies" href="https://forum.example/t/1/replies"/>
    <link rel="alternate" href="https://forum.example/t/1"/>
    <id>tag:forum.example,2026:thread-1</id>
    <updated>2026-10-12T07:30:00Z</updated>
    <category term="proxmox"/>
  </entry>
  <entry>
    <title>Solo link senza rel</title>
    <link href="/t/2"/>
    <published>2026-10-10T07:30:00Z</published>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
  <channel><title>Vecchio RSS 1.0</title></channel>
  <item><title>Elemento RDF</title><link>https://rdf.example/a</link></item>
</rdf:RDF>`;

describe('looksLikeFeed', () => {
  it('riconosce RSS, Atom e RDF ma non le pagine HTML', () => {
    expect(looksLikeFeed(RSS)).toBe(true);
    expect(looksLikeFeed(ATOM)).toBe(true);
    expect(looksLikeFeed(RDF)).toBe(true);
    expect(looksLikeFeed('<!doctype html><html><body>feed</body></html>')).toBe(false);
  });
});

describe('parseFeed', () => {
  it('RSS 2.0: titoli decodificati, link relativi, guid, date, categorie, niente duplicati', () => {
    const feed = parseFeed(RSS, 'https://blog.example/feed')!;
    expect(feed.title).toBe('Blog & Notizie');
    expect(feed.items).toEqual([
      {
        title: 'Primo articolo importante', url: 'https://blog.example/primo', key: 'post-1',
        publishedAt: '2026-10-12T08:00:00.000Z', tags: ['Docker', 'Linux'],
      },
      {
        title: 'Secondo: CDATA & co', url: 'https://blog.example/secondo', key: 'https://blog.example/secondo',
        publishedAt: '2026-10-11T10:00:00.000Z', tags: [],
      },
    ]);
  });

  it('Atom: link alternate, id come chiave, updated, category term', () => {
    const feed = parseFeed(ATOM, 'https://forum.example/forums/-/index.rss')!;
    expect(feed.title).toBe('Forum · Ultimi thread');
    expect(feed.items[0]).toEqual({
      title: 'Cluster & Ceph', url: 'https://forum.example/t/1', key: 'tag:forum.example,2026:thread-1',
      publishedAt: '2026-10-12T07:30:00.000Z', tags: ['proxmox'],
    });
    expect(feed.items[1]).toMatchObject({ url: 'https://forum.example/t/2', publishedAt: '2026-10-10T07:30:00.000Z' });
  });

  it('RSS 1.0 (RDF)', () => {
    expect(parseFeed(RDF, 'https://rdf.example/')!.items).toEqual([
      { title: 'Elemento RDF', url: 'https://rdf.example/a', key: 'https://rdf.example/a', tags: [] },
    ]);
  });

  it('contenuto non feed → null', () => {
    expect(parseFeed('<html><body>no</body></html>', 'https://x.example/')).toBeNull();
  });
});

describe('scoperta feed', () => {
  const PAGE = `<html><head>
    <link rel="alternate" type="application/rss+xml" title="Articoli" href="/feed/">
    <link rel="alternate" type="application/atom+xml" href="https://site.example/atom.xml">
    <link rel="alternate" type="application/feed+json" href="/feed.json">
    <link rel="alternate" hreflang="en" href="/en/">
  </head><body></body></html>`;

  it('legge solo i feed RSS/Atom dichiarati, con URL assoluti', () => {
    expect(declaredFeeds(PAGE, 'https://site.example/blog/')).toEqual([
      { url: 'https://site.example/feed/', title: 'Articoli' },
      { url: 'https://site.example/atom.xml', title: '' },
    ]);
  });

  it('candidati: prima i dichiarati, poi i percorsi comuni, senza duplicati', () => {
    expect(feedCandidates(PAGE, 'https://site.example/blog/', 5)).toEqual([
      'https://site.example/feed/',
      'https://site.example/atom.xml',
      'https://site.example/feed',
      'https://site.example/rss',
      'https://site.example/feed.xml',
    ]);
  });
});
