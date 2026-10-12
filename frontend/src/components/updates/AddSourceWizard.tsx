'use client';

import { useState } from 'react';
import { X, Search, Loader2, Check, ChevronLeft } from 'lucide-react';
import { watchApi } from '@/lib/api';
import type { ExtractedItem, SuggestedArea, WatchSource } from '@/types/api';

interface Props {
  onClose: () => void;
  onCreated: (source: WatchSource) => void;
  initialUrl?: string;
  bookmarkId?: string;
}

type Step = 'url' | 'area' | 'settings';

const INTERVALS = [
  { value: 60, label: 'Ogni ora' },
  { value: 360, label: 'Ogni 6 ore' },
  { value: 1440, label: 'Ogni giorno' },
];

const panel: React.CSSProperties = {
  background: '#1e293b', border: '1px solid var(--glass-border)', borderRadius: 12,
  width: 'min(720px, 94vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
};
const input: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
  borderRadius: 8, color: 'var(--text-main)', padding: '9px 12px', fontSize: 13, outline: 'none',
};
const label: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', margin: '14px 0 6px' };
const secondaryBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};

function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function ItemList({ items }: { items: ExtractedItem[] }) {
  return (
    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((i) => (
        <li key={i.url} style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          › {i.title}
        </li>
      ))}
    </ul>
  );
}

export default function AddSourceWizard({ onClose, onCreated, initialUrl = '', bookmarkId }: Props) {
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState(initialUrl);
  const [finalUrl, setFinalUrl] = useState('');
  const [areas, setAreas] = useState<SuggestedArea[]>([]);
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

  async function analyze() {
    setError('');
    setBusy(true);
    try {
      const res = await watchApi.preview(url.trim());
      setFinalUrl(res.finalUrl);
      setAreas(res.areas);
      const first = res.areas.find((a) => !a.isNavigation) ?? res.areas[0];
      setSelector(first?.selector ?? '');
      setStep('area');
    } catch (err) {
      setError((err as Error).message);
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
      if (res.items.length > 0) setSelector(manualSelector.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function goSettings() {
    const areaName = chosenArea && !/^[a-z]+(\.|$)/.test(chosenArea.label) ? chosenArea.label : '';
    setName(`${hostname(finalUrl || url)}${areaName ? ` · ${areaName}` : ''}`);
    setStep('settings');
  }

  async function save() {
    setError('');
    setBusy(true);
    try {
      const source = await watchApi.createSource({
        name: name.trim(), url: finalUrl || url.trim(), selector, filter: filter.trim(), intervalMinutes, bookmarkId,
      });
      onCreated(source);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panel}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Aggiungi fonte</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {step === 'url' ? '1/3 · Pagina' : step === 'area' ? '2/3 · Cosa monitorare' : '3/3 · Impostazioni'}
          </span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
          {step === 'url' && (
            <>
              <label style={label} htmlFor="watch-url">Indirizzo della pagina con gli aggiornamenti</label>
              <input id="watch-url" style={input} value={url} autoFocus placeholder="https://…"
                onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && url) analyze(); }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                Linko scarica la pagina e cerca da solo le liste di elementi (articoli, uscite, thread).
              </p>
            </>
          )}

          {step === 'area' && (
            <>
              {visibleAreas.length === 0 && (
                <p style={{ fontSize: 13, color: '#fbbf24' }}>
                  Nessuna lista trovata automaticamente. Indica l&apos;area con un selettore CSS qui sotto.
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleAreas.map((a) => (
                  <label key={a.selector} style={{
                    display: 'flex', gap: 10, padding: 12, borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${selector === a.selector ? 'var(--accent)' : 'var(--glass-border)'}`,
                    background: selector === a.selector ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.15)',
                  }}>
                    <input type="radio" name="area" checked={selector === a.selector} onChange={() => setSelector(a.selector)} style={{ marginTop: 3 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        {a.label} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {a.itemCount} elementi{a.isNavigation ? ' · menu' : ''}</span>
                      </div>
                      <ItemList items={a.sample.slice(0, 3)} />
                    </div>
                  </label>
                ))}
              </div>
              {areas.some((a) => a.isNavigation) && (
                <button onClick={() => setShowNav((v) => !v)} style={{ ...secondaryBtn, marginTop: 10, fontSize: 12, padding: '5px 10px' }}>
                  {showNav ? 'Nascondi menu e piè di pagina' : 'Mostra anche menu e piè di pagina'}
                </button>
              )}

              <label style={label} htmlFor="watch-selector">Nessuna è quella giusta? Selettore CSS dell&apos;area</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="watch-selector" style={{ ...input, fontFamily: 'monospace' }} value={manualSelector} placeholder="es. #main ul.latest"
                  onChange={(e) => setManualSelector(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') tryManual(); }} />
                <button onClick={tryManual} disabled={busy || !manualSelector.trim()} style={secondaryBtn}>
                  <Search size={14} /> Prova
                </button>
              </div>
              {manualItems && (
                <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: 'rgba(0,0,0,0.15)', border: '1px solid var(--glass-border)' }}>
                  {manualItems.length === 0
                    ? <span style={{ fontSize: 12, color: '#fbbf24' }}>Nessun elemento trovato con questo selettore.</span>
                    : <><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{manualItems.length} elementi trovati{selector === manualSelector.trim() ? ' · selezionato' : ''}</div><ItemList items={manualItems.slice(0, 5)} /></>}
                </div>
              )}
            </>
          )}

          {step === 'settings' && (
            <>
              <label style={label} htmlFor="watch-name">Nome</label>
              <input id="watch-name" style={input} value={name} onChange={(e) => setName(e.target.value)} />

              <label style={label}>Frequenza dei controlli</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {INTERVALS.map((i) => (
                  <button key={i.value} onClick={() => setIntervalMinutes(i.value)}
                    className={`folder-tab${intervalMinutes === i.value ? ' active' : ''}`} style={{ border: 'none' }}>
                    {i.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Se la lista si aggiorna più in fretta, Linko accorcia da solo l&apos;intervallo (fino a 15 minuti).
              </p>

              <label style={label} htmlFor="watch-filter">Filtro (facoltativo)</label>
              <input id="watch-filter" style={input} value={filter} placeholder='es. docker "zfs pool" -request'
                onChange={(e) => setFilter(e.target.value)} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Vuoto = tutti gli elementi nuovi. <code>parola</code> nel titolo · <code>&quot;frase esatta&quot;</code> · <code>-parola</code> per escludere.
              </p>
            </>
          )}

          {error && <p style={{ marginTop: 14, fontSize: 13, color: '#f87171' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {step !== 'url' && (
            <button style={{ ...secondaryBtn, marginRight: 'auto' }} onClick={() => setStep(step === 'settings' ? 'area' : 'url')} disabled={busy}>
              <ChevronLeft size={14} /> Indietro
            </button>
          )}
          {step === 'url' && (
            <button className="btn-add" onClick={analyze} disabled={busy || !url.trim()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Analizza
            </button>
          )}
          {step === 'area' && (
            <button className="btn-add" onClick={goSettings} disabled={busy || !selector}>Avanti</button>
          )}
          {step === 'settings' && (
            <button className="btn-add" onClick={save} disabled={busy || !name.trim()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salva fonte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
