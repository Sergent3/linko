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
    <article className="bg-zinc-900 border border-white/[0.06] rounded-xl overflow-hidden break-inside-avoid mb-4">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-2.5 border-b border-white/[0.04] hover:bg-zinc-800/50 transition-colors"
      >
        <h2 className="text-[11px] font-semibold text-zinc-200 uppercase tracking-wider truncate text-left">
          {title}
        </h2>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className="text-[10px] text-zinc-600 tabular-nums">{bookmarks.length}</span>
          <ChevronDown
            className={`w-3 h-3 text-zinc-600 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
          />
        </div>
      </button>

      {/* List */}
      {!collapsed && (
        <ul className="py-1">
          {bookmarks.map(b => (
            <BookmarkListItem key={b.id} bookmark={b} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </article>
  );
}
