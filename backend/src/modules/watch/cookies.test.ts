import { describe, expect, it } from 'vitest';
import { cleanUserAgent, CookieInputError, domainOf, parseCookieInput } from './cookies';
import { decrypt, encrypt, loadKey } from '../../utils/secret-box';

describe('domainOf', () => {
  it('ricava il dominio senza www', () => {
    expect(domainOf('https://www.SimpCity.cr/forums/')).toBe('simpcity.cr');
    expect(domainOf('forum.proxmox.com')).toBe('forum.proxmox.com');
  });
  it('rifiuta valori non validi', () => {
    expect(() => domainOf('localhost')).toThrow(CookieInputError);
    expect(() => domainOf('')).toThrow(CookieInputError);
  });
});

describe('parseCookieInput', () => {
  it('legge l\'intestazione Cookie', () => {
    const r = parseCookieInput('Cookie: xf_user=123%2Cabc; __ddg1_=zz ; xf_session=s1', 'simpcity.cr');
    expect(r.header).toBe('xf_user=123%2Cabc; __ddg1_=zz; xf_session=s1');
    expect(r.names).toEqual(['xf_user', '__ddg1_', 'xf_session']);
  });

  it('tiene i valori con "=" interni', () => {
    expect(parseCookieInput('tok=a=b==', 'x.it').header).toBe('tok=a=b==');
  });

  it('legge cookies.txt filtrando per dominio', () => {
    const txt = [
      '# Netscape HTTP Cookie File',
      '.simpcity.cr\tTRUE\t/\tTRUE\t1999999999\txf_user\t42',
      '#HttpOnly_simpcity.cr\tFALSE\t/\tTRUE\t1999999999\txf_session\tabc',
      '.altro.com\tTRUE\t/\tFALSE\t1999999999\tother\tno',
    ].join('\n');
    const r = parseCookieInput(txt, 'simpcity.cr');
    expect(r.names).toEqual(['xf_user', 'xf_session']);
  });

  it('legge il JSON delle estensioni filtrando per dominio', () => {
    const json = JSON.stringify([
      { name: 'xf_user', value: '42', domain: '.simpcity.cr' },
      { name: 'ga', value: '1', domain: '.google.com' },
    ]);
    expect(parseCookieInput(json, 'simpcity.cr').header).toBe('xf_user=42');
  });

  it('blocca caratteri che romperebbero l\'intestazione', () => {
    expect(() => parseCookieInput('a=1\r\nX-Evil: 1', 'x.it')).toThrow(CookieInputError);
    expect(() => parseCookieInput('bad name=1', 'x.it')).toThrow(CookieInputError);
    expect(() => parseCookieInput('soloTesto', 'x.it')).toThrow(CookieInputError);
  });

  it('segnala quando nel file non ci sono cookie del dominio', () => {
    const json = JSON.stringify([{ name: 'a', value: '1', domain: '.google.com' }]);
    expect(() => parseCookieInput(json, 'simpcity.cr')).toThrow(/simpcity\.cr/);
  });
});

describe('cleanUserAgent', () => {
  it('accetta una riga e rifiuta gli a capo', () => {
    expect(cleanUserAgent('  Mozilla/5.0 X ')).toBe('Mozilla/5.0 X');
    expect(cleanUserAgent('')).toBeNull();
    expect(() => cleanUserAgent('a\nb')).toThrow(CookieInputError);
  });
});

describe('secret-box', () => {
  const key = loadKey(Buffer.alloc(32, 7).toString('base64'));

  it('cifra e decifra', () => {
    const box = encrypt('xf_user=42', key);
    expect(box).not.toContain('xf_user');
    expect(decrypt(box, key)).toBe('xf_user=42');
  });

  it('rileva manomissioni e chiavi sbagliate', () => {
    const box = encrypt('segreto', key);
    const [iv, tag, data] = box.split('.');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 1;
    expect(() => decrypt([iv, tag, flipped.toString('base64')].join('.'), key)).toThrow();
    expect(() => decrypt(box, loadKey(Buffer.alloc(32, 8).toString('base64')))).toThrow();
  });

  it('rifiuta chiavi della lunghezza sbagliata', () => {
    expect(() => loadKey(Buffer.alloc(16).toString('base64'))).toThrow();
    expect(() => loadKey(undefined)).toThrow();
  });
});
