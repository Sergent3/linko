'use client';

import { useState } from 'react';
import BookmarkListItem from './BookmarkListItem';
import type { Bookmark } from '@/types/api';

interface Props {
  title: string;
  bookmarks: Bookmark[];
  onDelete: (id: string) => void;
  onAddClick?: () => void;
}

export default function BookmarkWidget({ title, bookmarks, onDelete, onAddClick }: Props) {
  return (
    <div className="widget-card">
      <div className="widget-card-header">
        <span>{title}</span>
        {onAddClick && (
          <button
            onClick={onAddClick}
            title="Aggiungi segnalibro"
            style={{
              float: 'right',
              background: 'none',
              border: 'none',
              color: '#aaa',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '0 0 0 8px',
            }}
          >
            +
          </button>
        )}
      </div>
      <div className="widget-card-body">
        {bookmarks.length === 0 ? (
          <div style={{ padding: '6px 10px', color: '#888', fontSize: '12px' }}>
            Nessun segnalibro
          </div>
        ) : (
          bookmarks.map((b) => (
            <BookmarkListItem key={b.id} bookmark={b} onDelete={onDelete} />
          ))
        )}
      </div>
    </div>
  );
}
