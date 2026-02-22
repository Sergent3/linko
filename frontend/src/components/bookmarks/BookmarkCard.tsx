'use client';

import { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import TagBadge from './TagBadge';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

// Compact status indicator
const statusDot: Record<string, string> = {
  PENDING:    'bg-amber-400/80 animate-pulse',
  PROCESSING: 'bg-blue-400/80 animate-pulse',
  DONE:       'bg-emerald-400/80',
  FAILED:     'bg-red-400/80',
};

export default function BookmarkCard({ bookmark, onDelete }: Props) {
  const [imgError, setImgError] = useState(false);

  const hostname = (() => {
    try { return new URL(bookmark.url).hostname.replace('www.', ''); }
    catch { return bookmark.url; }
  })();

  const date = new Date(bookmark.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });

  return (
    <article className="group gradient-border bg-zinc-900 border border-white/[0.06] hover:border-white/[0.14] rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-card-hover">
      {/* OG image */}
      {bookmark.imageUrl && !imgError ? (
        <div className="h-36 bg-zinc-800 shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bookmark.imageUrl} alt=""
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        /* Favicon-centered fallback */
        <div className="h-24 bg-zinc-800/50 shrink-0 flex items-center justify-center border-b border-white/[0.04]">
          {bookmark.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bookmark.favicon} alt="" className="w-10 h-10 rounded-xl"
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            <span className="font-display font-bold text-3xl text-zinc-700">
              {hostname[0]?.toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug">
          {bookmark.title}
        </h3>

        {bookmark.description && (
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
            {bookmark.description}
          </p>
        )}

        {bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bookmark.tags.slice(0, 4).map(({ tag, source }) => (
              <TagBadge key={tag.id} name={tag.name} source={source} />
            ))}
            {bookmark.tags.length > 4 && (
              <span className="text-[11px] text-zinc-600">+{bookmark.tags.length - 4}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-2.5 border-t border-white/[0.04] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-600 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[bookmark.enrichStatus]}`} />
            <span className="truncate">{hostname}</span>
            <span className="shrink-0 text-zinc-700">· {date}</span>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer"
              className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button onClick={() => onDelete(bookmark.id)}
              className="p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
