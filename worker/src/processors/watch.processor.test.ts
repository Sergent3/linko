import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ prisma: {} }));
vi.mock('../config', () => ({ config: { SCRAPING_TIMEOUT_MS: 1000, WATCH_BLOCKED_IPS: [] } }));

import { nextInterval, providedPage, swapHost, swapInText } from './watch.processor';

describe('nextInterval', () => {
  it('primo controllo o nessun elemento: invariato', () => {
    expect(nextInterval(360, 360, 20, 20, true)).toBe(360);
    expect(nextInterval(360, 90, 0, 0, false)).toBe(90);
  });

  it('tutti gli elementi nuovi: dimezza, non sotto 10 minuti', () => {
    expect(nextInterval(360, 360, 20, 20, false)).toBe(180);
    expect(nextInterval(360, 15, 20, 20, false)).toBe(10);
    expect(nextInterval(30, 30, 20, 20, false)).toBe(15);
  });

  it('niente di nuovo: torna verso la base senza superarla', () => {
    expect(nextInterval(360, 60, 20, 0, false)).toBe(90);
    expect(nextInterval(360, 300, 20, 0, false)).toBe(360);
  });

  it('alcuni nuovi: accorcia di un quarto, non sotto 10 minuti', () => {
    expect(nextInterval(360, 120, 20, 3, false)).toBe(90);
    expect(nextInterval(60, 12, 20, 3, false)).toBe(10);
  });
});

describe('providedPage', () => {
  const page = { url: 'https://esempio.it/', status: 200, html: '<ul></ul>' };

  it('restituisce la pagina dell\'estensione una sola volta', async () => {
    const fetch = providedPage(page);
    await expect(fetch('https://esempio.it/')).resolves.toBe(page);
    await expect(fetch('https://esempio.it/feed')).rejects.toThrow(/estensione/);
  });
});

describe('trasloco di dominio', () => {
  it('swapHost cambia solo il dominio vecchio, con o senza www', () => {
    expect(swapHost('https://www.eurekaddl.living/movies/feed/', 'eurekaddl.living', 'eurekaddl.beer')).toBe('https://eurekaddl.beer/movies/feed/');
    expect(swapHost('https://altro.com/x', 'eurekaddl.living', 'eurekaddl.beer')).toBe('https://altro.com/x');
  });
  it('swapInText sostituisce il dominio nei guid e nei nomi, avanti e indietro', () => {
    const guid = 'https://eurekaddl.beer/?p=3690164';
    expect(swapInText(guid, 'eurekaddl.beer', 'eurekaddl.living')).toBe('https://eurekaddl.living/?p=3690164');
    expect(swapInText('eurekaddl.living · Movies', 'eurekaddl.living', 'eurekaddl.beer')).toBe('eurekaddl.beer · Movies');
  });
});
