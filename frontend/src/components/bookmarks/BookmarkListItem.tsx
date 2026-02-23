'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
}

/** Always uses Google Favicon Service (sz=32) as the definitive source. */
function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  const src = (() => {
    try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; }
    catch { return ''; }
  })();

  if (!src || failed) {
    return <div className="w-4 h-4 rounded-sm" style={{ background: 'var(--widget-divider)' }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      className="w-4 h-4 rounded-sm"
      style={{ objectFit: 'contain' }}
      onError={() => setFailed(true)}
    />
  );
}

export default function BookmarkListItem({ bookmark, onDelete }: Props) {
  return (
    <li className="item-row group border-b" style={{ borderColor: 'var(--widget-divider)' }}>
      {/* Favicon */}
      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
        <Favicon url={bookmark.url} />
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
        className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100
                   transition-opacity duration-150 hover:text-red-400"
        style={{ color: 'var(--widget-header-text)' }}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </li>
  );
}
