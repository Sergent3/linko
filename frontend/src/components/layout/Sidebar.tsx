'use client';

import { useEffect, useState } from 'react';
import { Folder, FolderOpen, Hash, ChevronRight, Layers } from 'lucide-react';
import { folders as foldersApi, tags as tagsApi } from '@/lib/api';
import type { Folder as FolderType, Tag as TagType } from '@/types/api';

interface Props {
  activeFolderId?: string;
  activeTagId?: string;
  onFolderSelect: (id: string | undefined) => void;
  onTagSelect: (id: string | undefined) => void;
  open?: boolean;
  onClose?: () => void;
}

function FolderItem({
  folder,
  depth,
  activeFolderId,
  onSelect,
}: {
  folder: FolderType;
  depth: number;
  activeFolderId?: string;
  onSelect: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = (folder.children?.length ?? 0) > 0;
  const isActive = folder.id === activeFolderId;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(isActive ? undefined : folder.id);
          if (hasChildren) setOpen((o) => !o);
        }}
        style={{ paddingLeft: `${0.75 + depth * 0.875}rem` }}
        className={`w-full flex items-center gap-1.5 py-1.5 pr-3 text-sm rounded-lg text-left transition-all ${
          isActive
            ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
            : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 border border-transparent'
        }`}
      >
        {hasChildren ? (
          <ChevronRight
            className={`w-3.5 h-3.5 shrink-0 transition-transform text-zinc-600 ${open ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-3.5" />
        )}
        {isActive ? (
          <FolderOpen className="w-4 h-4 shrink-0 text-violet-400" />
        ) : (
          <Folder className="w-4 h-4 shrink-0 text-zinc-500" />
        )}
        <span className="truncate">{folder.name}</span>
        {(folder._count?.bookmarks ?? 0) > 0 && (
          <span className="ml-auto text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
            {folder._count!.bookmarks}
          </span>
        )}
      </button>
      {open && hasChildren && (
        <div className="mt-0.5">
          {folder.children!.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  activeFolderId,
  activeTagId,
  onFolderSelect,
  onTagSelect,
  open = true,
  onClose,
}: Props) {
  const [folderList, setFolderList] = useState<FolderType[]>([]);
  const [tagList, setTagList] = useState<TagType[]>([]);

  useEffect(() => {
    foldersApi.list().then(setFolderList).catch(() => {});
    tagsApi.list().then(setTagList).catch(() => {});
  }, []);

  const topLevel = folderList.filter((f) => !f.parentId);

  const sidebarContent = (
    <div className="h-full flex flex-col overflow-y-auto p-2 gap-4">
      {/* Folders */}
      <section>
        <p className="px-3 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">
          Cartelle
        </p>

        {/* All bookmarks */}
        <button
          onClick={() => { onFolderSelect(undefined); onTagSelect(undefined); }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-left transition-all ${
            !activeFolderId && !activeTagId
              ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
              : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 border border-transparent'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0 text-zinc-500" />
          <span>Tutti</span>
        </button>

        <div className="mt-0.5 flex flex-col gap-0.5">
          {topLevel.map((f) => (
            <FolderItem
              key={f.id}
              folder={f}
              depth={0}
              activeFolderId={activeFolderId}
              onSelect={onFolderSelect}
            />
          ))}
        </div>
      </section>

      {/* Tags */}
      {tagList.length > 0 && (
        <section>
          <p className="px-3 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">
            Tag
          </p>
          <div className="flex flex-col gap-0.5">
            {tagList.map((tag) => {
              const isActive = tag.id === activeTagId;
              return (
                <button
                  key={tag.id}
                  onClick={() => onTagSelect(isActive ? undefined : tag.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg text-left transition-all ${
                    isActive
                      ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5 shrink-0 text-zinc-600" />
                  <span className="truncate">{tag.name}</span>
                  {(tag._count?.bookmarks ?? 0) > 0 && (
                    <span className="ml-auto text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                      {tag._count!.bookmarks}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-white/[0.05] bg-[#0c0c15]">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative z-50 w-64 bg-[#0c0c15] border-r border-white/[0.05] flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
