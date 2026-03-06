'use client';

import { useEffect, useState } from 'react';

interface Folder { id: string; name: string; }

export default function SaveQuickPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const url   = params.get('url')   ?? '';
  const title = params.get('title') ?? '';

  /* ── Carica cartelle ── */
  useEffect(() => {
    const token = localStorage.getItem('linko_access');
    if (!token) {
      setStatus('error');
      setMessage('Non autenticato — accedi a Linko prima di usare il bookmarklet.');
      return;
    }

    fetch('/api/v1/folders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data: Folder[]) => {
        setFolders(data ?? []);
        setStatus('ready');
      })
      .catch(() => setStatus('ready')); // nessuna cartella, va bene lo stesso
  }, []);

  /* ── Salva ── */
  async function save() {
    setStatus('saving');
    const token = localStorage.getItem('linko_access');
    if (!token) {
      notify(false, 'Non autenticato');
      return;
    }

    let effectiveTitle = title.trim();
    if (!effectiveTitle) {
      try { effectiveTitle = new URL(url).hostname; } catch { effectiveTitle = url; }
    }

    try {
      const res = await fetch('/api/v1/bookmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url,
          title: effectiveTitle,
          ...(folderId ? { folderId } : {}),
        }),
      });

      if (res.status === 409) { notify(true, 'exists'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      notify(true, 'saved');
    } catch (err: unknown) {
      notify(false, err instanceof Error ? err.message : 'Errore');
    }
  }

  function notify(ok: boolean, detail: string) {
    window.opener?.postMessage({ ok, detail }, window.location.origin);
    setStatus('done');
    setTimeout(() => window.close(), 800);
  }

  /* ── UI ── */
  const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      background: '#2b2b2b',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    }}>
      <div style={{
        background: '#3a3a3a',
        border: '1px solid #555',
        borderRadius: 8,
        width: '100%',
        maxWidth: 320,
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,.5)',
      }}>

        {/* Header */}
        <div style={{
          background: '#444',
          padding: '8px 14px',
          borderBottom: '1px solid #555',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#ccc' }}>
            Salva in Linko
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px' }}>

          {/* URL */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
              Pagina
            </div>
            <div style={{ fontSize: 12, color: '#ddd', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title || domain}
            </div>
            <div style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
              {domain}
            </div>
          </div>

          {/* Stato errore */}
          {status === 'error' && (
            <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>{message}</div>
          )}

          {/* Selettore cartella */}
          {(status === 'ready' || status === 'saving') && folders.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                Categoria
              </div>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                disabled={status === 'saving'}
                style={{
                  width: '100%',
                  background: '#222',
                  border: '1px solid #555',
                  borderRadius: 4,
                  color: '#ddd',
                  padding: '6px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <option value="">Nessuna categoria</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Bottoni */}
          {(status === 'ready' || status === 'saving') && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => window.close()}
                disabled={status === 'saving'}
                style={{
                  flex: 1,
                  background: '#555',
                  border: '1px solid #666',
                  borderRadius: 4,
                  color: '#ccc',
                  padding: '7px 0',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Annulla
              </button>
              <button
                onClick={save}
                disabled={status === 'saving'}
                style={{
                  flex: 2,
                  background: status === 'saving' ? '#2a5a8a' : '#3a7bd5',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  padding: '7px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: status === 'saving' ? 'not-allowed' : 'pointer',
                }}
              >
                {status === 'saving' ? 'Salvataggio…' : 'Salva'}
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div style={{ textAlign: 'center', color: '#888', fontSize: 12, padding: '8px 0' }}>
              Caricamento…
            </div>
          )}

          {status === 'done' && (
            <div style={{ textAlign: 'center', color: '#6ee7b7', fontSize: 13, padding: '8px 0' }}>
              ✓ Fatto
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
