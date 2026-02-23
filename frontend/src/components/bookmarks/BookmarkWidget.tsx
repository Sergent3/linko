'use client';

import { MoreVertical, Plus } from 'lucide-react';
import BookmarkListItem from './BookmarkListItem';
import type { Bookmark } from '@/types/api';

interface Props {
  title: string;
  bookmarks: Bookmark[];
  onDelete: (id: string) => void;
}

export default function BookmarkWidget({ title, bookmarks, onDelete }: Props) {
  return (
    <div className="widget-card flex flex-col h-96">
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-zinc-200/5 dark:border-white/5 flex items-center justify-between flex-shrink-0">
        <h2 className="font-semibold text-sm">{title}</h2>
        <button className="text-zinc-400 hover:text-white transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Widget Content (Bookmarks) */}
      <div className="p-2 flex-1 overflow-y-auto">
        <ul className="space-y-0.5">
          {bookmarks.map(b => (
            <BookmarkListItem key={b.id} bookmark={b} onDelete={onDelete} />
          ))}
        </ul>
      </div>

      {/* Widget Footer */}
      <div className="px-4 py-2 border-t border-zinc-200/5 dark:border-white/5 flex-shrink-0">
        <button className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
          <Plus className="w-3 h-3" />
          Aggiungi segnalibro
        </button>
      </div>
    </div>
  );
}
