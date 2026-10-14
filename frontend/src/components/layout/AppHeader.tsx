'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Download, KeyRound, LogOut, MonitorSmartphone, Puzzle, Rss, Search, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/components/ui/UIProvider';
import { bookmarks as bookmarksApi, watchApi } from '@/lib/api';

/** Evento con cui le pagine aggiornano il contatore "Aggiornamenti" senza ricaricarlo. */
export const WATCH_UNREAD_EVENT = 'linko:watch-unread';
/** Evento che apre la ricerca rapida (CommandPalette) della pagina Segnalibri. */
export const OPEN_PALETTE_EVENT = 'linko:open-palette';
/** Evento: gli accessi ai siti sono cambiati, ricaricare il conteggio degli scaduti. */
export const CREDENTIALS_CHANGED_EVENT = 'linko:credentials-changed';

const NAV = [
  { href: '/bookmarks', label: 'Segnalibri', icon: Bookmark },
  { href: '/updates', label: 'Aggiornamenti', icon: Rss },
] as const;

export default function AppHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const ui = useUI();
  const [unread, setUnread] = useState(0);
  const [expired, setExpired] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  // Il viewer remoto esiste solo sulla versione HTTPS (/viewer servito da Caddy)
  const [viewerAvailable, setViewerAvailable] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setViewerAvailable(window.location.protocol === 'https:'); }, []);

  // Contatore non letti: all'avvio, ogni minuto e quando una pagina lo comunica
  useEffect(() => {
    const load = () => watchApi.sources()
      // Le fonti in riepilogo giornaliero non contano: arrivano una volta al giorno
      .then((list) => setUnread(list.reduce((n, s) => n + (s.delivery === 'DIGEST' ? 0 : s.unreadCount), 0)))
      .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    const onEvent = (e: Event) => setUnread((e as CustomEvent<number>).detail);
    window.addEventListener(WATCH_UNREAD_EVENT, onEvent);
    return () => { clearInterval(t); window.removeEventListener(WATCH_UNREAD_EVENT, onEvent); };
  }, []);

  // Accessi ai siti scaduti: segnalati sull'avatar e nel menu
  useEffect(() => {
    const load = () => watchApi.credentials()
      .then((list) => setExpired(list.filter((c) => c.status === 'EXPIRED').length))
      .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60_000);
    window.addEventListener(CREDENTIALS_CHANGED_EVENT, load);
    return () => { clearInterval(t); window.removeEventListener(CREDENTIALS_CHANGED_EVENT, load); };
  }, []);

  // Chiusura del menu utente con click esterno o Esc
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  async function exportHtml() {
    setMenuOpen(false);
    try { await bookmarksApi.exportHtml(); }
    catch { ui.toast('Esportazione non riuscita. Riprova tra qualche istante.', { kind: 'error' }); }
  }

  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase();
  const onBookmarks = pathname.startsWith('/bookmarks');

  return (
    <header className="app-header">
      <Link href="/bookmarks" className="flex items-center gap-2 shrink-0" aria-label="Linko, vai ai segnalibri">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={28} height={28} className="w-7 h-7 rounded-lg" />
        <span className="hidden sm:inline font-bold text-[15px] text-fg-strong" translate="no">Linko</span>
      </Link>

      <nav aria-label="Sezioni" className="tabs ml-1 sm:ml-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="tab" aria-current={active ? 'page' : undefined}>
              <Icon size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
              {href === '/updates' && unread > 0 && (
                <span className="badge" aria-label={`${unread} non letti`}>{unread > 99 ? '99+' : unread}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {onBookmarks && (
        <button
          type="button"
          className="btn btn-secondary hidden md:inline-flex"
          style={{ width: 220, justifyContent: 'flex-start', fontWeight: 400, color: 'var(--text-faint)' }}
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        >
          <Search size={14} aria-hidden="true" />
          <span className="flex-1 text-left">Ricerca rapida…</span>
          <kbd className="text-[11px] text-fg-faint border border-line rounded px-1.5">Ctrl&nbsp;K</kbd>
        </button>
      )}

      {viewerAvailable && (
        // <a> e non <Link>: /viewer non fa parte dell'app Next
        <a href="/viewer/" className="icon-btn" title="Viewer remoto" aria-label="Apri il viewer remoto">
          <MonitorSmartphone size={18} aria-hidden="true" />
        </a>
      )}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className="w-8 h-8 rounded-full bg-surface-hover border border-line-strong text-fg-strong text-xs font-semibold flex items-center justify-center hover:border-accent transition-colors"
          aria-label={expired > 0 ? `Menu utente: ${expired} accessi scaduti` : 'Menu utente'}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          style={{ position: 'relative' }}
        >
          {initials}
          {expired > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: 'var(--danger)', boxShadow: '0 0 0 2px var(--bg)' }}
            />
          )}
        </button>
        {menuOpen && (
          <div className="menu right-0 mt-2" role="menu">
            <div className="px-2.5 py-2 text-xs text-fg-faint truncate" title={user?.email}>{user?.email}</div>
            <div className="menu-sep" />
            <Link href="/access" className="menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
              <KeyRound size={15} aria-hidden="true" /> Accessi ai siti
              {expired > 0 && (
                <span className="badge ml-auto" style={{ background: 'var(--danger-strong)' }}>{expired} scadut{expired === 1 ? 'o' : 'i'}</span>
              )}
            </Link>
            <Link href="/extension" className="menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
              <Puzzle size={15} aria-hidden="true" /> Estensione del browser
            </Link>
            <Link href="/import" className="menu-item" role="menuitem" onClick={() => setMenuOpen(false)}>
              <Upload size={15} aria-hidden="true" /> Importa segnalibri
            </Link>
            <button type="button" className="menu-item" role="menuitem" onClick={exportHtml}>
              <Download size={15} aria-hidden="true" /> Esporta in HTML
            </button>
            <div className="menu-sep" />
            <button type="button" className="menu-item menu-item-danger" role="menuitem" onClick={logout}>
              <LogOut size={15} aria-hidden="true" /> Esci
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
