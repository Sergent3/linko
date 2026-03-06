'use client';

import { useEffect } from 'react';
import { bookmarks as bookmarksApi } from '@/lib/api';

/**
 * Pagina invisibile usata dal bookmarklet per salvare in background.
 *
 * Flusso:
 *  1. Il bookmarklet apre questa pagina in un popup 1×1 px fuori schermo.
 *  2. La pagina legge ?url= e ?title= dai query params.
 *  3. Chiama l'API con il token JWT dal localStorage (stesso origine).
 *  4. Invia il risultato alla finestra parent via postMessage.
 *  5. Si auto-chiude dopo 300 ms.
 *
 * Il bookmarklet riceve il postMessage e mostra un toast sulla pagina corrente.
 */
export default function SaveQuickPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') ?? '';
    const title = params.get('title') ?? '';

    async function save() {
      try {
        if (!url) throw new Error('URL mancante');

        let effectiveTitle = title.trim();
        if (!effectiveTitle) {
          try { effectiveTitle = new URL(url).hostname; } catch { effectiveTitle = url; }
        }

        await bookmarksApi.create({ url, title: effectiveTitle });
        window.opener?.postMessage({ ok: true }, '*');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Errore';
        window.opener?.postMessage({ ok: false, error: msg }, '*');
      } finally {
        setTimeout(() => window.close(), 300);
      }
    }

    save();
  }, []);

  // Nessuna UI — la finestra è invisibile (1×1 px fuori schermo)
  return null;
}
