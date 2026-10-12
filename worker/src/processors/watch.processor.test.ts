import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ prisma: {} }));
vi.mock('../config', () => ({ config: { SCRAPING_TIMEOUT_MS: 1000, WATCH_BLOCKED_IPS: [] } }));

import { nextInterval } from './watch.processor';

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
