import { describe, expect, it } from 'vitest';
import { latestUrl, parseThread, threadBase } from './thread';

const post = (id: number, author: string, body: string, time = '2026-10-12T10:00:00+0200') => `
  <article class="message message--post js-post" data-author="${author}" data-content="post-${id}" id="js-post-${id}">
    <div class="message-attribution"><time class="u-dt" datetime="${time}">oggi</time></div>
    <div class="message-body"><div class="bbWrapper">${body}</div></div>
  </article>`;

const PAGE = `<html><head><title>Italian Babes Megathread | Page 12 | Forum</title></head><body>
  <h1 class="p-title-value">Italian Babes Megathread</h1>
  ${post(101, 'mario', 'Ciao a tutti, <blockquote>citazione da ignorare</blockquote> ecco le nuove foto')}
  ${post(102, 'luigi', '<img src="a.jpg"><img src="b.jpg">')}
</body></html>`;

describe('threadBase', () => {
  it('riconosce i thread XenForo con e senza slug, pagina o ancora', () => {
    expect(threadBase('https://simpcity.cr/threads/italian-babes-megathread.133162')).toBe('https://simpcity.cr/threads/italian-babes-megathread.133162');
    expect(threadBase('https://simpcity.cr/threads/italian-babes-megathread.133162/page-12#post-9')).toBe('https://simpcity.cr/threads/italian-babes-megathread.133162');
    expect(threadBase('https://forum.example.org/community/threads/133162/')).toBe('https://forum.example.org/community/threads/133162');
  });
  it('non confonde altre pagine', () => {
    expect(threadBase('https://simpcity.cr/')).toBeNull();
    expect(threadBase('https://simpcity.cr/forums/italian.12/')).toBeNull();
    expect(threadBase('https://example.org/threads-guide')).toBeNull();
  });
  it('latestUrl punta all\'ultima pagina', () => {
    expect(latestUrl('https://simpcity.cr/threads/x.1')).toBe('https://simpcity.cr/threads/x.1/latest');
  });
});

describe('parseThread', () => {
  it('estrae i post con permalink stabile, autore, testo e data', () => {
    const t = parseThread(PAGE, 'https://simpcity.cr/threads/italian-babes-megathread.133162/page-12')!;
    expect(t.title).toBe('Italian Babes Megathread');
    expect(t.posts).toHaveLength(2);
    expect(t.posts[0]).toEqual({
      url: 'https://simpcity.cr/threads/italian-babes-megathread.133162/post-101',
      title: 'mario: Ciao a tutti, ecco le nuove foto',
      publishedAt: '2026-10-12T08:00:00.000Z',
    });
  });
  it('per i post con sole immagini descrive i contenuti', () => {
    const t = parseThread(PAGE, 'https://simpcity.cr/threads/x.1/')!;
    expect(t.posts[1].title).toBe('luigi: 2 contenuti multimediali o link');
  });
  it('null se la pagina non ha post (es. login richiesto) o non è un thread', () => {
    expect(parseThread('<html><body>Devi accedere</body></html>', 'https://simpcity.cr/threads/x.1/')).toBeNull();
    expect(parseThread(PAGE, 'https://simpcity.cr/')).toBeNull();
  });
});
