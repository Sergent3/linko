'use client';

import { useState } from 'react';
import { Search, Check, ChevronLeft, Rss, LayoutList } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { watchApi } from '@/lib/api';
import type { ExtractedItem, FoundFeed, SuggestedArea, WatchSource } from '@/types/api';

interface Props {
  onClose: () => void;
  onCreated: (source: WatchSource) => void;
  initialUrl?: string;
  bookmarkId?: string;
}

type Step = 'url' | 'area' | 'settings';

const STEPS: { id: Step; label: string }[] = [
  { id: 'url', label: 'Pagina' },
  { id: 'area', label: 'Cosa monitorare' },
  { id: 'settings', label: 'Impostazioni' },
];

const INTERVALS = [
  { value: 60, label: 'Ogni ora' },
  { value: 360, label: 'Ogni 6 ore' },
  { value: 1440, label: 'Ogni giorno' },
];

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

export default function AddSourceWizard({ onClose, onCreated, initialUrl = '', bookmarkId }: Props) {
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState(initialUrl);
  const [finalUrl, setFinalUrl] = useState('');
  const [areas, setAreas] = useState<SuggestedArea[]>([]);
  const [feeds, setFeeds] = useState<FoundFeed[]>([]);
  const [feedUrl, setFeedUrl] = useState('');
  const [showNav, setShowNav] = useState(false);
  const [selector, setSelector] = useState('');
  const [manualSelector, setManualSelector] = useState('');
  const [manualItems, setManualItems] = useState<ExtractedItem[] | null>(null);
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(360);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const chosenArea = areas.find((a) => a.selector === selector);
  const visibleAreas = areas.filter((a) => showNav || !a.isNavigation);
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  async function analyze() {
    if (!url.trim()) return;
    setError('');
    setBusy(true);
    try {
      const res = await watchApi.preview(url.trim());
      setFinalUrl(res.finalUrl);
      setAreas(res.areas);
      setFeeds(res.feeds);
      // Il feed, quando c'è, è più affidabile di un'area della pagina
      if (res.feeds.length > 0) {
        setFeedUrl(res.feeds[0].url);
        setSelector('');
      } else {
        const first = res.areas.find((a) => !a.isNavigation) ?? res.areas[0];
        setFeedUrl('');
        setSelector(first?.selector ?? '');
      }
      setStep('area');
    } catch (err) {
      setError(`${(err as Error).message}. Controlla l'indirizzo e riprova.`);
    } finally {
      setBusy(false);
    }
  }

  async function tryManual() {
    if (!manualSelector.trim()) return;
    setError('');
    setBusy(true);
    try {
      const res = await watchApi.preview(finalUrl || url.trim(), manualSelector.trim());
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
  }

  function chooseFeed(u: string) {
    setFeedUrl(u);
    setSelector('');
  }

  function goSettings() {
    const chosenFeed = feeds.find((f) => f.url === feedUrl);
    const areaName = chosenFeed
      ? chosenFeed.title
      : chosenArea && !/^[a-z]+(\.|$)/.test(chosenArea.label) ? chosenArea.label : '';
    setName(`${hostname(finalUrl || url)}${areaName ? ` · ${areaName}` : ''}`);
    setStep('settings');
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      const source = await watchApi.createSource({
        name: name.trim(),
        url: finalUrl || url.trim(),
        ...(feedUrl ? { feedUrl } : { selector }),
        filter: filter.trim(),
        intervalMinutes,
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
      {step !== 'url' && (
        <button type="button" className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => setStep(step === 'settings' ? 'area' : 'url')} disabled={busy}>
          <ChevronLeft size={15} aria-hidden="true" /> Indietro
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
      {step === 'url' && (
        <button type="button" className="btn btn-primary" onClick={analyze} disabled={busy || !url.trim()}>
          {busy ? spinner : <Search size={14} aria-hidden="true" />} {busy ? 'Analisi…' : 'Analizza pagina'}
        </button>
      )}
      {step === 'area' && (
        <button type="button" className="btn btn-primary" onClick={goSettings} disabled={busy || (!selector && !feedUrl)}>Avanti</button>
      )}
      {step === 'settings' && (
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !name.trim()}>
          {busy ? spinner : <Check size={14} aria-hidden="true" />} {busy ? 'Salvataggio…' : 'Salva fonte'}
        </button>
      )}
    </>
  );

  return (
    <Modal title="Aggiungi fonte" onClose={onClose} width={720} dismissOnBackdrop={step === 'url' && !url} footer={footer}>
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

      {step === 'url' && (
        <form onSubmit={(e) => { e.preventDefault(); analyze(); }}>
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
        </form>
      )}

      {step === 'area' && (
        <fieldset>
          <legend className="sr-only">Cosa monitorare</legend>
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
          {visibleAreas.length === 0 && feeds.length === 0 && (
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

      {step === 'settings' && (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) save(); }}>
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
          <p className="field-hint">Se la lista si aggiorna più in fretta, Linko accorcia da solo l&apos;intervallo (fino a 15 minuti).</p>

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
    </Modal>
  );
}
