'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
    <li className="item-row group">
      {/* Favicon */}
      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
        {faviconUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={faviconUrl}
            alt=""
            width={16}
            height={16}
            className="w-4 h-4 rounded-sm"
            style={{ objectFit: 'contain' }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-3.5 h-3.5 rounded-sm" style={{ background: 'var(--widget-border)' }} />
        )}
      </div>

      {/* Title */}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="item-link"
        title={bookmark.title}
      >
        {bookmark.title}
      </a>

      {/* Delete — fades in on row hover */}
      <button
        onClick={e => { e.preventDefault(); onDelete(bookmark.id); }}
        className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:text-red-500"
        style={{ color: 'var(--text-muted)' }}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </li>
  );
}
