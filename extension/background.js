/**
 * Linko Sync — Background Service Worker (Manifest V3)
 *
 * Responsabilità:
 * - Riceve messaggi dal popup (SYNC, LOGIN, LOGOUT, GET_STATE)
 * - Legge l'albero segnalibri via chrome.bookmarks.getTree()
 * - Chiama POST /api/v1/import/sync sul backend Linko
 * - Gestisce login/logout salvando token in chrome.storage.local
 */

// ─── Costanti ────────────────────────────────────────────────────────────────

const STORAGE_KEY_TOKEN  = 'linko_token';
const STORAGE_KEY_APIURL = 'linko_api_url';
const DEFAULT_API_URL    = 'http://localhost:3001';

// ─── Helpers storage ─────────────────────────────────────────────────────────

async function getSettings() {
  const data = await chrome.storage.local.get([STORAGE_KEY_TOKEN, STORAGE_KEY_APIURL]);
  return {
    token:  data[STORAGE_KEY_TOKEN]  ?? null,
    apiUrl: data[STORAGE_KEY_APIURL] ?? DEFAULT_API_URL,
  };
}

async function saveSettings(partial) {
  await chrome.storage.local.set(partial);
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login(apiUrl, email, password) {
  const url = apiUrl.replace(/\/$/, '');
  const res = await fetch(`${url}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

  const token = body.accessToken ?? body.token;
  if (!token) throw new Error('Token non ricevuto dal server');

  await saveSettings({
    [STORAGE_KEY_TOKEN]:  token,
    [STORAGE_KEY_APIURL]: url,
  });

  return { token };
}

async function logout() {
  await chrome.storage.local.remove([STORAGE_KEY_TOKEN]);
}

// ─── Normalizzazione albero bookmark ─────────────────────────────────────────

/**
 * Converte il nodo chrome.bookmarks.BookmarkTreeNode nel formato
 * atteso dall'endpoint /api/v1/import/sync: { title, url } | { title, children }.
 * Scarta bookmark con URL non-http (chrome://, javascript:, ecc.).
 */
function normalizeNode(node) {
  if (node.url) {
    // Filtro protocolli non supportati
    if (!/^https?:\/\//i.test(node.url)) return null;
    return {
      title: node.title?.trim() || new URL(node.url).hostname,
      url: node.url,
    };
  }

  // Cartella
  const children = (node.children ?? [])
    .map(normalizeNode)
    .filter(Boolean);

  // Salta cartelle vuote (es. "Barra dei segnalibri" senza figli utili)
  if (children.length === 0) return null;

  return {
    title: node.title?.trim() || 'Senza nome',
    children,
  };
}

/**
 * Legge l'intero albero segnalibri e restituisce i nodi radice normalizzati.
 * I nodi virtuali di Chrome ("Barra dei segnalibri", "Altri segnalibri",
 * "Segnalibri per dispositivi mobili") vengono passati come radici dell'albero —
 * il backend li creerà come cartelle di primo livello.
 */
async function readBookmarks() {
  const [root] = await chrome.bookmarks.getTree();
  // root.children = [Bookmarks Bar, Other Bookmarks, Mobile Bookmarks]
  const topLevel = root.children ?? [];

  const nodes = topLevel
    .map(normalizeNode)
    .filter(Boolean);

  return nodes;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

async function sync() {
  const { token, apiUrl } = await getSettings();
  if (!token) throw new Error('Non autenticato — accedi prima dall\'estensione');

  const tree = await readBookmarks();
  if (tree.length === 0) throw new Error('Nessun segnalibro trovato nel browser');

  const res = await fetch(`${apiUrl}/api/v1/import/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ tree }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

  return body; // { imported, duplicates, errors }
}

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handle = async () => {
    switch (msg.type) {
      case 'GET_STATE': {
        const { token, apiUrl } = await getSettings();
        return { loggedIn: !!token, apiUrl };
      }
      case 'LOGIN': {
        await login(msg.apiUrl, msg.email, msg.password);
        return { ok: true };
      }
      case 'LOGOUT': {
        await logout();
        return { ok: true };
      }
      case 'SYNC': {
        const result = await sync();
        return { ok: true, result };
      }
      default:
        return { ok: false, error: 'Messaggio sconosciuto' };
    }
  };

  handle()
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err.message }));

  return true; // Mantieni il canale aperto per la risposta asincrona
});
