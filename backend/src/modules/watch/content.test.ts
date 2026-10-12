import { describe, expect, it } from 'vitest';
import { sanitizeContent } from './content';

describe('sanitizeContent', () => {
  it('toglie script, stili, iframe e gestori di eventi', () => {
    const out = sanitizeContent('<p onclick="x()">ciao<script>alert(1)</script></p><style>p{}</style><iframe src="https://e.org"></iframe>', 'https://ex.org/a');
    expect(out).toBe('<p>ciao</p>');
  });
  it('rende assoluti link e immagini, apre i link in una nuova scheda, blocca javascript:', () => {
    const out = sanitizeContent('<a href="/b">b</a><a href="javascript:alert(1)">x</a><img src="i.jpg" onerror="x()">', 'https://ex.org/a/');
    expect(out).toContain('<a href="https://ex.org/b" target="_blank" rel="noopener noreferrer nofollow">b</a>');
    expect(out).not.toContain('javascript');
    expect(out).toContain('<img src="https://ex.org/a/i.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" />');
    expect(out).not.toContain('onerror');
  });
  it('scarta le immagini senza indirizzo', () => {
    expect(sanitizeContent('<p>a<img src="data:image/png;base64,xx"></p>', 'https://ex.org/')).toBe('<p>a</p>');
  });
});
