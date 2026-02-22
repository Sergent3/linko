'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { folders as foldersApi, tags as tagsApi } from '@/lib/api';
import type { Folder as FolderType, Tag as TagType } from '@/types/api';

interface Props {
  activeFolderId?: string;
  activeTagId?: string;
  onFolderSelect: (id: string | undefined) => void;
  onTagSelect: (id: string | undefined) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function FolderRow({ folder, depth, active, onSelect }: {
  folder: FolderType; depth: number; active: boolean;
  onSelect: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = (folder.children?.length ?? 0) > 0;

  return (
    <div>
      <button
        onClick={() => { onSelect(active ? undefined : folder.id); if (hasChildren) setOpen(o => !o); }}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        className={`w-full flex items-center gap-1.5 py-1.5 pr-3 text-[13px] rounded-lg transition-colors ${
          active ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
        }`}
      >
        {hasChildren
          ? <ChevronRight className={`w-3 h-3 shrink-0 text-zinc-700 transition-transform ${open ? 'rotate-90' : ''}`} />
          : <span className="w-3" />}
        <span className="truncate">{folder.name}</span>
        {(folder._count?.bookmarks ?? 0) > 0 && (
          <span className="ml-auto text-[10px] text-zinc-700 tabular-nums">{folder._count!.bookmarks}</span>
        )}
      </button>
      {open && hasChildren && folder.children!.map(c => (
        <FolderRow key={c.id} folder={c} depth={depth + 1}
          active={false} onSelect={onSelect} />
      ))}
    </div>
  );
}

function SidebarContent({ activeFolderId, activeTagId, onFolderSelect, onTagSelect }: Omit<Props, 'mobileOpen' | 'onMobileClose'>) {
  const [folderList, setFolderList] = useState<FolderType[]>([]);
  const [tagList, setTagList] = useState<TagType[]>([]);

  useEffect(() => {
    foldersApi.list().then(setFolderList).catch(() => {});
    tagsApi.list().then(setTagList).catch(() => {});
  }, []);

  const topLevel = folderList.filter(f => !f.parentId);

  const itemClass = (active: boolean) =>
    `w-full flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-lg transition-colors ${
      active ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
    }`;

  return (
    <div className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
      {/* Folders */}
      <div>
        <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-semibold px-3 mb-1">
          Cartelle
        </p>
        <button onClick={() => { onFolderSelect(undefined); onTagSelect(undefined); }}
          className={itemClass(!activeFolderId && !activeTagId)}>
          <span>Tutti</span>
        </button>
        {topLevel.map(f => (
          <FolderRow key={f.id} folder={f} depth={0}
            active={f.id === activeFolderId} onSelect={onFolderSelect} />
        ))}
      </div>

      {/* Tags */}
      {tagList.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-semibold px-3 mb-1">
            Tag
          </p>
          {tagList.map(tag => (
            <button key={tag.id}
              onClick={() => onTagSelect(tag.id === activeTagId ? undefined : tag.id)}
              className={itemClass(tag.id === activeTagId)}
            >
              <span className="text-zinc-700">#</span>
              <span className="truncate">{tag.name}</span>
              {(tag._count?.bookmarks ?? 0) > 0 && (
                <span className="ml-auto text-[10px] text-zinc-700 tabular-nums">{tag._count!.bookmarks}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ mobileOpen, onMobileClose, ...rest }: Props) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-48 shrink-0 flex-col border-r border-white/[0.04]">
        <SidebarContent {...rest} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative z-50 w-56 bg-zinc-950 border-r border-white/[0.05] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Menu</span>
              <button onClick={onMobileClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent {...rest} />
          </aside>
        </div>
      )}
    </>
  );
}
