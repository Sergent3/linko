'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
}

export default function BookmarkListItem({ bookmark, onDelete, onRename }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(bookmark.title || bookmark.url);
  const inputRef = useRef<HTMLInputElement>(null);

  const label = bookmark.title || bookmark.url;

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function startEdit() {
    if (!onRename) return;
    setEditValue(label);
    setEditing(true);
  }

  function commitEdit() {
    const name = editValue.trim();
    if (name && name !== label && onRename) onRename(bookmark.id, name);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  }

  const domain = (() => {
    try { return new URL(bookmark.url).hostname; }
    catch { return ''; }
  })();

  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';

  const favicon = !imgFailed && faviconUrl ? (
    <img src={faviconUrl} alt="" width={16} height={16} loading="lazy" className="favicon" onError={() => setImgFailed(true)} />
  ) : (
    <span className="favicon favicon-fallback" aria-hidden="true" />
  );

  function handleDragStart(e: React.DragEvent) {
    if (editing) { e.preventDefault(); return; }
    e.dataTransfer.setData('bookmarkid', bookmark.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  if (editing) {
    return (
      <div className="bookmark-item" style={{ cursor: 'default' }}>
        {favicon}
        <input
          ref={inputRef}
          className="input"
          style={{ height: 26, fontSize: 13, padding: '0 8px' }}
          aria-label="Nuovo titolo del segnalibro"
          name="title"
          autoComplete="off"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  return (
    <div className="bookmark-item" draggable onDragStart={handleDragStart}>
      {favicon}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="bookmark-title"
        title={`${label}\n${bookmark.url}`}
        onDoubleClick={(e) => { if (onRename) { e.preventDefault(); startEdit(); } }}
      >
        {label}
      </a>
      <span className="row-actions">
        {onRename && (
          <button type="button" className="icon-btn icon-btn-sm" onClick={startEdit} aria-label={`Rinomina ${label}`} title="Rinomina">
            <Pencil size={13} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="icon-btn icon-btn-sm icon-btn-danger"
          onClick={() => onDelete(bookmark.id)}
          aria-label={`Sposta nel cestino ${label}`}
          title="Sposta nel cestino"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
