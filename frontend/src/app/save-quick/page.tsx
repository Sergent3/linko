'use client';
import { useEffect } from 'react';

export default function SaveQuickPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url') ?? '';
    const title = params.get('title') ?? '';

    async function save() {
      try {
        if (!url) throw new Error('URL mancante');

        // Legge il token direttamente dal localStorage — nessuna dipendenza da context
        const token = localStorage.getItem('linko_access');
        if (!token) throw new Error('Non autenticato');

        let effectiveTitle = title.trim();
        if (!effectiveTitle) {
          try { effectiveTitle = new URL(url).hostname; } catch { effectiveTitle = url; }
        }

        const res = await fetch('/api/v1/bookmarks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ url, title: effectiveTitle }),
        });

        if (res.status === 409) {
          window.opener?.postMessage({ ok: true, exists: true }, window.location.origin);
          return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        window.opener?.postMessage({ ok: true, exists: false }, window.location.origin);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Errore';
        window.opener?.postMessage({ ok: false, error: msg }, window.location.origin);
      } finally {
        setTimeout(() => window.close(), 300);
      }
    }

    save();
  }, []);

  return null;
}
