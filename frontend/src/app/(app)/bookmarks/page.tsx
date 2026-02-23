'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import Widget from '@/components/Widget'; // Usa il componente Widget generico
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import { useSearch } from '@/contexts/SearchContext';
import type { Bookmark, Folder } from '@/types/api';

export default function BookmarksDashboardPage() {
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [folderList, setFolderList] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activePageName, setActivePageName] = useState('Bookmarks Dashboard'); // Titolo della pagina

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
  function handleCreated(b: Bookmark) {
    setAllBookmarks(prev => [b, ...prev]);
  }

  /* ── Filter & group bookmarks into widgets ───────────────────────────────── */
  const q = search.toLowerCase();
  const filtered = q
    ? allBookmarks.filter(b =>
        b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q))
    : allBookmarks;

  const groupedWidgets = new Map<string, { title: string; bookmarks: Bookmark[] }>();

  // Group bookmarks by folder
  filtered.forEach(b => {
    const folderName = b.folder?.name || 'Uncategorized';
    if (!groupedWidgets.has(folderName)) {
      groupedWidgets.set(folderName, { title: folderName, bookmarks: [] });
    }
    groupedWidgets.get(folderName)!.bookmarks.push(b);
  });

  const widgetsData = Array.from(groupedWidgets.values()).sort((a, b) => a.title.localeCompare(b.title));

  /* ── Render ────────────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen pt-16">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div
      className="min-h-screen bg-cover bg-center transition-all duration-300 relative"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1557683316-973673baf923?q=80&w=2000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')`,
      }}
    >
      {/* Background Overlay and blur */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] z-10"></div>

      <main className="relative z-20 pt-20 pb-8 px-4 md:px-8 lg:px-12">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">{activePageName}</h1>
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-md">
              <Plus size={20} />
              <span>Add Bookmark</span>
            </button>
            <button className="bg-white/20 text-white p-2 rounded-lg hover:bg-white/30 transition-colors shadow-md">
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Widget Grid */}
        {widgetsData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {widgetsData.map((widget, index) => (
              <Widget key={index} title={widget.title} type="bookmarks" content={widget.bookmarks} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-4 w-full text-white">
            <p className="text-lg">Nessun segnalibro trovato.</p>
            {!search && (
              <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors shadow-md">
                <Plus size={20} /> Aggiungi il primo
              </button>
            )}
          </div>
        )}
      </main>

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