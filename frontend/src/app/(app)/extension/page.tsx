'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Copy, Download, Puzzle, RefreshCw, ShieldAlert, Unplug } from 'lucide-react';
import { useUI } from '@/components/ui/UIProvider';
import { extensionApi } from '@/lib/api';
import {
  connectExtension, detectExtension, EXTENSION_VERSION, grantExtension, pollExtension, type ExtensionState,
} from '@/lib/extension';
import type { ExtensionStatus } from '@/types/api';

const fmtDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function newer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

function host(origin: string) {
  try { return new URL(origin).hostname.replace(/^www\./, ''); } catch { return origin; }
}

function CopyCode({ text }: { text: string }) {
  const ui = useUI();
  return (
    <span className="inline-flex items-center gap-1">
      <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-hover)' }}>{text}</code>
      <button
        type="button"
        className="icon-btn icon-btn-sm"
        aria-label={`Copia ${text}`}
        title="Copia"
        onClick={() => navigator.clipboard.writeText(text).then(() => ui.toast('Copiato: incollalo nella barra degli indirizzi'), () => {})}
      >
        <Copy size={13} aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Estensione per Chrome/Brave: controlla dal browser dell'utente le fonti che
 * il server non riesce a scaricare (verifiche anti-bot come Cloudflare).
 */
export default function ExtensionPage() {
  const ui = useUI();
  const [ext, setExt] = useState<ExtensionState | null | undefined>(undefined);
  const [server, setServer] = useState<ExtensionStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  const load = useCallback(async () => {
    const [state, status] = await Promise.all([detectExtension(), extensionApi.status().catch(() => null)]);
    setExt(state);
    setServer(status);
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
    // Appena installata o ricaricata, l'estensione si annuncia: si aggiorna la pagina da sola
    const onReady = (e: MessageEvent) => {
      if (e.source === window && e.data?.type === 'linko-ext:ready') load();
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, [load]);

  // Finché non è installata si ricontrolla ogni pochi secondi (serve ricaricare la pagina dopo l'installazione)
  useEffect(() => {
    if (ext !== null) return;
    const t = window.setInterval(async () => { const s = await detectExtension(); if (s) setExt(s); }, 4000);
    return () => window.clearInterval(t);
  }, [ext]);

  async function connect() {
    setBusy('connect');
    try {
      const { token } = await extensionApi.createToken();
      const state = await connectExtension(token);
      if (!state?.connected) throw new Error('L\'estensione non ha risposto: ricarica la pagina e riprova');
      setExt(state);
      ui.toast('Browser collegato a Linko');
      await load();
    } catch (err) {
      ui.toast((err as Error).message, { kind: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function checkNow() {
    setBusy('poll');
    try {
      const state = await pollExtension();
      if (state) setExt(state);
      await load();
      ui.toast('Controllo completato');
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string, browser: string | null) {
    const ok = await ui.confirm({
      title: 'Scollegare questo browser?',
      message: `${browser ?? 'Il browser'} smetterà di controllare le fonti. Puoi ricollegarlo quando vuoi.`,
      confirmLabel: 'Scollega',
      danger: true,
    });
    if (!ok) return;
    try {
      await extensionApi.revokeToken(id);
      await load();
    } catch {
      ui.toast('Operazione non riuscita. Riprova.', { kind: 'error' });
    }
  }

  const downloadUrl = origin ? `/downloads/linko-extension.zip?origin=${encodeURIComponent(origin)}` : undefined;
  const outdated = ext && newer(EXTENSION_VERSION, ext.version);
  const spinner = <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />;
  const extPages = ext?.browser.startsWith('Brave') ? 'brave://extensions' : 'chrome://extensions';

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title mr-2">Estensione del browser</h1>
      </div>

      <div className="px-4 pb-10 mx-auto flex flex-col gap-4" style={{ maxWidth: 820 }}>
        <p className="text-sm text-fg-muted">
          Alcuni siti (protetti da Cloudflare o simili) bloccano i server ma lasciano passare il tuo browser.
          Con l&apos;estensione è il tuo Chrome o Brave a controllare quelle fonti, in background, e a mandare le pagine a Linko:
          le novità arrivano in <Link href="/updates" className="text-accent-text hover:underline">Aggiornamenti</Link> come per le altre fonti.
          Funziona finché il computer è acceso e il browser aperto.
        </p>

        {origin.startsWith('http:') && (
          <p className="text-xs px-3 py-2 rounded-md flex gap-2" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
            <ShieldAlert size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
            Linko è aperto in HTTP: il collegamento e le pagine inviate dall&apos;estensione viaggiano senza cifratura.
          </p>
        )}

        {/* ── Stato dell'estensione in questo browser ─────────────────────── */}
        <section className="card p-4" aria-labelledby="ext-state">
          <h2 id="ext-state" className="font-semibold text-fg-strong flex items-center gap-2 mb-2">
            <Puzzle size={16} aria-hidden="true" /> In questo browser
          </h2>

          {ext === undefined && <div className="flex justify-center py-6"><div className="spinner" aria-label="Controllo…" /></div>}

          {ext === null && (
            <ol className="text-sm text-fg-muted list-decimal pl-5 space-y-2">
              <li>
                <a href={downloadUrl} className="btn btn-primary btn-sm" download>
                  <Download size={14} aria-hidden="true" /> Scarica l&apos;estensione
                </a>{' '}
                ed estrai lo .zip in una cartella che non cancellerai (es. Documenti).
              </li>
              <li>Apri <CopyCode text="chrome://extensions" /> (su Brave <CopyCode text="brave://extensions" />) in una nuova scheda.</li>
              <li>Attiva <strong>Modalità sviluppatore</strong> in alto a destra.</li>
              <li>Premi <strong>Carica estensione non pacchettizzata</strong> e scegli la cartella <code>linko-extension</code>.</li>
              <li>Torna qui e <button type="button" className="underline text-accent-text" onClick={() => window.location.reload()}>ricarica la pagina</button>: comparirà il pulsante per collegarla.</li>
            </ol>
          )}

          {ext && (
            <div className="text-sm">
              <p className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 size={15} style={{ color: 'var(--success)' }} aria-hidden="true" />
                Installata · versione {ext.version} · {ext.browser}
              </p>

              {outdated && (
                <div className="mt-3 p-3 rounded-md" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                  <strong>Aggiornamento disponibile ({EXTENSION_VERSION}).</strong>{' '}
                  <a href={downloadUrl} className="underline" download>Scarica lo .zip</a>, estrailo sopra la cartella di prima,
                  poi in <CopyCode text={extPages} /> premi ↻ sull&apos;estensione Linko e ricarica questa pagina.
                </div>
              )}

              {!ext.connected && (
                <div className="mt-3">
                  <p className="text-fg-muted mb-2">Ultimo passo: collega l&apos;estensione al tuo account.</p>
                  <button type="button" className="btn btn-primary" onClick={connect} disabled={busy !== null}>
                    {busy === 'connect' ? spinner : null} Collega questo browser
                  </button>
                </div>
              )}

              {ext.connected && (
                <>
                  <p className="text-fg-muted mt-1">
                    {ext.lastError
                      ? <span style={{ color: 'var(--danger)' }}>{ext.lastError}</span>
                      : ext.lastRun
                        ? <>Collegata · ultimo controllo {fmtDate.format(new Date(ext.lastRun))} · pagine lette: {ext.checked}</>
                        : 'Collegata · primo controllo entro un minuto'}
                  </p>

                  {ext.needPermission.length > 0 && (
                    <div className="mt-3 p-3 rounded-md flex flex-wrap items-center gap-2" style={{ background: 'var(--danger-soft)' }}>
                      <AlertTriangle size={15} style={{ color: 'var(--danger)' }} aria-hidden="true" />
                      <span className="flex-1 min-w-0">
                        Serve il permesso per aprire {ext.needPermission.map(host).join(', ')}.
                      </span>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => grantExtension(ext.needPermission)}>
                        Concedi nell&apos;estensione
                      </button>
                    </div>
                  )}

                  {ext.challenged.length > 0 && (
                    <div className="mt-3 p-3 rounded-md" style={{ background: 'var(--danger-soft)' }}>
                      <p className="flex items-center gap-2">
                        <AlertTriangle size={15} style={{ color: 'var(--danger)' }} aria-hidden="true" />
                        Verifica anti-bot da superare a mano: apri il sito, spunta la casella, poi premi “Controlla ora”.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {ext.challenged.map((o) => (
                          <a key={o} href={o} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">Apri {host(o)}</a>
                        ))}
                      </div>
                    </div>
                  )}

                  <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={checkNow} disabled={busy !== null}>
                    {busy === 'poll' ? spinner : <RefreshCw size={14} aria-hidden="true" />} Controlla ora
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* ── Fonti controllate dall'estensione ───────────────────────────── */}
        <section className="card p-4" aria-labelledby="ext-sources">
          <h2 id="ext-sources" className="font-semibold text-fg-strong mb-2">Fonti controllate dal browser</h2>
          {!server || server.sources.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Nessuna. Quando aggiungi una fonte che blocca il server (es. “verifica anti-bot”), Linko ti propone di farla controllare all&apos;estensione.
            </p>
          ) : (
            <ul style={{ listStyle: 'none' }} className="flex flex-col gap-2">
              {server.sources.map((s) => (
                <li key={s.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-fg-strong truncate">{s.name}</span>
                    {!s.isActive && <span className="chip">in pausa</span>}
                  </div>
                  <div className="text-xs truncate" style={{ color: s.status === 'ERROR' ? 'var(--danger)' : 'var(--text-faint)' }}>
                    {s.status === 'ERROR' && s.lastError
                      ? s.lastError
                      : s.lastCheckedAt ? `Ultimo controllo ${fmtDate.format(new Date(s.lastCheckedAt))}` : 'In attesa del primo controllo'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Browser collegati ───────────────────────────────────────────── */}
        {server && server.tokens.length > 0 && (
          <section className="card p-4" aria-labelledby="ext-links">
            <h2 id="ext-links" className="font-semibold text-fg-strong mb-2">Browser collegati</h2>
            <ul style={{ listStyle: 'none' }} className="flex flex-col gap-2">
              {server.tokens.map((t) => (
                <li key={t.id} className="flex items-center gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="text-fg-strong">{t.browser ?? 'Browser'}{t.version ? ` · v${t.version}` : ''}</div>
                    <div className="text-xs text-fg-faint">
                      {t.lastSeenAt ? `Ultimo contatto ${fmtDate.format(new Date(t.lastSeenAt))}` : 'Mai contattato'} · collegato il {fmtDate.format(new Date(t.createdAt))}
                    </div>
                  </div>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => revoke(t.id, t.browser)}>
                    <Unplug size={14} aria-hidden="true" /> Scollega
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
