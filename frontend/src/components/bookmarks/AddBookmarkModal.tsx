'use client';

import { FormEvent, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { bookmarks as bookmarksApi } from '@/lib/api';
import type { Bookmark, Folder } from '@/types/api';

interface Props {
  folders: Folder[];
  onClose: () => void;
  onCreated: (b: Bookmark) => void;
  /** Valori pre-compilati dal bookmarklet (opzionali) */
  initialUrl?: string;
  initialTitle?: string;
}

export default function AddBookmarkModal({
  folders,
  onClose,
  onCreated,
  initialUrl = '',
  initialTitle = '',
}: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [folderId, setFolderId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Se il titolo è vuoto usiamo l'hostname come fallback
      // (il backend richiede title non vuoto — bookmarks.schema.ts:L7)
      let effectiveTitle = title.trim();
      if (!effectiveTitle && url) {
        try { effectiveTitle = new URL(url).hostname; } catch { effectiveTitle = url; }
      }
      const created = await bookmarksApi.create({
        url,
        title: effectiveTitle,
        folderId: folderId || undefined,
      });
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il salvataggio';
      setError(msg === 'Session expired' ? 'Sessione scaduta: ricarica la pagina e accedi di nuovo.' : msg);
    } finally {
      setLoading(false);
    }
  }

  const dirty = url !== initialUrl || title !== initialTitle;

  return (
    <Modal
      title={initialUrl ? 'Salva dal bookmarklet' : 'Aggiungi segnalibro'}
      onClose={onClose}
      dismissOnBackdrop={!dirty}
    >
      <form onSubmit={handleSubmit} noValidate={false}>
        <div className="mb-4">
          <label className="field-label" htmlFor="bm-url">URL</label>
          <input
            id="bm-url"
            name="url"
            className="input"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://esempio.it/articolo…"
            required
            {...(!initialUrl && { 'data-autofocus': true })}
          />
        </div>

        <div className="mb-4">
          <label className="field-label" htmlFor="bm-title">Titolo</label>
          <input
            id="bm-title"
            name="title"
            className="input"
            type="text"
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo della pagina…"
            {...(initialUrl && { 'data-autofocus': true })}
          />
          <p className="field-hint">Se lo lasci vuoto viene usato il dominio.</p>
        </div>

        {folders.length > 0 && (
          <div className="mb-4">
            <label className="field-label" htmlFor="bm-folder">Cartella</label>
            <select
              id="bm-folder"
              name="folder"
              className="input"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            >
              <option value="">Senza categoria</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}

        <div aria-live="polite">
          {error && <div className="alert-error mb-4">{error}</div>}
        </div>

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading && <span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} aria-hidden="true" />}
            {loading ? 'Salvataggio…' : 'Salva segnalibro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
