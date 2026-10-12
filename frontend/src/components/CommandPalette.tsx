'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Folder as FolderIcon, Link2 } from 'lucide-react';
import { OPEN_PALETTE_EVENT } from '@/components/layout/AppHeader';
import type { Bookmark, Folder } from '@/types/api';

interface Props {
  bookmarks: Bookmark[];
  folders: Folder[];
  onSelectFolder?: (id: string) => void;
}

/** Ricerca rapida (Ctrl/⌘ K): apre un segnalibro o filtra per cartella. */
export default function CommandPalette({ bookmarks, folders, onSelectFolder }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const openEvt = () => setOpen(true);
    document.addEventListener('keydown', down);
    window.addEventListener(OPEN_PALETTE_EVENT, openEvt);
    return () => {
      document.removeEventListener('keydown', down);
      window.removeEventListener(OPEN_PALETTE_EVENT, openEvt);
    };
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Ricerca rapida"
      overlayClassName="modal-backdrop"
      contentClassName="cmdk-content"
    >
      <Command.Input className="cmdk-input" placeholder="Cerca segnalibri o cartelle…" />
      <Command.List className="cmdk-list">
        <Command.Empty className="empty-state" style={{ padding: 24 }}>Nessun risultato.</Command.Empty>

        {folders.length > 0 && (
          <Command.Group heading="Cartelle">
            {folders.map((f) => (
              <Command.Item
                key={`f-${f.id}`}
                value={`cartella ${f.name} ${f.id}`}
                onSelect={() => { onSelectFolder?.(f.id); setOpen(false); }}
              >
                <FolderIcon size={14} aria-hidden="true" />
                <span className="truncate">{f.name}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Segnalibri">
          {bookmarks.map((b) => (
            <Command.Item
              key={`b-${b.id}`}
              value={`${b.title ?? ''} ${b.url} ${b.id}`}
              onSelect={() => { window.open(b.url, '_blank', 'noopener,noreferrer'); setOpen(false); }}
            >
              <Link2 size={14} aria-hidden="true" />
              <span className="truncate">{b.title || b.url}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
