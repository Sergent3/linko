'use client';

import { useEffect, useRef, useState } from 'react';
import BookmarkListItem from './BookmarkListItem';
import type { Bookmark } from '@/types/api';

interface Props {
  title: string;
  folderId?: string;
  bookmarks: Bookmark[];
  onDelete: (id: string) => void;
  onAddClick?: () => void;
  onFolderDelete?: (folderId: string) => void;
  onClearAll?: () => void;
  onMoveBookmark?: (bookmarkId: string, targetFolderId: string | null) => void;
  onRename?: (folderId: string, newName: string) => void;
}

export default function BookmarkWidget({
  title, folderId, bookmarks, onDelete, onAddClick,
  onFolderDelete, onClearAll, onMoveBookmark, onRename,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [editing, setEditing]       = useState(false);
  const [editValue, setEditValue]   = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  const canDelete = !!(folderId && onFolderDelete) || !!onClearAll;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    if (!folderId || !onRename) return;
    setEditValue(title);
    setEditing(true);
  }

  function commitEdit() {
    const name = editValue.trim();
    if (name && name !== title && folderId && onRename) onRename(folderId, name);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  }

  function handleDelete() {
    if (!canDelete) return;
    if (!confirming) { setConfirming(true); return; }
    if (folderId && onFolderDelete) onFolderDelete(folderId);
    else if (onClearAll) onClearAll();
    setConfirming(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const bookmarkId = e.dataTransfer.getData('bookmarkId');
    if (!bookmarkId || !onMoveBookmark) return;
    if (bookmarks.some((b) => b.id === bookmarkId)) return;
    onMoveBookmark(bookmarkId, folderId ?? null);
  }

  return (
    <div
      className="widget-card"
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      style={dragOver ? { outline: '2px solid #3a7bd5', outlineOffset: -2 } : undefined}
    >
      <div className="widget-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Titolo — doppio click per rinominare */}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, background: '#222', border: '1px solid #3a7bd5', borderRadius: 3,
              color: '#eee', fontSize: 12, fontWeight: 600, padding: '1px 6px',
            }}
          />
        ) : (
          <span
            onDoubleClick={startEdit}
            title={folderId ? 'Doppio click per rinominare' : undefined}
            style={{ cursor: folderId && onRename ? 'text' : 'default', flex: 1 }}
          >
            {title}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {canDelete && !editing && (
            confirming ? (
              <>
                <span style={{ fontSize: 11, color: '#f87171' }}>Eliminare?</span>
                <button onClick={handleDelete} title="Conferma"
                  style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>✓</button>
                <button onClick={() => setConfirming(false)} title="Annulla"
                  style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>✕</button>
              </>
            ) : (
              <button onClick={handleDelete} title={folderId ? 'Elimina cartella' : 'Elimina tutti'}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1 }}>🗑</button>
            )
          )}
          {onAddClick && !editing && (
            <button onClick={onAddClick} title="Aggiungi segnalibro"
              style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16, padding: '0 0 0 4px', lineHeight: 1 }}>+</button>
          )}
        </div>
      </div>

      <div className="widget-card-body">
        {bookmarks.length === 0 ? (
          <div style={{ padding: '6px 10px', color: '#888', fontSize: '12px' }}>Nessun segnalibro</div>
        ) : (
          bookmarks.map((b) => (
            <BookmarkListItem key={b.id} bookmark={b} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}
