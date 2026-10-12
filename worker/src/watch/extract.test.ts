import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import { cssPath, extractItems, suggestAreas } from './extract';

const BASE = 'https://example.org/section/';

const PAGE = `<!doctype html><html><body>
<header><nav class="main-menu"><ul>
  <li><a href="/">Home</a></li><li><a href="/news">News</a></li>
  <li><a href="/about">Chi siamo</a></li><li><a href="/contact">Contatti</a></li>
</ul></nav></header>
<main>
  <h2>Ultimi quotidiani</h2>
  <ul class="latest">
    <li class="item"><a href="/d/corriere-12-10">Corriere della Sera 12/10</a><time datetime="2026-10-12T06:00:00Z">oggi</time></li>
    <li class="item is-new"><a href="/d/stampa-12-10">La Stampa 12/10</a></li>
    <li class="item"><a href="d/sole-12-10">Il Sole 24 Ore 12/10</a></li>
    <li class="item"><a href="#">x</a><a href="https://other.example/rep">La Repubblica 12/10</a></li>
  </ul>
  <h2>Magazine</h2>
  <div class="grid">
    <div class="card"><a href="/m/focus"><img src="f.jpg"></a><h3><a href="/m/focus">Focus Ottobre 2026</a></h3></div>
    <div class="card"><h3><a href="/m/wired">Wired n.112</a></h3></div>
    <div class="card"><h3><a href="/m/lescienze">Le Scienze Ottobre</a></h3></div>
  </div>
</main>
<footer><ul class="links"><li><a href="/privacy">Privacy policy</a></li><li><a href="/terms">Termini</a></li><li><a href="/cookie">Cookie</a></li></ul></footer>
</body></html>`;

describe('extractItems', () => {
  it('estrae titolo, URL assoluto e data dai blocchi ripetuti', () => {
    const items = extractItems(PAGE, BASE, 'ul.latest');
    expect(items).toEqual([
      { title: 'Corriere della Sera 12/10', url: 'https://example.org/d/corriere-12-10', publishedAt: '2026-10-12T06:00:00.000Z' },
      { title: 'La Stampa 12/10', url: 'https://example.org/d/stampa-12-10' },
      { title: 'Il Sole 24 Ore 12/10', url: 'https://example.org/section/d/sole-12-10' },
      { title: 'La Repubblica 12/10', url: 'https://other.example/rep' },
    ]);
  });

  it('in una card sceglie il link con il testo, non quello dell\'immagine', () => {
    const items = extractItems(PAGE, BASE, 'div.grid');
    expect(items.map((i) => i.title)).toEqual(['Focus Ottobre 2026', 'Wired n.112', 'Le Scienze Ottobre']);
  });

  it('selettore senza corrispondenze → nessun elemento', () => {
    expect(extractItems(PAGE, BASE, '#non-esiste')).toEqual([]);
  });
});

describe('suggestAreas', () => {
  it('propone prima le liste di contenuto, con etichetta dal titolo che le precede', () => {
    const areas = suggestAreas(PAGE, BASE);
    expect(areas[0]).toMatchObject({ label: 'Ultimi quotidiani', itemCount: 4, isNavigation: false });
    expect(areas[1]).toMatchObject({ label: 'Magazine', itemCount: 3, isNavigation: false });
  });

  it('marca menu e footer come navigazione e li mette in fondo', () => {
    const areas = suggestAreas(PAGE, BASE);
    const nav = areas.filter((a) => a.isNavigation);
    expect(nav.length).toBeGreaterThan(0);
    expect(areas.findIndex((a) => a.isNavigation)).toBeGreaterThan(1);
  });

  it('il selettore proposto riestrae gli stessi elementi', () => {
    for (const area of suggestAreas(PAGE, BASE)) {
      const items = extractItems(PAGE, BASE, area.selector);
      expect(items.length).toBe(area.itemCount);
    }
  });
});

describe('liste con righe alternate e sidebar', () => {
  // Struttura tipo Hacker News: riga titolo + riga autore/commenti, stessa numerosità
  const rows = [1, 2, 3, 4]
    .map((n) => `<tr class="athing"><td><a href="/item?id=${n}">Titolo della notizia numero ${n} abbastanza lungo</a></td></tr>
      <tr><td><a href="/user?id=u${n}">user${n}</a> <a href="/item?id=${n}#c">${n * 10} comments</a></td></tr>`)
    .join('');
  const HN = `<html><body><table id="stories"><tbody>${rows}</tbody></table></body></html>`;

  it('sceglie le righe con i titoli, non quelle con autore e commenti', () => {
    const [first] = suggestAreas(HN, 'https://news.example/');
    expect(first.sample[0].title).toBe('Titolo della notizia numero 1 abbastanza lungo');
    expect(extractItems(HN, 'https://news.example/', first.selector)).toHaveLength(4);
  });

  const SIDEBAR = `<html><body>
    <aside class="sidebar"><h3>Ultimi post</h3><ul class="latest">
      <li><a href="/t/1">Problema con il cluster dopo aggiornamento</a></li>
      <li><a href="/t/2">Backup su storage remoto non parte</a></li>
      <li><a href="/t/3">Migrazione container tra nodi fallita</a></li>
    </ul>
    <h3>Utenti online</h3><ul class="online">
      ${Array.from({ length: 20 }, (_, i) => `<li><a href="/u/${i}">utente${i}</a></li>`).join('')}
    </ul></aside></body></html>`;

  it('le liste in sidebar non sono navigazione e i nomi brevi pesano meno', () => {
    const areas = suggestAreas(SIDEBAR, 'https://forum.example/');
    expect(areas[0]).toMatchObject({ label: 'Ultimi post', isNavigation: false });
    expect(areas[1].label).toBe('Utenti online');
  });
});

describe('cssPath', () => {
  it('si ferma a un id e usa nth-of-type solo se serve', () => {
    const $ = cheerio.load('<body><div id="app"><ul class="list"></ul><ul class="list"><li>x</li></ul></div></body>');
    const el = $('ul.list').get(1)!;
    const sel = cssPath($, el);
    expect(sel).toBe('#app > ul.list:nth-of-type(2)');
    expect($(sel).get(0)).toBe(el);
  });
});
