'use client';

import { useEffect, useState } from 'react';
import { bookmarks, folders as foldersApi, tokens } from '@/lib/api';

interface Folder { id: string; name: string; }

export default function SaveQuickPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [firstTime, setFirstTime] = useState(false);

  // Letti in useEffect per evitare hydration mismatch (SSR vs client)
  const [url, setUrl]               = useState('');
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setUrl(p.get('url') ?? '');
    setTitle(p.get('title') ?? '');
    setDescription(p.get('description') ?? '');
  }, []);

  /* ── Carica cartelle + controlla se è il primo utilizzo ── */
  useEffect(() => {
    if (!tokens.refresh) {
      setStatus('error');
      setMessage('Non autenticato — accedi a Linko prima di usare il bookmarklet.');
      return;
    }

    // Il client API rinnova da solo l'access token scaduto
    Promise.all([
      foldersApi.list().catch(() => []),
      bookmarks.list({ limit: 1, page: 1 }).catch(() => null),
    ])
      .then(([folderData, bookmarkData]) => {
        setFolders(folderData ?? []);
        if (bookmarkData?.meta?.total === 0) setFirstTime(true);
        setStatus('ready');
      })
      .catch(() => setStatus('ready'));
  }, []);

  /* ── Salva ── */
  async function save() {
    setStatus('saving');
    if (!tokens.refresh) { notify(false, 'Non autenticato'); return; }

    let effectiveTitle = title.trim();
    if (!effectiveTitle) {
      try { effectiveTitle = new URL(url).hostname; } catch { effectiveTitle = url; }
    }

    try {
      await bookmarks.create({ url, title: effectiveTitle, description: description.trim() || undefined, ...(folderId ? { folderId } : {}) });
      notify(true, 'saved');
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 409) { notify(true, 'exists'); return; }
      notify(false, err instanceof Error ? err.message : 'Errore');
    }
  }

  function notify(ok: boolean, detail: string) {
    window.opener?.postMessage({ ok, detail }, window.location.origin);
    setStatus('done');
    setTimeout(() => window.close(), 800);
  }

  /* ── Apri /import nella finestra principale e chiudi il popup ── */
  function openImport() {
    const importUrl = window.location.origin + '/import';
    if (window.opener) {
      window.opener.location.assign(importUrl);
    } else {
      window.open(importUrl, '_blank');
    }
    window.close();
  }

  /* ── UI ── */
  const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <div style={{
      fontFamily: 'system-ui, sans-serif',
      background: 'transparent',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        width: '100%',
        maxWidth: 320,
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,.5)',
      }}>

        {/* Header */}
        <div style={{
          background: 'var(--surface-2)',
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-strong)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)' }}>
            Salva in Linko
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px' }}>

          {/* ── Prima volta: nessun bookmark in Linko ── */}
          {status === 'ready' && firstTime && (
            <>
              <div style={{
                background: '#1a2a1a',
                border: '1px solid #2a4a2a',
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: 14,
              }}>
                <div style={{ fontSize: 12, color: '#6ee7b7', fontWeight: 600, marginBottom: 4 }}>
                  Prima volta su Linko?
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Non hai ancora nessun bookmark salvato. Vuoi importare tutti i preferiti
                  dal tuo browser in un colpo solo?
                </div>
              </div>

              <button
                onClick={openImport}
                style={{
                  width: '100%',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  padding: '8px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                Importa tutti i preferiti dal browser
              </button>

              <button
                onClick={() => setFirstTime(false)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  padding: '6px 0',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                No, salva solo questa pagina
              </button>
            </>
          )}

          {/* ── Flusso normale ── */}
          {!(status === 'ready' && firstTime) && (
            <>
              {/* URL */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                  Pagina
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {title || domain}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
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
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
                    Categoria
                  </div>
                  <select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    disabled={status === 'saving'}
                    style={{
                      width: '100%',
                      background: 'var(--bg)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      color: 'var(--text)',
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
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      color: 'var(--text-muted)',
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
                      background: status === 'saving' ? 'var(--surface-2)' : 'var(--accent)',
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
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>
                  Caricamento…
                </div>
              )}

              {status === 'done' && (
                <div style={{ textAlign: 'center', color: '#6ee7b7', fontSize: 13, padding: '8px 0' }}>
                  ✓ Fatto
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
