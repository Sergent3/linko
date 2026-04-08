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
  onRenameBookmark?: (id: string, newTitle: string) => void;
  onWidgetReorder?: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
}

const BM_ORDER_PREFIX = 'linko_bm_order_';
function loadBmOrder(fid?: string): string[] {
  try { return JSON.parse(localStorage.getItem(BM_ORDER_PREFIX + (fid ?? 'null')) ?? '[]'); }
  catch { return []; }
}
function saveBmOrder(fid: string | undefined, ids: string[]) {
  localStorage.setItem(BM_ORDER_PREFIX + (fid ?? 'null'), JSON.stringify(ids));
}

export default function BookmarkWidget({
  title, folderId, bookmarks, onDelete, onAddClick,
  onFolderDelete, onClearAll, onMoveBookmark, onRename, onRenameBookmark, onWidgetReorder,
}: Props) {
  const [confirming, setConfirming]   = useState(false);
  const [editing, setEditing]         = useState(false);
  const [editValue, setEditValue]     = useState(title);
  const [collapsed, setCollapsed]     = useState(true);
  // bookmark drag-over (widget level, for cross-widget moves)
  const [bmDragOver, setBmDragOver]   = useState(false);
  // widget drag-over: 'before' | 'after' | null
  const [wDragOver, setWDragOver]     = useState<'before' | 'after' | null>(null);
  // item-level drag target for intra-widget reorder
  const [itemDragTarget, setItemDragTarget] = useState<{ id: string; pos: 'before' | 'after' } | null>(null);
  // per-folder bookmark order (localStorage)
  const [bmItemOrder, setBmItemOrder] = useState<string[]>(() => loadBmOrder(folderId));

  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef  = useRef<HTMLDivElement>(null);

  const canDelete = !!(folderId && onFolderDelete) || !!onClearAll;

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  // Sync order when bookmarks list changes (new items go to end)
  useEffect(() => {
    const allIds = bookmarks.map((b) => b.id);
    setBmItemOrder((prev) => {
      const merged = [
        ...prev.filter((id) => allIds.includes(id)),
        ...allIds.filter((id) => !prev.includes(id)),
      ];
      return merged;
    });
  }, [bookmarks]);

  const sortedBookmarks = [...bookmarks].sort((a, b) => {
    const ai = bmItemOrder.indexOf(a.id);
    const bi = bmItemOrder.indexOf(b.id);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

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
    e.stopPropagation();
  }

  // ── Widget-level DragOver (widget reorder + cross-widget bookmark move) ──
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const types = e.dataTransfer.types;

    if (types.includes('widgetid')) {
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
      // Cross-widget move only (intra-widget handled at item level)
      if (!bookmarks.some((b) => b.id === bookmarkId)) {
        onMoveBookmark(bookmarkId, folderId ?? null);
      }
    }
    setWDragOver(null);
  }

  // ── Item-level drag handlers (intra-widget reorder) ───────────────────────
  function handleItemDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setItemDragTarget({ id: targetId, pos });
    setBmDragOver(false);
  }

  function handleItemDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setItemDragTarget(null);
    }
  }

  function handleItemDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('bookmarkid');
    if (!draggedId || draggedId === targetId) { setItemDragTarget(null); return; }

    const isInSameWidget = bookmarks.some((b) => b.id === draggedId);

    if (isInSameWidget) {
      // Reorder within this widget
      setBmItemOrder((prev) => {
        const allIds = bookmarks.map((b) => b.id);
        const current = [
          ...prev.filter((id) => allIds.includes(id)),
          ...allIds.filter((id) => !prev.includes(id)),
        ];
        const order = current.filter((id) => id !== draggedId);
        const idx = order.indexOf(targetId);
        const pos = itemDragTarget?.pos ?? 'after';
        const insertAt = pos === 'before' ? idx : idx + 1;
        order.splice(insertAt < 0 ? order.length : insertAt, 0, draggedId);
        saveBmOrder(folderId, order);
        return [...order];
      });
    } else if (onMoveBookmark) {
      onMoveBookmark(draggedId, folderId ?? null);
    }
    setItemDragTarget(null);
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

        {/* Toggle chevron */}
        <button onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Espandi" : "Riduci"} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'transform 0.2s', transform: collapsed ? 'rotate(-90deg)' : 'none', marginRight: 4, flexShrink: 0, padding: 2 }}>
          ▼
        </button>

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

      {!collapsed && (
        <div className="widget-card-body">
          {sortedBookmarks.length === 0 ? (
            <div style={{ padding: '8px 14px', color: '#888', fontSize: '12px' }}>Nessun segnalibro</div>
          ) : (
            sortedBookmarks.map((b) => (
              <div
                key={b.id}
                onDragOver={(e) => handleItemDragOver(e, b.id)}
                onDragLeave={handleItemDragLeave}
                onDrop={(e) => handleItemDrop(e, b.id)}
                style={itemDragTarget?.id === b.id ? {
                  borderTop: itemDragTarget.pos === 'before' ? '2px solid #3a7bd5' : undefined,
                  borderBottom: itemDragTarget.pos === 'after' ? '2px solid #3a7bd5' : undefined,
                } : undefined}
              >
                <BookmarkListItem bookmark={b} onDelete={onDelete} onRename={onRenameBookmark} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
