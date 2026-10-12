'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Plus, ExternalLink, BookmarkPlus, EyeOff, Check, CheckCheck, RefreshCw, Pause, Play, Trash2, AlertTriangle, Circle, Rss, LayoutList, KeyRound, MessagesSquare, Pencil,
  ChevronRight, SlidersHorizontal, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import AddSourceWizard from '@/components/updates/AddSourceWizard';
import { CREDENTIALS_CHANGED_EVENT, WATCH_UNREAD_EVENT } from '@/components/layout/AppHeader';
import { useUI } from '@/components/ui/UIProvider';
import { watchApi } from '@/lib/api';
import { groupItems, type ItemGroup } from '@/lib/group-items';
import { clampWidth, SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, useUpdatesLayout } from '@/lib/updates-layout';
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

function every(minutes: number): string {
  return minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
}

/** Maniglia per allargare o restringere la colonna Fonti (trascina, frecce, doppio clic = predefinita). */
function SidebarResizer({ width, onChange }: { width: number; onChange: (w: number) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Larghezza della colonna Fonti"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Trascina per ridimensionare · doppio clic per ripristinare"
      className="sidebar-resizer hidden md:block"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, w: width };
      }}
      onPointerMove={(e) => {
        if (start.current) onChange(clampWidth(start.current.w + e.clientX - start.current.x));
      }}
      onPointerUp={() => { start.current = null; }}
      onPointerCancel={() => { start.current = null; }}
      onDoubleClick={() => onChange(SIDEBAR_DEFAULT)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(clampWidth(width - 20)); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onChange(clampWidth(width + 20)); }
        if (e.key === 'Home') { e.preventDefault(); onChange(SIDEBAR_DEFAULT); }
      }}
    />
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
    if (onlyUnread) params.set('view', 'unread');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `/updates?${qs}` : '/updates');
  }, [ready, activeSource, activeSite, onlyUnread]);

  const loadSources = useCallback(async () => {
    try { setSources(await watchApi.sources()); } catch { /* il contatore resta quello precedente */ }
    try { setCredentials(await watchApi.credentials()); } catch { /* avviso accessi non disponibile */ }
  }, []);

  const loadItems = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await watchApi.items({
        page: p, limit: PAGE_SIZE, sourceId: activeSource ?? undefined, domain: activeSource ? undefined : activeSite ?? undefined, unread: onlyUnread ? true : undefined,
      });
      setItems((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.meta.total);
      setPage(p);
    } catch {
      ui.toast('Impossibile caricare gli aggiornamenti. Riprova tra poco.', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeSource, activeSite, onlyUnread, ui]);

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

  // Allinea il contatore nell'header (solo dopo il primo caricamento)
  useEffect(() => {
    if (sources) window.dispatchEvent(new CustomEvent(WATCH_UNREAD_EVENT, { detail: totalUnread }));
  }, [sources, totalUnread]);

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
      await watchApi.readAll(activeSource ? { sourceId: activeSource } : activeSite ? { domain: activeSite } : {});
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

  function selectSource(id: string | null) {
    setActiveSource(id);
    setActiveSite(null);
  }

  function selectSite(site: string) {
    setActiveSite(site);
    setActiveSource(null);
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

  /* ── Righe della timeline ────────────────────────────────────────────────── */
  const rowPad = layout.compact ? '6px 6px 6px 14px' : '10px 6px 10px 14px';
  const titleClass = `${layout.wrapTitles ? 'block break-words' : 'block truncate'} ${layout.compact ? 'text-[13px]' : 'text-[14px]'} hover:underline`;

  function renderItem(it: WatchItem, nested = false) {
    return (
      <li
        key={it.id}
        className="bookmark-item"
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
    // In una discussione si riparte dal primo post non letto; altrimenti il più recente
    const target = g.thread && unread.length > 0 ? unread[unread.length - 1] : g.items[0];
    const sourceNames = [...new Set(g.items.map((i) => i.source.name))];
    const count = g.thread
      ? `${g.items.length} nuovi post`
      : `${g.items.length} volte`;
    return (
      <li key={g.key} style={{ borderTop: '1px solid var(--border)' }}>
        <div className="bookmark-item" style={{ padding: rowPad, alignItems: 'flex-start' }}>
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
    <>
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
                onClick={() => updateLayout({ sidebarWidth: SIDEBAR_DEFAULT })}
                disabled={layout.sidebarWidth === SIDEBAR_DEFAULT}
              >
                <span style={{ width: 15 }} aria-hidden="true" /> Larghezza fonti predefinita
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
          className="w-full md:w-[var(--sources-w)] md:shrink-0 md:sticky flex items-stretch"
          style={{ top: 'calc(var(--header-h) + 12px)', '--sources-w': `${layout.sidebarWidth}px` } as React.CSSProperties}
        >
        <nav aria-label="Fonti" className="card flex-1 min-w-0 overflow-hidden">
          <div className="card-header flex items-center">
            <span className="flex-1">Fonti</span>
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
          <ul className="py-1 max-h-[40vh] md:max-h-[calc(100vh-160px)] overflow-y-auto" style={{ listStyle: 'none', overscrollBehavior: 'contain' }}>
            <li>
              <button
                type="button"
                className="bookmark-item w-full text-left"
                style={{ border: 'none', font: 'inherit', cursor: 'pointer' }}
                aria-current={activeSource === null && activeSite === null ? 'true' : undefined}
                onClick={() => selectSource(null)}
              >
                <span className="bookmark-title">Tutte le fonti</span>
                {totalUnread > 0 && <span className="badge">{totalUnread}</span>}
              </button>
            </li>
            {groups.map((g) => (
              <li key={g.site}>
                {g.sources.length > 1 && (
                  <button
                    type="button"
                    className="bookmark-item w-full text-left"
                    style={{ border: 'none', font: 'inherit', cursor: 'pointer' }}
                    aria-current={activeSite === g.site ? 'true' : undefined}
                    title={`Tutte le ${g.sources.length} fonti di ${g.site}`}
                    onClick={() => selectSite(g.site)}
                  >
                    <SiteIcon site={g.site} />
                    <span className="bookmark-title font-semibold" translate="no">{g.site}</span>
                    <span className="text-xs text-fg-faint tabular-nums">{g.sources.length}</span>
                    {g.unread > 0 && <span className="badge badge-soft">{g.unread}</span>}
                  </button>
                )}
                <ul style={{ listStyle: 'none' }} aria-label={g.sources.length > 1 ? `Fonti di ${g.site}` : undefined}>
                  {g.sources.map((s) => (
                    <li key={s.id}>
                      <div
                        className="bookmark-item"
                        style={{ opacity: s.isActive ? 1 : 0.55, paddingLeft: g.sources.length > 1 ? 30 : undefined }}
                        aria-current={activeSource === s.id ? 'true' : undefined}
                      >
                        <button
                          type="button"
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                          style={{ border: 'none', background: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer', padding: 0 }}
                          title={s.status === 'ERROR' ? `Errore: ${s.lastError}` : `Ultimo controllo ${relative(s.lastCheckedAt)}`}
                          onClick={() => selectSource(s.id)}
                        >
                          {s.status === 'ERROR'
                            ? <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} aria-label="Errore" />
                            : !s.isActive
                              ? <Pause size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-label="Sospesa" />
                              : g.sources.length === 1
                                ? <SiteIcon site={g.site} />
                                : s.mode === 'FEED'
                                  ? <Rss size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />
                                  : s.mode === 'THREAD'
                                    ? <MessagesSquare size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />
                                    : <LayoutList size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />}
                          <span className="bookmark-title">{s.name}</span>
                          {s.unreadCount > 0 && <span className="badge badge-soft">{s.unreadCount}</span>}
                        </button>
                        <span className="row-actions">
                          <button
                            type="button"
                            className="icon-btn icon-btn-sm"
                            onClick={() => setEditingSource(s)}
                            aria-label={`Modifica ${s.name}`}
                            title="Modifica"
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-sm icon-btn-danger"
                            onClick={() => remove(s)}
                            aria-label={`Smetti di seguire ${s.name}`}
                            title="Smetti di seguire"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {sources?.length === 0 && (
              <li className="px-3.5 py-2.5 text-xs text-fg-muted">Nessuna fonte. Aggiungine una con “Fonte”.</li>
            )}
          </ul>
        </nav>
        <SidebarResizer width={layout.sidebarWidth} onChange={(w) => updateLayout({ sidebarWidth: w })} />
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
    </>
  );
}
