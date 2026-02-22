'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import BookmarkWidget from '@/components/bookmarks/BookmarkWidget';
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import type { Bookmark, Folder } from '@/types/api';

export default function BookmarksPage() {
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [folderList, setFolderList] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, fList] = await Promise.all([
        bookmarksApi.list({ page: 1, limit: 500 }),
        foldersApi.list(),
      ]);
      setAllBookmarks(bRes.data);
      setFolderList(fList);
    } catch {
      /* silent fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSearchChange(value: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(value), 300);
  }

  async function handleDelete(id: string) {
    await bookmarksApi.delete(id);
    setAllBookmarks(prev => prev.filter(b => b.id !== id));
  }

  function handleCreated(b: Bookmark) {
    setAllBookmarks(prev => [b, ...prev]);
  }

  // Filter by search
  const filtered = search
    ? allBookmarks.filter(b =>
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.url.toLowerCase().includes(search.toLowerCase())
      )
    : allBookmarks;

  // Build folder name map (flat, includes nested)
  const folderNameMap = new Map<string, string>();
  function flattenFolders(list: Folder[], prefix = '') {
    list.forEach(f => {
      folderNameMap.set(f.id, prefix ? `${prefix} / ${f.name}` : f.name);
      if (f.children?.length) flattenFolders(f.children, f.name);
    });
  }
  flattenFolders(folderList);

  // Group bookmarks by folderId
  const grouped = new Map<string | null, Bookmark[]>();
  filtered.forEach(b => {
    const key = b.folderId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  });

  // Sort: folders first (in folderList order), uncategorized last
  const folderOrder = folderList.map(f => f.id);
  const groups: Array<{ key: string | null; name: string; bookmarks: Bookmark[] }> = [];

  // Add in folder order
  folderOrder.forEach(id => {
    if (grouped.has(id)) {
      groups.push({ key: id, name: folderNameMap.get(id) ?? id, bookmarks: grouped.get(id)! });
    }
  });

  // Add uncategorized
  if (grouped.has(null) && (grouped.get(null)?.length ?? 0) > 0) {
    groups.push({ key: null, name: 'Senza cartella', bookmarks: grouped.get(null)! });
  }

  // Any folders referenced in bookmarks but not in folderList (edge case)
  grouped.forEach((bmarks, key) => {
    if (key !== null && !folderOrder.includes(key)) {
      groups.push({ key, name: folderNameMap.get(key) ?? key, bookmarks: bmarks });
    }
  });

  const totalVisible = filtered.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05] bg-zinc-950/80 backdrop-blur-sm shrink-0">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="search"
            placeholder="Cerca in tutti i segnalibri…"
            onChange={e => handleSearchChange(e.target.value)}
            className="input pl-9 py-2"
          />
        </div>

        {/* Count */}
        <span className="hidden sm:block ml-auto text-xs text-zinc-600">
          {totalVisible} {totalVisible === 1 ? 'segnalibro' : 'segnalibri'}
        </span>

        {/* Add */}
        <button onClick={() => setShowAdd(true)} className="btn-primary shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:block">Aggiungi</span>
        </button>
      </div>

      {/* Widget grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-14 h-14 bg-zinc-900 border border-white/[0.06] rounded-2xl flex items-center justify-center">
              <Search className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">
              {search ? 'Nessun risultato' : 'Nessun segnalibro — aggiungine uno!'}
            </p>
            {!search && (
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                + Aggiungi il primo segnalibro
              </button>
            )}
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
            {groups.map(g => (
              <BookmarkWidget
                key={g.key ?? '__uncategorized__'}
                title={g.name}
                bookmarks={g.bookmarks}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddBookmarkModal
          folders={folderList}
          onClose={() => setShowAdd(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
