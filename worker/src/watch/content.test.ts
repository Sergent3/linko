import { describe, expect, it } from 'vitest';
import { extractContent } from './content';

const THREAD = `<html><head><title>Thread | Forum</title></head><body>
  <h1 class="p-title-value">Italian Babes Megathread</h1>
  <article class="message" data-author="mario" data-content="post-101" id="js-post-101">
    <time datetime="2026-10-12T10:00:00+0200"></time>
    <div class="message-body"><div class="bbWrapper">Primo <img src="data:image/gif;base64,R0" data-src="https://img.example/a.jpg"></div></div>
  </article>
  <article class="message" data-author="luigi" data-content="post-102" id="js-post-102">
    <div class="message-body"><div class="bbWrapper">
      <blockquote data-quote="mario"><div class="bbCodeBlock-title">mario said:</div>Primo</blockquote>
      Risposta <iframe src="https://video.example/embed/1"></iframe><script>x()</script>
    </div></div>
  </article>
</body></html>`;

describe('extractContent', () => {
  it('estrae il singolo post richiesto, con immagini differite e iframe come link', () => {
    const c = extractContent(THREAD, 'https://f.example/threads/x.1/page-3', 'https://f.example/threads/x.1/post-102');
    expect(c.title).toBe('Italian Babes Megathread');
    expect(c.author).toBe('luigi');
    expect(c.html).toContain('Risposta');
    expect(c.html).not.toContain('Primo <img');
    expect(c.html).toContain('data-author="mario"');
    expect(c.html).toContain('<a href="https://video.example/embed/1">Contenuto incorporato: apri</a>');
    expect(c.html).not.toContain('<script');
    const first = extractContent(THREAD, 'https://f.example/threads/x.1/page-3', 'https://f.example/threads/x.1/post-101');
    expect(first.html).toContain('src="https://img.example/a.jpg"');
    expect(first.publishedAt).toBe('2026-10-12T08:00:00.000Z');
  });

  it('estrae il corpo di un articolo senza menu, condivisioni e script', () => {
    const body = 'Testo del pezzo abbastanza lungo. '.repeat(12);
    const html = `<html><head><meta property="og:title" content="Titolo"><meta property="og:image" content="https://ex.org/c.jpg"></head><body>
      <nav><a href="/">Home</a></nav>
      <article><h1>Titolo</h1><p>${body}</p><div class="share">Condividi</div><script>x()</script></article>
      <footer>Copyright</footer></body></html>`;
    const c = extractContent(html, 'https://ex.org/a', 'https://ex.org/a');
    expect(c.title).toBe('Titolo');
    expect(c.image).toBe('https://ex.org/c.jpg');
    expect(c.html).toContain('Testo del pezzo');
    expect(c.html).not.toMatch(/Home|Condividi|Copyright|<script|<h1/);
  });

  it('senza corpo leggibile usa la descrizione della pagina', () => {
    const c = extractContent('<html><head><meta name="description" content="Breve riassunto & altro"></head><body><div>x</div></body></html>', 'https://ex.org/', 'https://ex.org/');
    expect(c.html).toBe('<p>Breve riassunto &amp; altro</p>');
  });
});
