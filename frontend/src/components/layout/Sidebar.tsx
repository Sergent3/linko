'use client';

import { useEffect, useState } from 'react';
import { Folder, FolderOpen, Tag, Hash, ChevronRight } from 'lucide-react';
import { folders as foldersApi, tags as tagsApi } from '@/lib/api';
import type { Folder as FolderType, Tag as TagType } from '@/types/api';

interface Props {
  activeFolderId?: string;
  activeTagId?: string;
  onFolderSelect: (id: string | undefined) => void;
  onTagSelect: (id: string | undefined) => void;
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
        style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
        className={`w-full flex items-center gap-1.5 py-1.5 pr-3 text-sm rounded-lg text-left transition-colors ${
          isActive
            ? 'bg-slate-100 text-slate-900 font-medium'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        {hasChildren ? (
          <ChevronRight
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-3.5" />
        )}
        {isActive ? (
          <FolderOpen className="w-4 h-4 shrink-0 text-slate-600" />
        ) : (
          <Folder className="w-4 h-4 shrink-0" />
        )}
        <span className="truncate">{folder.name}</span>
        {folder._count?.bookmarks != null && folder._count.bookmarks > 0 && (
          <span className="ml-auto text-xs text-gray-400">
            {folder._count.bookmarks}
          </span>
        )}
      </button>
      {open && hasChildren && (
        <div>
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
}: Props) {
  const [folderList, setFolderList] = useState<FolderType[]>([]);
  const [tagList, setTagList] = useState<TagType[]>([]);

  useEffect(() => {
    foldersApi.list().then(setFolderList).catch(() => {});
    tagsApi.list().then(setTagList).catch(() => {});
  }, []);

  const topLevel = folderList.filter((f) => !f.parentId);

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-2 flex flex-col gap-4">
      {/* Folders */}
      <section>
        <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Cartelle
        </p>
        <button
          onClick={() => onFolderSelect(undefined)}
          className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-left transition-colors ${
            !activeFolderId
              ? 'bg-slate-100 text-slate-900 font-medium'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Folder className="w-4 h-4" />
          Tutti
        </button>
        {topLevel.map((f) => (
          <FolderItem
            key={f.id}
            folder={f}
            depth={0}
            activeFolderId={activeFolderId}
            onSelect={onFolderSelect}
          />
        ))}
      </section>

      {/* Tags */}
      {tagList.length > 0 && (
        <section>
          <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Tag
          </p>
          <div className="flex flex-col gap-0.5">
            {tagList.map((tag) => {
              const isActive = tag.id === activeTagId;
              return (
                <button
                  key={tag.id}
                  onClick={() => onTagSelect(isActive ? undefined : tag.id)}
                  className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {tag.source === 'MANUAL' ? (
                    <Tag className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <Hash className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{tag.name}</span>
                  {tag._count?.bookmarks != null && tag._count.bookmarks > 0 && (
                    <span className="ml-auto text-xs text-gray-400">
                      {tag._count.bookmarks}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </aside>
  );
}
