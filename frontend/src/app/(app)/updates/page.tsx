'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus, ExternalLink, BookmarkPlus, EyeOff, Check, CheckCheck, RefreshCw, Pause, Play, Trash2, AlertTriangle, Circle, Rss, LayoutList, KeyRound, MessagesSquare, Pencil,
  ChevronRight, ChevronDown, SlidersHorizontal, PanelLeftClose, PanelLeftOpen, Search, Keyboard, X,
  ArrowUpDown, Folder, FolderPlus, Eye, GripVertical, Bell, Newspaper,
} from 'lucide-react';
import AddSourceWizard from '@/components/updates/AddSourceWizard';
import Modal from '@/components/ui/Modal';
import ItemPreview from '@/components/updates/ItemPreview';
import NotificationsModal from '@/components/updates/NotificationsModal';
import { CREDENTIALS_CHANGED_EVENT, WATCH_UNREAD_EVENT } from '@/components/layout/AppHeader';
import { useUI } from '@/components/ui/UIProvider';
import { watchApi } from '@/lib/api';
import { groupItems, type ItemGroup } from '@/lib/group-items';
import {
  clampHeight, clampWidth, LIST_MAX_HEIGHT, LIST_MIN_HEIGHT, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, useUpdatesLayout, type SourceSort,
} from '@/lib/updates-layout';
import type { SiteCredential, WatchItem, WatchSource } from '@/types/api';

const PAGE_SIZE = 50;

const fmtDay = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });
const fmtRelative = new Intl.RelativeTimeFormat('it-IT', { numeric: 'auto' });

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
  const s = fmtDay.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function relative(iso: string | null): string {
  if (!iso) return 'mai';
  const min = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(min) < 1) return 'adesso';
  if (Math.abs(min) < 60) return fmtRelative.format(min, 'minute');
  if (Math.abs(min) < 1440) return fmtRelative.format(Math.round(min / 60), 'hour');
  return fmtRelative.format(Math.round(min / 1440), 'day');
}

/** Sito della fonte: host senza www, per raggruppare le fonti dello stesso dominio. */
function siteOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return url; }
}

function modeLabel(mode: WatchSource['mode']): string {
  return mode === 'FEED' ? 'Feed RSS/Atom' : mode === 'THREAD' ? 'Discussione' : 'Area della pagina';
}

function SiteIcon({ site }: { site: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="favicon favicon-fallback" aria-hidden="true" />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${site}&sz=32`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      className="favicon"
      onError={() => setFailed(true)}
    />
  );
}

/** Testo confrontabile per la ricerca: minuscolo e senza accenti. */
function fold(s: string): string {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['j', 'k'], label: 'Aggiornamento successivo / precedente' },
  { keys: ['o', 'Invio'], label: 'Apri sul sito (e segna come letto)' },
  { keys: ['p'], label: 'Anteprima senza lasciare Linko' },
  { keys: ['m'], label: 'Segna come letto / non letto' },
  { keys: ['s'], label: 'Salva tra i segnalibri' },
  { keys: ['h'], label: 'Nascondi' },
  { keys: ['x'], label: 'Apri o chiudi un gruppo accorpato' },
  { keys: ['u'], label: 'Passa tra Tutti e Non letti' },
  { keys: ['/'], label: 'Cerca tra le fonti' },
  { keys: ['Alt+↑', 'Alt+↓'], label: 'Sposta la fonte selezionata (ordine personalizzato)' },
  { keys: ['Esc'], label: 'Esci dalla ricerca o dalla selezione' },
  { keys: ['?'], label: 'Mostra questi tasti' },
];

const SORTS: { value: SourceSort; label: string }[] = [
  { value: 'custom', label: 'Personalizzato (trascina)' },
  { value: 'unread', label: 'Più non letti' },
  { value: 'name', label: 'Nome' },
  { value: 'recent', label: 'Aggiunte di recente' },
];

const NO_CATEGORY = '-';

function byPosition(a: WatchSource, b: WatchSource): number {
  return a.position - b.position || a.createdAt.localeCompare(b.createdAt);
}

interface SiteGroup { site: string; sources: WatchSource[]; unread: number }
interface Section { category: string | null; groups: SiteGroup[]; unread: number; count: number }

function every(minutes: number): string {
  return minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
}

/**
 * Maniglia di ridimensionamento: trascina (mouse o dito), frecce da tastiera,
 * doppio clic per tornare al valore predefinito.
 */
function ResizeHandle({ vertical, value, min, max, label, onChange, onReset, className }: {
  vertical: boolean;
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (v: number) => void;
  onReset: () => void;
  className?: string;
}) {
  const start = useRef<{ pos: number; v: number } | null>(null);
  const pos = (e: React.PointerEvent) => (vertical ? e.clientX : e.clientY);
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      title={`${label}: trascina per cambiarla · doppio clic per ripristinare`}
      className={`resize-handle ${vertical ? 'resize-handle-x' : 'resize-handle-y'} ${className ?? ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { pos: pos(e), v: value };
      }}
      onPointerMove={(e) => {
        if (start.current) onChange(start.current.v + pos(e) - start.current.pos);
      }}
      onPointerUp={() => { start.current = null; }}
      onPointerCancel={() => { start.current = null; }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 80 : 20;
        const less = vertical ? 'ArrowLeft' : 'ArrowUp';
        const more = vertical ? 'ArrowRight' : 'ArrowDown';
        if (e.key === less) { e.preventDefault(); onChange(value - step); }
        if (e.key === more) { e.preventDefault(); onChange(value + step); }
        if (e.key === 'Home') { e.preventDefault(); onReset(); }
      }}
    >
      <span className="resize-grip" aria-hidden="true" />
    </div>
  );
}

export default function UpdatesPage() {
  const ui = useUI();
  const [sources, setSources] = useState<WatchSource[] | null>(null);
  const [credentials, setCredentials] = useState<SiteCredential[]>([]);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  // In alternativa a una fonte: tutte le fonti dello stesso sito
  const [activeSite, setActiveSite] = useState<string | null>(null);
  // In alternativa: tutte le fonti di una categoria ("-" = senza categoria)
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardUrl, setWizardUrl] = useState('');
  const [wizardBookmarkId, setWizardBookmarkId] = useState<string | undefined>();
  const [wizardTitle, setWizardTitle] = useState('');
  const [editingSource, setEditingSource] = useState<WatchSource | null>(null);
  const [layout, updateLayout] = useUpdatesLayout();
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const sourceListRef = useRef<HTMLUListElement>(null);
  const sourceSearchRef = useRef<HTMLInputElement>(null);
  const [sourceQuery, setSourceQuery] = useState('');
  // Riga selezionata con la tastiera (id elemento, o giorno|chiave per un gruppo)
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  // Categorie appena create, ancora senza fonti (esistono finché non ci si sposta qualcosa)
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  // Trascinamento delle fonti: id trascinati e destinazione evidenziata
  const dragIds = useRef<string[] | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  // Anteprima: id dell'elemento aperto (l'oggetto si rilegge dagli elementi caricati)
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewStash = useRef<WatchItem | null>(null);
  // Gruppi aperti, per giorno + chiave del gruppo
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Chiusura del menu Layout con click esterno o Esc
  useEffect(() => {
    if (!layoutMenuOpen) return;
    const onDown = (e: MouseEvent) => { if (!layoutMenuRef.current?.contains(e.target as Node)) setLayoutMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLayoutMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [layoutMenuOpen]);

  // Stato iniziale dall'URL: ?source=…&view=unread, oppure apertura del wizard (?add_url=…&bookmark=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActiveSource(params.get('source'));
    setActiveSite(params.get('source') ? null : params.get('site'));
    setActiveCategory(params.get('source') || params.get('site') ? null : params.get('category'));
    setOnlyUnread(params.get('view') === 'unread');
    const addUrl = params.get('add_url');
    if (addUrl) {
      setWizardUrl(addUrl);
      setWizardBookmarkId(params.get('bookmark') ?? undefined);
      setWizardTitle(params.get('add_title') ?? '');
      setShowWizard(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (activeSource) params.set('source', activeSource);
    else if (activeSite) params.set('site', activeSite);
    else if (activeCategory) params.set('category', activeCategory);
    if (onlyUnread) params.set('view', 'unread');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `/updates?${qs}` : '/updates');
  }, [ready, activeSource, activeSite, activeCategory, onlyUnread]);

  const loadSources = useCallback(async () => {
    try { setSources(await watchApi.sources()); } catch { /* il contatore resta quello precedente */ }
    try { setCredentials(await watchApi.credentials()); } catch { /* avviso accessi non disponibile */ }
  }, []);

  const loadItems = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await watchApi.items({
        page: p,
        limit: PAGE_SIZE,
        ...(activeSource ? { sourceId: activeSource } : activeSite ? { domain: activeSite } : activeCategory ? { category: activeCategory } : {}),
        unread: onlyUnread ? true : undefined,
      });
      setItems((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.meta.total);
      setPage(p);
    } catch {
      ui.toast('Impossibile caricare gli aggiornamenti. Riprova tra poco.', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeSource, activeSite, activeCategory, onlyUnread, ui]);

  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { if (ready) loadItems(1); }, [ready, loadItems]);

  useEffect(() => {
    const t = setInterval(loadSources, 60_000);
    return () => clearInterval(t);
  }, [loadSources]);

  const sourceList = sources ?? [];
  const expiredCreds = credentials.filter((c) => c.status === 'EXPIRED');

  // Il controllo delle fonti può aver appena segnato un accesso come scaduto: allinea l'header
  useEffect(() => {
    window.dispatchEvent(new Event(CREDENTIALS_CHANGED_EVENT));
  }, [expiredCreds.length]);
  const totalUnread = sourceList.reduce((s, x) => s + x.unreadCount, 0);
  // Il contatore nell'intestazione non conta le fonti in riepilogo: arrivano una volta al giorno
  const headerUnread = sourceList.reduce((s, x) => s + (x.delivery === 'DIGEST' ? 0 : x.unreadCount), 0);

  // Allinea il contatore nell'header (solo dopo il primo caricamento)
  useEffect(() => {
    if (sources) window.dispatchEvent(new CustomEvent(WATCH_UNREAD_EVENT, { detail: headerUnread }));
  }, [sources, headerUnread]);

  const grouped = useMemo(() => {
    const days: { day: string; items: WatchItem[]; groups: ItemGroup[] }[] = [];
    for (const it of items) {
      const day = dayLabel(it.firstSeenAt);
      const last = days[days.length - 1];
      if (last && last.day === day) last.items.push(it);
      else days.push({ day, items: [it], groups: [] });
    }
    for (const d of days) {
      d.groups = layout.groupSimilar
        ? groupItems(d.items)
        : d.items.map((it) => ({ key: it.id, items: [it], thread: false, title: it.title }));
    }
    return days;
  }, [items, layout.groupSimilar]);

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /* ── Azioni elemento ─────────────────────────────────────────────────────── */
  const adjustUnread = (sourceId: string, delta: number) =>
    setSources((prev) => prev && prev.map((s) => (s.id === sourceId ? { ...s, unreadCount: Math.max(0, s.unreadCount + delta) } : s)));

  async function setRead(item: WatchItem, isRead: boolean) {
    if (item.isRead === isRead) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isRead } : i)));
    adjustUnread(item.sourceId, isRead ? -1 : 1);
    try { await watchApi.updateItem(item.id, { isRead }); } catch { loadItems(1); loadSources(); }
  }

  async function setReadMany(list: WatchItem[], isRead: boolean) {
    const changed = list.filter((i) => i.isRead !== isRead);
    if (changed.length === 0) return;
    const ids = new Set(changed.map((i) => i.id));
    setItems((prev) => prev.map((i) => (ids.has(i.id) ? { ...i, isRead } : i)));
    for (const i of changed) adjustUnread(i.sourceId, isRead ? -1 : 1);
    try {
      await Promise.all(changed.map((i) => watchApi.updateItem(i.id, { isRead })));
    } catch {
      loadItems(1);
      loadSources();
    }
  }

  async function hideMany(list: WatchItem[]) {
    const ids = new Set(list.map((i) => i.id));
    setItems((prev) => prev.filter((i) => !ids.has(i.id)));
    for (const i of list) if (!i.isRead) adjustUnread(i.sourceId, -1);
    try {
      await Promise.all(list.map((i) => watchApi.updateItem(i.id, { isHidden: true })));
      ui.toast(`${list.length} elementi nascosti`, {
        action: {
          label: 'Annulla',
          onClick: async () => {
            await Promise.all(list.map((i) => watchApi.updateItem(i.id, { isHidden: false }))).catch(() => {});
            loadItems(1);
            loadSources();
          },
        },
      });
    } catch {
      loadItems(1);
      loadSources();
    }
  }

  async function hide(item: WatchItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (!item.isRead) adjustUnread(item.sourceId, -1);
    try {
      await watchApi.updateItem(item.id, { isHidden: true });
      ui.toast('Elemento nascosto', {
        action: {
          label: 'Annulla',
          onClick: async () => {
            await watchApi.updateItem(item.id, { isHidden: false }).catch(() => {});
            loadItems(1);
            loadSources();
          },
        },
      });
    } catch {
      loadItems(1);
      loadSources();
    }
  }

  async function save(item: WatchItem) {
    try {
      const updated = await watchApi.saveItem(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updated, source: i.source } : i)));
      if (!item.isRead) adjustUnread(item.sourceId, -1);
      ui.toast('Salvato tra i segnalibri');
    } catch (err) {
      ui.toast(`Salvataggio non riuscito: ${(err as Error).message}`, { kind: 'error' });
    }
  }

  async function readAll() {
    try {
      await watchApi.readAll(
        activeSource ? { sourceId: activeSource } : activeSite ? { domain: activeSite } : activeCategory ? { category: activeCategory } : {},
      );
      loadItems(1);
      loadSources();
    } catch {
      ui.toast('Operazione non riuscita. Riprova.', { kind: 'error' });
    }
  }

  /* ── Azioni fonte ────────────────────────────────────────────────────────── */
  const current = sourceList.find((s) => s.id === activeSource) ?? null;

  // Fonti raggruppate per sito, nell'ordine in cui compaiono
  const groups = useMemo(() => {
    const bySite = new Map<string, WatchSource[]>();
    for (const s of sourceList) {
      const site = siteOf(s.url);
      bySite.set(site, [...(bySite.get(site) ?? []), s]);
    }
    return [...bySite].map(([site, list]) => ({ site, sources: list, unread: list.reduce((n, x) => n + x.unreadCount, 0) }));
  }, [sourceList]);
  const currentGroup = !current && activeSite ? groups.find((g) => g.site === activeSite) ?? null : null;

  // Colonna Fonti: categorie → siti → fonti, nell'ordine scelto
  const sortMode = layout.sourceSort;
  const sections = useMemo<Section[]>(() => {
    const list = [...sourceList];
    if (sortMode === 'unread') list.sort((a, b) => b.unreadCount - a.unreadCount || byPosition(a, b));
    else if (sortMode === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
    else if (sortMode === 'recent') list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    else list.sort(byPosition);

    const byCategory = new Map<string | null, Map<string, WatchSource[]>>();
    for (const c of pendingCategories) byCategory.set(c, new Map());
    for (const s of list) {
      const cat = s.category ?? null;
      const sites = byCategory.get(cat) ?? new Map<string, WatchSource[]>();
      byCategory.set(cat, sites);
      const site = siteOf(s.url);
      sites.set(site, [...(sites.get(site) ?? []), s]);
    }
    const out = [...byCategory].map(([category, sites]) => {
      const siteGroups = [...sites].map(([site, srcs]) => ({ site, sources: srcs, unread: srcs.reduce((n, x) => n + x.unreadCount, 0) }));
      if (sortMode === 'unread') siteGroups.sort((a, b) => b.unread - a.unread);
      if (sortMode === 'name') siteGroups.sort((a, b) => a.site.localeCompare(b.site, 'it'));
      return {
        category,
        groups: siteGroups,
        unread: siteGroups.reduce((n, g) => n + g.unread, 0),
        count: siteGroups.reduce((n, g) => n + g.sources.length, 0),
      };
    });
    // Senza categoria sempre in fondo; nell'ordine personalizzato le categorie seguono le loro fonti
    out.sort((a, b) => {
      if (a.category === null || b.category === null) return (a.category === null ? 1 : 0) - (b.category === null ? 1 : 0);
      return sortMode === 'custom' ? 0 : a.category.localeCompare(b.category, 'it');
    });
    return out;
  }, [sourceList, sortMode, pendingCategories]);
  const hasCategories = sections.some((sec) => sec.category !== null);
  const categoryNames = sections.flatMap((sec) => (sec.category ? [sec.category] : []));

  // Ricerca nella colonna Fonti: per nome, indirizzo, sito o categoria
  const query = fold(sourceQuery.trim());
  const visibleSections = useMemo(() => {
    if (!query) return sections;
    return sections
      .map((sec) => {
        if (sec.category && fold(sec.category).includes(query)) return sec;
        const groupsF = sec.groups
          .map((g) => ({
            ...g,
            sources: fold(g.site).includes(query)
              ? g.sources
              : g.sources.filter((s) => fold(s.name).includes(query) || fold(s.url).includes(query)),
          }))
          .filter((g) => g.sources.length > 0);
        return { ...sec, groups: groupsF };
      })
      .filter((sec) => sec.groups.length > 0);
  }, [sections, query]);
  const visibleGroups = visibleSections.flatMap((sec) => sec.groups);
  const flatVisibleSources = visibleGroups.flatMap((g) => g.sources);

  function toggleCategory(key: string) {
    const set = new Set(layout.collapsedCategories);
    if (set.has(key)) set.delete(key); else set.add(key);
    updateLayout({ collapsedCategories: [...set] });
  }

  function selectCategory(category: string) {
    setActiveCategory(category);
    setActiveSource(null);
    setActiveSite(null);
  }

  /**
   * Sposta fonti: before = id davanti a cui metterle ('END' in fondo, null = ordine invariato);
   * category = nuova categoria (undefined = invariata). Il riordino vale solo nell'ordine personalizzato.
   */
  async function moveSources(ids: string[], before: string | 'END' | null, category?: string | null) {
    const all = sources ?? [];
    const changeCat = category === undefined ? [] : ids.filter((id) => (all.find((s) => s.id === id)?.category ?? null) !== category);
    let order: string[] | null = null;
    if (before !== null && sortMode === 'custom' && !ids.includes(before)) {
      const rest = [...all].sort(byPosition).map((s) => s.id).filter((id) => !ids.includes(id));
      const at = before === 'END' ? rest.length : rest.indexOf(before);
      rest.splice(at < 0 ? rest.length : at, 0, ...ids);
      order = rest;
      if (order.every((id, i) => all.find((s) => s.id === id)?.position === i)) order = null;
    }
    if (!order && changeCat.length === 0) return;
    const previous = sources;
    setSources((prev) => prev && prev.map((s) => ({
      ...s,
      ...(order && { position: order.indexOf(s.id) }),
      ...(changeCat.includes(s.id) && { category: category ?? null }),
    })));
    if (category) setPendingCategories((prev) => prev.filter((c) => c !== category));
    try {
      if (changeCat.length) await Promise.all(changeCat.map((id) => watchApi.updateSource(id, { category: category ?? null })));
      if (order) await watchApi.reorderSources(order);
      if (changeCat.length) ui.toast(category ? `Spostat${changeCat.length === 1 ? 'a' : 'e'} in “${category}”` : 'Categoria tolta');
    } catch {
      setSources(previous);
      ui.toast('Spostamento non riuscito. Riprova.', { kind: 'error' });
    }
  }

  // Props per il trascinamento: cosa si trascina e dove si può lasciare
  function dragProps(ids: string[]) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        dragIds.current = ids;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ids.join(','));
      },
      onDragEnd: () => { dragIds.current = null; setDropTarget(null); },
    };
  }

  function dropProps(key: string, onDrop: (ids: string[]) => void) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!dragIds.current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropTarget !== key) setDropTarget(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget((t) => (t === key ? null : t));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const ids = dragIds.current;
        dragIds.current = null;
        setDropTarget(null);
        if (ids) onDrop(ids);
      },
    };
  }

  /** Alt+↑/↓ su una fonte: la sposta nell'ordine personalizzato (anche tra categorie). */
  function moveByKeyboard(e: React.KeyboardEvent, s: WatchSource) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    if (sortMode !== 'custom') {
      ui.toast('Per spostare le fonti scegli l’ordine “Personalizzato”');
      return;
    }
    const idx = flatVisibleSources.findIndex((x) => x.id === s.id);
    const target = e.key === 'ArrowUp' ? flatVisibleSources[idx - 1] : flatVisibleSources[idx + 1];
    if (!target) return;
    const before = e.key === 'ArrowUp' ? target.id : flatVisibleSources[idx + 2]?.id ?? 'END';
    moveSources([s.id], before, target.category ?? null).then(() => {
      setTimeout(() => document.querySelector<HTMLButtonElement>(`[data-source-btn="${CSS.escape(s.id)}"]`)?.focus(), 0);
    });
  }

  async function newCategory() {
    setSortMenuOpen(false);
    const name = (await ui.prompt({ title: 'Nuova categoria', label: 'Nome', placeholder: 'es. Riviste, Forum, News', confirmLabel: 'Crea' }))?.trim();
    if (!name) return;
    if (name.length > 40) { ui.toast('Nome troppo lungo (max 40 caratteri)', { kind: 'error' }); return; }
    if (!categoryNames.includes(name)) setPendingCategories((prev) => [...prev, name]);
    ui.toast(`Categoria “${name}” creata: trascinaci dentro le fonti, o sceglila modificando una fonte`);
  }

  async function renameCategory(from: string) {
    const to = (await ui.prompt({ title: 'Rinomina categoria', label: 'Nome', initialValue: from, confirmLabel: 'Rinomina' }))?.trim();
    if (to === undefined || to === from) return;
    if (!to) return removeCategory(from);
    if (to.length > 40) { ui.toast('Nome troppo lungo (max 40 caratteri)', { kind: 'error' }); return; }
    if (pendingCategories.includes(from)) {
      setPendingCategories((prev) => prev.map((c) => (c === from ? to : c)));
      return;
    }
    try {
      await watchApi.renameCategory(from, to);
      setSources((prev) => prev && prev.map((s) => (s.category === from ? { ...s, category: to } : s)));
      if (activeCategory === from) setActiveCategory(to);
      ui.toast(categoryNames.includes(to) ? `Fonti unite in “${to}”` : 'Categoria rinominata');
    } catch {
      ui.toast('Operazione non riuscita. Riprova.', { kind: 'error' });
    }
  }

  async function removeCategory(name: string) {
    if (pendingCategories.includes(name)) {
      setPendingCategories((prev) => prev.filter((c) => c !== name));
      return;
    }
    const ok = await ui.confirm({
      title: 'Togliere la categoria?',
      message: <>Le fonti di <strong>{name}</strong> restano, senza categoria.</>,
      confirmLabel: 'Togli categoria',
    });
    if (!ok) return;
    try {
      await watchApi.renameCategory(name, null);
      setSources((prev) => prev && prev.map((s) => (s.category === name ? { ...s, category: null } : s)));
      if (activeCategory === name) setActiveCategory(null);
      ui.toast('Categoria tolta');
    } catch {
      ui.toast('Operazione non riuscita. Riprova.', { kind: 'error' });
    }
  }

  // Chiusura del menu Ordina con click esterno o Esc
  useEffect(() => {
    if (!sortMenuOpen) return;
    const onDown = (e: MouseEvent) => { if (!sortMenuRef.current?.contains(e.target as Node)) setSortMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSortMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [sortMenuOpen]);

  function toggleSite(site: string) {
    const set = new Set(layout.collapsedSites);
    if (set.has(site)) set.delete(site); else set.add(site);
    updateLayout({ collapsedSites: [...set] });
  }

  function selectSource(id: string | null) {
    setActiveSource(id);
    setActiveSite(null);
    setActiveCategory(null);
  }

  function selectSite(site: string) {
    setActiveSite(site);
    setActiveSource(null);
    setActiveCategory(null);
  }

  async function toggleActive(s: WatchSource) {
    try {
      const updated = await watchApi.updateSource(s.id, { isActive: !s.isActive });
      setSources((prev) => prev && prev.map((x) => (x.id === s.id ? { ...x, ...updated } : x)));
      ui.toast(updated.isActive ? 'Fonte riattivata' : 'Fonte sospesa');
    } catch {
      ui.toast('Operazione non riuscita. Riprova.', { kind: 'error' });
    }
  }

  async function changeInterval(s: WatchSource, minutes: number) {
    try {
      const updated = await watchApi.updateSource(s.id, { intervalMinutes: minutes });
      setSources((prev) => prev && prev.map((x) => (x.id === s.id ? { ...x, ...updated } : x)));
      ui.toast(`Controllo ogni ${every(minutes)}`);
    } catch {
      ui.toast('Modifica non riuscita. Riprova.', { kind: 'error' });
    }
  }

  async function checkNow(s: WatchSource) {
    try {
      await watchApi.checkNow(s.id);
      ui.toast('Controllo richiesto: avverrà entro un minuto');
    } catch {
      ui.toast('Richiesta non riuscita. Riprova.', { kind: 'error' });
    }
  }

  async function remove(s: WatchSource) {
    const ok = await ui.confirm({
      title: 'Eliminare la fonte?',
      message: <>La fonte <strong>{s.name}</strong> e tutti i suoi elementi verranno eliminati.</>,
      confirmLabel: 'Elimina fonte',
      danger: true,
    });
    if (!ok) return;
    try {
      await watchApi.deleteSource(s.id);
      if (activeSource === s.id) setActiveSource(null);
      setSources((prev) => prev && prev.filter((x) => x.id !== s.id));
      loadSources();
      loadItems(1);
      ui.toast('Fonte eliminata');
    } catch {
      ui.toast('Eliminazione non riuscita. Riprova.', { kind: 'error' });
    }
  }

  function openWizard() {
    setWizardUrl('');
    setWizardBookmarkId(undefined);
    setWizardTitle('');
    setShowWizard(true);
  }

  /* ── Navigazione da tastiera ──────────────────────────────────────────────── */
  // Righe nell'ordine in cui compaiono: un gruppo chiuso è una riga, se aperto seguono i suoi elementi
  const navRows = useMemo(() => {
    const rows: { id: string; group: ItemGroup; groupId: string; item?: WatchItem }[] = [];
    for (const d of grouped) {
      for (const g of d.groups) {
        const groupId = `${d.day}|${g.key}`;
        if (g.items.length === 1) { rows.push({ id: g.items[0].id, group: g, groupId, item: g.items[0] }); continue; }
        rows.push({ id: groupId, group: g, groupId });
        if (expanded.has(groupId)) for (const it of g.items) rows.push({ id: it.id, group: g, groupId, item: it });
      }
    }
    return rows;
  }, [grouped, expanded]);

  /** Elemento da aprire per un gruppo: in una discussione il primo post non letto, altrimenti il più recente. */
  function groupTarget(g: ItemGroup): WatchItem {
    const unread = g.items.filter((i) => !i.isRead);
    return g.thread && unread.length > 0 ? unread[unread.length - 1] : g.items[0];
  }

  // Anteprima: l'elemento si rilegge dalla lista (stato letto/salvato aggiornato)
  const previewItem = previewId
    ? items.find((i) => i.id === previewId) ?? (previewStash.current?.id === previewId ? previewStash.current : null)
    : null;

  function openPreview(it: WatchItem) {
    previewStash.current = it;
    setPreviewId(it.id);
    setRead(it, true);
  }

  function closePreview() {
    setPreviewId(null);
  }

  // Il gestore viene riletto a ogni render: usa sempre lo stato aggiornato
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
    if (showWizard || editingSource || document.querySelector('[role="dialog"]')) return;

    const idx = navRows.findIndex((r) => r.id === cursorId);
    const row = idx >= 0 ? navRows[idx] : null;
    const move = (to: number) => {
      if (navRows.length === 0) return;
      const next = navRows[Math.max(0, Math.min(navRows.length - 1, to))];
      setCursorId(next.id);
      // Con l'anteprima aperta, j/k sfogliano gli aggiornamenti
      if (previewId) openPreview(next.item ?? groupTarget(next.group));
    };

    switch (e.key) {
      case 'j': e.preventDefault(); move(idx < 0 ? 0 : idx + 1); break;
      case 'k': e.preventDefault(); move(idx < 0 ? 0 : idx - 1); break;
      case 'o':
      case 'Enter': {
        if (!row) return;
        // Invio su un pulsante o link mantiene il suo comportamento
        if (e.key === 'Enter' && el && el !== document.body) return;
        e.preventDefault();
        const target = row.item ?? groupTarget(row.group);
        window.open(target.url, '_blank', 'noopener,noreferrer');
        if (row.item) setRead(row.item, true); else setReadMany(row.group.items, true);
        break;
      }
      case 'm':
        if (!row) return;
        e.preventDefault();
        if (row.item) setRead(row.item, !row.item.isRead);
        else setReadMany(row.group.items, row.group.items.some((i) => !i.isRead));
        break;
      case 's':
        if (!row?.item || row.item.savedBookmarkId) return;
        e.preventDefault();
        save(row.item);
        break;
      case 'h': {
        if (!row) return;
        e.preventDefault();
        // La selezione passa alla riga successiva (o precedente se era l'ultima)
        const gone = new Set(row.item ? [row.id] : [row.id, ...row.group.items.map((i) => i.id)]);
        const next = navRows.slice(idx + 1).find((r) => !gone.has(r.id)) ?? navRows.slice(0, idx).reverse().find((r) => !gone.has(r.id));
        setCursorId(next?.id ?? null);
        if (row.item) hide(row.item); else hideMany(row.group.items);
        break;
      }
      case 'x':
        if (!row || row.group.items.length < 2) return;
        e.preventDefault();
        toggleGroup(row.groupId);
        setCursorId(row.groupId);
        break;
      case 'u': e.preventDefault(); setOnlyUnread((v) => !v); setCursorId(null); break;
      case '/':
        e.preventDefault();
        if (!layout.sidebarOpen) updateLayout({ sidebarOpen: true });
        setTimeout(() => sourceSearchRef.current?.focus(), 0);
        break;
      case 'p': {
        if (!row) return;
        e.preventDefault();
        const target = row.item ?? groupTarget(row.group);
        if (previewId === target.id) closePreview(); else openPreview(target);
        break;
      }
      case '?': e.preventDefault(); setShowShortcuts(true); break;
      case 'Escape':
        if (previewId) closePreview(); else setCursorId(null);
        break;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // La riga selezionata resta visibile
  useEffect(() => {
    if (!cursorId) return;
    document.querySelector(`[data-row="${CSS.escape(cursorId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursorId]);

  /* ── Colonna Fonti: un sito con le sue fonti ─────────────────────────────── */
  function renderSiteGroup(g: SiteGroup, category: string | null, indent: number) {
    const multi = g.sources.length > 1;
    const collapsed = multi && !query && layout.collapsedSites.includes(g.site);
    const reorderable = sortMode === 'custom';
    const groupKey = `g:${category ?? NO_CATEGORY}|${g.site}`;
    return (
      <li key={g.site}>
        {multi && (
          <div
            className={`bookmark-item ${dropTarget === groupKey ? 'drop-before' : ''}`}
            style={{ paddingLeft: 4 + indent }}
            aria-current={activeSite === g.site ? 'true' : undefined}
            {...dragProps(g.sources.map((x) => x.id))}
            {...dropProps(groupKey, (ids) => moveSources(ids, reorderable ? g.sources[0].id : null, category))}
          >
            <button
              type="button"
              className="icon-btn icon-btn-sm shrink-0"
              onClick={() => toggleSite(g.site)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? `Mostra le fonti di ${g.site}` : `Nascondi le fonti di ${g.site}`}
              title={collapsed ? 'Espandi' : 'Comprimi'}
            >
              {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              style={{ border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', padding: 0 }}
              title={`Tutte le ${g.sources.length} fonti di ${g.site}${reorderable ? ' · trascina per spostarle' : ''}`}
              onClick={() => selectSite(g.site)}
            >
              <SiteIcon site={g.site} />
              <span className="bookmark-title font-semibold" translate="no">{g.site}</span>
              <span className="text-xs text-fg-faint tabular-nums">{g.sources.length}</span>
              {g.unread > 0 && <span className="badge badge-soft">{g.unread}</span>}
            </button>
          </div>
        )}
        {!collapsed && (
          <ul style={{ listStyle: 'none' }} aria-label={multi ? `Fonti di ${g.site}` : undefined}>
            {g.sources.map((s) => {
              const key = `s:${s.id}`;
              return (
                <li key={s.id}>
                  <div
                    className={`bookmark-item ${dropTarget === key ? 'drop-before' : ''}`}
                    style={{ opacity: s.isActive ? 1 : 0.55, paddingLeft: (multi ? 30 : 14) + indent }}
                    aria-current={activeSource === s.id ? 'true' : undefined}
                    {...dragProps([s.id])}
                    {...dropProps(key, (ids) => moveSources(ids, reorderable ? s.id : null, category))}
                  >
                    {reorderable && <GripVertical size={12} className="drag-grip" aria-hidden="true" />}
                    <button
                      type="button"
                      data-source-btn={s.id}
                      className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      style={{ border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', padding: 0 }}
                      title={`${s.status === 'ERROR' ? `Errore: ${s.lastError}` : `Ultimo controllo ${relative(s.lastCheckedAt)}`}${reorderable ? ' · trascina o Alt+↑/↓ per spostare' : ''}`}
                      onClick={() => selectSource(s.id)}
                      onKeyDown={(e) => moveByKeyboard(e, s)}
                    >
                      {s.status === 'ERROR'
                        ? <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} aria-label="Errore" />
                        : !s.isActive
                          ? <Pause size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-label="Sospesa" />
                          : !multi
                            ? <SiteIcon site={g.site} />
                            : s.mode === 'FEED'
                              ? <Rss size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />
                              : s.mode === 'THREAD'
                                ? <MessagesSquare size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />
                                : <LayoutList size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />}
                      <span className="bookmark-title" style={layout.wrapSourceNames ? { whiteSpace: 'normal', overflowWrap: 'anywhere' } : undefined}>{s.name}</span>
                      {s.delivery === 'INSTANT' && <Bell size={12} className="shrink-0 text-fg-faint" aria-label="Notifica subito" />}
                      {s.delivery === 'DIGEST' && <Newspaper size={12} className="shrink-0 text-fg-faint" aria-label="Riepilogo giornaliero" />}
                      {s.unreadCount > 0 && <span className="badge badge-soft">{s.unreadCount}</span>}
                    </button>
                    <span className="row-actions">
                      <button type="button" className="icon-btn icon-btn-sm" onClick={() => setEditingSource(s)} aria-label={`Modifica ${s.name}`} title="Modifica">
                        <Pencil size={13} aria-hidden="true" />
                      </button>
                      <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => remove(s)} aria-label={`Smetti di seguire ${s.name}`} title="Smetti di seguire">
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  /* ── Righe della timeline ────────────────────────────────────────────────── */
  const rowPad = layout.compact ? '6px 6px 6px 14px' : '10px 6px 10px 14px';
  const titleClass = `${layout.wrapTitles ? 'block break-words' : 'block truncate'} ${layout.compact ? 'text-[13px]' : 'text-[14px]'} hover:underline`;

  function renderItem(it: WatchItem, nested = false) {
    return (
      <li
        key={it.id}
        data-row={it.id}
        className={`bookmark-item ${cursorId === it.id ? 'kbd-cursor' : ''} ${previewId === it.id ? 'is-previewed' : ''}`}
        onClick={(e) => {
          // Un clic sulla riga (non su link o pulsanti) apre l'anteprima
          if ((e.target as HTMLElement).closest('a, button')) return;
          setCursorId(it.id);
          openPreview(it);
        }}
        style={{ padding: nested ? rowPad.replace(/14px$/, '38px') : rowPad, borderTop: '1px solid var(--border)', alignItems: 'flex-start' }}
      >
        <span
          className="mt-1.5 shrink-0 rounded-full"
          style={{ width: 7, height: 7, background: it.isRead ? 'transparent' : 'var(--accent)' }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <a
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className={titleClass}
            style={{ fontWeight: it.isRead ? 400 : 600, color: it.isRead ? 'var(--text-muted)' : 'var(--text-strong)' }}
            onClick={() => setRead(it, true)}
            onAuxClick={(e) => { if (e.button === 1) setRead(it, true); }}
          >
            {!it.isRead && <span className="sr-only">Non letto: </span>}
            {it.title}
          </a>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-fg-faint">
            {!nested && <><span>{it.source.name}</span><span aria-hidden="true">·</span></>}
            <time dateTime={it.firstSeenAt} className="tabular-nums">{fmtTime.format(new Date(it.firstSeenAt))}</time>
            {it.kind === 'UPDATED' && <span style={{ color: 'var(--warning)' }}>· aggiornato</span>}
            {it.matchedTerms.map((t) => <span key={t} className="chip">{t}</span>)}
            {it.savedBookmarkId && <span style={{ color: 'var(--success)' }}>· salvato</span>}
          </div>
        </div>
        <span className="row-actions">
          <button type="button" className="icon-btn" onClick={() => { setCursorId(it.id); openPreview(it); }} aria-label="Anteprima" title="Anteprima (p)">
            <Eye size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setRead(it, !it.isRead)}
            aria-label={it.isRead ? 'Segna come non letto' : 'Segna come letto'}
            title={it.isRead ? 'Segna come non letto' : 'Segna come letto'}
          >
            {it.isRead ? <Circle size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          </button>
          {!it.savedBookmarkId && (
            <button type="button" className="icon-btn" onClick={() => save(it)} aria-label="Salva tra i segnalibri" title="Salva tra i segnalibri">
              <BookmarkPlus size={15} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => hide(it)} aria-label="Nascondi" title="Nascondi">
            <EyeOff size={15} aria-hidden="true" />
          </button>
        </span>
      </li>
    );
  }

  function renderGroup(g: ItemGroup, day: string) {
    if (g.items.length === 1) return renderItem(g.items[0]);
    const id = `${day}|${g.key}`;
    const open = expanded.has(id);
    const unread = g.items.filter((i) => !i.isRead);
    const target = groupTarget(g);
    const sourceNames = [...new Set(g.items.map((i) => i.source.name))];
    const count = g.digest
      ? `${g.items.length} novità del giorno`
      : g.thread
        ? `${g.items.length} nuovi post`
        : `${g.items.length} volte`;
    return (
      <li key={g.key} style={{ borderTop: '1px solid var(--border)' }}>
        <div
          data-row={id}
          className={`bookmark-item ${cursorId === id ? 'kbd-cursor' : ''} ${previewId === target.id ? 'is-previewed' : ''}`}
          style={{ padding: rowPad, alignItems: 'flex-start' }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a, button')) return;
            setCursorId(id);
            openPreview(target);
          }}
        >
          <span
            className="mt-1.5 shrink-0 rounded-full"
            style={{ width: 7, height: 7, background: unread.length > 0 ? 'var(--accent)' : 'transparent' }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              className={titleClass}
              style={{ fontWeight: unread.length > 0 ? 600 : 400, color: unread.length > 0 ? 'var(--text-strong)' : 'var(--text-muted)' }}
              onClick={() => setReadMany(g.items, true)}
              onAuxClick={(e) => { if (e.button === 1) setReadMany(g.items, true); }}
            >
              {g.digest && <Newspaper size={13} className="inline mr-1.5 -mt-0.5 text-fg-faint" aria-hidden="true" />}
              {g.thread && <MessagesSquare size={13} className="inline mr-1.5 -mt-0.5 text-fg-faint" aria-hidden="true" />}
              {g.title}
            </a>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-fg-faint">
              <button
                type="button"
                className="pill"
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                aria-expanded={open}
                onClick={() => toggleGroup(id)}
              >
                <ChevronRight size={12} aria-hidden="true" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .12s' }} />
                {count}{unread.length > 0 && unread.length < g.items.length && <> · {unread.length} da leggere</>}
              </button>
              <span>{sourceNames.join(', ')}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={g.items[0].firstSeenAt} className="tabular-nums">
                {fmtTime.format(new Date(g.items[g.items.length - 1].firstSeenAt))}–{fmtTime.format(new Date(g.items[0].firstSeenAt))}
              </time>
            </div>
          </div>
          <span className="row-actions">
            <button type="button" className="icon-btn" onClick={() => { setCursorId(id); openPreview(target); }} aria-label="Anteprima" title={g.thread ? 'Anteprima del primo post da leggere (p)' : 'Anteprima (p)'}>
              <Eye size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setReadMany(g.items, unread.length > 0)}
              aria-label={unread.length > 0 ? 'Segna tutti come letti' : 'Segna tutti come non letti'}
              title={unread.length > 0 ? 'Segna tutti come letti' : 'Segna tutti come non letti'}
            >
              {unread.length > 0 ? <CheckCheck size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
            </button>
            <button type="button" className="icon-btn" onClick={() => hideMany(g.items)} aria-label="Nascondi tutti" title="Nascondi tutti">
              <EyeOff size={15} aria-hidden="true" />
            </button>
          </span>
        </div>
        {open && <ul style={{ listStyle: 'none' }}>{g.items.map((it) => renderItem(it, true))}</ul>}
      </li>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className={previewItem ? 'has-preview' : undefined}>
      <div className="toolbar">
        <h1 className="page-title mr-2">Aggiornamenti</h1>
        <div className="tabs" role="tablist" aria-label="Filtro">
          <button type="button" role="tab" className="tab" aria-selected={!onlyUnread} onClick={() => setOnlyUnread(false)}>Tutti</button>
          <button type="button" role="tab" className="tab" aria-selected={onlyUnread} onClick={() => setOnlyUnread(true)}>Non letti</button>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowNotifications(true)}
          aria-label="Notifiche"
          title="Notifiche: Telegram, parole chiave, riepilogo"
        >
          <Bell size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn hidden md:inline-flex"
          onClick={() => setShowShortcuts(true)}
          aria-label="Scorciatoie da tastiera"
          title="Scorciatoie da tastiera (?)"
        >
          <Keyboard size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => updateLayout({ sidebarOpen: !layout.sidebarOpen })}
          aria-pressed={layout.sidebarOpen}
          aria-label={layout.sidebarOpen ? 'Nascondi le fonti' : 'Mostra le fonti'}
          title={layout.sidebarOpen ? 'Nascondi le fonti' : 'Mostra le fonti'}
        >
          {layout.sidebarOpen ? <PanelLeftClose size={16} aria-hidden="true" /> : <PanelLeftOpen size={16} aria-hidden="true" />}
        </button>
        <div className="relative" ref={layoutMenuRef}>
          <button
            type="button"
            className="icon-btn"
            aria-haspopup="menu"
            aria-expanded={layoutMenuOpen}
            aria-label="Layout della pagina"
            title="Layout"
            onClick={() => setLayoutMenuOpen((o) => !o)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
          </button>
          {layoutMenuOpen && (
            <div className="menu right-0 mt-2" role="menu" style={{ minWidth: 250 }}>
              {([
                ['sidebarOpen', 'Mostra la colonna Fonti'],
                ['sidebarSticky', 'Fonti ferme durante lo scorrimento'],
                ['wrapSourceNames', 'Nomi delle fonti completi'],
                ['fullWidth', 'Usa tutta la larghezza'],
                ['wrapTitles', 'Titoli completi su più righe'],
                ['compact', 'Vista compatta'],
                ['groupSimilar', 'Accorpa aggiornamenti uguali'],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={layout[k]}
                  className="menu-item"
                  onClick={() => updateLayout({ [k]: !layout[k] })}
                >
                  <Check size={15} aria-hidden="true" style={{ opacity: layout[k] ? 1 : 0 }} /> {label}
                </button>
              ))}
              <div className="menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => updateLayout({ sidebarWidth: SIDEBAR_DEFAULT, sidebarHeight: null })}
                disabled={layout.sidebarWidth === SIDEBAR_DEFAULT && layout.sidebarHeight == null}
              >
                <span style={{ width: 15 }} aria-hidden="true" /> Dimensioni fonti predefinite
              </button>
            </div>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={readAll} aria-label="Segna tutto come letto">
          <CheckCheck size={15} aria-hidden="true" /> <span className="hidden sm:inline">Segna tutto letto</span>
        </button>
        <button type="button" className="btn btn-primary" onClick={openWizard}>
          <Plus size={15} aria-hidden="true" /> Fonte
        </button>
      </div>

      <div
        className="flex flex-col md:flex-row gap-4 md:gap-0 px-4 pb-10 mx-auto items-start"
        style={{ maxWidth: layout.fullWidth ? 'none' : 1400 }}
      >
        {/* ── Fonti ──────────────────────────────────────────────────────── */}
        {layout.sidebarOpen && (
        <div
          className={`w-full md:w-[var(--sources-w)] md:shrink-0 flex items-stretch ${layout.sidebarSticky ? 'md:sticky' : ''}`}
          style={{ top: 'calc(var(--header-h) + 12px)', '--sources-w': `${layout.sidebarWidth}px` } as React.CSSProperties}
        >
        <div className="flex-1 min-w-0">
        <nav aria-label="Fonti" className="card overflow-hidden">
          <div className="card-header flex items-center">
            <span className="flex-1">Fonti</span>
            <div className="relative" ref={sortMenuRef}>
              <button
                type="button"
                className="icon-btn icon-btn-sm"
                aria-haspopup="menu"
                aria-expanded={sortMenuOpen}
                aria-label="Ordina e organizza le fonti"
                title={`Ordina: ${SORTS.find((x) => x.value === sortMode)?.label}`}
                onClick={() => setSortMenuOpen((o) => !o)}
              >
                <ArrowUpDown size={14} aria-hidden="true" />
              </button>
              {sortMenuOpen && (
                <div className="menu right-0 mt-2" role="menu" style={{ minWidth: 230 }}>
                  <div className="px-2.5 py-1.5 text-xs text-fg-faint">Ordina le fonti</div>
                  {SORTS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={sortMode === o.value}
                      className="menu-item"
                      onClick={() => { updateLayout({ sourceSort: o.value }); setSortMenuOpen(false); }}
                    >
                      <Check size={15} aria-hidden="true" style={{ opacity: sortMode === o.value ? 1 : 0 }} /> {o.label}
                    </button>
                  ))}
                  <div className="menu-sep" />
                  <button type="button" role="menuitem" className="menu-item" onClick={newCategory}>
                    <FolderPlus size={15} aria-hidden="true" /> Nuova categoria…
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              onClick={() => updateLayout({ sidebarOpen: false })}
              aria-label="Nascondi le fonti"
              title="Nascondi le fonti"
            >
              <PanelLeftClose size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="source-search">
            <Search size={14} className="text-fg-faint shrink-0" aria-hidden="true" />
            <label htmlFor="source-search" className="sr-only">Cerca tra le fonti</label>
            <input
              ref={sourceSearchRef}
              id="source-search"
              type="search"
              name="source-search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Cerca fonte…  ( / )"
              value={sourceQuery}
              onChange={(e) => setSourceQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSourceQuery(''); e.currentTarget.blur(); }
                // Invio apre la prima fonte trovata
                if (e.key === 'Enter') {
                  const first = visibleGroups[0];
                  if (!first && visibleSections[0]?.category) selectCategory(visibleSections[0].category);
                  if (first) {
                    if (first.sources.length === 1) selectSource(first.sources[0].id); else selectSite(first.site);
                  }
                }
              }}
            />
            {sourceQuery && (
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => { setSourceQuery(''); sourceSearchRef.current?.focus(); }} aria-label="Cancella ricerca">
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          <ul
            ref={sourceListRef}
            className={`py-1 overflow-y-auto ${layout.sidebarHeight == null ? `max-h-[40vh] ${layout.sidebarSticky ? 'md:max-h-[calc(100vh-200px)]' : 'md:max-h-none'}` : ''}`}
            style={{ listStyle: 'none', overscrollBehavior: 'contain', height: layout.sidebarHeight ?? undefined }}
          >
            <li>
              <button
                type="button"
                className="bookmark-item w-full text-left"
                style={{ border: 'none', font: 'inherit', cursor: 'pointer' }}
                aria-current={activeSource === null && activeSite === null && activeCategory === null ? 'true' : undefined}
                onClick={() => selectSource(null)}
              >
                <span className="bookmark-title">Tutte le fonti</span>
                {totalUnread > 0 && <span className="badge">{totalUnread}</span>}
              </button>
            </li>
            {visibleSections.map((sec) => {
              const catKey = sec.category ?? NO_CATEGORY;
              const catCollapsed = hasCategories && !query && layout.collapsedCategories.includes(catKey);
              const dropKey = `c:${catKey}`;
              return (
                <li key={catKey}>
                  {hasCategories && (
                    <div
                      className={`bookmark-item category-row ${dropTarget === dropKey ? 'drop-into' : ''}`}
                      aria-current={activeCategory === catKey ? 'true' : undefined}
                      {...dropProps(dropKey, (ids) => moveSources(ids, null, sec.category))}
                    >
                      <button
                        type="button"
                        className="icon-btn icon-btn-sm shrink-0"
                        onClick={() => toggleCategory(catKey)}
                        aria-expanded={!catCollapsed}
                        aria-label={catCollapsed ? `Mostra ${sec.category ?? 'le fonti senza categoria'}` : `Nascondi ${sec.category ?? 'le fonti senza categoria'}`}
                        title={catCollapsed ? 'Espandi' : 'Comprimi'}
                      >
                        {catCollapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        style={{ border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', padding: 0 }}
                        onClick={() => selectCategory(catKey)}
                        title={sec.category ? `Tutti gli aggiornamenti di “${sec.category}”` : 'Fonti senza categoria'}
                      >
                        <Folder size={14} className="shrink-0 text-fg-faint" aria-hidden="true" />
                        <span className="bookmark-title text-xs font-semibold uppercase tracking-wider">{sec.category ?? 'Senza categoria'}</span>
                        <span className="text-xs text-fg-faint tabular-nums">{sec.count}</span>
                        {sec.unread > 0 && <span className="badge badge-soft">{sec.unread}</span>}
                      </button>
                      {sec.category && (
                        <span className="row-actions">
                          <button type="button" className="icon-btn icon-btn-sm" onClick={() => renameCategory(sec.category!)} aria-label={`Rinomina ${sec.category}`} title="Rinomina">
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          <button type="button" className="icon-btn icon-btn-sm" onClick={() => removeCategory(sec.category!)} aria-label={`Togli la categoria ${sec.category}`} title="Togli la categoria (le fonti restano)">
                            <X size={13} aria-hidden="true" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                  {!catCollapsed && sec.groups.length === 0 && (
                    <p className="px-3.5 py-2 text-xs text-fg-faint" style={{ paddingLeft: 36 }}>Trascina qui le fonti</p>
                  )}
                  {!catCollapsed && sec.groups.length > 0 && (
                    <ul style={{ listStyle: 'none' }} aria-label={sec.category ?? (hasCategories ? 'Senza categoria' : undefined)}>
                      {sec.groups.map((g) => renderSiteGroup(g, sec.category, hasCategories ? 14 : 0))}
                    </ul>
                  )}
                </li>
              );
            })}
            {query && visibleSections.length === 0 && (
              <li className="px-3.5 py-2.5 text-xs text-fg-muted">Nessuna fonte corrisponde a “{sourceQuery.trim()}”.</li>
            )}
            {sources?.length === 0 && (
              <li className="px-3.5 py-2.5 text-xs text-fg-muted">Nessuna fonte. Aggiungine una con “Fonte”.</li>
            )}
          </ul>
          <ResizeHandle
            vertical={false}
            label="Altezza dell'elenco fonti"
            value={layout.sidebarHeight ?? sourceListRef.current?.clientHeight ?? 400}
            min={LIST_MIN_HEIGHT}
            max={LIST_MAX_HEIGHT}
            onChange={(h) => updateLayout({ sidebarHeight: clampHeight(h) })}
            onReset={() => updateLayout({ sidebarHeight: null })}
          />
        </nav>
        </div>
        <ResizeHandle
          vertical
          className="hidden md:flex"
          label="Larghezza della colonna Fonti"
          value={layout.sidebarWidth}
          min={SIDEBAR_MIN}
          max={SIDEBAR_MAX}
          onChange={(w) => updateLayout({ sidebarWidth: clampWidth(w) })}
          onReset={() => updateLayout({ sidebarWidth: SIDEBAR_DEFAULT })}
        />
        </div>
        )}

        {/* ── Timeline ───────────────────────────────────────────────────── */}
        <section className="flex-1 min-w-0 w-full" aria-label="Elementi">
          {expiredCreds.map((c) => (
            <div key={c.id} className="alert-error flex flex-wrap items-center gap-3 mb-4" role="alert">
              <KeyRound size={16} className="shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-[200px]">
                L&apos;accesso a <strong translate="no">{c.domain}</strong> è scaduto
                {c.sourceCount > 0 && <>: {c.sourceCount === 1 ? '1 fonte è ferma' : `${c.sourceCount} fonti sono ferme`}</>}.
                {' '}Rifai login nel browser e incolla il nuovo cookie.
              </span>
              <Link href={`/access?domain=${encodeURIComponent(c.domain)}`} className="btn btn-sm btn-danger">
                Aggiorna cookie
              </Link>
            </div>
          ))}
          {!current && !currentGroup && activeCategory && (
            <div className="card flex items-center gap-3 px-4 py-3 mb-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-fg-strong flex items-center gap-2">
                  <Folder size={15} className="text-fg-faint" aria-hidden="true" />
                  {activeCategory === NO_CATEGORY ? 'Senza categoria' : activeCategory}
                </h2>
                <p className="text-xs text-fg-muted mt-0.5">
                  {(() => {
                    const list = sourceList.filter((x) => (x.category ?? NO_CATEGORY) === activeCategory);
                    return `${list.length} ${list.length === 1 ? 'fonte' : 'fonti'}: ${list.map((x) => x.name).join(' · ')}`;
                  })()}
                </p>
              </div>
              {activeCategory !== NO_CATEGORY && (
                <button type="button" className="icon-btn" onClick={() => renameCategory(activeCategory)} aria-label="Rinomina categoria" title="Rinomina">
                  <Pencil size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {currentGroup && (
            <div className="card px-4 py-3 mb-4">
              <h2 className="font-semibold text-fg-strong flex items-center gap-2" translate="no">
                <SiteIcon site={currentGroup.site} /> {currentGroup.site}
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">
                {currentGroup.sources.length} fonti: {currentGroup.sources.map((x) => x.name).join(' · ')}
              </p>
            </div>
          )}
          {current && (
            <div className="card flex items-center gap-3 flex-wrap px-4 py-3 mb-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-fg-strong truncate">{current.name}</h2>
                <p className="text-xs text-fg-muted">
                  {modeLabel(current.mode)} · ultimo controllo {relative(current.lastCheckedAt)} · ogni {every(current.currentIntervalMinutes)}
                  {current.filter && <> · filtro <code className="chip">{current.filter}</code></>}
                </p>
                {current.status === 'ERROR' && (
                  <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                    {current.lastError}{!current.isActive && ' — fonte sospesa dopo troppi errori: riattivala per riprovare.'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <label className="sr-only" htmlFor="source-interval">Frequenza dei controlli</label>
                <select
                  id="source-interval"
                  name="interval"
                  className="input mr-1"
                  style={{ width: 'auto', height: 30, fontSize: 12, padding: '0 8px' }}
                  value={current.intervalMinutes}
                  onChange={(e) => changeInterval(current, Number(e.target.value))}
                  title="Frequenza dei controlli"
                >
                  {[15, 30, 60, 360, 1440].map((m) => <option key={m} value={m}>ogni {every(m)}</option>)}
                </select>
                <a href={current.url} target="_blank" rel="noopener noreferrer" className="icon-btn" aria-label="Apri la pagina" title="Apri la pagina">
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
                <button type="button" className="icon-btn" onClick={() => setEditingSource(current)} aria-label="Modifica fonte" title="Modifica">
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button type="button" className="icon-btn" onClick={() => checkNow(current)} aria-label="Controlla ora" title="Controlla ora">
                  <RefreshCw size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => toggleActive(current)}
                  aria-label={current.isActive ? 'Sospendi fonte' : 'Riattiva fonte'}
                  title={current.isActive ? 'Sospendi' : 'Riattiva'}
                >
                  {current.isActive ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                </button>
                <button type="button" className="icon-btn icon-btn-danger" onClick={() => remove(current)} aria-label="Elimina fonte" title="Elimina fonte">
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {grouped.map(({ day, groups: dayGroups }) => (
            <section key={day} className="mb-5" aria-label={day}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-faint mx-1 mb-2">{day}</h3>
              <ul className="card overflow-hidden timeline-list" style={{ listStyle: 'none' }}>
                {dayGroups.map((g) => renderGroup(g, day))}
              </ul>
            </section>
          ))}

          {!loading && items.length === 0 && (
            <div className="empty-state card">
              {sourceList.length === 0 ? (
                <>
                  <p className="text-fg-strong font-medium mb-1">Nessuna fonte monitorata</p>
                  <p className="mb-4">Aggiungi un sito o un feed per vedere qui i nuovi contenuti.</p>
                  <button type="button" className="btn btn-primary" onClick={openWizard}><Plus size={15} aria-hidden="true" /> Aggiungi fonte</button>
                </>
              ) : onlyUnread ? (
                <>
                  <p className="text-fg-strong font-medium mb-1">Tutto letto</p>
                  <p>Non ci sono aggiornamenti da leggere.</p>
                </>
              ) : 'Nessun elemento ancora: il primo controllo avverrà entro un minuto.'}
            </div>
          )}
          {loading && (
            <div className="flex justify-center py-8" aria-busy="true">
              <div className="spinner" aria-label="Caricamento…" />
            </div>
          )}
          {!loading && items.length < total && (
            <div className="text-center">
              <button type="button" className="btn btn-secondary" onClick={() => loadItems(page + 1)}>
                Carica altri ({total - items.length})
              </button>
            </div>
          )}
        </section>
      </div>

      {showWizard && (
        <AddSourceWizard
          sources={sourceList}
          initialUrl={wizardUrl}
          initialTitle={wizardTitle}
          bookmarkId={wizardBookmarkId}
          onClose={() => setShowWizard(false)}
          onCreated={() => { loadSources(); ui.toast('Fonte aggiunta: il primo controllo avverrà entro un minuto'); }}
        />
      )}
      {showNotifications && (
        <NotificationsModal
          sources={[...sourceList].sort(byPosition)}
          onClose={() => setShowNotifications(false)}
          onSourceUpdated={(updated) => setSources((prev) => prev && prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))}
        />
      )}
      {showShortcuts && (
        <Modal title="Scorciatoie da tastiera" onClose={() => setShowShortcuts(false)} width={420}>
          <dl className="grid gap-y-2 gap-x-4 text-sm" style={{ gridTemplateColumns: 'auto 1fr' }}>
            {SHORTCUTS.map(({ keys, label }) => (
              <div key={label} className="contents">
                <dt className="text-right whitespace-nowrap">
                  {keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && <span className="text-fg-faint text-xs mx-1">/</span>}
                      <kbd className="kbd">{k}</kbd>
                    </span>
                  ))}
                </dt>
                <dd className="text-fg-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      {editingSource && (
        <AddSourceWizard
          key={editingSource.id}
          editing={editingSource}
          sources={sourceList}
          onClose={() => setEditingSource(null)}
          onCreated={(updated) => {
            setSources((prev) => prev && prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
            loadSources();
            ui.toast('Fonte aggiornata');
          }}
        />
      )}
      {previewItem && (
        <ItemPreview
          key={previewItem.id}
          item={previewItem}
          onClose={closePreview}
          onSave={save}
          onMarkUnread={(it) => { setRead(it, false); closePreview(); }}
        />
      )}
    </div>
  );
}
