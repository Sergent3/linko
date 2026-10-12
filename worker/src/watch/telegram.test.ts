import { describe, expect, it } from 'vitest';
import { escapeHtml, formatDigest, formatInstant, isTelegramToken, nextDigestTime } from './telegram';

describe('telegram', () => {
  it('riconosce il formato del token', () => {
    expect(isTelegramToken('123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw')).toBe(true);
    expect(isTelegramToken('ciao')).toBe(false);
  });

  it('formatta le novità con link e parole chiave, senza HTML iniettato', () => {
    const msg = formatInstant('Forum <b>x</b>', [
      { title: 'Nuovo <script>', url: 'https://ex.org/a?x=1&y=2', keywords: ['docker'] },
      { title: 'Due', url: 'https://ex.org/b' },
    ], 'http://linko/updates?source=1');
    expect(msg).toContain('🔔 <b>Forum &lt;b&gt;x&lt;/b&gt;</b> · 2 novità');
    expect(msg).toContain('<a href="https://ex.org/a?x=1&amp;y=2">Nuovo &lt;script&gt;</a> 🔑 <i>docker</i>');
    expect(msg).toContain('<a href="http://linko/updates?source=1">Apri in Linko</a>');
  });

  it('limita le righe e indica quante ne restano', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ title: `T${i}`, url: `https://ex.org/${i}` }));
    expect(formatInstant('S', items)).toContain('…e altre 4');
    const d = formatDigest([{ sourceName: 'arXiv', items }]);
    expect(d).toContain('📰 <b>Riepilogo di oggi</b> · 12 novità');
    expect(d).toContain('<b>arXiv</b> (12)');
    expect(d).toContain('…e altre 6');
  });

  it('calcola il prossimo riepilogo nel fuso di Roma, con ora legale e solare', () => {
    // 12 ottobre (ora legale, UTC+2): alle 7:00 di Roma il prossimo delle 8 è lo stesso giorno alle 6:00 UTC
    expect(nextDigestTime(8, new Date('2026-10-12T05:00:00Z')).toISOString()).toBe('2026-10-12T06:00:00.000Z');
    // già passato → il giorno dopo
    expect(nextDigestTime(8, new Date('2026-10-12T06:00:00Z')).toISOString()).toBe('2026-10-13T06:00:00.000Z');
    // dicembre (ora solare, UTC+1)
    expect(nextDigestTime(8, new Date('2026-12-01T10:00:00Z')).toISOString()).toBe('2026-12-02T07:00:00.000Z');
    // cambio d'ora: 25 ottobre 2026 si torna all'ora solare
    expect(nextDigestTime(8, new Date('2026-10-24T08:00:00Z')).toISOString()).toBe('2026-10-25T07:00:00.000Z');
  });

  it('escapeHtml', () => {
    expect(escapeHtml('a & <b> "c"')).toBe('a &amp; &lt;b&gt; &quot;c&quot;');
  });
});
