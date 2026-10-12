'use client';

import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Circle, ExternalLink, X } from 'lucide-react';
import { watchApi } from '@/lib/api';
import type { WatchItem, WatchItemContent } from '@/types/api';

const fmtDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Contenuti già scaricati in questa sessione: tornare su un elemento è immediato
const cache = new Map<string, WatchItemContent>();

interface Props {
  item: WatchItem;
  onClose: () => void;
  onSave: (item: WatchItem) => void;
  onMarkUnread: (item: WatchItem) => void;
}

/**
 * Anteprima di un aggiornamento senza lasciare Linko: il post del forum o il
 * corpo dell'articolo, scaricati dal worker con i cookie del sito e ripuliti
 * dal backend (niente script, stili o iframe).
 */
export default function ItemPreview({ item, onClose, onSave, onMarkUnread }: Props) {
  const [content, setContent] = useState<WatchItemContent | null>(cache.get(item.id) ?? null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!cache.has(item.id));
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    const cached = cache.get(item.id);
    if (cached) {
      setContent(cached);
      setError('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setContent(null);
    setError('');
    setLoading(true);
    watchApi.itemContent(item.id)
      .then((c) => {
        cache.set(item.id, c);
        if (!cancelled) setContent(c);
      })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [item.id]);

  const when = content?.publishedAt ?? item.publishedAt ?? item.firstSeenAt;
  // Per i post di una discussione il titolo dell'elemento è "autore: testo": meglio quello della discussione
  const heading = item.source.mode === 'THREAD' && content?.title ? content.title : item.title;

  return (
    <aside className="item-preview" aria-label="Anteprima">
      <div className="item-preview-bar">
        <span className="text-xs text-fg-faint truncate flex-1">{item.source.name}</span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="icon-btn" aria-label="Apri sul sito" title="Apri sul sito (o)">
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        {!item.savedBookmarkId && (
          <button type="button" className="icon-btn" onClick={() => onSave(item)} aria-label="Salva tra i segnalibri" title="Salva tra i segnalibri (s)">
            <BookmarkPlus size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={() => onMarkUnread(item)} aria-label="Segna come non letto" title="Segna come non letto (m)">
          <Circle size={16} aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Chiudi anteprima" title="Chiudi (Esc)">
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="item-preview-body" ref={bodyRef}>
        <h2 className="text-lg font-semibold text-fg-strong leading-snug">
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{heading}</a>
        </h2>
        <p className="text-xs text-fg-faint mt-1">
          {content?.author && <>{content.author} · </>}
          <time dateTime={when}>{fmtDate.format(new Date(when))}</time>
        </p>

        {loading && (
          <div className="flex justify-center py-10" aria-busy="true">
            <div className="spinner" aria-label="Caricamento dell'anteprima…" />
          </div>
        )}
        {error && (
          <div className="alert-error mt-4" role="alert">
            Anteprima non disponibile: {error}
            <div className="mt-2">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
                <ExternalLink size={14} aria-hidden="true" /> Apri sul sito
              </a>
            </div>
          </div>
        )}
        {content && !loading && (
          <>
            {content.image && !content.html.includes(content.image) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={content.image} alt="" className="item-preview-cover" referrerPolicy="no-referrer" loading="lazy" />
            )}
            {content.html.trim() ? (
              // HTML ripulito dal backend (sanitize-html): solo testo, link, immagini e video
              <div className="item-preview-content" dangerouslySetInnerHTML={{ __html: content.html }} />
            ) : (
              <p className="text-sm text-fg-muted mt-4">Questa pagina non ha un testo leggibile in anteprima: aprila sul sito.</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
