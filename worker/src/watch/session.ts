/**
 * Riconosce se una pagina è vista da utente autenticato o da ospite.
 * Serve ad accorgersi che il cookie di un sito è scaduto anche quando il
 * sito risponde 200 con la versione pubblica della pagina.
 */

export type SessionState = 'in' | 'out' | 'unknown';

const LOGIN_PATH_RE = /\/(login|log-in|signin|sign-in|sign_in|account\/login|users\/sign_in|member\.php\?action=login|ucp\.php\?mode=login)\b/i;

/** Il redirect è finito sulla pagina di login? */
export function isLoginUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return LOGIN_PATH_RE.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

export function detectSession(html: string, finalUrl: string): SessionState {
  if (isLoginUrl(finalUrl)) return 'out';

  // XenForo: <html … data-logged-in="true|false">
  const xf = html.match(/<html[^>]*\sdata-logged-in="(true|false)"/i);
  if (xf) return xf[1] === 'true' ? 'in' : 'out';

  // Discourse: l'utente corrente è nei dati precaricati
  if (/<meta[^>]+name="discourse_/i.test(html)) {
    return /data-preloaded="[^"]*currentUser/i.test(html) || /id="current-user"/i.test(html) ? 'in' : 'out';
  }

  // Link di uscita: phpBB (mode=logout), vBulletin (do=logout / logout.php), generici
  if (/href="[^"]*(mode=logout|do=logout|logout\.php|\/logout|\/log-out|\/signout|\/sign-out|action=logout)/i.test(html)) {
    return 'in';
  }
  // Un semplice link "Accedi" non basta: molti siti lo mostrano comunque.
  // Per non segnalare scadenze false, "out" arriva solo da segnali certi.
  return 'unknown';
}
