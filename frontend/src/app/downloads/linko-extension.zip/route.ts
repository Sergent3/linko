import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { createZip } from '@/lib/zip';

/**
 * Estensione del browser da installare a mano in Chrome/Brave (cartella
 * frontend/extension). Il manifest e config.js ricevono l'indirizzo di Linko da
 * cui è stata scaricata: l'estensione parla solo con quello.
 */
export const dynamic = 'force-dynamic';

const ROOT = path.join(process.cwd(), 'extension');

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await listFiles(path.join(dir, e.name), rel)));
    else out.push(rel);
  }
  return out.sort();
}

export async function GET(request: Request) {
  // L'indirizzo di Linko visto dal browser (http://IP:3000 o il dominio HTTPS)
  const origin = new URL(request.url).searchParams.get('origin') ?? '';
  let linko: URL;
  try {
    linko = new URL(origin);
  } catch {
    return new Response('Indirizzo di Linko non valido', { status: 400 });
  }
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!/^https?:$/.test(linko.protocol) || linko.origin !== origin || linko.host !== host) {
    return new Response('Indirizzo di Linko non valido', { status: 400 });
  }
  // I match pattern di Chrome non distinguono le porte: si indica l'host
  const match = `${linko.protocol}//${linko.hostname}/*`;

  const entries = await Promise.all(
    (await listFiles(ROOT)).map(async (rel) => {
      let data = await readFile(path.join(ROOT, rel));
      if (rel === 'manifest.json') data = Buffer.from(data.toString('utf8').replaceAll('__LINKO_MATCH__', match));
      if (rel === 'config.js') data = Buffer.from(data.toString('utf8').replace('__LINKO_ORIGIN__', linko.origin));
      return { path: `linko-extension/${rel}`, data };
    }),
  );

  return new Response(new Uint8Array(createZip(entries)), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="linko-extension.zip"',
      'Cache-Control': 'no-store',
    },
  });
}
