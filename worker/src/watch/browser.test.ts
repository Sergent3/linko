import { describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({ config: { SCRAPING_TIMEOUT_MS: 1000, WATCH_BLOCKED_IPS: [] } }));

import { isChallenge } from './browser';

describe('isChallenge', () => {
  it('riconosce la verifica di Cloudflare', () => {
    expect(isChallenge(403, { server: 'cloudflare', 'cf-mitigated': 'challenge' }, '')).toBe(true);
    expect(isChallenge(403, { server: 'cloudflare' }, '<html><head><title>Just a moment...</title>')).toBe(true);
    expect(isChallenge(503, {}, '<script src="/cdn-cgi/challenge-platform/h/g/orchestrate/jsch/v1">')).toBe(true);
  });

  it('riconosce DDoS-Guard', () => {
    expect(isChallenge(403, { server: 'ddos-guard' }, '<html>403 Forbidden</html>')).toBe(true);
  });

  it('un 403/404 normale non è una verifica', () => {
    expect(isChallenge(403, { server: 'nginx' }, '<h1>Forbidden</h1>')).toBe(false);
    expect(isChallenge(404, { 'cf-mitigated': 'challenge' }, '')).toBe(false);
    expect(isChallenge(200, { server: 'cloudflare' }, '<title>Just a moment</title>')).toBe(false);
  });
});
