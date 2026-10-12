'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Rss, Trash2 } from 'lucide-react';
import type { Bookmark } from '@/types/api';

interface Props {
  bookmark: Bookmark;
  onDelete: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
}

const MENU_WIDTH = 220;

export default function BookmarkListItem({ bookmark, onDelete, onRename }: Props) {
  const router = useRouter();
  const [imgFailed, setImgFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(bookmark.title || bookmark.url);
  // Posizione del menu: fixed, perché le card dei widget tagliano ciò che sborda
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const label = bookmark.title || bookmark.url;

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  // Menu: focus sulla prima voce, chiusura con click esterno, Esc, scroll o resize
  useEffect(() => {
    if (!menuPos) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = () => setMenuPos(null);
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !menuBtnRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); menuBtnRef.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menuPos]);

  function toggleMenu() {
    if (menuPos) { setMenuPos(null); return; }
    const r = menuBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const below = r.bottom + 4;
    const top = below + 140 > window.innerHeight ? Math.max(8, r.top - 4 - 136) : below;
    setMenuPos({ top, left });
  }

  function startEdit() {
    if (!onRename) return;
    setMenuPos(null);
    setEditValue(label);
    setEditing(true);
  }

  function commitEdit() {
    const name = editValue.trim();
    if (name && name !== label && onRename) onRename(bookmark.id, name);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  }

  function watchUpdates() {
    setMenuPos(null);
    const params = new URLSearchParams({ add_url: bookmark.url, add_title: bookmark.title ?? '', bookmark: bookmark.id });
    router.push(`/updates?${params}`);
  }

  const domain = (() => {
    try { return new URL(bookmark.url).hostname; }
    catch { return ''; }
  })();

  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';

  const favicon = !imgFailed && faviconUrl ? (
    <img src={faviconUrl} alt="" width={16} height={16} loading="lazy" className="favicon" onError={() => setImgFailed(true)} />
  ) : (
    <span className="favicon favicon-fallback" aria-hidden="true" />
  );

  function handleDragStart(e: React.DragEvent) {
    if (editing) { e.preventDefault(); return; }
    e.dataTransfer.setData('bookmarkid', bookmark.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  if (editing) {
    return (
      <div className="bookmark-item" style={{ cursor: 'default' }}>
        {favicon}
        <input
          ref={inputRef}
          className="input"
          style={{ height: 26, fontSize: 13, padding: '0 8px' }}
          aria-label="Nuovo titolo del segnalibro"
          name="title"
          autoComplete="off"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  return (
    <div className="bookmark-item" draggable onDragStart={handleDragStart} style={menuPos ? { background: 'var(--surface-hover)' } : undefined}>
      {favicon}
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="bookmark-title"
        title={`${label}\n${bookmark.url}`}
        onDoubleClick={(e) => { if (onRename) { e.preventDefault(); startEdit(); } }}
      >
        {label}
      </a>
      <span className="row-actions" style={menuPos ? { opacity: 1 } : undefined}>
        <button
          ref={menuBtnRef}
          type="button"
          className="icon-btn icon-btn-sm"
          onClick={toggleMenu}
          aria-label={`Azioni per ${label}`}
          aria-haspopup="menu"
          aria-expanded={!!menuPos}
          title="Altre azioni"
        >
          <MoreHorizontal size={15} aria-hidden="true" />
        </button>
      </span>

      {menuPos && (
        <div
          ref={menuRef}
          className="menu"
          role="menu"
          aria-label={`Azioni per ${label}`}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
        >
          <button type="button" role="menuitem" className="menu-item" onClick={watchUpdates}>
            <Rss size={15} aria-hidden="true" /> Monitora aggiornamenti
          </button>
          {onRename && (
            <button type="button" role="menuitem" className="menu-item" onClick={startEdit}>
              <Pencil size={15} aria-hidden="true" /> Rinomina
            </button>
          )}
          <div className="menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="menu-item menu-item-danger"
            onClick={() => { setMenuPos(null); onDelete(bookmark.id); }}
          >
            <Trash2 size={15} aria-hidden="true" /> Sposta nel cestino
          </button>
        </div>
      )}
    </div>
  );
}
