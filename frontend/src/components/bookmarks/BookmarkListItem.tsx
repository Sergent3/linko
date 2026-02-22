'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

export default function BookmarkListItem({ bookmark, onDelete }: Props) {
  const [imgError, setImgError] = useState(false);

  const initial = (() => {
    try { return new URL(bookmark.url).hostname.replace('www.', '')[0]?.toUpperCase() ?? '?'; }
    catch { return '?'; }
  })();

  return (
    <li className="group flex items-center gap-2 px-3 py-[5px] hover:bg-zinc-800/60 rounded-md transition-colors mx-1">
      {/* Favicon */}
      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
        {bookmark.favicon && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bookmark.favicon}
            alt=""
            className="w-4 h-4 rounded-sm"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="text-[9px] font-bold text-zinc-600 leading-none">{initial}</span>
        )}
      </div>

      {/* Title */}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 text-[12px] text-zinc-400 hover:text-violet-300 truncate transition-colors leading-snug"
        title={bookmark.title}
      >
        {bookmark.title}
      </a>

      {/* Delete */}
      <button
        onClick={(e) => { e.preventDefault(); onDelete(bookmark.id); }}
        className="shrink-0 p-0.5 rounded text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </li>
  );
}
