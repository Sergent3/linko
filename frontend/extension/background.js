/*
 * Linko · estensione del browser
 *
 * Ogni minuto chiede a Linko quali fonti "controllate dal browser" sono da
 * controllare, apre le loro pagine qui (dove le verifiche anti-bot come
 * Cloudflare lasciano passare) e manda l'HTML a Linko, che trova le novità.
 *
 * Prima prova una richiesta diretta, che usa i cookie del browser; se il sito
 * mostra la verifica anti-bot, apre la pagina in una finestra ridotta a icona,
 * aspetta che la verifica si risolva da sola, legge la pagina e chiude la finestra.
 */
importScripts('config.js');

const VERSION = chrome.runtime.getManifest().version;
const API = `${self.LINKO_ORIGIN}/api/v1/extension/agent`;
const CHALLENGE_WAIT_MS = 45_000;
// Analisi dal wizard: dopo qualche secondo la finestra si mostra, l'utente può spuntare la casella
const SHOW_AFTER_MS = 12_000;
const INTERACTIVE_WAIT_MS = 150_000;
const POLL_MINUTES = 1;

const DEFAULT_STATE = {
  token: null,
  lastRun: null,
  lastError: null,
  // Siti che servono a Linko ma per cui l'utente non ha ancora dato il permesso
  needPermission: [],
  // Siti dove la verifica anti-bot non si è risolta da sola
  challenged: [],
  checked: 0,
};

const getState = () => chrome.storage.local.get(DEFAULT_STATE);
const setState = (patch) => chrome.storage.local.set(patch);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function originOf(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}

const hasPermission = (origin) => chrome.permissions.contains({ origins: [`${origin}/*`] });

function browserName() {
  const ua = navigator.userAgent;
  const name = navigator.brave ? 'Brave' : /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : 'Chrome';
  const version = ua.match(/Chrome\/(\d+)/)?.[1] ?? '';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [`${name} ${version}`.trim(), os].filter(Boolean).join(' · ');
}

async function api(path, options = {}) {
  const { token } = await getState();
  if (!token) throw Object.assign(new Error('Non collegata a Linko'), { status: 401 });
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Linko-Extension': VERSION,
      'X-Linko-Browser': browserName(),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || `Linko ha risposto ${res.status}`), { status: res.status });
  }
  return res.json();
}

// ── Scaricare una pagina ─────────────────────────────────────────────────────

const CHALLENGE_TITLE = /just a moment|un momento|ci siamo quasi|attention required|ddos-guard|checking your browser|verifica/i;

function looksChallenged(title, html) {
  return CHALLENGE_TITLE.test(title || '') || /challenge-platform\/h\/[bg]\/orchestrate|cf-turnstile/i.test(html || '');
}

function titleOf(html) {
  return html.match(/<title[^>]*>([^<]*)/i)?.[1] ?? '';
}

/**
 * Pagina aperta in una finestra ridotta a icona, per superare la verifica anti-bot.
 * Con interactive (l'utente sta aggiungendo la fonte) la finestra, se la verifica
 * non passa da sola, viene mostrata: l'utente spunta la casella e la pagina arriva.
 */
async function viaWindow(url, interactive = false) {
  const win = await chrome.windows.create({ url, state: 'minimized', focused: false });
  const tabId = win.tabs?.[0]?.id;
  const start = Date.now();
  let shown = false;
  try {
    const deadline = start + (interactive ? INTERACTIVE_WAIT_MS : CHALLENGE_WAIT_MS);
    while (Date.now() < deadline) {
      await sleep(1500);
      if (interactive && !shown && Date.now() - start > SHOW_AFTER_MS) {
        shown = true;
        await chrome.windows.update(win.id, { state: 'normal', focused: true, width: 900, height: 760 }).catch(() => {});
      }
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) return { error: 'network', message: 'Finestra chiusa prima della fine' };
      if (tab.status !== 'complete') continue;
      let snap;
      try {
        [{ result: snap }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => ({ title: document.title, url: location.href, html: `<!DOCTYPE html>${document.documentElement.outerHTML}` }),
        });
      } catch {
        continue; // pagina in ricaricamento dopo la verifica
      }
      if (snap && !looksChallenged(snap.title, snap.html)) {
        return { page: { url: snap.url, status: 200, html: snap.html } };
      }
    }
    return { error: 'challenge' };
  } finally {
    chrome.windows.remove(win.id).catch(() => {});
  }
}

async function fetchSite(url, interactive = false) {
  const origin = originOf(url);
  if (!origin || !(await hasPermission(origin))) return { error: 'permission', origin };
  try {
    const res = await fetch(url, { credentials: 'include', cache: 'no-store', redirect: 'follow' });
    const html = await res.text();
    const blocked = res.headers.get('cf-mitigated') === 'challenge' || ([403, 429, 503].includes(res.status) && looksChallenged(titleOf(html), html));
    if (!blocked) return { page: { url: res.url || url, status: res.status, html } };
  } catch {
    // Errore di rete o CORS: si riprova aprendo la pagina
  }
  try {
    return await viaWindow(url, interactive);
  } catch (err) {
    return { error: 'network', message: String(err?.message ?? err) };
  }
}

// ── Ciclo di controllo ───────────────────────────────────────────────────────

let running = false;

async function poll() {
  if (running) return;
  running = true;
  try {
    const state = await getState();
    if (!state.token) return;
    let data;
    try {
      data = await api('/jobs');
    } catch (err) {
      if (err.status === 401) await setState({ token: null, lastError: 'Collegamento revocato: ricollega l\'estensione da Linko' });
      else await setState({ lastError: `Linko non raggiungibile: ${err.message}` });
      return;
    }

    // Siti delle fonti, più quelli chiesti dal wizard di Linko e non ancora concessi
    const missing = [];
    for (const o of new Set([...data.origins, ...state.needPermission])) if (!(await hasPermission(o))) missing.push(o);
    const challenged = new Set(state.challenged);
    let checked = state.checked;

    for (const job of data.jobs) {
      const origin = originOf(job.url);
      const r = await fetchSite(job.url);
      if (r.error === 'challenge') challenged.add(origin);
      else if (r.page) challenged.delete(origin);
      await api('/results', {
        method: 'POST',
        body: JSON.stringify({ sourceId: job.sourceId, ...(r.page ? { page: r.page } : { error: r.error, message: r.message }) }),
      }).catch(() => {});
      if (r.page) checked++;
    }

    await setState({
      lastRun: new Date().toISOString(),
      lastError: null,
      needPermission: missing,
      challenged: [...challenged].filter((o) => data.origins.includes(o)),
      checked,
    });
  } finally {
    running = false;
    await updateBadge();
  }
}

async function updateBadge() {
  const s = await getState();
  const problem = !s.token
    ? 'Da collegare a Linko'
    : s.needPermission.length
      ? 'Servono permessi per alcuni siti'
      : s.challenged.length
        ? 'Un sito chiede la verifica anti-bot'
        : s.lastError;
  await chrome.action.setBadgeText({ text: problem ? '!' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  await chrome.action.setTitle({ title: problem ? `Linko · ${problem}` : 'Linko · tutto a posto' });
}

function schedule() {
  chrome.alarms.create('poll', { periodInMinutes: POLL_MINUTES, delayInMinutes: 0.1 });
}

chrome.runtime.onInstalled.addListener(() => { schedule(); updateBadge(); });
chrome.runtime.onStartup.addListener(() => { schedule(); updateBadge(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'poll') poll(); });
chrome.permissions.onAdded.addListener(() => poll());

// ── Messaggi da Linko (linko-bridge.js) e dal pannello ───────────────────────

async function publicState() {
  const s = await getState();
  return {
    version: VERSION,
    browser: browserName(),
    connected: !!s.token,
    lastRun: s.lastRun,
    lastError: s.lastError,
    needPermission: s.needPermission,
    challenged: s.challenged,
    checked: s.checked,
    linko: self.LINKO_ORIGIN,
  };
}

async function handle(msg, sender) {
  const fromLinko = sender.origin === self.LINKO_ORIGIN;
  const fromPanel = sender.url?.startsWith(chrome.runtime.getURL(''));
  if (!fromLinko && !fromPanel) return { error: 'forbidden' };

  switch (msg?.type) {
    case 'hello':
      return publicState();
    case 'connect':
      if (!fromLinko || typeof msg.token !== 'string') return { error: 'forbidden' };
      await setState({ token: msg.token, lastError: null });
      schedule();
      poll();
      return publicState();
    case 'disconnect':
      await setState({ token: null });
      await updateBadge();
      return publicState();
    case 'fetch': {
      // Analisi di una pagina dal wizard di Linko
      if (typeof msg.url !== 'string') return { error: 'forbidden' };
      return fetchSite(msg.url, true);
    }
    case 'grant': {
      // Linko chiede il permesso per nuovi siti: si apre il pannello, dove l'utente lo concede
      const s = await getState();
      const add = (Array.isArray(msg.origins) ? msg.origins : []).filter((o) => typeof o === 'string' && originOf(o) === o);
      await setState({ needPermission: [...new Set([...s.needPermission, ...add])] });
      await updateBadge();
      await chrome.tabs.create({ url: chrome.runtime.getURL('panel.html?tab=1') });
      return { ok: true };
    }
    case 'poll':
      await poll();
      return publicState();
    default:
      return { error: 'unknown' };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (err) => sendResponse({ error: 'extension', message: String(err?.message ?? err) }));
  return true;
});
