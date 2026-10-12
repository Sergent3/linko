/**
 * Cifratura simmetrica dei segreti salvati nel database (cookie dei siti).
 * AES-256-GCM, formato: base64(iv).base64(tag).base64(ciphertext).
 *
 * Copia identica in backend/src/utils/secret-box.ts e worker/src/lib/secret-box.ts: tenere allineate.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

/** Chiave da WATCH_SECRET_KEY: 32 byte in base64. */
export function loadKey(raw: string | undefined): Buffer {
  if (!raw) throw new Error('WATCH_SECRET_KEY non impostata');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('WATCH_SECRET_KEY deve essere di 32 byte in base64');
  return key;
}

export function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(box: string, key: Buffer): string {
  const [iv, tag, data] = box.split('.').map((p) => Buffer.from(p, 'base64'));
  if (!iv || !tag || !data) throw new Error('Segreto cifrato non valido');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
