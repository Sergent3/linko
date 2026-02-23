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
    <div className="break-inside-avoid bg-white dark:bg-[#1E293B] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/50 overflow-hidden flex flex-col mb-6">
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between group bg-slate-50/50 dark:bg-[#0F172A]/50">
        <h2 className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{title}</h2>
        <button className="text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-600 dark:hover:text-slate-300 transition-all">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Widget Content (Bookmarks) */}
      <div className="p-2 flex-1">
        <ul className="space-y-0.5">
          {bookmarks.map(b => (
            <BookmarkListItem key={b.id} bookmark={b} onDelete={onDelete} />
          ))}
        </ul>
      </div>

      {/* Widget Footer */}
      <div className="px-4 py-2 border-t border-slate-50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#0F172A]/50">
        <button className="text-xs font-medium text-slate-500 dark:text:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors">
          <Plus className="w-3 h-3" />
          Aggiungi segnalibro
        </button>
      </div>
    </div>
  );
}
