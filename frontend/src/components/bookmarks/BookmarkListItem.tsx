'use client';

import { useState } from 'react';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

export default function BookmarkListItem({ bookmark, onDelete }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  const domain = (() => {
    try { return new URL(bookmark.url).hostname; }
    catch { return ''; }
  })();

  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : '';

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('bookmarkId', bookmark.id);
    e.dataTransfer.effectAllowed = 'move';
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
      <span>{bookmark.title || bookmark.url}</span>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(bookmark.id); }}
        title="Elimina"
        style={{
          marginLeft: 'auto',
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
