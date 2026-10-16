/*
 * Giro di prova dell'interfaccia di Linko, da e2e/run.sh (gira dentro linko-browser-1).
 * Ogni controllo stampa ✓ o ✗; se uno fallisce il processo esce con codice 1.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium, devices } = require(process.env.PW);

const BASE = process.env.LINKO_URL || 'http://frontend:3000';
const WORK = process.env.WORK;
const reg = JSON.parse(fs.readFileSync(path.join(WORK, 'auth.json'), 'utf8'));

// Screenshot dei controlli falliti (cartella fuori da WORK, che run.sh cancella)
const SHOTS = '/tmp/linko-e2e-shots';
let failed = 0;
let current = null; // pagina in uso, per lo screenshot in caso di errore
async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`✓ ${name} (${Date.now() - t0} ms)`);
  } catch (err) {
    failed++;
    console.log(`✗ ${name}: ${err.message.split('\n')[0]}`);
    if (current) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const file = path.join(SHOTS, `${failed}.png`);
      await current.screenshot({ path: file, fullPage: true }).then(() => console.log(`  screenshot: ${file}`)).catch(() => {});
    }
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Pagina già autenticata con l'utente di prova. */
async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.evaluate(([a, r, u]) => {
    localStorage.setItem('linko_access', a);
    localStorage.setItem('linko_refresh', r);
    localStorage.setItem('linko_user', u);
  }, [reg.accessToken, reg.refreshToken, JSON.stringify(reg.user)]);
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  // ── Computer ──────────────────────────────────────────────────────────────
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desk.newPage();
  current = page;
  await login(page);

  await check('Aggiornamenti: la fonte compare e il worker porta gli elementi', async () => {
    await page.goto(`${BASE}/updates`);
    await page.locator('[data-source-btn]').first().waitFor({ timeout: 20000 });
    assert(await page.locator('[data-source-btn]').count() === 1, 'fonte non trovata');
    // Il primo controllo della fonte avviene entro un minuto: si aspetta l'API, poi si guarda la pagina
    let first = null;
    for (let i = 0; i < 18 && !first; i++) {
      const res = await page.request.get(`${BASE}/api/v1/watch/items?limit=1`, { headers: { Authorization: `Bearer ${reg.accessToken}` } });
      first = (await res.json()).data?.[0] ?? null;
      if (!first) await page.waitForTimeout(5000);
    }
    assert(first, 'nessun elemento dal feed dopo 90 s');
    await page.reload();
    await page.getByText(first.title, { exact: true }).first().waitFor({ timeout: 15000 });
  });

  await check('Clic sul nome filtra senza aprire schede; l\'icona apre il sito', async () => {
    const before = desk.pages().length;
    await page.locator('[data-source-btn]').first().click();
    await page.waitForTimeout(800);
    assert(desk.pages().length === before, 'il clic sul nome ha aperto una scheda');
    const popup = desk.waitForEvent('page', { timeout: 5000 });
    await page.getByRole('link', { name: /nel browser/ }).first().click();
    const p = await popup;
    assert(p.url().includes('warontherocks.com'), `aperto ${p.url()}`);
    await p.close();
  });

  await check('Download dell\'estensione: zip con manifest e indirizzo di Linko', async () => {
    const res = await page.request.get(`${BASE}/downloads/linko-extension.zip?origin=${encodeURIComponent(BASE)}`);
    assert(res.status() === 200, `HTTP ${res.status()}`);
    const zip = await res.body();
    fs.writeFileSync(path.join(WORK, 'ext.zip'), zip);
    execFileSync('python3', ['-m', 'zipfile', '-e', path.join(WORK, 'ext.zip'), WORK]);
    const manifest = JSON.parse(fs.readFileSync(path.join(WORK, 'linko-extension/manifest.json'), 'utf8'));
    assert(manifest.content_scripts[0].matches[0].startsWith(BASE.replace(/:\d+$/, '')), 'match del manifest errato');
    assert(fs.readFileSync(path.join(WORK, 'linko-extension/config.js'), 'utf8').includes(BASE), 'config.js senza indirizzo');
  });
  await desk.close();

  // ── Estensione caricata nel browser ───────────────────────────────────────
  await check('Estensione: rilevata e collegata all\'account', async () => {
    const ext = path.join(WORK, 'linko-extension');
    const ctx = await chromium.launchPersistentContext(path.join(WORK, `profile-${Date.now()}`), {
      headless: false,
      args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-sandbox'],
    });
    try {
      const p = await ctx.newPage();
      await login(p);
      await p.goto(`${BASE}/extension`);
      await p.getByText('Installata · versione').waitFor({ timeout: 30000 });
      await p.getByRole('button', { name: 'Collega questo browser' }).click();
      await p.getByText(/Collegata ·/).waitFor({ timeout: 30000 });
    } finally {
      await ctx.close();
    }
  });

  // ── Telefono ──────────────────────────────────────────────────────────────
  const phone = await browser.newContext({ ...devices['iPhone 13'] });
  const mob = await phone.newPage();
  current = mob;
  await login(mob);
  for (const route of ['/updates', '/bookmarks', '/extension', '/access']) {
    await check(`Telefono ${route}: niente scorrimento orizzontale`, async () => {
      await mob.goto(BASE + route);
      await mob.waitForLoadState('networkidle');
      const { w, sw } = await mob.evaluate(() => ({ w: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }));
      assert(sw <= w, `larghezza contenuto ${sw}px > schermo ${w}px`);
    });
  }
  await check('Telefono: avviso che l\'estensione si installa dal computer', async () => {
    await mob.goto(`${BASE}/extension`);
    await mob.getByText('Su telefono e tablet').waitFor({ timeout: 10000 });
  });

  await browser.close();
  console.log(failed ? `\n${failed} controlli falliti` : '\nTutti i controlli passati');
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error('ERRORE', err);
  process.exit(1);
});
