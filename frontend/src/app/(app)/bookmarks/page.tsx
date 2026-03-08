'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import BookmarkWidget from '@/components/bookmarks/BookmarkWidget';
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import BookmarkletTools from '@/components/bookmarks/BookmarkletTools';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import { useSearch } from '@/contexts/SearchContext';
import type { Bookmark, Folder } from '@/types/api';

export default function BookmarksDashboardPage() {
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [folderList, setFolderList] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  // Valori pre-compilati dal bookmarklet (intercettati dai query params)
  const [bookmarkletUrl, setBookmarkletUrl] = useState('');
  const [bookmarkletTitle, setBookmarkletTitle] = useState('');

  const { search } = useSearch();

  /* ── Intercetta parametri bookmarklet ───────────────────────────────────────
   * Il bookmarklet apre /bookmarks?add_url=...&add_title=...
   * Leggiamo i params, apriamo il modal pre-compilato e puliamo l'URL
   * senza causare un re-render della pagina (history.replaceState).
   * Non usiamo useSearchParams per evitare il requisito di Suspense boundary.
   * ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addUrl = params.get('add_url');
    const addTitle = params.get('add_title');

    if (addUrl) {
      setBookmarkletUrl(addUrl);
      setBookmarkletTitle(addTitle ?? '');
      setShowAdd(true);
      // Rimuovi i parametri dall'URL senza ricaricare la pagina
      window.history.replaceState({}, '', '/bookmarks');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Data loading ────────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, fList] = await Promise.all([
        bookmarksApi.list({ page: 1, limit: 2000 }),
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

  /* ── Handlers ────────────────────────────────────────────────────────────── */
  const handleDelete = useCallback(async (id: string) => {
    try {
      await bookmarksApi.delete(id);
      setAllBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch { /* ignore */ }
  }, []);

  const handleRename = useCallback(async (folderId: string, newName: string) => {
    try {
      await foldersApi.update(folderId, newName);
      setFolderList((prev) => prev.map((f) => f.id === folderId ? { ...f, name: newName } : f));
    } catch (err) {
      console.error('Errore rinomina cartella:', err);
    }
  }, []);

  const handleCreateFolder = useCallback(async () => {
    const name = prompt('Nome della nuova cartella:')?.trim();
    if (!name) return;
    try {
      const folder = await foldersApi.create(name);
      setFolderList((prev) => [...prev, folder]);
    } catch (err) {
      console.error('Errore creazione cartella:', err);
    }
  }, []);

  const handleMoveBookmark = useCallback(async (bookmarkId: string, targetFolderId: string | null) => {
    try {
      await bookmarksApi.update(bookmarkId, { folderId: targetFolderId ?? undefined });
      setAllBookmarks((prev) =>
        prev.map((b) => b.id === bookmarkId ? { ...b, folderId: targetFolderId ?? undefined } : b)
      );
    } catch (err) {
      console.error('Errore spostamento bookmark:', err);
    }
  }, []);

  const handleClearUncategorized = useCallback(async () => {
    try {
      const ids = allBookmarks.filter((b) => !b.folderId).map((b) => b.id);
      await Promise.all(ids.map((id) => bookmarksApi.delete(id)));
      setAllBookmarks((prev) => prev.filter((b) => !!b.folderId));
    } catch (err) {
      console.error('Errore eliminazione senza categoria:', err);
      alert('Errore durante l\'eliminazione. Riprova.');
    }
  }, [allBookmarks]);

  const handleFolderDelete = useCallback(async (folderId: string) => {
    try {
      await foldersApi.delete(folderId);
      // Raccoglie gli id di tutte le cartelle eliminate (la cartella + eventuali figli già in lista)
      setFolderList((prev) => {
        const deleted = new Set<string>();
        const collect = (id: string) => {
          deleted.add(id);
          prev.filter((f) => f.parentId === id).forEach((f) => collect(f.id));
        };
        collect(folderId);
        // Elimina i bookmark delle cartelle rimosse
        setAllBookmarks((bms) => bms.filter((b) => !deleted.has(b.folderId ?? '')));
        if (deleted.has(activeFolder ?? '')) setActiveFolder(null);
        return prev.filter((f) => !deleted.has(f.id));
      });
    } catch (err) {
      console.error('Errore eliminazione cartella:', err);
      alert('Impossibile eliminare la cartella. Riprova.');
    }
  }, [activeFolder]);

  const handleCreated = useCallback((bm: Bookmark) => {
    setAllBookmarks((prev) => [bm, ...prev]);
    setActiveFolder(null); // mostra "Tutti" così il nuovo segnalibro è sempre visibile
  }, []);

  function openAddModal() {
    // Reset dei valori bookmarklet quando il modal viene aperto manualmente
    setBookmarkletUrl('');
    setBookmarkletTitle('');
    setShowAdd(true);
  }

  function closeModal() {
    setShowAdd(false);
    // Pulisci i valori bookmarklet dopo la chiusura così il prossimo
    // apertura manuale non pre-compila i campi
    setBookmarkletUrl('');
    setBookmarkletTitle('');
  }

  /* ── Filtering & grouping ────────────────────────────────────────────────── */
  const filtered = search
    ? allBookmarks.filter(
        (b) =>
          b.title?.toLowerCase().includes(search.toLowerCase()) ||
          b.url?.toLowerCase().includes(search.toLowerCase())
      )
    : allBookmarks;

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

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#2b2b2b' }}>

      {/* ── Top header ─────────────────────────────────────────────────────── */}
      <div className="top-header">
        <span className="page-title">Bookmarks</span>

        {/* Folder tabs */}
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
                (f.id === '__all__' && activeFolder === null) || f.id === activeFolder
                  ? ' active'
                  : ''
              }`}
              onClick={() => setActiveFolder(f.id === '__all__' ? null : f.id)}
            >
              {f.name}
            </span>
          ))}
        </div>

        <button
          className="btn-add"
          onClick={handleCreateFolder}
          style={{ marginLeft: 12, flexShrink: 0, background: '#444' }}
        >
          <Plus size={13} />
          Cartella
        </button>
        <button
          className="btn-add"
          onClick={openAddModal}
          style={{ marginLeft: 6, flexShrink: 0 }}
        >
          <Plus size={13} />
          Aggiungi
        </button>
      </div>

      {/* ── Bookmark grid ──────────────────────────────────────────────────── */}
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
              folderId={folder?.id}
              bookmarks={items}
              onDelete={handleDelete}
              onAddClick={openAddModal}
              onFolderDelete={folder ? handleFolderDelete : undefined}
              onClearAll={!folder ? handleClearUncategorized : undefined}
              onMoveBookmark={handleMoveBookmark}
              onRename={handleRename}
            />
          ))}
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
              {search ? 'Nessun risultato' : 'Nessun segnalibro. Aggiungine uno!'}
            </div>
          )}

          {/* ── Tools widget ─────────────────────────────────────────────── */}
          <BookmarkletTools />
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      {showAdd && (
        <AddBookmarkModal
          folders={folderList}
          onClose={closeModal}
          onCreated={handleCreated}
          initialUrl={bookmarkletUrl}
          initialTitle={bookmarkletTitle}
        />
      )}
    </div>
  );
}
