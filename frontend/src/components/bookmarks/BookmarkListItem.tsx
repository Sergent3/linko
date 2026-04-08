'use client';

import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  function startEdit(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    if (!onRename) return;
    setEditValue(bookmark.title || bookmark.url);
    setEditing(true);
  }

  function commitEdit() {
    const name = editValue.trim();
    if (name && name !== (bookmark.title || bookmark.url) && onRename) {
      onRename(bookmark.id, name);
    }
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

  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : '';

  function handleDragStart(e: React.DragEvent) {
    if (editing) { e.preventDefault(); return; }
    e.dataTransfer.setData('bookmarkId', bookmark.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  if (editing) {
    return (
      <div className="bookmark-item" style={{ cursor: 'default' }}>
        {!imgFailed && faviconUrl ? (
          <img src={faviconUrl} alt="" onError={() => setImgFailed(true)} />
        ) : (
          <div style={{ width: 16, height: 16, marginRight: 8, flexShrink: 0, borderRadius: 2, background: '#555' }} />
        )}
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1, background: '#222', border: '1px solid #3a7bd5',
            borderRadius: 3, color: '#eee', fontSize: 12, padding: '1px 6px',
          }}
        />
      </div>
    );
  }

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bookmark-item group"
      draggable
      onDragStart={handleDragStart}
    >
      {!imgFailed && faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          style={{
            width: 16,
            height: 16,
            marginRight: 8,
            flexShrink: 0,
            borderRadius: 2,
            background: '#555',
          }}
        />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {bookmark.title || bookmark.url}
      </span>
      {onRename && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEdit(e); }}
          title="Rinomina"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '0 2px',
            flexShrink: 0,
            opacity: 0,
            transition: 'opacity 0.15s',
          }}
          className="delete-btn"
        >
          ✎
        </button>
      )}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(bookmark.id); }}
        title="Elimina"
        style={{
          marginLeft: onRename ? 0 : 'auto',
          background: 'none',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          fontSize: '14px',
          padding: '0 0 0 4px',
          flexShrink: 0,
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        className="delete-btn"
      >
        ×
      </button>
    </a>
  );
}
