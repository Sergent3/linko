'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
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
const OPEN_PREFIX = 'linko_widget_open_';

function readStorage<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage non disponibile */ }
}

export default function BookmarkWidget({
  title, folderId, bookmarks, onDelete, onAddClick,
  onFolderDelete, onClearAll, onMoveBookmark, onRename, onRenameBookmark, onWidgetReorder,
}: Props) {
  const key = folderId ?? 'null';
  const [editing, setEditing]         = useState(false);
  const [editValue, setEditValue]     = useState(title);
  // Le cartelle partono chiuse; lo stato aperto/chiuso viene ricordato
  const [open, setOpen]               = useState(false);
  const [bmDragOver, setBmDragOver]   = useState(false);
  const [wDragOver, setWDragOver]     = useState<'before' | 'after' | null>(null);
  const [itemDragTarget, setItemDragTarget] = useState<{ id: string; pos: 'before' | 'after' } | null>(null);
  const [bmItemOrder, setBmItemOrder] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef  = useRef<HTMLDivElement>(null);
  const bodyId   = `widget-body-${key}`;

  const canDelete = !!(folderId && onFolderDelete) || !!onClearAll;

  useEffect(() => {
    setOpen(readStorage(OPEN_PREFIX + key, false));
    setBmItemOrder(readStorage<string[]>(BM_ORDER_PREFIX + key, []));
  }, [key]);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function toggleOpen() {
    setOpen((o) => { writeStorage(OPEN_PREFIX + key, !o); return !o; });
  }

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

  // ── Elimina (la conferma è gestita dalla pagina) ──────────────────────────
  function handleDelete() {
    if (folderId && onFolderDelete) onFolderDelete(folderId);
    else if (onClearAll) onClearAll();
  }

  // ── Drag widget (maniglia) ────────────────────────────────────────────────
  function handleWidgetDragStart(e: React.DragEvent) {
    if (!folderId) { e.preventDefault(); return; }
    e.dataTransfer.setData('widgetid', folderId);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }

  // ── DragOver del widget (riordino widget + spostamento tra cartelle) ──────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const types = e.dataTransfer.types;
    if (types.includes('widgetid')) {
      const rect = cardRef.current?.getBoundingClientRect();
      setWDragOver(rect && e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
      setBmDragOver(false);
    } else if (types.includes('bookmarkid')) {
      e.dataTransfer.dropEffect = 'move';
      setBmDragOver(true);
      setWDragOver(null);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
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
    } else if (bookmarkId && onMoveBookmark && !bookmarks.some((b) => b.id === bookmarkId)) {
      onMoveBookmark(bookmarkId, folderId ?? null);
    }
    setWDragOver(null);
  }

  // ── Drag dei singoli segnalibri (riordino interno) ────────────────────────
  function handleItemDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setItemDragTarget({ id: targetId, pos: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after' });
    setBmDragOver(false);
  }

  function handleItemDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setItemDragTarget(null);
  }

  function handleItemDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('bookmarkid');
    if (!draggedId || draggedId === targetId) { setItemDragTarget(null); return; }

    if (bookmarks.some((b) => b.id === draggedId)) {
      setBmItemOrder((prev) => {
        const allIds = bookmarks.map((b) => b.id);
        const current = [...prev.filter((id) => allIds.includes(id)), ...allIds.filter((id) => !prev.includes(id))];
        const order = current.filter((id) => id !== draggedId);
        const idx = order.indexOf(targetId);
        const insertAt = (itemDragTarget?.pos ?? 'after') === 'before' ? idx : idx + 1;
        order.splice(insertAt < 0 ? order.length : insertAt, 0, draggedId);
        writeStorage(BM_ORDER_PREFIX + key, order);
        return order;
      });
    } else if (onMoveBookmark) {
      onMoveBookmark(draggedId, folderId ?? null);
    }
    setItemDragTarget(null);
  }

  // ── Indicatori di trascinamento ───────────────────────────────────────────
  const dropStyle: React.CSSProperties = bmDragOver
    ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' }
    : wDragOver === 'before'
      ? { boxShadow: '0 -3px 0 0 var(--accent)' }
      : wDragOver === 'after'
        ? { boxShadow: '0 3px 0 0 var(--accent)' }
        : {};

  return (
    <section
      ref={cardRef}
      className="widget-card"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={dropStyle}
      aria-label={title}
    >
      <div className="widget-card-header">
        {folderId && (
          <span
            draggable
            onDragStart={handleWidgetDragStart}
            title="Trascina per riordinare"
            aria-hidden="true"
            style={{ cursor: 'grab', color: 'var(--text-faint)', display: 'flex', flexShrink: 0 }}
          >
            <GripVertical size={14} />
          </span>
        )}

        {editing ? (
          <input
            ref={inputRef}
            className="input"
            style={{ height: 28, fontSize: 13, fontWeight: 600, padding: '0 8px', flex: 1 }}
            aria-label="Nuovo nome della cartella"
            name="folder-name"
            autoComplete="off"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <button
            type="button"
            onClick={toggleOpen}
            onDoubleClick={startEdit}
            aria-expanded={open}
            aria-controls={bodyId}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left rounded-md px-1 py-1 hover:text-white"
            style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
          >
            <ChevronRight
              size={14}
              aria-hidden="true"
              style={{ flexShrink: 0, color: 'var(--text-faint)', transition: 'transform 0.15s ease', transform: open ? 'rotate(90deg)' : 'none' }}
            />
            <span className="truncate">{title}</span>
            <span className="badge badge-soft" style={{ marginLeft: 2 }}>{bookmarks.length}</span>
          </button>
        )}

        {!editing && (
          <span className="row-actions">
            {folderId && onRename && (
              <button type="button" className="icon-btn icon-btn-sm" onClick={startEdit} aria-label={`Rinomina cartella ${title}`} title="Rinomina">
                <Pencil size={13} aria-hidden="true" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="icon-btn icon-btn-sm icon-btn-danger"
                onClick={handleDelete}
                aria-label={folderId ? `Elimina cartella ${title}` : 'Sposta tutti nel cestino'}
                title={folderId ? 'Elimina cartella' : 'Sposta tutti nel cestino'}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            )}
          </span>
        )}
        {onAddClick && !editing && (
          <button type="button" className="icon-btn icon-btn-sm" onClick={onAddClick} aria-label="Aggiungi segnalibro" title="Aggiungi segnalibro">
            <Plus size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div className="widget-card-body" id={bodyId}>
          {sortedBookmarks.length === 0 ? (
            <p style={{ padding: '8px 12px', color: 'var(--text-faint)', fontSize: 12 }}>Nessun segnalibro</p>
          ) : (
            sortedBookmarks.map((b) => (
              <div
                key={b.id}
                onDragOver={(e) => handleItemDragOver(e, b.id)}
                onDragLeave={handleItemDragLeave}
                onDrop={(e) => handleItemDrop(e, b.id)}
                style={itemDragTarget?.id === b.id ? {
                  boxShadow: itemDragTarget.pos === 'before' ? 'inset 0 2px 0 var(--accent)' : 'inset 0 -2px 0 var(--accent)',
                } : undefined}
              >
                <BookmarkListItem bookmark={b} onDelete={onDelete} onRename={onRenameBookmark} />
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
