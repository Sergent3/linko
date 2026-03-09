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
  onWidgetReorder?: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
}

export default function BookmarkWidget({
  title, folderId, bookmarks, onDelete, onAddClick,
  onFolderDelete, onClearAll, onMoveBookmark, onRename, onWidgetReorder,
}: Props) {
  const [confirming, setConfirming]   = useState(false);
  const [editing, setEditing]         = useState(false);
  const [editValue, setEditValue]     = useState(title);
  // bookmark drag-over
  const [bmDragOver, setBmDragOver]   = useState(false);
  // widget drag-over: 'before' | 'after' | null
  const [wDragOver, setWDragOver]     = useState<'before' | 'after' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef  = useRef<HTMLDivElement>(null);

  const canDelete = !!(folderId && onFolderDelete) || !!onClearAll;

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  // ── Rinomina ──────────────────────────────────────────────────────────────
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

  // ── Elimina ───────────────────────────────────────────────────────────────
  function handleDelete() {
    if (!canDelete) return;
    if (!confirming) { setConfirming(true); return; }
    if (folderId && onFolderDelete) onFolderDelete(folderId);
    else if (onClearAll) onClearAll();
    setConfirming(false);
  }

  // ── Drag widget (handle) ─────────────────────────────────────────────────
  function handleWidgetDragStart(e: React.DragEvent) {
    if (!folderId) { e.preventDefault(); return; }
    e.dataTransfer.setData('widgetid', folderId);
    e.dataTransfer.effectAllowed = 'move';
    // Evita che il dragstart del bookmark venga triggerato
    e.stopPropagation();
  }

  // ── DragOver: distingue bookmark da widget ───────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const types = e.dataTransfer.types;

    if (types.includes('widgetid')) {
      // Determina se siamo nella metà alta o bassa del widget
      const rect = cardRef.current?.getBoundingClientRect();
      const pos: 'before' | 'after' = rect && e.clientY < rect.top + rect.height / 2
        ? 'before' : 'after';
      setWDragOver(pos);
      setBmDragOver(false);
    } else if (types.includes('bookmarkid')) {
      e.dataTransfer.dropEffect = 'move';
      setBmDragOver(true);
      setWDragOver(null);
    }
  }

  function handleDragLeave() {
    setBmDragOver(false);
    setWDragOver(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setBmDragOver(false);
    const draggedWidgetId = e.dataTransfer.getData('widgetid');
    const bookmarkId      = e.dataTransfer.getData('bookmarkid');

    if (draggedWidgetId && folderId && draggedWidgetId !== folderId && onWidgetReorder) {
      onWidgetReorder(draggedWidgetId, folderId, wDragOver ?? 'before');
    } else if (bookmarkId && onMoveBookmark) {
      if (!bookmarks.some((b) => b.id === bookmarkId)) {
        onMoveBookmark(bookmarkId, folderId ?? null);
      }
    }
    setWDragOver(null);
  }

  // ── Stili bordo indicatore posizione ─────────────────────────────────────
  const outlineStyle: React.CSSProperties = bmDragOver
    ? { outline: '2px solid #3a7bd5', outlineOffset: -2 }
    : wDragOver === 'before'
      ? { borderTop: '3px solid #f59e0b' }
      : wDragOver === 'after'
        ? { borderBottom: '3px solid #f59e0b' }
        : {};

  return (
    <div
      ref={cardRef}
      className="widget-card"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={outlineStyle}
    >
      <div className="widget-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Impugnatura drag widget */}
        {folderId && (
          <span
            draggable
            onDragStart={handleWidgetDragStart}
            title="Trascina per riordinare"
            style={{ cursor: 'grab', color: '#555', fontSize: 14, marginRight: 6, userSelect: 'none', flexShrink: 0 }}
          >
            ⠿
          </span>
        )}

        {/* Titolo */}
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, background: '#222', border: '1px solid #3a7bd5',
              borderRadius: 3, color: '#eee', fontSize: 12, fontWeight: 600, padding: '1px 6px',
            }}
          />
        ) : (
          <span
            onDoubleClick={startEdit}
            title={folderId && onRename ? 'Doppio click per rinominare' : undefined}
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
