import { describe, expect, it } from 'vitest';
import { detectSession, isLoginUrl } from './session';

describe('isLoginUrl', () => {
  it('riconosce le pagine di login più comuni', () => {
    expect(isLoginUrl('https://simpcity.cr/login/')).toBe(true);
    expect(isLoginUrl('https://forum.it/ucp.php?mode=login&redirect=x')).toBe(true);
    expect(isLoginUrl('https://site.com/users/sign_in')).toBe(true);
    expect(isLoginUrl('https://site.com/blog/logins-explained')).toBe(false);
  });
});

describe('detectSession', () => {
  it('XenForo: usa data-logged-in', () => {
    expect(detectSession('<html lang="en" data-logged-in="true" data-app="public">', 'https://x.cr/')).toBe('in');
    expect(detectSession('<html data-logged-in="false">', 'https://x.cr/')).toBe('out');
  });

  it('phpBB e vBulletin: link di uscita', () => {
    expect(detectSession('<a href="./ucp.php?mode=logout&sid=1">Esci</a>', 'https://f.it/')).toBe('in');
    expect(detectSession('<a href="login.php?do=logout&logouthash=1">Log out</a>', 'https://f.it/')).toBe('in');
    // Un link di accesso da solo non è un segnale certo
    expect(detectSession('<a href="./ucp.php?mode=login">Login</a>', 'https://f.it/')).toBe('unknown');
  });

  it('redirect alla pagina di login = sessione scaduta', () => {
    expect(detectSession('<html data-logged-in="true">', 'https://x.cr/login/')).toBe('out');
  });

  it('pagina senza indizi', () => {
    expect(detectSession('<html><body><h1>Notizie</h1></body></html>', 'https://news.it/')).toBe('unknown');
  });
});
