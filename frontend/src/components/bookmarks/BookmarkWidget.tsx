'use client';

import { ChevronRight } from 'lucide-react';
import BookmarkListItem from './BookmarkListItem';
import type { Bookmark } from '@/types/api';

interface Props {
  title: string;
  bookmarks: Bookmark[];
  onDelete: (id: string) => void;
}

export default function BookmarkWidget({ title, bookmarks, onDelete }: Props) {
  return (
    <article className="widget-card">
      {/* Header */}
      <header
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ background: 'var(--widget-header-bg)', borderColor: 'var(--widget-border)' }}
      >
        <h2
          className="text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ color: 'var(--widget-header-text)' }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--widget-header-text)' }}>
            {bookmarks.length}
          </span>
          <ChevronRight className="w-3 h-3 opacity-30" style={{ color: 'var(--widget-header-text)' }} />
        </div>
      </header>

      {/* List */}
      <ul className="py-0.5">
        {bookmarks.map(b => (
          <BookmarkListItem key={b.id} bookmark={b} onDelete={onDelete} />
        ))}
      </ul>
    </article>
  );
}
