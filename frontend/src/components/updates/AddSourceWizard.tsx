'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Check, ChevronLeft, Rss, LayoutList, Link2, Folder as FolderIcon, KeyRound, MessagesSquare, Crosshair, Puzzle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import CredentialForm from './CredentialForm';
import { bookmarks as bookmarksApi, watchApi } from '@/lib/api';
import { detectExtension, EXTENSION_VERSION, fetchViaExtension, grantExtension, originOf, type ExtensionState } from '@/lib/extension';
import type { Bookmark, ExtractedItem, FetchedPage, FoundFeed, SuggestedArea, WatchDelivery, WatchFetcher, WatchPreview, WatchSource } from '@/types/api';
import { DELIVERY_OPTIONS } from './NotificationsModal';

interface Props {
  onClose: () => void;
  onCreated: (source: WatchSource) => void;
  /** Fonti già seguite: i segnalibri corrispondenti vengono segnalati */
  sources?: WatchSource[];
  initialUrl?: string;
  initialTitle?: string;
  bookmarkId?: string;
  /** Fonte da modificare: il wizard parte dalle impostazioni e salva sulla fonte esistente */
  editing?: WatchSource;
}

const MAX_RESULTS = 60;

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sameUrl(a: string, b: string) {
  const strip = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();
  return strip(a) === strip(b);
}

function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostname(url);
  if (failed || !host) return <span className="favicon favicon-fallback" aria-hidden="true" />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      className="favicon"
      onError={() => setFailed(true)}
    />
  );
}

type Step = 'url' | 'area' | 'settings';

const STEPS: { id: Step; label: string }[] = [
  { id: 'url', label: 'Sito' },
  { id: 'area', label: 'Cosa monitorare' },
  { id: 'settings', label: 'Impostazioni' },
];

const INTERVALS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 ora' },
  { value: 360, label: '6 ore' },
  { value: 1440, label: '1 giorno' },
];

// I forum cambiano più in fretta dei siti: frequenza proposta più alta
const DEFAULT_SITE_INTERVAL = 60;
const DEFAULT_FORUM_INTERVAL = 30;

/** L'estensione installata è più vecchia di quella che distribuisce Linko? */
function outdated(ext: ExtensionState | null | undefined) {
  if (!ext?.version) return false;
  const a = EXTENSION_VERSION.split('.').map(Number);
  const b = ext.version.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function ItemList({ items }: { items: ExtractedItem[] }) {
  return (
    <ul className="flex flex-col gap-1" style={{ listStyle: 'none' }}>
      {items.map((i) => (
        <li key={i.url} className="truncate text-xs text-fg-muted">› {i.title}</li>
      ))}
    </ul>
  );
}

/** Opzione selezionabile (feed o area): radio nativo, tutta la card è cliccabile. */
function Choice({
  checked, onChange, icon, title, meta, items,
}: {
  checked: boolean; onChange: () => void; icon?: React.ReactNode; title: string; meta: string; items: ExtractedItem[];
}) {
  return (
    <label
      className="flex gap-3 p-3 rounded-[10px] cursor-pointer transition-colors"
      style={{
        border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
        background: checked ? 'var(--accent-soft)' : 'var(--bg)',
      }}
    >
      <input type="radio" name="area" checked={checked} onChange={onChange} className="mt-1 accent-[var(--accent)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-strong mb-1.5">
          {icon}
          <span className="truncate">{title}</span>
          <span className="font-normal text-fg-muted shrink-0">· {meta}</span>
        </div>
        <ItemList items={items} />
      </div>
    </label>
  );
}

function targetLabel(s: WatchSource): string {
  if (s.mode === 'THREAD') return 'Nuove risposte della discussione';
  if (s.mode === 'FEED') return `Feed ${s.feedUrl ?? ''}`;
  return `Area della pagina (${s.selector ?? ''})`;
}

export default function AddSourceWizard({ onClose, onCreated, sources = [], initialUrl = '', initialTitle = '', bookmarkId: initialBookmarkId, editing }: Props) {
  const [step, setStep] = useState<Step>(editing ? 'settings' : 'url');
  const [url, setUrl] = useState(editing?.url ?? initialUrl);
  // In modifica: true quando l'utente ha rianalizzato la pagina per cambiare cosa monitorare
  const [retarget, setRetarget] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | undefined>(initialBookmarkId);
  const [bookmarkTitle, setBookmarkTitle] = useState(initialTitle);
  const [allBookmarks, setAllBookmarks] = useState<Bookmark[] | null>(null);
  const [query, setQuery] = useState('');
  const [manualMode, setManualMode] = useState(!!editing);
  const [finalUrl, setFinalUrl] = useState('');
  const [areas, setAreas] = useState<SuggestedArea[]>([]);
  const [feeds, setFeeds] = useState<FoundFeed[]>([]);
  const [feedUrl, setFeedUrl] = useState('');
  const [thread, setThread] = useState<WatchPreview['thread']>();
  const [followThread, setFollowThread] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [selector, setSelector] = useState('');
  const [manualSelector, setManualSelector] = useState('');
  const [manualItems, setManualItems] = useState<ExtractedItem[] | null>(null);
  const [name, setName] = useState(editing?.name ?? '');
  const [filter, setFilter] = useState(editing?.filter ?? '');
  const [intervalMinutes, setIntervalMinutes] = useState(editing?.intervalMinutes ?? DEFAULT_SITE_INTERVAL);
  const [category, setCategory] = useState(editing?.category ?? '');
  const [delivery, setDelivery] = useState<WatchDelivery>(editing?.delivery ?? 'NORMAL');
  // Siti con verifica anti-bot: la pagina la scarica l'estensione nel browser dell'utente
  const [fetcher, setFetcher] = useState<WatchFetcher>(editing?.fetcher ?? 'SERVER');
  const [extPage, setExtPage] = useState<FetchedPage | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [ext, setExt] = useState<ExtensionState | null | undefined>(undefined);
  const [grantOrigin, setGrantOrigin] = useState<string | null>(null);
  const [viaExt, setViaExt] = useState(false);
  const categories = [...new Set(sources.map((s) => s.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'it'));
  const [forum, setForum] = useState<string | null>(editing?.kind === 'FORUM' ? 'forum' : null);
  const [auth, setAuth] = useState<WatchPreview['auth']>();
  // Mostra il modulo per incollare il cookie (sito bloccato o pagine riservate)
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const chosenArea = areas.find((a) => a.selector === selector);
  const visibleAreas = areas.filter((a) => showNav || !a.isNavigation);
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  // Segnalibri tra cui scegliere: il primo passo parte da qui, niente link da incollare
  useEffect(() => {
    bookmarksApi.list({ page: 1, limit: 2000 })
      .then((res) => setAllBookmarks(res.data ?? []))
      .catch(() => { setAllBookmarks([]); setManualMode(true); });
  }, []);

  // Aperto da un segnalibro: si analizza subito la sua pagina
  useEffect(() => {
    if (initialUrl && !editing) analyze(initialUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isFollowed = (b: Bookmark) => sources.some((s) => s.bookmarkId === b.id || sameUrl(s.url, b.url));

  const matches = useMemo(() => {
    if (!allBookmarks) return [];
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return allBookmarks;
    return allBookmarks.filter((b) => {
      const hay = normalize(`${b.title} ${b.url} ${b.folder?.name ?? ''}`);
      return terms.every((t) => hay.includes(t));
    });
  }, [allBookmarks, query]);
  const results = matches.slice(0, MAX_RESULTS);

  function pickBookmark(b: Bookmark) {
    setUrl(b.url);
    setBookmarkId(b.id);
    setBookmarkTitle(b.title);
    analyze(b.url);
  }

  // L'estensione serve solo se il server viene bloccato: la si cerca in quel momento
  useEffect(() => {
    if ((blocked || fetcher === 'EXTENSION') && ext === undefined) detectExtension().then(setExt);
  }, [blocked, fetcher, ext]);

  async function analyze(target = url) {
    if (!target.trim()) return;
    if (fetcher === 'EXTENSION') return analyzeWithExtension(target);
    setError('');
    setBlocked(false);
    setBusy(true);
    let antiBot = false;
    try {
      applyPreview(await watchApi.preview(target.trim()));
    } catch (err) {
      const msg = (err as Error).message;
      // Verifica anti-bot: il server non passa, il browser dell'utente sì
      if (/anti-bot/.test(msg)) antiBot = true;
      else {
        setError(`${msg}.`);
        // Login richiesto o cookie scaduto: si propone di incollare il cookie
        if (/login|scaduto/.test(msg)) setShowLogin(true);
      }
    } finally {
      setBusy(false);
    }
    if (!antiBot) return;
    setBlocked(true);
    // Estensione già collegata: si passa subito al browser dell'utente
    const found = await detectExtension();
    setExt(found);
    if (found?.connected && !outdated(found)) return analyzeWithExtension(target);
    setError(`${hostname(target)} blocca i server con una verifica anti-bot.`);
  }

  /** Pagina scaricata dal browser dell'utente tramite l'estensione, poi analizzata dal server. */
  async function analyzeWithExtension(target = url) {
    setError('');
    setGrantOrigin(null);
    setBusy(true);
    setViaExt(true);
    try {
      const r = await fetchViaExtension(target.trim());
      if ('page' in r) {
        const res = await watchApi.preview(target.trim(), undefined, r.page);
        setExtPage(r.page);
        setFetcher('EXTENSION');
        setBlocked(false);
        applyPreview(res);
        return;
      }
      if (r.error === 'permission') {
        setGrantOrigin(r.origin);
        setError(`L'estensione ha bisogno del permesso per aprire ${hostname(target)}.`);
      } else if (r.error === 'challenge') {
        setError('La verifica anti-bot non è stata superata in tempo: riprova e, quando si apre la finestra del sito, spunta la casella.');
      } else if (r.error === 'reload') {
        setError('L\'estensione è stata aggiornata: ricarica questa pagina e riprova.');
      } else {
        setError(`L'estensione non è riuscita ad aprire la pagina${r.message ? `: ${r.message}` : ''}.`);
      }
    } catch (err) {
      setError(`${(err as Error).message}.`);
    } finally {
      setBusy(false);
      setViaExt(false);
    }
  }

  function applyPreview(res: WatchPreview) {
    setShowLogin(false);
    setForum(res.forum ?? null);
    setAuth(res.auth);
    if (!editing) setIntervalMinutes(res.forum ? DEFAULT_FORUM_INTERVAL : DEFAULT_SITE_INTERVAL);
    setFinalUrl(res.finalUrl);
    setAreas(res.areas);
    setFeeds(res.feeds);
    setThread(res.thread);
    setFollowThread(!!res.thread && (!editing || editing.mode === 'THREAD'));
    if (editing) setRetarget(true);
    // In modifica si ripropone la scelta attuale, se è ancora valida sulla stessa pagina
    if (editing && sameUrl(res.finalUrl, editing.url) && editing.mode !== 'THREAD') {
      if (editing.mode === 'FEED' && editing.feedUrl) {
        const fu = editing.feedUrl;
        if (!res.feeds.some((f) => f.url === fu)) setFeeds([{ url: fu, title: 'Feed attuale', itemCount: 0, sample: [] }, ...res.feeds]);
        setFeedUrl(fu);
        setSelector('');
      } else if (editing.selector) {
        setSelector(editing.selector);
        setFeedUrl('');
        if (!res.areas.some((a) => a.selector === editing.selector)) setManualSelector(editing.selector);
      }
    } else if (res.thread && (!editing || editing.mode === 'THREAD')) {
      setFeedUrl('');
      setSelector('');
    } else if (res.feeds.length > 0) {
      setFeedUrl(res.feeds[0].url);
      setSelector('');
    } else {
      const first = res.areas.find((a) => !a.isNavigation) ?? res.areas[0];
      setFeedUrl('');
      setSelector(first?.selector ?? '');
    }
    setStep('area');
  }

  async function tryManual() {
    if (!manualSelector.trim()) return;
    setError('');
    setBusy(true);
    try {
      const res = await watchApi.preview(finalUrl || url.trim(), manualSelector.trim(), fetcher === 'EXTENSION' ? extPage ?? undefined : undefined);
      setManualItems(res.items);
      if (res.items.length > 0) chooseArea(manualSelector.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function chooseArea(sel: string) {
    setSelector(sel);
    setFeedUrl('');
    setFollowThread(false);
  }

  function chooseFeed(u: string) {
    setFeedUrl(u);
    setSelector('');
    setFollowThread(false);
  }

  function goSettings() {
    // In modifica il nome scelto dall'utente resta
    if (editing) { setStep('settings'); return; }
    if (followThread && thread) {
      setName(thread.title || bookmarkTitle.trim() || hostname(thread.url));
      setStep('settings');
      return;
    }
    const chosenFeed = feeds.find((f) => f.url === feedUrl);
    const areaName = chosenFeed
      ? chosenFeed.title
      : chosenArea && !/^[a-z]+(\.|$)/.test(chosenArea.label) ? chosenArea.label : '';
    const base = bookmarkTitle.trim() || hostname(finalUrl || url);
    const extra = areaName && !normalize(base).includes(normalize(areaName)) ? ` · ${areaName}` : '';
    setName(`${base}${extra}`);
    setStep('settings');
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      if (editing) {
        const updated = await watchApi.updateSource(editing.id, {
          name: name.trim(),
          filter: filter.trim(),
          intervalMinutes,
          category: category.trim() || null,
          delivery,
          ...(fetcher !== editing.fetcher && { fetcher }),
          ...(retarget && {
            url: finalUrl || url.trim(),
            kind: forum ? 'FORUM' as const : 'SITE' as const,
            ...(followThread ? { thread: true } : feedUrl ? { feedUrl } : { selector }),
          }),
        });
        onCreated(updated);
        onClose();
        return;
      }
      const source = await watchApi.createSource({
        name: name.trim(),
        url: finalUrl || url.trim(),
        ...(followThread ? { thread: true } : feedUrl ? { feedUrl } : { selector }),
        kind: forum ? 'FORUM' : 'SITE',
        filter: filter.trim(),
        intervalMinutes,
        category: category.trim() || null,
        delivery,
        fetcher,
        bookmarkId,
      });
      onCreated(source);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const spinner = <span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} aria-hidden="true" />;

  const footer = (
    <>
      {editing && step === 'url' && (
        <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => { setError(''); setShowLogin(false); setStep('settings'); }} disabled={busy}>
          <ChevronLeft size={15} aria-hidden="true" /> Indietro
        </button>
      )}
      {step !== 'url' && !(editing && step === 'settings' && !retarget) && (
        <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => { setError(''); setStep(step === 'settings' ? 'area' : 'url'); }} disabled={busy}>
          <ChevronLeft size={15} aria-hidden="true" /> Indietro
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
      {step === 'url' && manualMode && (
        <button type="button" className="btn btn-primary" onClick={() => analyze()} disabled={busy || !url.trim()}>
          {busy ? spinner : <Search size={14} aria-hidden="true" />} {busy ? 'Analisi…' : 'Analizza pagina'}
        </button>
      )}
      {step === 'area' && (
        <button type="button" className="btn btn-primary" onClick={goSettings} disabled={busy || (!selector && !feedUrl && !followThread)}>Avanti</button>
      )}
      {step === 'settings' && (
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !name.trim()}>
          {busy ? spinner : <Check size={14} aria-hidden="true" />} {busy ? 'Salvataggio…' : editing ? 'Salva modifiche' : 'Salva fonte'}
        </button>
      )}
    </>
  );

  return (
    <Modal title={editing ? `Modifica “${editing.name}”` : 'Aggiungi fonte'} onClose={onClose} width={720} dismissOnBackdrop={!editing && step === 'url'} footer={footer}>
      {/* Indicatore dei passi */}
      <ol className="flex items-center gap-2 mb-5 text-xs" style={{ listStyle: 'none' }} aria-label="Passi">
        {STEPS.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2" aria-current={i === stepIndex ? 'step' : undefined}>
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center font-semibold tabular-nums"
              style={{
                background: i <= stepIndex ? 'var(--accent)' : 'var(--surface-hover)',
                color: i <= stepIndex ? '#fff' : 'var(--text-faint)',
              }}
            >
              {i < stepIndex ? <Check size={11} aria-hidden="true" /> : i + 1}
            </span>
            <span className={i === stepIndex ? 'text-fg-strong font-medium' : 'text-fg-faint'}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="w-6 h-px bg-line-strong" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step === 'url' && busy && (
        <div className="flex flex-col items-center gap-3 py-10 text-fg-muted" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Analizzo <strong className="text-fg-strong">{bookmarkTitle || hostname(url)}</strong>…</p>
          {viaExt
            ? <p className="text-xs text-fg-faint text-center max-w-sm">La pagina la apre il tuo browser. Se compare una finestra con la verifica anti-bot, spunta la casella: la finestra si chiude da sola.</p>
            : <p className="text-xs text-fg-faint">Cerco feed RSS e liste di elementi nella pagina.</p>}
        </div>
      )}

      {step === 'url' && !busy && !manualMode && (
        <div>
          <label className="field-label" htmlFor="watch-bm-search">Quale dei tuoi segnalibri vuoi seguire?</label>
          <div className="relative">
            <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint pointer-events-none" />
            <input
              id="watch-bm-search"
              name="bookmark-search"
              type="search"
              className="input"
              style={{ paddingLeft: 32 }}
              autoComplete="off"
              spellCheck={false}
              data-autofocus
              placeholder="Cerca per nome, indirizzo o cartella…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); pickBookmark(results[0]); } }}
            />
          </div>

          <ul
            className="mt-3 rounded-[10px] overflow-y-auto"
            style={{ listStyle: 'none', maxHeight: 'min(380px, 50vh)', border: '1px solid var(--border)', background: 'var(--bg)', overscrollBehavior: 'contain' }}
            aria-label="Segnalibri"
          >
            {allBookmarks === null && (
              <li className="flex justify-center py-8"><div className="spinner" aria-label="Caricamento…" /></li>
            )}
            {allBookmarks !== null && results.length === 0 && (
              <li className="empty-state" style={{ padding: 24 }}>
                {query ? `Nessun segnalibro corrisponde a “${query}”.` : 'Non hai ancora segnalibri.'}
              </li>
            )}
            {results.map((b, idx) => (
              <li key={b.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : undefined }}>
                <button
                  type="button"
                  className="bookmark-item w-full text-left"
                  style={{ border: 'none', font: 'inherit', cursor: 'pointer', minHeight: 48 }}
                  onClick={() => pickBookmark(b)}
                >
                  <Favicon url={b.url} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg-strong">{b.title || hostname(b.url)}</span>
                    <span className="flex items-center gap-1.5 text-xs text-fg-faint min-w-0">
                      <span className="truncate">{hostname(b.url)}</span>
                      {b.folder && (
                        <span className="inline-flex items-center gap-1 shrink-0">
                          · <FolderIcon size={11} aria-hidden="true" /> {b.folder.name}
                        </span>
                      )}
                    </span>
                  </span>
                  {isFollowed(b) && <span className="chip shrink-0">già seguito</span>}
                </button>
              </li>
            ))}
          </ul>
          {matches.length > results.length && (
            <p className="field-hint">Mostrati {results.length} di {matches.length}: scrivi qualcosa per restringere.</p>
          )}

          <button type="button" className="btn btn-sm btn-ghost mt-3" onClick={() => setManualMode(true)}>
            <Link2 size={14} aria-hidden="true" /> Non è tra i segnalibri? Incolla un indirizzo
          </button>
        </div>
      )}

      {step === 'url' && !busy && manualMode && (
        <form onSubmit={(e) => { e.preventDefault(); if (!editing) { setBookmarkId(undefined); setBookmarkTitle(''); } analyze(); }}>
          <label className="field-label" htmlFor="watch-url">Indirizzo della pagina con gli aggiornamenti</label>
          <input
            id="watch-url"
            name="url"
            className="input"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            data-autofocus
            value={url}
            placeholder="https://esempio.it/news…"
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="field-hint">Linko scarica la pagina e cerca da solo feed RSS e liste di elementi (articoli, uscite, thread).</p>
          {!editing && allBookmarks && allBookmarks.length > 0 && (
            <button type="button" className="btn btn-sm btn-ghost mt-3" onClick={() => setManualMode(false)}>
              <ChevronLeft size={14} aria-hidden="true" /> Scegli dai segnalibri
            </button>
          )}
        </form>
      )}

      {step === 'area' && (
        <fieldset>
          <legend className="sr-only">Cosa monitorare</legend>
          {sources.some((x) => x.id !== editing?.id && ((bookmarkId && x.bookmarkId === bookmarkId) || sameUrl(x.url, url) || (finalUrl && sameUrl(x.url, finalUrl)))) && (
            <p className="text-xs mb-3 px-3 py-2 rounded-md" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
              Segui già questo sito: puoi aggiungere un altro feed o un&apos;altra area.
            </p>
          )}
          {(forum || auth) && (
            <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
              {forum && (
                <span className="chip"><MessagesSquare size={11} className="mr-1" aria-hidden="true" /> Forum {forum}</span>
              )}
              {auth?.state === 'in' && (
                <span className="chip" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--success)' }}>
                  <KeyRound size={11} className="mr-1" aria-hidden="true" /> Connesso come utente registrato
                </span>
              )}
              {auth && auth.state === 'unknown' && (
                <span className="chip"><KeyRound size={11} className="mr-1" aria-hidden="true" /> Cookie di {auth.domain} inviato</span>
              )}
              {!auth && forum && !showLogin && (
                <button type="button" className="btn btn-sm btn-ghost" style={{ color: 'var(--accent-text)' }} onClick={() => setShowLogin(true)}>
                  Alcune sezioni richiedono il login? Aggiungi l&apos;accesso
                </button>
              )}
            </div>
          )}
          {thread && (
            <div className="mb-5">
              <h3 className="field-label">Discussione · consigliato</h3>
              <Choice
                checked={followThread}
                onChange={() => { setFollowThread(true); setSelector(''); setFeedUrl(''); }}
                icon={<MessagesSquare size={13} style={{ color: 'var(--accent-text)', flexShrink: 0 }} aria-hidden="true" />}
                title={`Nuove risposte in “${thread.title}”`}
                meta="ultimi post"
                items={thread.sample.slice(0, 3)}
              />
              <p className="field-hint">Linko controlla l&apos;ultima pagina della discussione e ti segnala ogni nuovo post.</p>
              {visibleAreas.length > 0 && <h3 className="field-label mt-4">Oppure un&apos;area della pagina</h3>}
            </div>
          )}
          {feeds.length > 0 && (
            <>
              <h3 className="field-label">Feed trovati · consigliati</h3>
              <div className="flex flex-col gap-2 mb-5">
                {feeds.map((f) => (
                  <Choice
                    key={f.url}
                    checked={feedUrl === f.url}
                    onChange={() => chooseFeed(f.url)}
                    icon={<Rss size={13} style={{ color: '#fb923c', flexShrink: 0 }} aria-hidden="true" />}
                    title={f.title || 'Feed'}
                    meta={`${f.itemCount} elementi`}
                    items={f.sample.slice(0, 3)}
                  />
                ))}
              </div>
              {visibleAreas.length > 0 && <h3 className="field-label">Oppure un&apos;area della pagina</h3>}
            </>
          )}
          {visibleAreas.length === 0 && feeds.length === 0 && !thread && (
            <p className="text-[13px] mb-3" style={{ color: 'var(--warning)' }}>
              Nessuna lista trovata automaticamente. Indica l&apos;area con un selettore CSS qui sotto.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {visibleAreas.map((a) => (
              <Choice
                key={a.selector}
                checked={selector === a.selector}
                onChange={() => chooseArea(a.selector)}
                icon={<LayoutList size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} aria-hidden="true" />}
                title={a.label}
                meta={`${a.itemCount} elementi${a.isNavigation ? ' · menu' : ''}`}
                items={a.sample.slice(0, 3)}
              />
            ))}
          </div>
          {areas.some((a) => a.isNavigation) && (
            <button type="button" className="btn btn-sm btn-ghost mt-2" onClick={() => setShowNav((v) => !v)}>
              {showNav ? 'Nascondi menu e piè di pagina' : 'Mostra anche menu e piè di pagina'}
            </button>
          )}

          <label className="field-label mt-5" htmlFor="watch-selector">Nessuna è quella giusta? Selettore CSS dell&apos;area</label>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); tryManual(); }}>
            <input
              id="watch-selector"
              name="selector"
              className="input font-mono"
              autoComplete="off"
              spellCheck={false}
              value={manualSelector}
              placeholder="es. #main ul.latest…"
              onChange={(e) => setManualSelector(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" disabled={busy || !manualSelector.trim()}>
              <Search size={14} aria-hidden="true" /> Prova
            </button>
          </form>
          {manualItems && (
            <div className="mt-2.5 p-3 rounded-[10px]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }} aria-live="polite">
              {manualItems.length === 0
                ? <span className="text-xs" style={{ color: 'var(--warning)' }}>Nessun elemento trovato con questo selettore: prova un contenitore più ampio.</span>
                : <>
                    <div className="text-xs text-fg-muted mb-1.5">{manualItems.length} elementi trovati{selector === manualSelector.trim() ? ' · selezionato' : ''}</div>
                    <ItemList items={manualItems.slice(0, 5)} />
                  </>}
            </div>
          )}
        </fieldset>
      )}

      {step === 'settings' && editing && (
        <div className="mb-5 p-3 rounded-[10px] flex items-center gap-3 flex-wrap" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-fg-faint">Cosa monitora</div>
            <div className="text-[13px] text-fg-strong truncate">
              {retarget
                ? followThread ? 'Nuove risposte della discussione' : feedUrl ? `Feed ${feedUrl}` : `Area della pagina (${selector})`
                : targetLabel(editing)}
            </div>
            <div className="text-xs text-fg-muted truncate">{retarget ? finalUrl || url : editing.url}</div>
            {retarget && <div className="text-xs mt-1" style={{ color: 'var(--accent-text)' }}>Nuova scelta: gli elementi già presenti diventano il punto di partenza.</div>}
          </div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setError(''); setStep('url'); }}>
            <Crosshair size={14} aria-hidden="true" /> Cambia pagina o area
          </button>
        </div>
      )}

      {step === 'settings' && (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) save(); }}>
          {fetcher === 'EXTENSION' && (
            <p className="text-xs mb-4 px-3 py-2 rounded-md flex items-center gap-2 flex-wrap" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
              <Puzzle size={13} aria-hidden="true" />
              <span className="flex-1 min-w-0">Controllata dal tuo browser con l&apos;estensione Linko (il server è bloccato da questo sito).</span>
              {editing?.fetcher === 'EXTENSION' && (
                <button type="button" className="underline" onClick={() => setFetcher('SERVER')}>Riprova dal server</button>
              )}
            </p>
          )}
          {fetcher === 'SERVER' && editing?.fetcher === 'EXTENSION' && (
            <p className="text-xs mb-4 px-3 py-2 rounded-md" style={{ background: 'var(--surface-hover)' }}>
              Al salvataggio la fonte torna a essere controllata dal server.{' '}
              <button type="button" className="underline" onClick={() => setFetcher('EXTENSION')}>Annulla</button>
            </p>
          )}
          <label className="field-label" htmlFor="watch-name">Nome</label>
          <input id="watch-name" name="name" className="input" autoComplete="off" data-autofocus value={name} onChange={(e) => setName(e.target.value)} />

          <span className="field-label mt-5" id="watch-interval-label">Frequenza dei controlli</span>
          <div className="tabs" role="radiogroup" aria-labelledby="watch-interval-label">
            {INTERVALS.map((i) => (
              <button
                key={i.value}
                type="button"
                role="radio"
                aria-checked={intervalMinutes === i.value}
                className="tab"
                onClick={() => setIntervalMinutes(i.value)}
              >
                {i.label}
              </button>
            ))}
          </div>
          <p className="field-hint">
            {editing
              ? ''
              : followThread
              ? 'Per una discussione è proposto un controllo ogni 30 minuti. '
              : forum
              ? 'Per i forum è proposto un controllo ogni 30 minuti: i thread nuovi arrivano più spesso che sui siti. '
              : ''}
            Se la lista si aggiorna più in fretta, Linko accorcia da solo l&apos;intervallo (fino a 10 minuti).
          </p>

          <span className="field-label mt-5" id="watch-delivery-label">Novità</span>
          <div className="tabs" role="radiogroup" aria-labelledby="watch-delivery-label">
            {DELIVERY_OPTIONS.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={delivery === o.value} className="tab" onClick={() => setDelivery(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="field-hint">{DELIVERY_OPTIONS.find((o) => o.value === delivery)?.hint}. Telegram si collega da “Notifiche” in Aggiornamenti.</p>

          <label className="field-label mt-5" htmlFor="watch-category">Categoria (facoltativa)</label>
          <input
            id="watch-category"
            name="category"
            className="input"
            autoComplete="off"
            maxLength={40}
            list="watch-categories"
            value={category}
            placeholder="es. Riviste, Forum, News…"
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="watch-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
          <p className="field-hint">Le fonti della stessa categoria compaiono insieme nella colonna Fonti.</p>

          <label className="field-label mt-5" htmlFor="watch-filter">Filtro (facoltativo)</label>
          <input
            id="watch-filter"
            name="filter"
            className="input"
            autoComplete="off"
            spellCheck={false}
            value={filter}
            placeholder='es. docker "zfs pool" -request…'
            onChange={(e) => setFilter(e.target.value)}
          />
          <p className="field-hint">
            Vuoto = tutti gli elementi nuovi. <code>parola</code> nel titolo · <code>&quot;frase esatta&quot;</code> · <code>-parola</code> per escludere
            {feedUrl && <> · <code>#categoria</code> per le categorie del feed</>}.
          </p>
          <button type="submit" hidden />
        </form>
      )}

      <div aria-live="polite">
        {error && <div className="alert-error mt-4">{error}</div>}
      </div>

      {(blocked || grantOrigin) && step === 'url' && !busy && (
        <div className="card p-4 mt-4" style={{ background: 'var(--surface-2)' }}>
          <h3 className="flex items-center gap-2 font-semibold text-fg-strong mb-1">
            <Puzzle size={15} aria-hidden="true" /> Controllalo dal tuo browser
          </h3>
          <p className="text-xs text-fg-muted mb-3">
            {hostname(url)} blocca i server con una verifica anti-bot, ma lascia passare il tuo browser.
            Con l&apos;estensione Linko è il tuo Chrome o Brave ad aprire la pagina e a mandarla a Linko, anche per i controlli successivi
            (finché il computer è acceso e il browser aperto).
          </p>
          {ext === undefined && <div className="spinner" style={{ width: 16, height: 16 }} aria-label="Cerco l'estensione…" />}
          {ext === null && (
            <div className="flex flex-wrap items-center gap-2">
              <a href="/extension" target="_blank" rel="noopener" className="btn btn-primary btn-sm">Installa l&apos;estensione</a>
              <span className="text-xs text-fg-faint">Dopo l&apos;installazione ricarica questa pagina e riaggiungi la fonte.</span>
            </div>
          )}
          {ext && !ext.connected && (
            <div className="flex flex-wrap items-center gap-2">
              <a href="/extension" target="_blank" rel="noopener" className="btn btn-primary btn-sm">Collega l&apos;estensione</a>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExt(undefined)}>Fatto, ricontrolla</button>
            </div>
          )}
          {ext?.connected && outdated(ext) && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <a href="/extension" target="_blank" rel="noopener" className="btn btn-primary btn-sm">Aggiorna l&apos;estensione</a>
              <span className="text-xs text-fg-faint">È disponibile la versione {EXTENSION_VERSION}: scaricala, sostituisci la cartella e premi ↻ in brave://extensions.</span>
            </div>
          )}
          {ext?.connected && !grantOrigin && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => analyzeWithExtension()}>
              <Puzzle size={14} aria-hidden="true" /> Analizza con l&apos;estensione
            </button>
          )}
          {ext?.connected && grantOrigin && (
            <div className="flex flex-col gap-2 items-start">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => grantExtension([grantOrigin])}>
                Concedi il permesso per {hostname(grantOrigin)}
              </button>
              <span className="text-xs text-fg-faint">
                Si apre una scheda dell&apos;estensione: premi <strong>Consenti</strong>, torna qui e{' '}
                <button type="button" className="underline text-accent-text" onClick={() => analyzeWithExtension()}>riprova l&apos;analisi</button>.
              </span>
            </div>
          )}
        </div>
      )}

      {showLogin && step !== 'settings' && !busy && (
        <div className="card p-4 mt-4" style={{ background: 'var(--surface-2)' }}>
          <h3 className="flex items-center gap-2 font-semibold text-fg-strong mb-1">
            <KeyRound size={15} aria-hidden="true" /> Hai un account su {hostname(finalUrl || url)}?
          </h3>
          <p className="text-xs text-fg-muted mb-4">
            Incolla il cookie della tua sessione: Linko vedrà le pagine come le vedi tu da utente registrato.
            Se scade, la fonte si ferma e te lo segnala.
          </p>
          <CredentialForm
            site={finalUrl || url}
            testUrl={finalUrl || url}
            compact
            onCancel={() => setShowLogin(false)}
            onSaved={() => { setShowLogin(false); setError(''); analyze(finalUrl || url); }}
          />
        </div>
      )}
    </Modal>
  );
}
