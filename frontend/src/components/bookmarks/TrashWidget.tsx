'use client';

import { useState } from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmarks: Bookmark[];
  onRestore: (id: string) => void;
  onHardDelete: (id: string) => void;
  onEmptyTrash: () => void;
}

export default function TrashWidget({ bookmarks, onRestore, onHardDelete, onEmptyTrash }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  if (bookmarks.length === 0) return null;

  return (
    <div className="widget-card" style={{ opacity: 0.85 }}>
      <div className="widget-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, color: '#e57373' }}
          onClick={() => setCollapsed((c) => !c)}
        >
          <Trash2 size={14} />
          Cestino
          <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>({bookmarks.length})</span>
        </span>

        {confirmEmpty ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: '#ccc' }}>Svuotare?</span>
            <button
              onClick={() => { setConfirmEmpty(false); onEmptyTrash(); }}
              style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
            >
              Sì
            </button>
            <button
              onClick={() => setConfirmEmpty(false)}
              style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
            >
              No
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmEmpty(true)}
            title="Svuota cestino"
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}
          >
            Svuota
          </button>
        )}
      </div>

      {!collapsed && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0 0' }}>
          {bookmarks.map((bm) => (
            <li
              key={bm.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                borderRadius: 6,
                fontSize: 13,
                color: '#aaa',
              }}
            >
              {bm.favicon && (
                <img src={bm.favicon} alt="" width={14} height={14} style={{ borderRadius: 2, flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bm.url}>
                {bm.title || bm.url}
              </span>
              {bm.folder && (
                <span style={{ fontSize: 11, color: '#666', flexShrink: 0 }}>{bm.folder.name}</span>
              )}
              <button
                onClick={() => onRestore(bm.id)}
                title="Ripristina"
                style={{ background: 'none', border: 'none', color: '#7ec8a4', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => onHardDelete(bm.id)}
                title="Elimina definitivamente"
                style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
