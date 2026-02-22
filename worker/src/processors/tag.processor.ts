/**
 * Tag Processor — AI Tagging (Fase 2, placeholder)
 *
 * Quando implementato, chiamerà il Claude API per assegnare tag
 * semantici ai bookmark che non sono stati coperti dalle regex (Fase 1).
 *
 * Il processo è:
 * 1. Legge titolo, descrizione e URL del bookmark
 * 2. Chiama Claude con un prompt strutturato
 * 3. Parsa la risposta e salva i tag con source='AI' nel DB
 *
 * La separazione in un processor dedicato permette di:
 * - Scalare il worker AI indipendentemente dagli altri
 * - Controllare i costi API con un rate limiter separato
 * - Disabilitare l'AI tagging senza toccare il resto del sistema
 */

import { Job } from 'bullmq';
import { prisma } from '../lib/prisma';

export interface TagJobData {
  bookmarkId: string;
  url: string;
  title: string;
  description?: string;
}

export async function tagProcessor(job: Job<TagJobData>): Promise<void> {
  const { bookmarkId, url, title, description } = job.data;

  // TODO: Implementare AI tagging con Claude API
  //
  // Esempio di integrazione futura:
  //
  //   import Anthropic from '@anthropic-ai/sdk';
  //   const client = new Anthropic();
  //
  //   const msg = await client.messages.create({
  //     model: 'claude-opus-4-6',
  //     max_tokens: 256,
  //     messages: [{
  //       role: 'user',
  //       content: `Assign 3-5 concise tags to this bookmark:
  //         URL: ${url}
  //         Title: ${title}
  //         Description: ${description ?? 'N/A'}
  //         Respond with only a JSON array of lowercase strings. Example: ["dev","tutorial","react"]`
  //     }]
  //   });
  //
  //   const aiTags: string[] = JSON.parse(msg.content[0].text);
  //
  //   // Salva i tag nel DB con source='AI'
  //   for (const tagName of aiTags) { ... }

  console.log(`[tag] AI tagging non ancora implementato per bookmark ${bookmarkId} (${url})`);
}
