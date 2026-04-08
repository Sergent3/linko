'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Inbox, Archive, Download, LogOut } from 'lucide-react';
import BookmarkWidget from '@/components/bookmarks/BookmarkWidget';
import CommandPalette from '@/components/CommandPalette';
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import BookmarkletTools from '@/components/bookmarks/BookmarkletTools';
import TrashWidget from '@/components/bookmarks/TrashWidget';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import { useSearch } from '@/contexts/SearchContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Bookmark, Folder } from '@/types/api';

const STORAGE_KEY = 'linko_folder_order';

function loadOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') ?? []; }
  catch { return []; }
}

function saveOrder(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function BookmarksDashboardPage() {
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[]>([]);
  const [folderList, setFolderList] = useState<Folder[]>([]);
  const [folderOrder, setFolderOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'inbox' | 'archive'>('inbox');
  const [trashedBookmarks, setTrashedBookmarks] = useState<Bookmark[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ folderId: string; name: string; count: number } | null>(null);

  // Valori pre-compilati dal bookmarklet (intercettati dai query params)
  const [bookmarkletUrl, setBookmarkletUrl] = useState('');
  const [bookmarkletTitle, setBookmarkletTitle] = useState('');

  const { search } = useSearch();
  const { logout } = useAuth();


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
      const [bRes, fList, trashData] = await Promise.all([
        bookmarksApi.list({ page: 1, limit: 2000 }),
        foldersApi.list(),
        bookmarksApi.trash(),
      ]);
      setAllBookmarks(bRes.data ?? []);
      setFolderList(fList ?? []);
      setTrashedBookmarks(trashData ?? []);
      // Inizializza l'ordine: saved order prima, poi eventuali nuove cartelle in coda
      const saved = loadOrder();
      const allIds = (fList ?? []).map((f: Folder) => f.id);
      const merged = [...saved.filter((id) => allIds.includes(id)), ...allIds.filter((id) => !saved.includes(id))];
      setFolderOrder(merged);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Auto-scroll durante drag ────────────────────────────────────────────
   * L'API HTML5 drag non scrolla la finestra automaticamente.
   * Aggiungiamo un listener su dragover che scrolla se il cursore è vicino
   * ai bordi superiore/inferiore della viewport.
   * ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const ZONE = 80;   // px dal bordo che attiva lo scroll
    const SPEED = 12;  // px per frame
    let rafId: number | null = null;
    let clientY = 0;

    const onDragOver = (e: DragEvent) => { clientY = e.clientY; };

    const scroll = () => {
      const h = window.innerHeight;
      if (clientY < ZONE) {
        window.scrollBy(0, -SPEED * (1 - clientY / ZONE));
      } else if (clientY > h - ZONE) {
        window.scrollBy(0, SPEED * (1 - (h - clientY) / ZONE));
      }
      rafId = requestAnimationFrame(scroll);
    };

    const onDragStart = () => { rafId = requestAnimationFrame(scroll); };
    const onDragEnd   = () => { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } };

    window.addEventListener('dragover',  onDragOver);
    window.addEventListener('dragstart', onDragStart);
    window.addEventListener('dragend',   onDragEnd);
    window.addEventListener('drop',      onDragEnd);

    return () => {
      window.removeEventListener('dragover',  onDragOver);
      window.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('dragend',   onDragEnd);
      window.removeEventListener('drop',      onDragEnd);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);


  /* ── Handlers ────────────────────────────────────────────────────────────── */
  const handleDelete = useCallback(async (id: string) => {
    try {
      await bookmarksApi.delete(id);
      setAllBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch { /* ignore */ }
  }, []);

  const handleRenameBookmark = useCallback(async (id: string, newTitle: string) => {
    try {
      await bookmarksApi.update(id, { title: newTitle });
      setAllBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, title: newTitle } : b));
    } catch { /* ignore */ }
  }, []);


  const handleWidgetReorder = useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    setFolderOrder((prev) => {
      const order = prev.filter((id) => id !== draggedId);
      const idx = order.indexOf(targetId);
      const insertAt = position === 'before' ? idx : idx + 1;
      order.splice(insertAt < 0 ? order.length : insertAt, 0, draggedId);
      saveOrder(order);
      return [...order];
    });
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
      setFolderOrder((prev) => { const o = [...prev, folder.id]; saveOrder(o); return o; });
    } catch (err) {
      console.error('Errore creazione cartella:', err);
    }
  }, []);

  const handleMoveBookmark = useCallback(async (bookmarkId: string, targetFolderId: string | null) => {
    try {
      await bookmarksApi.update(bookmarkId, { folderId: targetFolderId ?? undefined });
      setAllBookmarks((prev) =>
        prev.map((b) => b.id === bookmarkId ? { ...b, folderId: targetFolderId ?? null } : b)
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

  const handleFolderDelete = useCallback(async (folderId: string, folderName: string) => {
    // Conta i bookmark nella cartella (incluse sotto-cartelle)
    const collectIds = (id: string, list: Folder[]): Set<string> => {
      const set = new Set<string>([id]);
      list.filter((f) => f.parentId === id).forEach((f) => collectIds(f.id, list).forEach((x) => set.add(x)));
      return set;
    };
    const ids = collectIds(folderId, folderList);
    const count = allBookmarks.filter((b) => ids.has(b.folderId ?? '')).length;
    setDeleteConfirm({ folderId, name: folderName, count });
  }, [folderList, allBookmarks]);

  const confirmFolderDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { folderId } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await foldersApi.delete(folderId);
      setFolderList((prev) => {
        const deleted = new Set<string>();
        const collect = (id: string) => {
          deleted.add(id);
          prev.filter((f) => f.parentId === id).forEach((f) => collect(f.id));
        };
        collect(folderId);
        setAllBookmarks((bms) => bms.filter((b) => !deleted.has(b.folderId ?? '')));
        // Ricarica il cestino per mostrare i bookmark appena spostati
        bookmarksApi.trash().then(setTrashedBookmarks).catch(() => {});
        if (deleted.has(activeFolder ?? '')) setActiveFolder(null);
        setFolderOrder((o) => { const no = o.filter((id) => !deleted.has(id)); saveOrder(no); return no; });
        return prev.filter((f) => !deleted.has(f.id));
      });
    } catch (err) {
      console.error('Errore eliminazione cartella:', err);
      alert('Impossibile eliminare la cartella. Riprova.');
    }
  }, [deleteConfirm, activeFolder]);


  const handleCreated = useCallback((bm: Bookmark) => {
    setAllBookmarks((prev) => [bm, ...prev]);
    setActiveFolder(null); // mostra "Tutti" così il nuovo segnalibro è sempre visibile
  }, []);

  const handleTrashRestore = useCallback(async (id: string) => {
    try {
      const bm = await bookmarksApi.restore(id);
      setTrashedBookmarks((prev) => prev.filter((b) => b.id !== id));
      setAllBookmarks((prev) => [bm, ...prev]);
    } catch { /* ignore */ }
  }, []);

  const handleTrashHardDelete = useCallback(async (id: string) => {
    try {
      const access = (await import('@/lib/api')).tokens.access;
      await fetch(`/api/v1/bookmarks/${id}/permanent`, {
        method: 'DELETE',
        headers: access ? { Authorization: `Bearer ${access}` } : {},
      });
      setTrashedBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch { /* ignore */ }
  }, []);

  const handleEmptyTrash = useCallback(async () => {
    try {
      await bookmarksApi.emptyTrash();
      setTrashedBookmarks([]);
    } catch { /* ignore */ }
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

  // Ordina le cartelle secondo folderOrder (drag&drop), le nuove vanno in coda
  const orderedFolders = [
    ...folderOrder.map((id) => folderList.find((f) => f.id === id)).filter(Boolean) as Folder[],
    ...folderList.filter((f) => !folderOrder.includes(f.id)),
  ];

  const grouped: { folder: Folder | null; items: Bookmark[] }[] = [];

  // Filtro Inbox vs Archive
  const readFiltered = filtered.filter((b) => viewMode === 'inbox' ? !b.isRead : b.isRead);

  const noFolder = readFiltered.filter((b) => !b.folderId);
  if (noFolder.length > 0 || folderList.length === 0) {
    grouped.push({ folder: null, items: noFolder });
  }
  orderedFolders.forEach((f) => {
    const items = readFiltered.filter((b) => b.folderId === f.id);
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

        {/* Tab Inbox / Archivio */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '8px', marginLeft: 16 }}>
          <button className={`folder-tab ${viewMode === 'inbox' ? 'active' : ''}`} onClick={() => setViewMode('inbox')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', margin: 0 }}>
            <Inbox size={14} /> Da leggere
          </button>
          <button className={`folder-tab ${viewMode === 'archive' ? 'active' : ''}`} onClick={() => setViewMode('archive')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', margin: 0 }}>
            <Archive size={14} /> Archivio
          </button>
        </div>

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
          onClick={() => bookmarksApi.exportHtml()}
          style={{ flexShrink: 0, background: '#444' }}
          title="Esporta in HTML (Firefox/Chrome)"
        >
          <Download size={13} />
        </button>

        <button
          className="btn-add"
          onClick={handleCreateFolder}
          style={{ marginLeft: 6, flexShrink: 0, background: '#444' }}
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
        <button
          className="btn-add"
          onClick={logout}
          style={{ marginLeft: 6, flexShrink: 0, background: '#5a3535' }}
          title="Logout"
        >
          <LogOut size={13} />
          Logout
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
              onFolderDelete={folder ? (id) => handleFolderDelete(id, folder.name) : undefined}
              onClearAll={!folder ? handleClearUncategorized : undefined}
              onMoveBookmark={handleMoveBookmark}
              onRename={handleRename}

              onRenameBookmark={handleRenameBookmark}
              onWidgetReorder={handleWidgetReorder}
            />
          ))}
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
              {search ? 'Nessun risultato' : 'Nessun segnalibro. Aggiungine uno!'}
            </div>
          )}

          {/* ── Tools widget ─────────────────────────────────────────────── */}
          <BookmarkletTools />
          <TrashWidget
            bookmarks={trashedBookmarks}
            onRestore={handleTrashRestore}
            onHardDelete={handleTrashHardDelete}
            onEmptyTrash={handleEmptyTrash}
          />
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

      {/* ── Conferma eliminazione cartella ───────────────────────────────────── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#2e2e2e', borderRadius: 12, padding: 28, maxWidth: 380, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 12px', color: '#e57373', fontSize: 16 }}>Elimina cartella</h3>
            <p style={{ margin: '0 0 20px', color: '#ccc', fontSize: 14, lineHeight: 1.5 }}>
              Stai per eliminare <strong style={{ color: '#fff' }}>{deleteConfirm.name}</strong>.
              {deleteConfirm.count > 0
                ? <> I <strong style={{ color: '#fff' }}>{deleteConfirm.count} bookmark</strong> al suo interno saranno spostati nel cestino.</>
                : ' La cartella è vuota.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ background: '#444', color: '#ccc', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Annulla</button>
              <button onClick={confirmFolderDelete} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>Elimina</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Command Palette ────────────────────────────────────────────────── */}
      <CommandPalette bookmarks={allBookmarks} folders={folderList} />
    </div>
  );
}
