import { describe, expect, it, vi } from 'vitest';
import { assertPublicUrl, isPrivateAddress, BlockedUrlError } from './http';

vi.mock('../config', () => ({ config: { SCRAPING_TIMEOUT_MS: 1000, WATCH_BLOCKED_IPS: ['51.38.82.241'] } }));
vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(async (host: string) => {
      const table: Record<string, string[]> = {
        'pubblico.example': ['93.184.216.34'],
        'interno.example': ['172.20.0.5'],
        'misto.example': ['93.184.216.34', '10.0.0.1'],
        'vps.example': ['51.38.82.241'],
      };
      return (table[host] ?? []).map((address) => ({ address, family: 4 }));
    }),
  },
}));

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.20.0.5', '192.168.1.29',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fd00::1', 'fe80::1',
  ])('blocca %s', (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(['93.184.216.34', '51.38.82.240', '172.32.0.1', '2606:4700::1111'])('consente %s', (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe('assertPublicUrl', () => {
  it('consente host pubblici', async () => {
    await expect(assertPublicUrl('https://pubblico.example/x')).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ['host che risolve su rete Docker', 'http://interno.example/'],
    ['host con anche un IP privato', 'http://misto.example/'],
    ['IP letterale privato', 'http://127.0.0.1:6379/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['IP pubblico del VPS (lista extra)', 'http://vps.example:3001/'],
    ['IP del VPS letterale', 'http://51.38.82.241:8090/'],
    ['schema non http', 'file:///etc/passwd'],
    ['.onion', 'http://abc.onion/'],
    ['host inesistente', 'http://nessuno.example/'],
  ])('blocca %s', async (_desc, url) => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(BlockedUrlError);
  });
});
