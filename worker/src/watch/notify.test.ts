import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  settings: null as Record<string, unknown> | null,
  items: [] as unknown[],
  updates: [] as unknown[],
}));
const sent = vi.hoisted(() => [] as { chatId: string; html: string }[]);

vi.mock('../config', () => ({ config: { WATCH_SECRET_KEY: 'x'.repeat(44), LINKO_PUBLIC_URL: 'http://linko.test' } }));
vi.mock('../lib/secret-box', () => ({ loadKey: () => Buffer.alloc(32), decrypt: (s: string) => `tok:${s}` }));
vi.mock('../lib/prisma', () => ({
  prisma: {
    notificationSettings: {
      findUnique: async () => db.settings,
      findMany: async () => (db.settings ? [db.settings] : []),
      update: async (a: unknown) => { db.updates.push(a); return {}; },
    },
    watchItem: { findMany: async () => db.items },
  },
}));
vi.mock('./telegram', async (orig) => ({
  ...(await orig<typeof import('./telegram')>()),
  sendMessage: async (_t: string, chatId: string, html: string) => { sent.push({ chatId, html }); },
}));

import { notifyNew, runDigests } from './notify';

const linked = { id: 's1', userId: 'u1', telegramTokenEnc: 'enc', telegramChatId: '42', keywords: '', digestHour: 8, lastDigestAt: null, nextDigestAt: null };
const src = (delivery: 'NORMAL' | 'INSTANT' | 'DIGEST') => ({ id: 'src1', userId: 'u1', name: 'Forum', delivery });
const items = [{ title: 'Nuovo pool ZFS', url: 'https://f/1' }, { title: 'Altro', url: 'https://f/2' }];

beforeEach(() => { db.settings = { ...linked }; db.items = []; db.updates = []; sent.length = 0; });

describe('notifyNew', () => {
  it('fonte INSTANT: manda tutte le novità con il link a Linko', async () => {
    await notifyNew(src('INSTANT'), items);
    expect(sent).toHaveLength(1);
    expect(sent[0].chatId).toBe('42');
    expect(sent[0].html).toContain('2 novità');
    expect(sent[0].html).toContain('http://linko.test/updates?source=src1');
  });
  it('fonte NORMAL: solo gli elementi con una parola chiave', async () => {
    await notifyNew(src('NORMAL'), items);
    expect(sent).toHaveLength(0);
    db.settings = { ...linked, keywords: 'zfs -vendo' };
    await notifyNew(src('NORMAL'), items);
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain('Nuovo pool ZFS');
    expect(sent[0].html).toContain('🔑 <i>zfs</i>');
    expect(sent[0].html).not.toContain('Altro');
  });
  it('fonte DIGEST: niente subito, salvo parole chiave', async () => {
    await notifyNew(src('DIGEST'), items);
    expect(sent).toHaveLength(0);
    db.settings = { ...linked, keywords: '"pool zfs"' };
    await notifyNew(src('DIGEST'), items);
    expect(sent).toHaveLength(1);
  });
  it('senza Telegram collegato non fa nulla', async () => {
    db.settings = { ...linked, telegramChatId: null };
    await notifyNew(src('INSTANT'), items);
    expect(sent).toHaveLength(0);
  });
});

describe('runDigests', () => {
  it('al primo giro fissa solo il prossimo orario', async () => {
    await runDigests(new Date('2026-10-12T05:00:00Z'));
    expect(sent).toHaveLength(0);
    expect(db.updates[0]).toMatchObject({ data: { nextDigestAt: new Date('2026-10-12T06:00:00Z') } });
  });
  it('all\'orario manda un solo messaggio raggruppato per fonte e fissa il giorno dopo', async () => {
    db.settings = { ...linked, nextDigestAt: new Date('2026-10-12T06:00:00Z') };
    db.items = [
      { title: 'A', url: 'https://a/1', source: { id: 'x', name: 'arXiv' } },
      { title: 'B', url: 'https://a/2', source: { id: 'x', name: 'arXiv' } },
      { title: 'C', url: 'https://b/1', source: { id: 'y', name: 'OpenAI' } },
    ];
    await runDigests(new Date('2026-10-12T06:00:30Z'));
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain('Riepilogo di oggi</b> · 3 novità');
    expect(sent[0].html.indexOf('arXiv')).toBeLessThan(sent[0].html.indexOf('OpenAI'));
    expect(db.updates[0]).toMatchObject({ data: { nextDigestAt: new Date('2026-10-13T06:00:00Z') } });
  });
  it('nessuna novità: nessun messaggio, ma l\'orario avanza', async () => {
    db.settings = { ...linked, nextDigestAt: new Date('2026-10-12T06:00:00Z') };
    await runDigests(new Date('2026-10-12T06:01:00Z'));
    expect(sent).toHaveLength(0);
    expect(db.updates).toHaveLength(1);
  });
});
