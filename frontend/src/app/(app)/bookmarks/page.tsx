'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Inbox, Archive, FolderPlus, Search, X } from 'lucide-react';
import BookmarkWidget from '@/components/bookmarks/BookmarkWidget';
import CommandPalette from '@/components/CommandPalette';
import AddBookmarkModal from '@/components/bookmarks/AddBookmarkModal';
import BookmarkletTools from '@/components/bookmarks/BookmarkletTools';
import TrashWidget from '@/components/bookmarks/TrashWidget';
import { bookmarks as bookmarksApi, folders as foldersApi } from '@/lib/api';
import { useSearch } from '@/contexts/SearchContext';
import { useUI } from '@/components/ui/UIProvider';
import type { Bookmark, Folder } from '@/types/api';

const STORAGE_KEY = 'linko_folder_order';

function loadOrder(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') ?? []; }
  catch { return []; }
}

function saveOrder(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* storage non disponibile */ }
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

  // Valori pre-compilati dal bookmarklet (intercettati dai query params)
  const [bookmarkletUrl, setBookmarkletUrl] = useState('');
  const [bookmarkletTitle, setBookmarkletTitle] = useState('');

  const { search, setSearch } = useSearch();
  const ui = useUI();


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
      ui.toast('Impossibile caricare i segnalibri. Ricarica la pagina.', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Vista e cartella attive restano nell'URL (?view=archive&folder=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'archive') setViewMode('archive');
    const f = params.get('folder');
    if (f) setActiveFolder(f);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (viewMode === 'archive') params.set('view', 'archive');
    if (activeFolder) params.set('folder', activeFolder);
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `/bookmarks?${qs}` : '/bookmarks');
  }, [viewMode, activeFolder]);

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
  // Eliminazione immediata nel cestino, con "Annulla" nella notifica
  const handleDelete = useCallback(async (id: string) => {
    const bm = allBookmarks.find((b) => b.id === id);
    try {
      await bookmarksApi.delete(id);
      setAllBookmarks((prev) => prev.filter((b) => b.id !== id));
      if (bm) setTrashedBookmarks((prev) => [bm, ...prev]);
      ui.toast('Spostato nel cestino', {
        action: {
          label: 'Annulla',
          onClick: async () => {
            try {
              const restored = await bookmarksApi.restore(id);
              setTrashedBookmarks((prev) => prev.filter((b) => b.id !== id));
              setAllBookmarks((prev) => [restored, ...prev]);
            } catch {
              ui.toast('Ripristino non riuscito: recuperalo dal cestino.', { kind: 'error' });
            }
          },
        },
      });
    } catch {
      ui.toast('Eliminazione non riuscita. Riprova.', { kind: 'error' });
    }
  }, [allBookmarks, ui]);

  const handleRenameBookmark = useCallback(async (id: string, newTitle: string) => {
    try {
      await bookmarksApi.update(id, { title: newTitle });
      setAllBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, title: newTitle } : b));
    } catch {
      ui.toast('Rinomina non riuscita. Riprova.', { kind: 'error' });
    }
  }, [ui]);


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
    } catch {
      ui.toast('Rinomina della cartella non riuscita. Riprova.', { kind: 'error' });
    }
  }, [ui]);

  const handleCreateFolder = useCallback(async () => {
    const name = await ui.prompt({ title: 'Nuova cartella', label: 'Nome della cartella', placeholder: 'Es. Lavoro…', confirmLabel: 'Crea cartella' });
    if (!name) return;
    try {
      const folder = await foldersApi.create(name);
      setFolderList((prev) => [...prev, folder]);
      setFolderOrder((prev) => { const o = [...prev, folder.id]; saveOrder(o); return o; });
    } catch {
      ui.toast('Creazione della cartella non riuscita. Riprova.', { kind: 'error' });
    }
  }, [ui]);

  const handleMoveBookmark = useCallback(async (bookmarkId: string, targetFolderId: string | null) => {
    try {
      await bookmarksApi.update(bookmarkId, { folderId: targetFolderId ?? undefined });
      setAllBookmarks((prev) =>
        prev.map((b) => b.id === bookmarkId ? { ...b, folderId: targetFolderId ?? null } : b)
      );
    } catch {
      ui.toast('Spostamento non riuscito. Riprova.', { kind: 'error' });
    }
  }, [ui]);

  const handleClearUncategorized = useCallback(async () => {
    const items = allBookmarks.filter((b) => !b.folderId);
    const ok = await ui.confirm({
      title: 'Svuotare “Senza categoria”?',
      message: <>I <strong>{items.length} segnalibri</strong> senza cartella saranno spostati nel cestino.</>,
      confirmLabel: 'Sposta nel cestino',
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(items.map((b) => bookmarksApi.delete(b.id)));
      setAllBookmarks((prev) => prev.filter((b) => !!b.folderId));
      setTrashedBookmarks((prev) => [...items, ...prev]);
      ui.toast(`${items.length} segnalibri spostati nel cestino`);
    } catch {
      ui.toast('Eliminazione non riuscita. Riprova.', { kind: 'error' });
      load();
    }
  }, [allBookmarks, ui, load]);

  const handleFolderDelete = useCallback(async (folderId: string, folderName: string) => {
    // Cartella e sotto-cartelle
    const collectIds = (id: string, list: Folder[]): Set<string> => {
      const set = new Set<string>([id]);
      list.filter((f) => f.parentId === id).forEach((f) => collectIds(f.id, list).forEach((x) => set.add(x)));
      return set;
    };
    const deleted = collectIds(folderId, folderList);
    const count = allBookmarks.filter((b) => deleted.has(b.folderId ?? '')).length;

    const ok = await ui.confirm({
      title: 'Eliminare la cartella?',
      message: count > 0
        ? <>Stai per eliminare <strong>{folderName}</strong>. I <strong>{count} segnalibri</strong> al suo interno saranno spostati nel cestino.</>
        : <>Stai per eliminare <strong>{folderName}</strong>. La cartella è vuota.</>,
      confirmLabel: 'Elimina cartella',
      danger: true,
    });
    if (!ok) return;

    try {
      await foldersApi.delete(folderId);
      setFolderList((prev) => prev.filter((f) => !deleted.has(f.id)));
      setAllBookmarks((bms) => bms.filter((b) => !deleted.has(b.folderId ?? '')));
      bookmarksApi.trash().then(setTrashedBookmarks).catch(() => {});
      if (deleted.has(activeFolder ?? '')) setActiveFolder(null);
      setFolderOrder((o) => { const no = o.filter((id) => !deleted.has(id)); saveOrder(no); return no; });
      ui.toast(`Cartella “${folderName}” eliminata`);
    } catch {
      ui.toast('Impossibile eliminare la cartella. Riprova.', { kind: 'error' });
    }
  }, [folderList, allBookmarks, activeFolder, ui]);

  const handleCreated = useCallback((bm: Bookmark) => {
    setAllBookmarks((prev) => [bm, ...prev]);
    setActiveFolder(null); // mostra "Tutti" così il nuovo segnalibro è sempre visibile
  }, []);

  const handleTrashRestore = useCallback(async (id: string) => {
    try {
      const bm = await bookmarksApi.restore(id);
      setTrashedBookmarks((prev) => prev.filter((b) => b.id !== id));
      setAllBookmarks((prev) => [bm, ...prev]);
      ui.toast('Segnalibro ripristinato');
    } catch {
      ui.toast('Ripristino non riuscito. Riprova.', { kind: 'error' });
    }
  }, [ui]);

  const handleTrashHardDelete = useCallback(async (id: string) => {
    const ok = await ui.confirm({
      title: 'Eliminare definitivamente?',
      message: 'Il segnalibro verrà cancellato e non potrà essere recuperato.',
      confirmLabel: 'Elimina definitivamente',
      danger: true,
    });
    if (!ok) return;
    try {
      const access = (await import('@/lib/api')).tokens.access;
      await fetch(`/api/v1/bookmarks/${id}/permanent`, {
        method: 'DELETE',
        headers: access ? { Authorization: `Bearer ${access}` } : {},
      });
      setTrashedBookmarks((prev) => prev.filter((b) => b.id !== id));
    } catch {
      ui.toast('Eliminazione non riuscita. Riprova.', { kind: 'error' });
    }
  }, [ui]);

  const handleEmptyTrash = useCallback(async () => {
    const ok = await ui.confirm({
      title: 'Svuotare il cestino?',
      message: <>I <strong>{trashedBookmarks.length} segnalibri</strong> nel cestino saranno cancellati definitivamente.</>,
      confirmLabel: 'Svuota cestino',
      danger: true,
    });
    if (!ok) return;
    try {
      await bookmarksApi.emptyTrash();
      setTrashedBookmarks([]);
      ui.toast('Cestino svuotato');
    } catch {
      ui.toast('Svuotamento non riuscito. Riprova.', { kind: 'error' });
    }
  }, [trashedBookmarks.length, ui]);

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

  const isActive = (id: string) => (id === '__all__' && activeFolder === null) || id === activeFolder;

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <>
      <h1 className="sr-only">Segnalibri</h1>

      {/* ── Barra strumenti ────────────────────────────────────────────────── */}
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Vista">
          <button type="button" role="tab" className="tab" aria-selected={viewMode === 'inbox'} onClick={() => setViewMode('inbox')}>
            <Inbox size={14} aria-hidden="true" /> Da leggere
          </button>
          <button type="button" role="tab" className="tab" aria-selected={viewMode === 'archive'} onClick={() => setViewMode('archive')}>
            <Archive size={14} aria-hidden="true" /> Archivio
          </button>
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" />
          <input
            type="search"
            name="search"
            className="input"
            style={{ paddingLeft: 32, paddingRight: search ? 32 : 12 }}
            placeholder="Filtra per titolo o URL…"
            aria-label="Filtra i segnalibri"
            autoComplete="off"
            spellCheck={false}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="icon-btn icon-btn-sm absolute right-1.5 top-1/2 -translate-y-1/2"
              aria-label="Cancella filtro"
              onClick={() => setSearch('')}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        <button type="button" className="btn btn-secondary" onClick={handleCreateFolder} aria-label="Nuova cartella">
          <FolderPlus size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Nuova cartella</span>
        </button>
        <button type="button" className="btn btn-primary" onClick={openAddModal}>
          <Plus size={15} aria-hidden="true" /> Aggiungi
        </button>
      </div>

      {/* ── Filtro cartelle ────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 overflow-x-auto px-4 pb-3 mx-auto"
        style={{ maxWidth: 1600, scrollbarWidth: 'thin' }}
        role="group"
        aria-label="Filtra per cartella"
      >
        {allFolders.map((f) => (
          <button
            key={f.id}
            type="button"
            className="pill"
            aria-pressed={isActive(f.id)}
            onClick={() => setActiveFolder(f.id === '__all__' ? null : f.id)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {/* ── Griglia segnalibri ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center items-center" style={{ height: 200 }} aria-busy="true">
          <div className="spinner" aria-label="Caricamento…" />
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
            <div className="empty-state" style={{ columnSpan: 'all' }}>
              {search ? `Nessun segnalibro corrisponde a “${search}”.` : 'Nessun segnalibro. Aggiungine uno con “Aggiungi”.'}
            </div>
          )}

          <BookmarkletTools />
          <TrashWidget
            bookmarks={trashedBookmarks}
            onRestore={handleTrashRestore}
            onHardDelete={handleTrashHardDelete}
            onEmptyTrash={handleEmptyTrash}
          />
        </div>
      )}

      {showAdd && (
        <AddBookmarkModal
          folders={folderList}
          onClose={closeModal}
          onCreated={handleCreated}
          initialUrl={bookmarkletUrl}
          initialTitle={bookmarkletTitle}
        />
      )}

      <CommandPalette bookmarks={allBookmarks} folders={folderList} onSelectFolder={setActiveFolder} />
    </>
  );
}
