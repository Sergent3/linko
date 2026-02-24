'use client';

import { FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { bookmarks as bookmarksApi } from '@/lib/api';
import type { Bookmark, Folder } from '@/types/api';

interface Props {
  folders: Folder[];
  onClose: () => void;
  onCreated: (b: Bookmark) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#222',
  border: '1px solid #555',
  borderRadius: 3,
  color: '#e0e0e0',
  padding: '6px 10px',
  fontSize: 13,
  outline: 'none',
  marginTop: 4,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#aaa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 2,
};

export default function AddBookmarkModal({ folders, onClose, onCreated }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const created = await bookmarksApi.create({
        url,
        title,
        folderId: folderId || undefined,
      });
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#3a3a3a',
          border: '1px solid #555',
          borderRadius: 6,
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: '#444',
            padding: '8px 14px',
            borderBottom: '1px solid #555',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: '6px 6px 0 0',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#ccc',
            }}
          >
            Aggiungi Segnalibro
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#aaa',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>URL *</label>
            <input
              style={inputStyle}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Titolo</label>
            <input
              style={inputStyle}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lascia vuoto per auto-rilevare"
            />
          </div>

          {folders.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Categoria</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                <option value="">Nessuna categoria</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 10,
                padding: '6px 10px',
                background: '#5c2020',
                border: '1px solid #8b3a3a',
                borderRadius: 3,
                fontSize: 12,
                color: '#ffaaaa',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#555',
                border: '1px solid #666',
                borderRadius: 3,
                color: '#ccc',
                padding: '6px 14px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#555' : '#3a7bd5',
                border: 'none',
                borderRadius: 3,
                color: 'white',
                padding: '6px 14px',
                fontSize: 12,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
