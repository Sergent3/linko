/*
 * Ponte tra le pagine di Linko e l'estensione: Linko manda richieste con
 * window.postMessage, qui vengono girate al service worker e la risposta torna
 * alla pagina. Gira solo sull'indirizzo di Linko (manifest + controllo qui).
 */
(() => {
  if (location.origin !== self.LINKO_ORIGIN) return;

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.type !== 'linko-ext:req' || typeof d.id !== 'string') return;
    const reply = (result) => window.postMessage({ type: 'linko-ext:res', id: d.id, result }, location.origin);
    try {
      chrome.runtime.sendMessage(d.payload, (result) => {
        const err = chrome.runtime.lastError;
        reply(err ? { error: 'extension', message: err.message } : result);
      });
    } catch (err) {
      // Estensione aggiornata o ricaricata: questa pagina va ricaricata
      reply({ error: 'reload', message: String(err && err.message) });
    }
  });

  window.postMessage({ type: 'linko-ext:ready', version: chrome.runtime.getManifest().version }, location.origin);
})();
