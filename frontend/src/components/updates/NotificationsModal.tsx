'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, ExternalLink, Newspaper, Send } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useUI } from '@/components/ui/UIProvider';
import { notificationsApi, watchApi } from '@/lib/api';
import type { NotificationSettings, WatchDelivery, WatchSource } from '@/types/api';

const fmtWhen = new Intl.DateTimeFormat('it-IT', { weekday: 'long', hour: '2-digit', minute: '2-digit' });

export const DELIVERY_OPTIONS: { value: WatchDelivery; label: string; hint: string }[] = [
  { value: 'NORMAL', label: 'Solo in Linko', hint: 'Le novità compaiono qui, senza notifiche' },
  { value: 'INSTANT', label: 'Notifica subito', hint: 'Ogni novità arriva anche su Telegram appena trovata' },
  { value: 'DIGEST', label: 'Riepilogo giornaliero', hint: 'Una riga al giorno in Linko e un solo messaggio Telegram all’ora scelta' },
];

interface Props {
  sources: WatchSource[];
  onClose: () => void;
  onSourceUpdated: (s: WatchSource) => void;
}

/**
 * Impostazioni delle notifiche: collegamento del bot Telegram (creato
 * dall'utente con @BotFather), parole chiave sempre notificate, ora del
 * riepilogo giornaliero e modalità di consegna di ogni fonte.
 */
export default function NotificationsModal({ sources, onClose, onSourceUpdated }: Props) {
  const ui = useUI();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [token, setToken] = useState('');
  const [keywords, setKeywords] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    notificationsApi.get()
      .then((s) => { setSettings(s); setKeywords(s.keywords); })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function run<T>(what: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(what);
    setError('');
    try {
      return await fn();
    } catch (err) {
      setError((err as Error).message);
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function saveToken(e: React.FormEvent) {
    e.preventDefault();
    const s = await run('token', () => notificationsApi.setTelegramToken(token.trim()));
    if (s) { setSettings(s); setToken(''); }
  }

  async function link() {
    const s = await run('link', () => notificationsApi.linkTelegram());
    if (s) {
      setSettings(s);
      ui.toast(`Collegato${s.chatName ? ` a ${s.chatName}` : ''}: ti ho mandato un messaggio di prova su Telegram`);
    }
  }

  async function test() {
    const ok = await run('test', () => notificationsApi.testTelegram());
    if (ok) ui.toast('Messaggio di prova inviato su Telegram');
  }

  async function disconnect() {
    const yes = await ui.confirm({
      title: 'Scollegare Telegram?',
      message: 'Non riceverai più notifiche né riepiloghi. Le impostazioni delle fonti restano.',
      confirmLabel: 'Scollega',
      danger: true,
    });
    if (!yes) return;
    const s = await run('remove', () => notificationsApi.removeTelegram());
    if (s) setSettings(s);
  }

  async function saveKeywords() {
    if (!settings || keywords.trim() === settings.keywords) return;
    const s = await run('keywords', () => notificationsApi.update({ keywords: keywords.trim() }));
    if (s) { setSettings(s); ui.toast('Parole chiave salvate'); }
  }

  async function saveHour(hour: number) {
    const s = await run('hour', () => notificationsApi.update({ digestHour: hour }));
    if (s) setSettings(s);
  }

  async function setDelivery(src: WatchSource, delivery: WatchDelivery) {
    try {
      onSourceUpdated(await watchApi.updateSource(src.id, { delivery }));
    } catch {
      ui.toast('Modifica non riuscita. Riprova.', { kind: 'error' });
    }
  }

  const tg = settings?.telegram;
  const spinner = <span className="spinner" style={{ width: 14, height: 14 }} aria-hidden="true" />;

  return (
    <Modal title="Notifiche" onClose={onClose} width={620}>
      {!settings && !error && (
        <div className="flex justify-center py-8" aria-busy="true"><div className="spinner" aria-label="Caricamento…" /></div>
      )}

      {settings && (
        <>
          {/* ── Telegram ─────────────────────────────────────────────────── */}
          <section aria-labelledby="tg-title">
            <h3 id="tg-title" className="font-semibold text-fg-strong flex items-center gap-2">
              <Send size={15} aria-hidden="true" /> Telegram
              {tg?.linked && <span className="pill" style={{ color: 'var(--success)' }}><CheckCircle2 size={12} aria-hidden="true" /> collegato a @{tg.bot}</span>}
            </h3>

            {!tg?.configured && (
              <form onSubmit={saveToken} className="mt-2">
                <ol className="text-sm text-fg-muted list-decimal pl-5 space-y-1">
                  <li>Su Telegram apri <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline">@BotFather</a> e invia <code>/newbot</code>.</li>
                  <li>Scegli un nome e uno username che finisca con “bot”.</li>
                  <li>Copia il <strong>token</strong> che ti dà (es. <code>123456789:AA…</code>) e incollalo qui.</li>
                </ol>
                <label htmlFor="tg-token" className="field-label mt-3">Token del bot</label>
                <div className="flex gap-2">
                  <input
                    id="tg-token"
                    name="tg-token"
                    className="input flex-1"
                    autoComplete="off"
                    spellCheck={false}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="123456789:AA…"
                  />
                  <button type="submit" className="btn btn-primary" disabled={!token.trim() || busy !== null}>
                    {busy === 'token' ? spinner : null} Verifica
                  </button>
                </div>
                <p className="field-hint">Il token resta cifrato sul server ed è usato solo per scriverti.</p>
              </form>
            )}

            {tg?.configured && !tg.linked && (
              <div className="mt-2 text-sm">
                <p className="text-fg-muted">
                  Bot <strong>@{tg.bot}</strong> pronto. Ora aprilo su Telegram e premi <strong>Avvia</strong> (o scrivigli “ciao”), poi torna qui.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <a href={`https://t.me/${tg.bot}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                    <ExternalLink size={14} aria-hidden="true" /> Apri @{tg.bot}
                  </a>
                  <button type="button" className="btn btn-primary" onClick={link} disabled={busy !== null}>
                    {busy === 'link' ? spinner : null} Ho premuto Avvia: collega
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={disconnect} disabled={busy !== null}>Cambia bot</button>
                </div>
              </div>
            )}

            {tg?.linked && (
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className="btn btn-secondary btn-sm" onClick={test} disabled={busy !== null}>
                  {busy === 'test' ? spinner : null} Manda un messaggio di prova
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={disconnect} disabled={busy !== null}>Scollega</button>
              </div>
            )}
          </section>

          {/* ── Parole chiave ────────────────────────────────────────────── */}
          <section className="mt-6" aria-labelledby="kw-title">
            <h3 id="kw-title" className="font-semibold text-fg-strong flex items-center gap-2">
              <Bell size={15} aria-hidden="true" /> Parole chiave
            </h3>
            <p className="text-sm text-fg-muted mt-1">
              Un aggiornamento che le contiene ti arriva <strong>subito</strong>, da qualunque fonte (anche da quelle in riepilogo).
            </p>
            <label htmlFor="notify-keywords" className="sr-only">Parole chiave</label>
            <input
              id="notify-keywords"
              name="keywords"
              className="input mt-2"
              autoComplete="off"
              spellCheck={false}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              onBlur={saveKeywords}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveKeywords(); } }}
              placeholder='es. "Federica Corona" proxmox -request'
            />
            <p className="field-hint">
              <code>parola</code> · <code>&quot;frase esatta&quot;</code> · <code>-parola</code> per escludere. Vuoto = nessuna.
            </p>
          </section>

          {/* ── Riepilogo ────────────────────────────────────────────────── */}
          <section className="mt-6" aria-labelledby="digest-title">
            <h3 id="digest-title" className="font-semibold text-fg-strong flex items-center gap-2">
              <Newspaper size={15} aria-hidden="true" /> Riepilogo giornaliero
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-fg-muted">
              <label htmlFor="digest-hour">Ogni giorno alle</label>
              <select
                id="digest-hour"
                name="digest-hour"
                className="input"
                style={{ width: 'auto', height: 32 }}
                value={settings.digestHour}
                onChange={(e) => saveHour(Number(e.target.value))}
                disabled={busy !== null}
              >
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
              {tg?.linked && settings.nextDigestAt && settings.digestSources > 0 && (
                <span className="text-xs text-fg-faint">prossimo: {fmtWhen.format(new Date(settings.nextDigestAt))}</span>
              )}
            </div>
          </section>

          {/* ── Fonti ────────────────────────────────────────────────────── */}
          <section className="mt-6" aria-labelledby="src-title">
            <h3 id="src-title" className="font-semibold text-fg-strong">Come arrivano le novità di ogni fonte</h3>
            {!tg?.linked && (
              <p className="text-xs text-fg-faint mt-1">
                “Notifica subito” e il messaggio del riepilogo richiedono Telegram collegato; il riepilogo in Linko funziona comunque.
              </p>
            )}
            <ul className="mt-2 card overflow-hidden" style={{ listStyle: 'none', maxHeight: 280, overflowY: 'auto' }}>
              {sources.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm" style={{ borderTop: i ? '1px solid var(--border)' : undefined }}>
                  <span className="flex-1 min-w-0 truncate" title={s.name}>{s.name}</span>
                  <label className="sr-only" htmlFor={`delivery-${s.id}`}>Consegna per {s.name}</label>
                  <select
                    id={`delivery-${s.id}`}
                    className="input"
                    style={{ width: 'auto', height: 30, fontSize: 12, padding: '0 8px' }}
                    value={s.delivery}
                    onChange={(e) => setDelivery(s, e.target.value as WatchDelivery)}
                  >
                    {DELIVERY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </li>
              ))}
              {sources.length === 0 && <li className="px-3 py-2 text-sm text-fg-muted">Nessuna fonte.</li>}
            </ul>
          </section>
        </>
      )}

      <div aria-live="polite">
        {error && <div className="alert-error mt-4">{error}</div>}
      </div>
    </Modal>
  );
}
