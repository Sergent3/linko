'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import BookmarkWidget from '@/components/bookmarks/BookmarkWidget';
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import { useSearch } from '@/contexts/SearchContext';
import type { Bookmark, Folder } from '@/types/api';

export default function BookmarksDashboardPage() {
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [folderList, setFolderList] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const { search } = useSearch();

  /* ---- data loading ---- */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, fList] = await Promise.all([
        bookmarksApi.list({ page: 1, limit: 500 }),
        foldersApi.list(),
      ]);
      setAllBookmarks(bRes.data ?? []);
      setFolderList(fList ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ---- handlers ---- */
  const handleDelete = useCallback(async (id: string) => {
    try {
      await bookmarksApi.delete(id);
      setAllBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch { /* ignore */ }
  }, []);

  const handleCreated = useCallback((bm: Bookmark) => {
    setAllBookmarks((prev) => [bm, ...prev]);
  }, []);

  /* ---- filtering ---- */
  const filtered = search
    ? allBookmarks.filter(
        (b) =>
          b.title?.toLowerCase().includes(search.toLowerCase()) ||
          b.url?.toLowerCase().includes(search.toLowerCase())
      )
    : allBookmarks;

  /* ---- group by folder ---- */
  const grouped: { folder: Folder | null; items: Bookmark[] }[] = [];

  const noFolder = filtered.filter((b) => !b.folderId);
  if (noFolder.length > 0 || folderList.length === 0) {
    grouped.push({ folder: null, items: noFolder });
  }

  folderList.forEach((f) => {
    const items = filtered.filter((b) => b.folderId === f.id);
    grouped.push({ folder: f, items });
  });

  const visible =
    activeFolder === null
      ? grouped
      : grouped.filter((g) => (g.folder?.id ?? 'uncategorized') === activeFolder);

  const allFolders: { id: string; name: string }[] = [
    { id: '__all__', name: 'Tutti' },
    ...folderList.map((f) => ({ id: f.id, name: f.name })),
    ...(noFolder.length > 0 ? [{ id: 'uncategorized', name: 'Senza categoria' }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#2b2b2b' }}>
      {/* Top header */}
      <div className="top-header">
        <span className="page-title">Bookmarks</span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginLeft: 20,
            gap: 0,
            overflowX: 'auto',
            flex: 1,
          }}
        >
          {allFolders.map((f) => (
            <span
              key={f.id}
              className={`folder-tab${
                (f.id === '__all__' && activeFolder === null) ||
                f.id === activeFolder
                  ? ' active'
                  : ''
              }`}
              onClick={() =>
                setActiveFolder(f.id === '__all__' ? null : f.id)
              }
            >
              {f.name}
            </span>
          ))}
        </div>

        <button
          className="btn-add"
          onClick={() => setShowAdd(true)}
          style={{ marginLeft: 12, flexShrink: 0 }}
        >
          <Plus size={13} />
          Aggiungi
        </button>
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 200,
            color: '#888',
          }}
        >
          Caricamento...
        </div>
      ) : (
        <div className="bookmarks-grid">
          {visible.map(({ folder, items }) => (
            <BookmarkWidget
              key={folder?.id ?? 'uncategorized'}
              title={folder?.name ?? 'Senza categoria'}
              bookmarks={items}
              onDelete={handleDelete}
              onAddClick={() => setShowAdd(true)}
            />
          ))}
          {visible.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 0',
                color: '#666',
              }}
            >
              {search ? 'Nessun risultato' : 'Nessun segnalibro. Aggiungine uno!'}
            </div>
          )}
        </div>
      )}

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
