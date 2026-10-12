'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Plus, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import CredentialForm, { verificationText } from '@/components/updates/CredentialForm';
import { useUI } from '@/components/ui/UIProvider';
import { CREDENTIALS_CHANGED_EVENT } from '@/components/layout/AppHeader';
import { watchApi } from '@/lib/api';
import type { SiteCredential } from '@/types/api';

const fmtDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function StatusBadge({ c }: { c: SiteCredential }) {
  if (c.status === 'EXPIRED') {
    return (
      <span className="chip" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
        <AlertTriangle size={11} className="mr-1" aria-hidden="true" /> Scaduto
      </span>
    );
  }
  if (c.status === 'OK') {
    return (
      <span className="chip" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--success)' }}>
        <CheckCircle2 size={11} className="mr-1" aria-hidden="true" /> Attivo
      </span>
    );
  }
  return (
    <span className="chip" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>
      <Clock size={11} className="mr-1" aria-hidden="true" /> Da verificare
    </span>
  );
}

export default function AccessPage() {
  const ui = useUI();
  const [creds, setCreds] = useState<SiteCredential[] | null>(null);
  const [editing, setEditing] = useState<SiteCredential | 'new' | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCreds(await watchApi.credentials());
    } catch {
      setCreds([]);
      ui.toast('Impossibile caricare gli accessi. Ricarica la pagina.', { kind: 'error' });
    }
  }, [ui]);

  useEffect(() => { load(); }, [load]);

  // Apertura diretta per un dominio: /access?domain=simpcity.cr
  useEffect(() => {
    if (!creds) return;
    const domain = new URLSearchParams(window.location.search).get('domain');
    if (!domain) return;
    window.history.replaceState({}, '', '/access');
    const found = creds.find((c) => c.domain === domain);
    setEditing(found ?? 'new');
  }, [creds]);

  const changed = () => {
    load();
    window.dispatchEvent(new Event(CREDENTIALS_CHANGED_EVENT));
  };

  async function verify(c: SiteCredential) {
    setVerifying(c.id);
    try {
      const v = await watchApi.verifyCredential(c.id);
      const { ok, text } = verificationText(v);
      ui.toast(ok ? text : `${text} Aggiorna il cookie.`, ok ? undefined : { kind: 'error', durationMs: 7000 });
    } catch (err) {
      ui.toast((err as Error).message, { kind: 'error' });
    } finally {
      setVerifying(null);
      changed();
    }
  }

  async function remove(c: SiteCredential) {
    const ok = await ui.confirm({
      title: `Eliminare l'accesso a ${c.domain}?`,
      message: c.sourceCount > 0
        ? <>Le <strong>{c.sourceCount} fonti</strong> di questo sito continueranno a funzionare solo con le pagine visibili da ospite.</>
        : 'Il cookie verrà cancellato da Linko.',
      confirmLabel: 'Elimina accesso',
      danger: true,
    });
    if (!ok) return;
    try {
      await watchApi.deleteCredential(c.id);
      ui.toast(`Accesso a ${c.domain} eliminato`);
      changed();
    } catch {
      ui.toast('Eliminazione non riuscita. Riprova.', { kind: 'error' });
    }
  }

  const expired = creds?.filter((c) => c.status === 'EXPIRED') ?? [];

  return (
    <>
      <div className="toolbar">
        <h1 className="page-title mr-2">Accessi ai siti</h1>
        <div className="flex-1" />
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <Plus size={15} aria-hidden="true" /> Aggiungi accesso
        </button>
      </div>

      <div className="px-4 pb-10 mx-auto" style={{ maxWidth: 900 }}>
        <p className="text-sm text-fg-muted mb-4">
          Per i siti e i forum con login, Linko usa il cookie della tua sessione per vedere le pagine riservate.
          Quando un cookie scade le fonti di quel sito si fermano e te lo segnaliamo qui e in{' '}
          <Link href="/updates" className="text-accent-text hover:underline">Aggiornamenti</Link>.
        </p>

        {expired.length > 0 && (
          <div className="alert-error mb-4 flex gap-2 items-start" role="alert">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              {expired.length === 1
                ? <>L&apos;accesso a <strong>{expired[0].domain}</strong> è scaduto: rifai login nel browser e incolla il nuovo cookie.</>
                : <>{expired.length} accessi sono scaduti: rifai login nel browser e incolla i nuovi cookie.</>}
            </span>
          </div>
        )}

        {creds === null ? (
          <div className="flex justify-center py-10"><div className="spinner" aria-label="Caricamento…" /></div>
        ) : creds.length === 0 ? (
          <div className="card empty-state">
            <KeyRound size={28} className="mx-auto mb-3 text-fg-faint" aria-hidden="true" />
            <p className="text-fg-strong font-medium mb-1">Nessun accesso salvato</p>
            <p className="mb-4">Aggiungine uno per seguire forum e siti che mostrano i contenuti solo agli iscritti.</p>
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Plus size={15} aria-hidden="true" /> Aggiungi accesso
            </button>
          </div>
        ) : (
          <ul className="card overflow-hidden" style={{ listStyle: 'none' }}>
            {creds.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-fg-strong" translate="no">{c.domain}</span>
                    <StatusBadge c={c} />
                    {c.sourceCount > 0 && <span className="text-xs text-fg-faint">{c.sourceCount} {c.sourceCount === 1 ? 'fonte' : 'fonti'}</span>}
                  </div>
                  <p className="text-xs text-fg-faint mt-0.5 truncate">
                    {c.cookieNames.length} cookie ({c.cookieNames.slice(0, 4).join(', ')}{c.cookieNames.length > 4 ? '…' : ''})
                    {c.hasUserAgent && ' · User-Agent personalizzato'}
                    {c.lastUsedAt && ` · ultimo uso ${fmtDate.format(new Date(c.lastUsedAt))}`}
                  </p>
                  {c.status === 'EXPIRED' && c.lastError && (
                    <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                      Scaduto{c.expiredAt ? ` il ${fmtDate.format(new Date(c.expiredAt))}` : ''}: {c.lastError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" className={`btn btn-sm ${c.status === 'EXPIRED' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEditing(c)}>
                    Aggiorna cookie
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => verify(c)}
                    disabled={verifying === c.id}
                    aria-label={`Verifica accesso a ${c.domain}`}
                    title="Verifica ora"
                  >
                    {verifying === c.id ? <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
                  </button>
                  <button type="button" className="icon-btn icon-btn-danger" onClick={() => remove(c)} aria-label={`Elimina accesso a ${c.domain}`} title="Elimina">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing && (
        <Modal
          title={editing === 'new' ? 'Nuovo accesso' : `Aggiorna accesso a ${editing.domain}`}
          onClose={() => { setEditing(null); changed(); }}
          width={560}
          dismissOnBackdrop={false}
        >
          <CredentialForm
            existing={editing === 'new' ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={(_, v) => {
              setEditing(null);
              ui.toast(verificationText(v).text);
              changed();
            }}
          />
        </Modal>
      )}
    </>
  );
}
