/**
 * Linko Sync — Popup script
 * Gestisce login, logout e avvio sincronizzazione comunicando col background service worker.
 */

// ─── Utils ───────────────────────────────────────────────────────────────────

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function showStatus(el, type, text) {
  el.className = `status ${type}`;
  el.textContent = text;
}

function setLoading(btn, loading, label) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Attendi…' : label;
}

// ─── Elementi DOM ─────────────────────────────────────────────────────────────

const panelLogin  = document.getElementById('panel-login');
const panelSync   = document.getElementById('panel-sync');

const inputApiUrl   = document.getElementById('api-url');
const inputEmail    = document.getElementById('email');
const inputPassword = document.getElementById('password');
const btnLogin      = document.getElementById('btn-login');
const loginStatus   = document.getElementById('login-status');

const infoApiUrl  = document.getElementById('info-api-url');
const btnSync     = document.getElementById('btn-sync');
const syncStatus  = document.getElementById('sync-status');
const resultGrid  = document.getElementById('result-grid');
const resImported  = document.getElementById('res-imported');
const resDuplicates = document.getElementById('res-duplicates');
const resErrors   = document.getElementById('res-errors');
const btnLogout   = document.getElementById('btn-logout');

// ─── Navigazione pannelli ─────────────────────────────────────────────────────

function showLogin() {
  panelLogin.style.display = 'block';
  panelSync.style.display  = 'none';
}

function showSyncPanel(apiUrl) {
  panelLogin.style.display = 'none';
  panelSync.style.display  = 'block';
  infoApiUrl.textContent   = apiUrl;
  resultGrid.style.display = 'none';
  syncStatus.className     = 'status';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const state = await send({ type: 'GET_STATE' });
  if (state?.loggedIn) {
    showSyncPanel(state.apiUrl);
  } else {
    showLogin();
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

btnLogin.addEventListener('click', async () => {
  const apiUrl   = inputApiUrl.value.trim();
  const email    = inputEmail.value.trim();
  const password = inputPassword.value;

  if (!apiUrl || !email || !password) {
    showStatus(loginStatus, 'error', 'Compila tutti i campi.');
    return;
  }

  setLoading(btnLogin, true, 'Accedi');
  loginStatus.className = 'status';

  const res = await send({ type: 'LOGIN', apiUrl, email, password });

  if (res?.ok) {
    showSyncPanel(apiUrl);
  } else {
    showStatus(loginStatus, 'error', res?.error ?? 'Errore di accesso');
    setLoading(btnLogin, false, 'Accedi');
  }
});

// Invio con Enter sulla password
inputPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLogin.click();
});

// ─── Logout ───────────────────────────────────────────────────────────────────

btnLogout.addEventListener('click', async () => {
  await send({ type: 'LOGOUT' });
  showLogin();
});

// ─── Sync ─────────────────────────────────────────────────────────────────────

btnSync.addEventListener('click', async () => {
  setLoading(btnSync, true, 'Sincronizza tutti i segnalibri');
  syncStatus.className  = 'status';
  resultGrid.style.display = 'none';

  showStatus(syncStatus, 'info', 'Lettura segnalibri in corso…');

  const res = await send({ type: 'SYNC' });

  setLoading(btnSync, false, 'Sincronizza tutti i segnalibri');

  if (res?.ok) {
    const { imported, duplicates, errors } = res.result;
    resImported.textContent   = imported;
    resDuplicates.textContent = duplicates;
    resErrors.textContent     = errors;
    resultGrid.style.display  = 'grid';

    const msg = errors > 0
      ? `Sincronizzazione completata con ${errors} errori.`
      : 'Sincronizzazione completata!';
    showStatus(syncStatus, errors > 0 ? 'error' : 'success', msg);
  } else {
    showStatus(syncStatus, 'error', res?.error ?? 'Errore durante la sincronizzazione');
  }
});

// ─── Avvio ────────────────────────────────────────────────────────────────────

init();
