'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, ExternalLink, BookmarkPlus, EyeOff, Check, CheckCheck, RefreshCw, Pause, Play, Trash2, AlertTriangle, Circle, Rss, LayoutList, KeyRound,
} from 'lucide-react';
import AddSourceWizard from '@/components/updates/AddSourceWizard';
import { CREDENTIALS_CHANGED_EVENT, WATCH_UNREAD_EVENT } from '@/components/layout/AppHeader';
import { useUI } from '@/components/ui/UIProvider';
import { watchApi } from '@/lib/api';
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

function every(minutes: number): string {
  return minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
}

export default function UpdatesPage() {
  const ui = useUI();
  const [sources, setSources] = useState<WatchSource[] | null>(null);
  const [credentials, setCredentials] = useState<SiteCredential[]>([]);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardUrl, setWizardUrl] = useState('');
  const [wizardBookmarkId, setWizardBookmarkId] = useState<string | undefined>();
  const [wizardTitle, setWizardTitle] = useState('');

  // Stato iniziale dall'URL: ?source=…&view=all, oppure apertura del wizard (?add_url=…&bookmark=…)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setActiveSource(params.get('source'));
    setOnlyUnread(params.get('view') !== 'all');
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
    if (!onlyUnread) params.set('view', 'all');
    const qs = params.toString();
    window.history.replaceState({}, '', qs ? `/updates?${qs}` : '/updates');
  }, [ready, activeSource, onlyUnread]);

  const loadSources = useCallback(async () => {
    try { setSources(await watchApi.sources()); } catch { /* il contatore resta quello precedente */ }
    try { setCredentials(await watchApi.credentials()); } catch { /* avviso accessi non disponibile */ }
  }, []);

  const loadItems = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await watchApi.items({
        page: p, limit: PAGE_SIZE, sourceId: activeSource ?? undefined, unread: onlyUnread ? true : undefined,
      });
      setItems((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.meta.total);
      setPage(p);
    } catch {
      ui.toast('Impossibile caricare gli aggiornamenti. Riprova tra poco.', { kind: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeSource, onlyUnread, ui]);

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
    const groups: { day: string; items: WatchItem[] }[] = [];
    for (const it of items) {
      const day = dayLabel(it.firstSeenAt);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(it);
      else groups.push({ day, items: [it] });
    }
    return groups;
  }, [items]);

  /* ── Azioni elemento ─────────────────────────────────────────────────────── */
  const adjustUnread = (sourceId: string, delta: number) =>
    setSources((prev) => prev && prev.map((s) => (s.id === sourceId ? { ...s, unreadCount: Math.max(0, s.unreadCount + delta) } : s)));

  async function setRead(item: WatchItem, isRead: boolean) {
    if (item.isRead === isRead) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isRead } : i)));
    adjustUnread(item.sourceId, isRead ? -1 : 1);
    try { await watchApi.updateItem(item.id, { isRead }); } catch { loadItems(1); loadSources(); }
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
      await watchApi.readAll(activeSource ?? undefined);
      loadItems(1);
      loadSources();
    } catch {
      ui.toast('Operazione non riuscita. Riprova.', { kind: 'error' });
    }
  }

  /* ── Azioni fonte ────────────────────────────────────────────────────────── */
  const current = sourceList.find((s) => s.id === activeSource) ?? null;

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
      setActiveSource(null);
      loadSources();
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

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <>
      <div className="toolbar">
        <h1 className="page-title mr-2">Aggiornamenti</h1>
        <div className="tabs" role="tablist" aria-label="Filtro">
          <button type="button" role="tab" className="tab" aria-selected={onlyUnread} onClick={() => setOnlyUnread(true)}>Non letti</button>
          <button type="button" role="tab" className="tab" aria-selected={!onlyUnread} onClick={() => setOnlyUnread(false)}>Tutti</button>
        </div>
        <div className="flex-1" />
        <button type="button" className="btn btn-secondary" onClick={readAll} aria-label="Segna tutto come letto">
          <CheckCheck size={15} aria-hidden="true" /> <span className="hidden sm:inline">Segna tutto letto</span>
        </button>
        <button type="button" className="btn btn-primary" onClick={openWizard}>
          <Plus size={15} aria-hidden="true" /> Fonte
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-5 px-4 pb-10 mx-auto items-start" style={{ maxWidth: 1400 }}>
        {/* ── Fonti ──────────────────────────────────────────────────────── */}
        <nav aria-label="Fonti" className="card w-full md:w-[280px] md:shrink-0 md:sticky overflow-hidden" style={{ top: 'calc(var(--header-h) + 12px)' }}>
          <div className="card-header">Fonti</div>
          <ul className="py-1 max-h-[40vh] md:max-h-[calc(100vh-160px)] overflow-y-auto" style={{ listStyle: 'none', overscrollBehavior: 'contain' }}>
            <li>
              <button
                type="button"
                className="bookmark-item w-full text-left"
                style={{ border: 'none', font: 'inherit', cursor: 'pointer' }}
                aria-current={activeSource === null ? 'true' : undefined}
                onClick={() => setActiveSource(null)}
              >
                <span className="bookmark-title">Tutte le fonti</span>
                {totalUnread > 0 && <span className="badge">{totalUnread}</span>}
              </button>
            </li>
            {sourceList.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="bookmark-item w-full text-left"
                  style={{ border: 'none', font: 'inherit', cursor: 'pointer', opacity: s.isActive ? 1 : 0.55 }}
                  aria-current={activeSource === s.id ? 'true' : undefined}
                  title={s.status === 'ERROR' ? `Errore: ${s.lastError}` : `Ultimo controllo ${relative(s.lastCheckedAt)}`}
                  onClick={() => setActiveSource(s.id)}
                >
                  {s.status === 'ERROR'
                    ? <AlertTriangle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} aria-label="Errore" />
                    : !s.isActive
                      ? <Pause size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-label="Sospesa" />
                      : s.mode === 'FEED'
                        ? <Rss size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />
                        : <LayoutList size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />}
                  <span className="bookmark-title">{s.name}</span>
                  {s.unreadCount > 0 && <span className="badge badge-soft">{s.unreadCount}</span>}
                </button>
              </li>
            ))}
            {sources?.length === 0 && (
              <li className="px-3.5 py-2.5 text-xs text-fg-muted">Nessuna fonte. Aggiungine una con “Fonte”.</li>
            )}
          </ul>
        </nav>

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
          {current && (
            <div className="card flex items-center gap-3 flex-wrap px-4 py-3 mb-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-fg-strong truncate">{current.name}</h2>
                <p className="text-xs text-fg-muted">
                  {current.mode === 'FEED' ? 'Feed RSS/Atom' : 'Area della pagina'} · ultimo controllo {relative(current.lastCheckedAt)} · ogni {every(current.currentIntervalMinutes)}
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

          {grouped.map(({ day, items: dayItems }) => (
            <section key={day} className="mb-5" aria-label={day}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-faint mx-1 mb-2">{day}</h3>
              <ul className="card overflow-hidden" style={{ listStyle: 'none' }}>
                {dayItems.map((it, idx) => (
                  <li
                    key={it.id}
                    className="bookmark-item"
                    style={{ padding: '10px 6px 10px 14px', borderTop: idx > 0 ? '1px solid var(--border)' : undefined, alignItems: 'flex-start' }}
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
                        className="block truncate text-[14px] hover:underline"
                        style={{ fontWeight: it.isRead ? 400 : 600, color: it.isRead ? 'var(--text-muted)' : 'var(--text-strong)' }}
                        onClick={() => setRead(it, true)}
                        onAuxClick={(e) => { if (e.button === 1) setRead(it, true); }}
                      >
                        {!it.isRead && <span className="sr-only">Non letto: </span>}
                        {it.title}
                      </a>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-fg-faint">
                        <span>{it.source.name}</span>
                        <span aria-hidden="true">·</span>
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
                ))}
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
    </>
  );
}
