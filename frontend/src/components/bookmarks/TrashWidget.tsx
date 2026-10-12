'use client';

import { useState } from 'react';
import { ChevronRight, RotateCcw, Trash2, X } from 'lucide-react';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmarks: Bookmark[];
  onRestore: (id: string) => void;
  onHardDelete: (id: string) => void;
  onEmptyTrash: () => void;
}

/** Cestino: la conferma di svuotamento ed eliminazione definitiva è gestita dalla pagina. */
export default function TrashWidget({ bookmarks, onRestore, onHardDelete, onEmptyTrash }: Props) {
  const [open, setOpen] = useState(false);

  if (bookmarks.length === 0) return null;

  return (
    <section className="widget-card" aria-label="Cestino">
      <div className="widget-card-header">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="trash-body"
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left rounded-md px-1 py-1"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', font: 'inherit', cursor: 'pointer' }}
        >
          <ChevronRight
            size={14}
            aria-hidden="true"
            style={{ flexShrink: 0, color: 'var(--text-faint)', transition: 'transform 0.15s ease', transform: open ? 'rotate(90deg)' : 'none' }}
          />
          <Trash2 size={14} aria-hidden="true" />
          Cestino
          <span className="badge badge-soft">{bookmarks.length}</span>
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onEmptyTrash}>
          Svuota
        </button>
      </div>

      {open && (
        <ul id="trash-body" className="widget-card-body" style={{ listStyle: 'none' }}>
          {bookmarks.map((bm) => (
            <li key={bm.id} className="bookmark-item" style={{ color: 'var(--text-muted)' }}>
              <span className="bookmark-title" title={bm.url}>{bm.title || bm.url}</span>
              {bm.folder && <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0 }}>{bm.folder.name}</span>}
              <span className="row-actions">
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  onClick={() => onRestore(bm.id)}
                  aria-label={`Ripristina ${bm.title || bm.url}`}
                  title="Ripristina"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-sm icon-btn-danger"
                  onClick={() => onHardDelete(bm.id)}
                  aria-label={`Elimina definitivamente ${bm.title || bm.url}`}
                  title="Elimina definitivamente"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
