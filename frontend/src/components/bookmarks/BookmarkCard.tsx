'use client';

import { useState } from 'react';
import { ExternalLink, Trash2, Globe, Clock } from 'lucide-react';
import TagBadge from './TagBadge';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

const statusColors = {
  PENDING: 'bg-yellow-400',
  PROCESSING: 'bg-blue-400 animate-pulse',
  DONE: 'bg-green-400',
  FAILED: 'bg-red-400',
};

export default function BookmarkCard({ bookmark, onDelete }: Props) {
  const [imgError, setImgError] = useState(false);
  const hostname = (() => {
    try {
      return new URL(bookmark.url).hostname.replace('www.', '');
    } catch {
      return bookmark.url;
    }
  })();

  const date = new Date(bookmark.createdAt).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
      {/* OG image */}
      {bookmark.imageUrl && !imgError ? (
        <div className="h-36 bg-gray-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bookmark.imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
      ) : (
        <div className="h-36 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
          <Globe className="w-8 h-8 text-gray-300" />
        </div>
      )}

      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Title & enrich status */}
        <div className="flex items-start gap-2">
          {bookmark.favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bookmark.favicon}
              alt=""
              className="w-4 h-4 mt-0.5 shrink-0 rounded-sm"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          )}
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1 leading-snug">
            {bookmark.title}
          </h3>
          <span
            className={`mt-1 w-2 h-2 rounded-full shrink-0 ${statusColors[bookmark.enrichStatus]}`}
            title={bookmark.enrichStatus}
          />
        </div>

        {/* Description */}
        {bookmark.description && (
          <p className="text-xs text-gray-500 line-clamp-2">
            {bookmark.description}
          </p>
        )}

        {/* Tags */}
        {bookmark.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bookmark.tags.slice(0, 5).map(({ tag, source }) => (
              <TagBadge key={tag.id} name={tag.name} source={source} />
            ))}
            {bookmark.tags.length > 5 && (
              <span className="text-xs text-gray-400">
                +{bookmark.tags.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs text-gray-400 min-w-0">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate">{hostname}</span>
            <span>·</span>
            <span className="shrink-0">{date}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a
              href={bookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-gray-400 hover:text-gray-700 rounded transition-colors"
              title="Apri"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => onDelete(bookmark.id)}
              className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
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
