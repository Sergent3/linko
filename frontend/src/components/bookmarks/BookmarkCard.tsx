'use client';

import { useState } from 'react';
import { ExternalLink, Trash2, Globe } from 'lucide-react';
import TagBadge from './TagBadge';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

const statusDot: Record<string, string> = {
  PENDING: 'bg-amber-400 animate-pulse',
  PROCESSING: 'bg-blue-400 animate-pulse',
  DONE: 'bg-emerald-400',
  FAILED: 'bg-red-400',
};

// Generates a deterministic gradient from the URL/hostname
function getDomainColor(hostname: string) {
  const colors = [
    'from-violet-600/30 to-purple-800/20',
    'from-indigo-600/30 to-blue-800/20',
    'from-fuchsia-600/30 to-pink-800/20',
    'from-cyan-600/30 to-teal-800/20',
    'from-emerald-600/30 to-green-800/20',
    'from-orange-600/30 to-amber-800/20',
  ];
  let hash = 0;
  for (const c of hostname) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffff;
  return colors[hash % colors.length];
}

export default function BookmarkCard({ bookmark, onDelete }: Props) {
  const [imgError, setImgError] = useState(false);

  const hostname = (() => {
    try {
      return new URL(bookmark.url).hostname.replace('www.', '');
    } catch {
      return bookmark.url;
    }
  })();

  const letter = hostname[0]?.toUpperCase() ?? '?';

  const date = new Date(bookmark.createdAt).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
  });

  const gradientClass = getDomainColor(hostname);

  return (
    <article className="group relative bg-[#14141f] border border-zinc-800/60 rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:border-violet-500/30 hover:shadow-card-hover hover:-translate-y-0.5">
      {/* Image / Placeholder */}
      {bookmark.imageUrl && !imgError ? (
        <div className="h-36 bg-zinc-900 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bookmark.imageUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className={`h-36 bg-gradient-to-br ${gradientClass} flex items-center justify-center shrink-0`}>
          <div className="w-12 h-12 bg-zinc-800/80 border border-zinc-700/50 rounded-2xl flex items-center justify-center">
            <span className="text-xl font-bold text-zinc-400">{letter}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col gap-2 flex-1 min-h-0">
        {/* Header: favicon + title + status */}
        <div className="flex items-start gap-2">
          {bookmark.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bookmark.favicon}
              alt=""
              className="w-4 h-4 mt-0.5 shrink-0 rounded"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : (
            <Globe className="w-4 h-4 mt-0.5 shrink-0 text-zinc-600" />
          )}
          <h3 className="text-sm font-medium text-zinc-100 line-clamp-2 flex-1 leading-snug">
            {bookmark.title}
          </h3>
          <span
            className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[bookmark.enrichStatus]}`}
            title={bookmark.enrichStatus}
          />
        </div>

        {/* Description */}
        {bookmark.description && (
          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
            {bookmark.description}
          </p>
        )}

        {/* Tags */}
        {bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bookmark.tags.slice(0, 4).map(({ tag, source }) => (
              <TagBadge key={tag.id} name={tag.name} source={source} />
            ))}
            {bookmark.tags.length > 4 && (
              <span className="text-[11px] text-zinc-600 px-1">
                +{bookmark.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-2 flex items-center justify-between border-t border-zinc-800/50">
          <div className="flex items-center gap-1 text-[11px] text-zinc-600 min-w-0">
            <span className="truncate font-medium">{hostname}</span>
            <span className="shrink-0">· {date}</span>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-zinc-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
              title="Apri"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => onDelete(bookmark.id)}
              className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Elimina"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
