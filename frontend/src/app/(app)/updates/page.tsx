'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus, ExternalLink, BookmarkPlus, EyeOff, Check, CheckCheck, RefreshCw, Pause, Play, Trash2, AlertTriangle, ArrowLeft,
} from 'lucide-react';
import AddSourceWizard from '@/components/updates/AddSourceWizard';
import { watchApi } from '@/lib/api';
import type { WatchItem, WatchSource } from '@/types/api';

const PAGE_SIZE = 50;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Oggi';
  if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function relative(iso: string | null): string {
  if (!iso) return 'mai';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  if (min < 1440) return `${Math.round(min / 60)} h fa`;
  return `${Math.round(min / 1440)} g fa`;
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
  padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center',
};

export default function UpdatesPage() {
  const [sources, setSources] = useState<WatchSource[]>([]);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardUrl, setWizardUrl] = useState('');
  const [wizardBookmarkId, setWizardBookmarkId] = useState<string | undefined>();

  const loadSources = useCallback(async () => {
    try { setSources(await watchApi.sources()); } catch { /* ignore */ }
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
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [activeSource, onlyUnread]);

  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { loadItems(1); }, [loadItems]);

  // Apertura dal menu di un segnalibro: /updates?add_url=…&bookmark=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addUrl = params.get('add_url');
    if (addUrl) {
      setWizardUrl(addUrl);
      setWizardBookmarkId(params.get('bookmark') ?? undefined);
      setShowWizard(true);
      window.history.replaceState({}, '', '/updates');
    }
  }, []);

  // Aggiorna periodicamente i contatori mentre la pagina è aperta
  useEffect(() => {
    const t = setInterval(loadSources, 60_000);
    return () => clearInterval(t);
  }, [loadSources]);

  const totalUnread = sources.reduce((s, x) => s + x.unreadCount, 0);

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
    setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, unreadCount: Math.max(0, s.unreadCount + delta) } : s)));

  async function setRead(item: WatchItem, isRead: boolean) {
    if (item.isRead === isRead) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isRead } : i)));
    adjustUnread(item.sourceId, isRead ? -1 : 1);
    try { await watchApi.updateItem(item.id, { isRead }); } catch { loadItems(1); loadSources(); }
  }

  async function hide(item: WatchItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (!item.isRead) adjustUnread(item.sourceId, -1);
    try { await watchApi.updateItem(item.id, { isHidden: true }); } catch { loadItems(1); loadSources(); }
  }

  async function save(item: WatchItem) {
    try {
      const updated = await watchApi.saveItem(item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updated, source: i.source } : i)));
      if (!item.isRead) adjustUnread(item.sourceId, -1);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function open(item: WatchItem) {
    window.open(item.url, '_blank', 'noopener,noreferrer');
    setRead(item, true);
  }

  async function readAll() {
    await watchApi.readAll(activeSource ?? undefined);
    loadItems(1);
    loadSources();
  }

  /* ── Azioni fonte ────────────────────────────────────────────────────────── */
  const current = sources.find((s) => s.id === activeSource) ?? null;

  async function toggleActive(s: WatchSource) {
    const updated = await watchApi.updateSource(s.id, { isActive: !s.isActive });
    setSources((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...updated } : x)));
  }

  async function checkNow(s: WatchSource) {
    await watchApi.checkNow(s.id);
    alert('Controllo richiesto: avverrà entro un minuto.');
  }

  async function remove(s: WatchSource) {
    if (!confirm(`Eliminare la fonte "${s.name}" e i suoi elementi?`)) return;
    await watchApi.deleteSource(s.id);
    setActiveSource(null);
    loadSources();
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: '#2b2b2b' }}>
      <div className="top-header">
        <Link href="/bookmarks" className="folder-tab" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Bookmarks
        </Link>
        <span className="page-title" style={{ marginLeft: 12 }}>Aggiornamenti</span>

        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 8, marginLeft: 16 }}>
          <button className={`folder-tab ${onlyUnread ? 'active' : ''}`} style={{ margin: 0, border: 'none' }} onClick={() => setOnlyUnread(true)}>Non letti</button>
          <button className={`folder-tab ${!onlyUnread ? 'active' : ''}`} style={{ margin: 0, border: 'none' }} onClick={() => setOnlyUnread(false)}>Tutti</button>
        </div>

        <div style={{ flex: 1 }} />
        <button className="btn-add" style={{ background: '#444' }} onClick={readAll} title="Segna tutto come letto">
          <CheckCheck size={13} /> Segna tutto letto
        </button>
        <button className="btn-add" style={{ marginLeft: 6 }} onClick={() => { setWizardUrl(''); setWizardBookmarkId(undefined); setShowWizard(true); }}>
          <Plus size={13} /> Fonte
        </button>
      </div>

      <div style={{ display: 'flex', gap: 20, padding: 24, maxWidth: 1400, margin: '0 auto', alignItems: 'flex-start' }}>
        {/* ── Fonti ──────────────────────────────────────────────────────── */}
        <aside className="widget-card" style={{ width: 280, flexShrink: 0, position: 'sticky', top: 84 }}>
          <div className="widget-card-header">Fonti</div>
          <div className="widget-card-body">
            <div className={`bookmark-item${activeSource === null ? ' active' : ''}`} onClick={() => setActiveSource(null)}
              style={{ background: activeSource === null ? 'var(--glass-hover)' : undefined }}>
              <span>Tutte</span>
              {totalUnread > 0 && <b style={{ fontSize: 11, color: 'var(--accent)' }}>{totalUnread}</b>}
            </div>
            {sources.map((s) => (
              <div key={s.id} className="bookmark-item" onClick={() => setActiveSource(s.id)}
                style={{ background: activeSource === s.id ? 'var(--glass-hover)' : undefined, opacity: s.isActive ? 1 : 0.5 }}
                title={s.status === 'ERROR' ? `Errore: ${s.lastError}` : `Ultimo controllo: ${relative(s.lastCheckedAt)}`}>
                {s.status === 'ERROR' && <AlertTriangle size={13} style={{ color: '#f87171', marginRight: 6, flexShrink: 0 }} />}
                {!s.isActive && <Pause size={13} style={{ color: 'var(--text-muted)', marginRight: 6, flexShrink: 0 }} />}
                <span>{s.name}</span>
                {s.unreadCount > 0 && <b style={{ fontSize: 11, color: 'var(--accent)' }}>{s.unreadCount}</b>}
              </div>
            ))}
            {sources.length === 0 && (
              <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                Nessuna fonte. Aggiungine una con il pulsante “Fonte”.
              </p>
            )}
          </div>
        </aside>

        {/* ── Timeline ───────────────────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {current && (
            <div className="widget-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{current.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {current.mode === 'FEED' ? 'Feed RSS/Atom' : 'Area della pagina'} · ultimo controllo {relative(current.lastCheckedAt)} · ogni {current.currentIntervalMinutes >= 60 ? `${Math.round(current.currentIntervalMinutes / 60)} h` : `${current.currentIntervalMinutes} min`}
                  {current.filter && <> · filtro <code>{current.filter}</code></>}
                </div>
                {current.status === 'ERROR' && (
                  <div style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>
                    {current.lastError}{!current.isActive && ' — fonte sospesa dopo troppi errori'}
                  </div>
                )}
              </div>
              <a href={current.url} target="_blank" rel="noopener noreferrer" style={iconBtn} title="Apri la pagina"><ExternalLink size={15} /></a>
              <button style={iconBtn} onClick={() => checkNow(current)} title="Controlla ora"><RefreshCw size={15} /></button>
              <button style={iconBtn} onClick={() => toggleActive(current)} title={current.isActive ? 'Sospendi' : 'Riattiva'}>
                {current.isActive ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <button style={{ ...iconBtn, color: '#f87171' }} onClick={() => remove(current)} title="Elimina fonte"><Trash2 size={15} /></button>
            </div>
          )}

          {grouped.map(({ day, items: dayItems }) => (
            <section key={day} style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)', margin: '6px 4px 8px' }}>{day}</h3>
              <div className="widget-card" style={{ marginBottom: 0 }}>
                {dayItems.map((it) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--glass-border)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: it.isRead ? 'transparent' : 'var(--accent)' }} />
                    <div style={{ minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={() => open(it)}>
                      <div style={{ fontSize: 13, fontWeight: it.isRead ? 400 : 600, color: it.isRead ? '#cbd5e1' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        <span>{it.source.name}</span>
                        <span>· {timeLabel(it.firstSeenAt)}</span>
                        {it.kind === 'UPDATED' && <span style={{ color: '#fbbf24' }}>· aggiornato</span>}
                        {it.matchedTerms.map((t) => (
                          <span key={t} style={{ background: 'rgba(99,102,241,0.18)', color: '#c7d2fe', borderRadius: 4, padding: '0 5px' }}>{t}</span>
                        ))}
                        {it.savedBookmarkId && <span style={{ color: '#34d399' }}>· salvato</span>}
                      </div>
                    </div>
                    <button style={iconBtn} onClick={() => open(it)} title="Apri"><ExternalLink size={14} /></button>
                    <button style={iconBtn} onClick={() => setRead(it, !it.isRead)} title={it.isRead ? 'Segna come non letto' : 'Segna come letto'}><Check size={14} /></button>
                    {!it.savedBookmarkId && <button style={iconBtn} onClick={() => save(it)} title="Salva tra i segnalibri"><BookmarkPlus size={14} /></button>}
                    <button style={iconBtn} onClick={() => hide(it)} title="Nascondi"><EyeOff size={14} /></button>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {!loading && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
              {sources.length === 0
                ? 'Aggiungi una fonte per iniziare a ricevere aggiornamenti.'
                : onlyUnread ? 'Nessun aggiornamento da leggere.' : 'Nessun elemento ancora.'}
            </div>
          )}
          {loading && <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Caricamento...</div>}
          {!loading && items.length < total && (
            <div style={{ textAlign: 'center' }}>
              <button className="btn-add" style={{ display: 'inline-flex', background: '#444' }} onClick={() => loadItems(page + 1)}>Carica altri</button>
            </div>
          )}
        </main>
      </div>

      {showWizard && (
        <AddSourceWizard
          initialUrl={wizardUrl}
          bookmarkId={wizardBookmarkId}
          onClose={() => setShowWizard(false)}
          onCreated={() => { loadSources(); }}
        />
      )}
    </div>
  );
}
