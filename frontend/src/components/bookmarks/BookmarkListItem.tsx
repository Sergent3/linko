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
      <div className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors relative">
        <a
          href={bookmark.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center gap-3 min-w-0"
          title={bookmark.title}
        >
          {/* Favicon */}
          <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
            {faviconUrl && !imgFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={faviconUrl}
                alt=""
                width={14}
                height={14}
                className="w-3.5 h-3.5"
                style={{ objectFit: 'contain' }}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            )}
          </div>

          {/* Title */}
          <span className="text-sm text-zinc-300 truncate group-hover:text-white transition-colors">
            {bookmark.title}
          </span>
        </a>

        {/* Delete — fades in on row hover */}
        <button
          onClick={e => { e.preventDefault(); onDelete(bookmark.id); }}
          className="shrink-0 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all duration-150 hover:bg-red-900/50 text-zinc-400 hover:text-red-400 absolute right-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}
