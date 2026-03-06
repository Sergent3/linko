'use client';

import { useEffect, useState } from 'react';
import { MousePointer2, Smartphone, Info } from 'lucide-react';

/**
 * BookmarkletTools
 *
 * Genera dinamicamente il codice del bookmarklet usando window.location.origin,
 * così funziona correttamente in qualsiasi ambiente (dev, staging, prod).
 *
 * Flusso:
 *   1. L'utente trascina il pulsante nella barra dei segnalibri del browser.
 *   2. Naviga su qualsiasi sito → clicca il bookmarklet.
 *   3. Si apre un popup Linko su /bookmarks?add_url=...&add_title=...
 *   4. La pagina intercetta i parametri e apre il modal pre-compilato.
 */
export default function BookmarkletTools() {
  // Inizializziamo a '#' per SSR; viene aggiornato solo lato client
  const [bookmarkletHref, setBookmarkletHref] = useState('#');

  useEffect(() => {
    const origin = window.location.origin;
    // Il codice è compresso manualmente (senza bundler) perché viene eseguito
    // nel contesto del browser dell'utente, non del nostro progetto.
    const code =
      `javascript:(function(){` +
      `var u=encodeURIComponent(window.location.href);` +
      `var t=encodeURIComponent(document.title);` +
      `var target='${origin}/bookmarks?add_url='+u+'&add_title='+t;` +
      `var w=window.open(target,'Linko','width=520,height=660,status=no,toolbar=no,menubar=no,location=no,scrollbars=yes');` +
      `if(!w||w.closed||typeof w.closed==='undefined'){window.location.href=target;}` +
      `})();`;
    setBookmarkletHref(code);
  }, []);

  return (
    <div className="widget-card" style={{ marginBottom: 0 }}>
      {/* Header */}
      <div
        className="widget-card-header"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <MousePointer2 size={11} />
        <span>Bookmarklet — Salva da qualsiasi browser</span>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {/* Descrizione */}
        <p style={{ fontSize: 12, color: '#999', marginBottom: 12, lineHeight: 1.55 }}>
          Un bookmarklet è un piccolo programma salvato come segnalibro nel browser.
          Cliccandolo su qualsiasi pagina web la salverai direttamente in Linko.
        </p>

        {/* ── Desktop: drag area ─────────────────────────────────────── */}
        <div
          style={{
            background: '#222',
            border: '1px dashed #484848',
            borderRadius: 4,
            padding: '12px 14px',
            marginBottom: 10,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: '#888',
              marginBottom: 10,
            }}
          >
            Desktop — trascina nella barra dei segnalibri
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Il link è il bookmarklet vero: draggable, non cliccabile nell'app */}
            {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
            {/* @ts-expect-error — href javascript: è intenzionale per il bookmarklet */}
            <a
              href={bookmarkletHref}
              draggable
              onClick={(e) => e.preventDefault()}
              title="Trascina nella barra dei segnalibri"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                background: '#3a7bd5',
                color: '#fff',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                cursor: 'grab',
                border: '1px solid #4e8fe0',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
              }}
              onMouseDown={(e) => {
                // Cambia il cursore durante il drag
                (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLElement).style.cursor = 'grab';
              }}
            >
              ⭐ Salva in Linko
            </a>

            <span style={{ fontSize: 11, color: '#555', lineHeight: 1.45 }}>
              ← trascina qui sopra nella barra dei segnalibri
            </span>
          </div>
        </div>

        {/* ── Mobile: istruzioni manuali ─────────────────────────────── */}
        <div
          style={{
            background: '#222',
            border: '1px solid #383838',
            borderRadius: 4,
            padding: '10px 14px',
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Smartphone size={11} style={{ color: '#888', flexShrink: 0 }} />
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: '#888',
                margin: 0,
              }}
            >
              Mobile — procedura manuale
            </p>
          </div>
          <ol style={{ fontSize: 11, color: '#666', margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
            <li>Aggiungi questa pagina ai preferiti del browser mobile.</li>
            <li>Vai nella gestione preferiti e modifica il segnalibro appena creato.</li>
            <li>
              Sostituisci l&apos;URL del segnalibro con il codice del bookmarklet
              (disponibile copiandolo dal campo qui sotto).
            </li>
          </ol>

          {/* Campo copia codice */}
          <CopyCodeField code={bookmarkletHref} />
        </div>

        {/* ── Nota informativa ───────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '7px 10px',
            background: '#1e1e1e',
            borderRadius: 3,
            border: '1px solid #333',
          }}
        >
          <Info size={11} style={{ color: '#666', marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: '#666', margin: 0, lineHeight: 1.45 }}>
            Il bookmarklet non invia dati a terzi. Apre un popup Linko passando
            solo URL e titolo della pagina corrente come parametri nell&apos;indirizzo.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sottocomponente: copia codice bookmarklet ──────────────────────────────────

function CopyCodeField({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (code === '#') return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: seleziona il testo manualmente
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <input
        readOnly
        value={code === '#' ? 'Caricamento...' : code}
        style={{
          flex: 1,
          background: '#1a1a1a',
          border: '1px solid #3a3a3a',
          borderRadius: 3,
          color: '#666',
          fontSize: 10,
          padding: '5px 8px',
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
        onFocus={(e) => e.target.select()}
      />
      <button
        onClick={handleCopy}
        disabled={code === '#'}
        style={{
          background: copied ? '#2a5a2a' : '#3a3a3a',
          border: '1px solid #4a4a4a',
          borderRadius: 3,
          color: copied ? '#6f6' : '#aaa',
          fontSize: 11,
          padding: '5px 10px',
          cursor: 'pointer',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          transition: 'background 0.2s, color 0.2s',
        }}
      >
        {copied ? 'Copiato!' : 'Copia'}
      </button>
    </div>
  );
}
