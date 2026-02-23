'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import BookmarkWidget from '@/components/bookmarks/BookmarkWidget';
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import type { Bookmark, Folder } from '@/types/api';

export default function BookmarksPage() {
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [folderList, setFolderList]     = useState<Folder[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showAdd, setShowAdd]           = useState(false);
  const [search, setSearch]             = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  function handleSearchChange(value: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(value), 250);
  }

  async function handleDelete(id: string) {
    await bookmarksApi.delete(id);
    setAllBookmarks(prev => prev.filter(b => b.id !== id));
  }

  function handleCreated(b: Bookmark) {
    setAllBookmarks(prev => [b, ...prev]);
  }

  /* ── Filtering & grouping ──────────────────────────────────────────────── */
  const q = search.toLowerCase();
  const filtered = q
    ? allBookmarks.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q))
    : allBookmarks;

  // Flatten folder names (supports nesting)
  const folderNameMap = new Map<string, string>();
  function flattenFolders(list: Folder[], prefix = '') {
    list.forEach(f => {
      const label = prefix ? `${prefix} / ${f.name}` : f.name;
      folderNameMap.set(f.id, label);
      if (f.children?.length) flattenFolders(f.children, f.name);
    });
  }
  flattenFolders(folderList);

  // Group by folderId
  const grouped = new Map<string | null, Bookmark[]>();
  filtered.forEach(b => {
    const key = b.folderId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  });

  // Ordered groups: folders first (API order), uncategorized last
  const folderOrder = folderList.map(f => f.id);
  const groups: Array<{ key: string | null; name: string; bookmarks: Bookmark[] }> = [];

  folderOrder.forEach(id => {
    if (grouped.has(id))
      groups.push({ key: id, name: folderNameMap.get(id) ?? id, bookmarks: grouped.get(id)! });
  });

  if ((grouped.get(null)?.length ?? 0) > 0)
    groups.push({ key: null, name: 'Senza cartella', bookmarks: grouped.get(null)! });

  // Edge case: folders in bookmarks not present in folderList
  grouped.forEach((bmarks, key) => {
    if (key !== null && !folderOrder.includes(key))
      groups.push({ key, name: folderNameMap.get(key) ?? key, bookmarks: bmarks });
  });

  const totalVisible = filtered.length;

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Sticky toolbar ───────────────────────────────────────────────── */}
      <div
        className="sticky top-10 z-20 flex items-center gap-3 px-5 py-2 border-b shrink-0"
        style={{
          background: 'var(--bar-bg)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderColor: 'var(--bar-border)',
        }}
      >
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--search-placeholder)' }} />
          <input
            type="search"
            placeholder="Cerca segnalibri…"
            onChange={e => handleSearchChange(e.target.value)}
            className="input pl-8"
          />
        </div>

        {/* Count */}
        <span className="hidden sm:block text-[11px] tabular-nums"
          style={{ color: 'var(--text-muted)' }}>
          {totalVisible} {totalVisible === 1 ? 'segnalibro' : 'segnalibri'}
        </span>

        <div className="ml-auto" />

        {/* Add */}
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Aggiungi</span>
        </button>
      </div>

      {/* ── Dashboard grid ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 py-6">

          {loading ? (
            /* Spinner */
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>

          ) : groups.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--widget-bg)', border: '1px solid var(--widget-border)' }}>
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

          ) : (
            /* Masonry widget grid */
            <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6">
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
      </div>

      {/* ── Add bookmark modal ───────────────────────────────────────────── */}
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
