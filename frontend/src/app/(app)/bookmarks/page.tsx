'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import BookmarkWidget from '@/components/bookmarks/BookmarkWidget';
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import { useSearch } from '@/contexts/SearchContext';
import type { Bookmark, Folder } from '@/types/api';

export default function BookmarksPage() {
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [folderList, setFolderList]     = useState<Folder[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showAdd, setShowAdd]           = useState(false);

  // Search comes from Navbar via SearchContext
  const { search } = useSearch();

  /* ── Data loading ──────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, fList] = await Promise.all([
        bookmarksApi.list({ page: 1, limit: 500 }),
        foldersApi.list(),
      ]);
      setAllBookmarks(bRes.data);
      setFolderList(fList);
    } catch { /* silent fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Handlers ──────────────────────────────────────────────────────────── */
  async function handleDelete(id: string) {
    await bookmarksApi.delete(id);
    setAllBookmarks(prev => prev.filter(b => b.id !== id));
  }

  function handleCreated(b: Bookmark) {
    setAllBookmarks(prev => [b, ...prev]);
  }

  /* ── Filter & group ────────────────────────────────────────────────────── */
  const q = search.toLowerCase();
  const filtered = q
    ? allBookmarks.filter(b =>
        b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q))
    : allBookmarks;

  const folderNameMap = new Map<string, string>();
  function flattenFolders(list: Folder[], prefix = '') {
    list.forEach(f => {
      folderNameMap.set(f.id, prefix ? `${prefix} / ${f.name}` : f.name);
      if (f.children?.length) flattenFolders(f.children, f.name);
    });
  }
  flattenFolders(folderList);

  const grouped = new Map<string | null, Bookmark[]>();
  filtered.forEach(b => {
    const key = b.folderId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  });

  const folderOrder = folderList.map(f => f.id);
  const groups: Array<{ key: string | null; name: string; bookmarks: Bookmark[] }> = [];

  folderOrder.forEach(id => {
    if (grouped.has(id))
      groups.push({ key: id, name: folderNameMap.get(id) ?? id, bookmarks: grouped.get(id)! });
  });
  if ((grouped.get(null)?.length ?? 0) > 0)
    groups.push({ key: null, name: 'Senza cartella', bookmarks: grouped.get(null)! });
  grouped.forEach((bmarks, key) => {
    if (key !== null && !folderOrder.includes(key))
      groups.push({ key, name: folderNameMap.get(key) ?? key, bookmarks: bmarks });
  });

  /* ── Render ────────────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center h-64 w-full">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  if (groups.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 w-full">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center widget-card">
        <Search className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {search ? 'Nessun risultato' : 'Nessun segnalibro — aggiungine uno!'}
      </p>
      {!search && (
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> Aggiungi il primo
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center justify-between px-8 pt-6 pb-0 max-w-[1800px] mx-auto w-full">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'segnalibro' : 'segnalibri'}
          {search && <span> per <em>"{search}"</em></span>}
        </p>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Aggiungi</span>
        </button>
      </div>

      {/* Masonry grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6 p-8 max-w-[1800px] mx-auto">
        {groups.map(g => (
          <BookmarkWidget
            key={g.key ?? '__uncategorized__'}
            title={g.name}
            bookmarks={g.bookmarks}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {showAdd && (
        <AddBookmarkModal
          folders={folderList}
          onClose={() => setShowAdd(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
