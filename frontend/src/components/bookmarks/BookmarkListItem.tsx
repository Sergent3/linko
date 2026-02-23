'use client';

import { useState } from 'react';
import { Trash2, ExternalLink } from 'lucide-react';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

export default function BookmarkListItem({ bookmark, onDelete }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  const domain = (() => {
    try { return new URL(bookmark.url).hostname; }
    catch { return ''; }
  })();

  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : '';

  return (
    <li className="group">
      <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors relative">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center gap-3 min-w-0"
          title={bookmark.title}
        >
          {/* Favicon */}
          <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
            {faviconUrl && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconUrl}
                alt=""
                width={16}
                height={16}
                className="w-4 h-4"
                style={{ objectFit: 'contain' }}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {/* Title */}
          <span className="text-sm text-slate-700 dark:text-slate-300 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {bookmark.title}
          </span>
        </a>

        {/* Delete — fades in on row hover */}
        <button
          onClick={e => { e.preventDefault(); onDelete(bookmark.id); }}
          className="shrink-0 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 absolute right-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}
