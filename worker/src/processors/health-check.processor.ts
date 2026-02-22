/**
 * Health Check Processor
 *
 * Controlla se un URL è ancora raggiungibile e registra lo status HTTP.
 * Usa HEAD (senza scaricare il body) per minimizzare il traffico.
 * Fallback a GET se il server non supporta HEAD (405 Method Not Allowed).
 *
 * httpStatus nel DB:
 *   200-399 → OK / redirect
 *   400-499 → Client error (404 = broken link)
 *   500-599 → Server error
 *   0       → Irraggiungibile (timeout, DNS fail, ecc.)
 */

import { Job } from 'bullmq';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { config } from '../config';

export interface HealthCheckJobData {
  bookmarkId: string;
  url: string;
}

const TIMEOUT = config.HTTP_CHECK_TIMEOUT_MS;

export async function healthCheckProcessor(job: Job<HealthCheckJobData>): Promise<void> {
  const { bookmarkId, url } = job.data;

  let httpStatus = 0; // default: irraggiungibile

  try {
    let response = await axios.head(url, {
      timeout: TIMEOUT,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    // Alcuni server non supportano HEAD → fallback a GET con responseType stream
    if (response.status === 405) {
      response = await axios.get(url, {
        timeout: TIMEOUT,
        maxRedirects: 5,
        validateStatus: () => true,
        responseType: 'stream',
      });
      response.data.destroy(); // Chiudi subito lo stream senza scaricare il body
    }

    httpStatus = response.status;
  } catch {
    // Timeout / DNS fail / connection refused → httpStatus rimane 0
  }

  await prisma.bookmark.update({
    where: { id: bookmarkId },
    data: { httpStatus },
  });
}
