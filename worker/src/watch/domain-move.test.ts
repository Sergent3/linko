import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ prisma: {} }));
vi.mock('./push', () => ({ sendPush: vi.fn() }));

import { isDomainMove, searchMovedDomain, shouldSearch, splitHost, titleMatches } from './domain-move';
import type { FetchedPage } from './http';

describe('splitHost', () => {
  it('separa sottodominio, nome ed estensione', () => {
    expect(splitHost('www.eurekaddl.living')).toEqual({ sub: '', label: 'eurekaddl', suffix: 'living' });
    expect(splitHost('forums.example.co.uk')).toEqual({ sub: 'forums.', label: 'example', suffix: 'co.uk' });
    expect(splitHost('localhost')).toBeNull();
  });
});

describe('isDomainMove', () => {
  it('stesso nome, altra estensione: trasloco', () => {
    expect(isDomainMove('https://eurekaddl.living/feed/', 'https://eurekaddl.beer/feed/')).toBe(true);
  });
  it('stesso percorso su un dominio diverso: trasloco', () => {
    expect(isDomainMove('https://old-name.com/movies/', 'https://newname.net/movies/')).toBe(true);
  });
  it('www, sottodomini e home verso altri siti non sono traslochi', () => {
    expect(isDomainMove('https://example.com/', 'https://www.example.com/')).toBe(false);
    expect(isDomainMove('https://example.com/x', 'https://m.example.com/x')).toBe(false);
    expect(isDomainMove('https://example.com/', 'https://accounts.google.com/')).toBe(false);
    expect(isDomainMove('https://example.com/a', 'https://login.other.com/b')).toBe(false);
  });
});

describe('titleMatches', () => {
  it('cerca il nome del sito nel titolo ignorando spazi e trattini', () => {
    expect(titleMatches('<title>EurekaDDL - Download</title>', 'eurekaddl')).toBe(true);
    expect(titleMatches('<title>Eureka DDL</title>', 'eurekaddl')).toBe(true);
    expect(titleMatches('<title>Domain for sale</title>', 'eurekaddl')).toBe(false);
  });
});

describe('searchMovedDomain', () => {
  const page = (url: string, title: string, status = 200): FetchedPage => ({ url, status, html: `<title>${title}</title>` });

  it('trova lo stesso nome su un\'altra estensione con il nome nel titolo', async () => {
    const resolve = vi.fn(async (h: string) => (['eurekaddl.beer', 'eurekaddl.com'].includes(h) ? ['1.2.3.4'] : []));
    const fetch = vi.fn(async (u: string) => (u.includes('.com')
      ? page(u, 'This domain is for sale')
      : page(u, 'EurekaDDL | Download')));
    const found = await searchMovedDomain('eurekaddl.living', undefined, { resolve, fetch });
    expect(found?.newHost).toBe('eurekaddl.beer');
    expect(resolve).not.toHaveBeenCalledWith('eurekaddl.living');
  });

  it('nessun candidato valido: null', async () => {
    const found = await searchMovedDomain('sparito.xyz', undefined, {
      resolve: async () => ['1.2.3.4'],
      fetch: async (u) => page(u, 'Parked domain', 200),
    });
    expect(found).toBeNull();
  });

  it('per una fonte a feed serve un feed vero: il clone con lo stesso titolo è scartato', async () => {
    const resolve = async (h: string) => (['eurekaddl.org', 'eurekaddl.beer'].includes(h) ? ['1.2.3.4'] : []);
    const fetch = async (u: string): Promise<FetchedPage> => (u.includes('.beer')
      ? { url: u, status: 200, html: '<?xml version="1.0"?><rss version="2.0"><channel><title>EurekaDDL</title></channel></rss>' }
      : page(u, 'EurekaDDL – Da noi trovi tutto!'));
    const found = await searchMovedDomain('eurekaddl.living', { path: '/movies/feed/', feed: true }, { resolve, fetch });
    expect(found?.newHost).toBe('eurekaddl.beer');
    expect(found?.evidence).toContain('/movies/feed/');
  });

  it('una sola ricerca al giorno per dominio', () => {
    expect(shouldSearch('a.example', 0)).toBe(true);
    expect(shouldSearch('a.example', 3600_000)).toBe(false);
    expect(shouldSearch('a.example', 25 * 3600_000)).toBe(true);
  });
});
