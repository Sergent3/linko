'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { watchApi } from '@/lib/api';
import type { CredentialVerification, SiteCredential } from '@/types/api';

interface Props {
  /** Sito o URL: se indicato il dominio non è modificabile */
  site?: string;
  /** Pagina su cui provare il cookie (default: home del dominio) */
  testUrl?: string;
  /** Accesso esistente da aggiornare (mostra quali cookie c'erano) */
  existing?: SiteCredential;
  onSaved: (credential: SiteCredential | undefined, verification: CredentialVerification) => void;
  onCancel?: () => void;
  compact?: boolean;
}

function hostOf(site: string) {
  try { return new URL(site.includes('://') ? site : `https://${site}`).hostname.replace(/^www\./, ''); }
  catch { return site; }
}

/** Esito della prova del cookie, in parole semplici. */
export function verificationText(v: CredentialVerification): { ok: boolean; text: string } {
  if (!v.ok) return { ok: false, text: v.message ?? 'Il cookie non funziona.' };
  if (v.state === 'in') return { ok: true, text: 'Accesso verificato: il sito ti riconosce come utente registrato.' };
  return { ok: true, text: 'Il sito risponde con il cookie, ma non riesco a confermare il login: controlla che le pagine riservate compaiano.' };
}

export default function CredentialForm({ site = '', testUrl, existing, onSaved, onCancel, compact }: Props) {
  const [domain, setDomain] = useState(existing?.domain ?? (site ? hostOf(site) : ''));
  const [cookie, setCookie] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CredentialVerification | null>(null);
  const fixedDomain = !!existing || !!site;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const res = await watchApi.saveCredential({
        site: domain,
        cookie,
        userAgent: userAgent.trim() || undefined,
        testUrl,
      });
      setResult(res.verification);
      if (res.verification.ok) {
        setCookie('');
        onSaved(res.credential, res.verification);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const outcome = result && verificationText(result);

  return (
    <form onSubmit={submit} className={compact ? '' : 'space-y-4'}>
      {!fixedDomain && (
        <div className="mb-4">
          <label className="field-label" htmlFor="cred-domain">Sito</label>
          <input
            id="cred-domain"
            name="domain"
            className="input"
            autoComplete="off"
            spellCheck={false}
            placeholder="es. forum.esempio.it…"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
            data-autofocus
          />
        </div>
      )}

      <div className="mb-4">
        <label className="field-label" htmlFor="cred-cookie">
          Cookie di <span className="text-fg-strong" translate="no">{domain || 'questo sito'}</span>
        </label>
        <textarea
          id="cred-cookie"
          name="cookie"
          className="input font-mono text-xs"
          rows={compact ? 3 : 4}
          autoComplete="off"
          spellCheck={false}
          placeholder="xf_user=…; xf_session=…  (oppure cookies.txt o il JSON di Cookie-Editor)"
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          required
          {...(fixedDomain && { 'data-autofocus': true })}
        />
        {existing && existing.cookieNames.length > 0 && (
          <p className="field-hint">Ora salvati: {existing.cookieNames.join(', ')}. Quelli nuovi li sostituiscono.</p>
        )}
        <details className="mt-2 text-xs text-fg-muted">
          <summary className="cursor-pointer text-accent-text">Come copio il cookie?</summary>
          <ol className="mt-2 ml-4 space-y-1" style={{ listStyle: 'decimal' }}>
            <li>Apri il sito nel browser ed entra con il tuo account.</li>
            <li>Premi <kbd>F12</kbd> (strumenti per sviluppatori) e apri la scheda <strong>Rete</strong>/<strong>Network</strong>.</li>
            <li>Ricarica la pagina e fai click sulla prima richiesta (il nome del sito).</li>
            <li>In <strong>Intestazioni richiesta</strong>/<strong>Request Headers</strong> copia tutto il valore di <code>cookie:</code> e incollalo qui.</li>
          </ol>
          <p className="mt-2">In alternativa va bene l&apos;esportazione di un&apos;estensione come Cookie-Editor (JSON) o un file cookies.txt.</p>
        </details>
      </div>

      <div className="mb-4">
        <label className="field-label" htmlFor="cred-ua">User-Agent del browser <span className="font-normal text-fg-faint">(facoltativo)</span></label>
        <div className="flex gap-2">
          <input
            id="cred-ua"
            name="user-agent"
            className="input text-xs"
            autoComplete="off"
            spellCheck={false}
            placeholder="Consigliato per i siti con protezione anti-bot…"
            value={userAgent}
            onChange={(e) => setUserAgent(e.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={() => setUserAgent(navigator.userAgent)} title="Usa lo User-Agent di questo browser">
            Questo browser
          </button>
        </div>
        <p className="field-hint">Se hai copiato il cookie da questo browser, premi “Questo browser”: alcuni siti accettano il cookie solo con lo stesso User-Agent.</p>
      </div>

      <div aria-live="polite">
        {error && <div className="alert-error mb-4">{error}</div>}
        {outcome && !outcome.ok && (
          <div className="alert-error mb-4 flex gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{outcome.text} Ricopia il cookie dopo aver fatto di nuovo login nel browser.</span>
          </div>
        )}
        {outcome && outcome.ok && (
          <p className="text-[13px] mb-4 flex gap-2" style={{ color: 'var(--success)' }}>
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" aria-hidden="true" /> {outcome.text}
          </p>
        )}
      </div>

      <p className="text-xs text-fg-faint mb-4">
        Il cookie viene salvato cifrato e inviato solo a {domain || 'questo sito'}. Chi lo possiede può agire come te sul sito:
        non condividerlo con altri.
      </p>

      <div className="flex gap-2 justify-end">
        {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>Annulla</button>}
        <button type="submit" className="btn btn-primary" disabled={busy || !cookie.trim() || !domain.trim()}>
          {busy
            ? <span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} aria-hidden="true" />
            : <KeyRound size={14} aria-hidden="true" />}
          {busy ? 'Verifica in corso…' : 'Salva e verifica'}
        </button>
      </div>
    </form>
  );
}
