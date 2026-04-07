'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import type { Bookmark, Folder } from '@/types/api';

export default function CommandPalette({ bookmarks, folders }: { bookmarks: Bookmark[], folders: Folder[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Global Command Menu"
      style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: '640px', background: 'rgba(30,30,40,0.9)', backdropFilter: 'blur(16px)',
        borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        zIndex: 9999, padding: '0', overflow: 'hidden', color: '#fff'
      }}>
      
      <Command.Input placeholder="Cerca bookmark, cartelle o apri link..." style={{
        width: '100%', padding: '16px', background: 'transparent',
        border: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '15px', outline: 'none'
      }} />
      
      <Command.List style={{ padding: '8px', maxHeight: '400px', overflowY: 'auto' }}>
        <Command.Empty style={{ padding: '16px', textAlign: 'center', color: '#888' }}>Nessun risultato trovato.</Command.Empty>

        <Command.Group heading="Cartelle" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888', padding: '8px 8px 4px' }}>
          {folders.map((f) => (
            <Command.Item key={`f-${f.id}`} onSelect={() => { setOpen(false); /* logica filtro cartella gestita nello state, forse solo scroll? */ }}
              style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              📁 {f.name}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Bookmarks" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888', padding: '8px 8px 4px' }}>
          {bookmarks.map((b) => (
            <Command.Item key={`b-${b.id}`} onSelect={() => { window.open(b.url, '_blank'); setOpen(false); }}
              style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}
            >
              ⭐ {b.title || b.url}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>

      <style jsx global>{`
        [cmdk-item][aria-selected="true"] {
          background: rgba(255,255,255,0.1);
        }
      `}</style>
    </Command.Dialog>
  );
}
