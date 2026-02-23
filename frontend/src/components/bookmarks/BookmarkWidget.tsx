'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import BookmarkListItem from './BookmarkListItem';
import type { Bookmark } from '@/types/api';

interface Props {
  title: string;
  bookmarks: Bookmark[];
  onDelete: (id: string) => void;
}

export default function BookmarkWidget({ title, bookmarks, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <article
      className="break-inside-avoid mb-5 rounded-lg overflow-hidden"
      style={{
        background: 'var(--widget-bg)',
        border: '1px solid var(--widget-border)',
        boxShadow: 'var(--widget-shadow)',
        /* Solid — no backdrop-blur, card feels physical */
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-1.5 border-b transition-colors select-none"
        style={{
          background: 'var(--widget-header-bg)',
          borderColor: 'var(--widget-border)',
        }}
        onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.07)')}
        onMouseLeave={e =>  (e.currentTarget.style.filter = '')}
      >
        <h2
          className="text-[10px] font-bold uppercase tracking-widest truncate text-left"
          style={{ color: 'var(--widget-header-text)' }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--widget-header-text)' }}>
            {bookmarks.length}
          </span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
            style={{ color: 'var(--widget-header-text)' }}
          />
        </div>
      </button>

      {/* Compact list — divided by a hairline */}
      {!collapsed && (
        <ul style={{ borderColor: 'var(--widget-divider)' }}>
          {bookmarks.map(b => (
            <BookmarkListItem key={b.id} bookmark={b} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </article>
  );
}
