/**
 * Tag Processor — AI Tagging via Claude API
 *
 * Flusso:
 * 1. Recupera il bookmark e le cartelle dell'utente dal DB
 * 2. Chiama Claude con un prompt strutturato
 * 3. Salva i tag con source='AI'
 * 4. Assegna la cartella suggerita (solo se il bookmark non ne ha già una)
 *
 * Supporto .onion: i siti Tor non sono raggiungibili, ma vengono comunque
 * categorizzati in base a titolo e descrizione salvati al momento del salvataggio.
 */

import { Job } from 'bullmq';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma';
import { config } from '../config';

export interface TagJobData {
  bookmarkId: string;
  userId: string;
  url: string;
  title: string;
  description?: string;
}

function isOnion(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.onion');
  } catch {
    return false;
  }
}

export async function tagProcessor(job: Job<TagJobData>): Promise<void> {
  const { bookmarkId, userId, url, title, description } = job.data;

  if (!config.ANTHROPIC_API_KEY) {
    console.log(`[tag] ANTHROPIC_API_KEY non configurato — skip per ${bookmarkId}`);
    return;
  }

  // Recupera bookmark e cartelle in parallelo
  const [bookmark, folders] = await Promise.all([
    prisma.bookmark.findFirst({
      where: { id: bookmarkId, userId, deletedAt: null },
      select: { id: true, folderId: true },
    }),
    prisma.folder.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
  ]);

  if (!bookmark) {
    console.warn(`[tag] Bookmark ${bookmarkId} non trovato — skip`);
    return;
  }

  const onion = isOnion(url);

  const folderList =
    folders.length > 0
      ? folders.map((f) => `- id="${f.id}" name="${f.name}"`).join('\n')
      : '(nessuna cartella disponibile)';

  const urlContext = onion
    ? `URL: ${url}
NOTA: Questo è un sito .onion (rete Tor) non raggiungibile pubblicamente.
Categorizza basandoti SOLO su titolo e descrizione.`
    : `URL: ${url}`;

  const prompt = `Sei un assistente che categorizza segnalibri web. Analizza il segnalibro e restituisci un JSON con:
- "tags": array di 3-6 tag in minuscolo, concisi e descrittivi (es. "sicurezza", "privacy", "linux")
- "folderId": l'id della cartella più adatta tra quelle fornite, oppure null se nessuna è adatta

${urlContext}
Titolo: ${title || '(nessun titolo)'}
Descrizione: ${description || '(nessuna descrizione)'}

Cartelle disponibili:
${folderList}

Rispondi SOLO con JSON valido, senza markdown, senza testo aggiuntivo.
Esempio: {"tags":["privacy","tor","darkweb"],"folderId":"cuid123"}`;

  const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

  let parsed: { tags?: unknown; folderId?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error(`[tag] Risposta non valida da Claude per ${bookmarkId}:`, text);
    return;
  }

  const aiTags = Array.isArray(parsed.tags)
    ? (parsed.tags as unknown[])
        .filter((t): t is string => typeof t === 'string' && t.length > 0)
        .map((t) => t.toLowerCase().slice(0, 50))
        .slice(0, 10)
    : [];

  const suggestedFolderId =
    typeof parsed.folderId === 'string' && folders.some((f) => f.id === parsed.folderId)
      ? parsed.folderId
      : null;

  await prisma.$transaction(async (tx) => {
    // Salva tag AI
    for (const name of aiTags) {
      const tag = await tx.tag.upsert({
        where: { name_userId: { name, userId } },
        create: { name, userId, source: 'AI' },
        update: {},
      });
      await tx.bookmarkTag.upsert({
        where: { bookmarkId_tagId: { bookmarkId, tagId: tag.id } },
        create: { bookmarkId, tagId: tag.id, source: 'AI' },
        update: {},
      });
    }

    // Assegna la cartella solo se il bookmark non ne ha già una
    if (suggestedFolderId && !bookmark.folderId) {
      await tx.bookmark.update({
        where: { id: bookmarkId },
        data: { folderId: suggestedFolderId },
      });
    }
  });

  const folderName = suggestedFolderId
    ? (folders.find((f) => f.id === suggestedFolderId)?.name ?? suggestedFolderId)
    : null;

  console.log(
    `[tag] ${bookmarkId}${onion ? ' [.onion]' : ''} → tags: [${aiTags.join(', ')}]` +
      (folderName ? ` → cartella: "${folderName}"` : ''),
  );
}
