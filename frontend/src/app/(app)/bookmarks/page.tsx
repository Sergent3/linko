'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
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

  // Filters
  const [search, setSearch] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>();
  const [activeTagId, setActiveTagId] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (filters: BookmarkFilters) => {
      setLoading(true);
      try {
        const res = await bookmarksApi.list(filters);
        setItems(res.data);
        setMeta({ page: res.meta.page, totalPages: res.meta.totalPages, total: res.meta.total });
      } catch {
        /* silently fail — user sees empty state */
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load folders once for sidebar + modal
  useEffect(() => {
    foldersApi.list().then(setFolderList).catch(() => {});
  }, []);

  // Reload whenever filters/page change
  useEffect(() => {
    load({ page, limit: LIMIT, folderId: activeFolderId, tagId: activeTagId, search: search || undefined });
  }, [load, page, activeFolderId, activeTagId, search]);

  function handleSearchChange(value: string) {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  }

  function handleFolderSelect(id: string | undefined) {
    setActiveFolderId(id);
    setPage(1);
  }

  function handleTagSelect(id: string | undefined) {
    setActiveTagId(id);
    setPage(1);
  }

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
        onFolderSelect={handleFolderSelect}
        onTagSelect={handleTagSelect}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Cerca segnalibri…"
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center gap-1.5 text-sm text-gray-500 ml-auto">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:block">
              {meta.total} {meta.total === 1 ? 'segnalibro' : 'segnalibri'}
            </span>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:block">Aggiungi</span>
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
              <Search className="w-10 h-10" />
              <p className="text-sm">Nessun segnalibro trovato</p>
              {!search && !activeFolderId && !activeTagId && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-2 text-sm text-slate-900 font-medium hover:underline"
                >
                  Aggiungi il tuo primo segnalibro
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
                className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">
                Pagina {page} di {meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
                className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
