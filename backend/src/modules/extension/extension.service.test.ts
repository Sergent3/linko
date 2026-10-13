import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/prisma', () => ({ prisma: {} }));
vi.mock('../../lib/queue', () => ({ watchQueue: {} }));

import { targetUrl } from './extension.service';

describe('targetUrl', () => {
  it('apre il feed, l\'ultima pagina del thread o la pagina dell\'area', () => {
    expect(targetUrl({ mode: 'FEED', url: 'https://a.it/', feedUrl: 'https://a.it/rss' })).toBe('https://a.it/rss');
    expect(targetUrl({ mode: 'THREAD', url: 'https://f.it/threads/titolo.123/page-4', feedUrl: null })).toBe('https://f.it/threads/titolo.123/latest');
    expect(targetUrl({ mode: 'AREA', url: 'https://x1337x.ws/sort-search/ita/time/desc/1/', feedUrl: null }))
      .toBe('https://x1337x.ws/sort-search/ita/time/desc/1/');
  });
});
