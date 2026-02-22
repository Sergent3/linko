'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight, SlidersHorizontal, Menu } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import BookmarkCard from '@/components/bookmarks/BookmarkCard';
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import type { Bookmark, BookmarkFilters, Folder } from '@/types/api';

const LIMIT = 24;

export default function BookmarksPage() {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [folderList, setFolderList] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [activeTagId, setActiveTagId] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (filters: BookmarkFilters) => {
    setLoading(true);
    try {
      const res = await bookmarksApi.list(filters);
      setItems(res.data);
      setMeta({ page: res.meta.page, totalPages: res.meta.totalPages, total: res.meta.total });
    } catch {
      /* silent fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    foldersApi.list().then(setFolderList).catch(() => {});
  }, []);

  useEffect(() => {
    load({ page, limit: LIMIT, folderId: activeFolderId, tagId: activeTagId, search: search || undefined });
  }, [load, page, activeFolderId, activeTagId, search]);

  function handleSearchChange(value: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(value); setPage(1); }, 400);
  }

  function handleFolderSelect(id: string | undefined) { setActiveFolderId(id); setPage(1); }
  function handleTagSelect(id: string | undefined) { setActiveTagId(id); setPage(1); }

  async function handleDelete(id: string) {
    await bookmarksApi.delete(id);
    setItems((prev) => prev.filter((b) => b.id !== id));
    setMeta((m) => ({ ...m, total: m.total - 1 }));
  }

  function handleCreated(b: Bookmark) {
    setItems((prev) => [b, ...prev]);
    setMeta((m) => ({ ...m, total: m.total + 1 }));
  }

  return (
    <>
      <Sidebar
        activeFolderId={activeFolderId}
        activeTagId={activeTagId}
        onFolderSelect={(id) => { handleFolderSelect(id); setSidebarOpen(false); }}
        onTagSelect={(id) => { handleTagSelect(id); setSidebarOpen(false); }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05] bg-[#0c0c15]/60 backdrop-blur shrink-0">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="search"
              placeholder="Cerca segnalibri…"
              onChange={(e) => handleSearchChange(e.target.value)}
              className="input-dark pl-9 py-2"
            />
          </div>

          {/* Count */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-600 ml-auto">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{meta.total} {meta.total === 1 ? 'segnalibro' : 'segnalibri'}</span>
          </div>

          {/* Add button */}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all hover:shadow-glow-violet-sm active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">Aggiungi</span>
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-16 h-16 bg-zinc-800/60 border border-zinc-700/40 rounded-2xl flex items-center justify-center">
                <Search className="w-7 h-7 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-500">Nessun segnalibro trovato</p>
              {!search && !activeFolderId && !activeTagId && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors"
                >
                  + Aggiungi il primo segnalibro
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((b) => (
                <BookmarkCard key={b.id} bookmark={b} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl border border-zinc-800 text-zinc-500 hover:border-violet-500/40 hover:text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-zinc-500">
                {page} / {meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="p-2 rounded-xl border border-zinc-800 text-zinc-500 hover:border-violet-500/40 hover:text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
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
