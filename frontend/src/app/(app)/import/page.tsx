'use client';

import { DragEvent, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { importApi } from '@/lib/api';
import type { ImportResult } from '@/types/api';

type State = 'idle' | 'dragging' | 'loading' | 'done' | 'error';

export default function ImportPage() {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.match(/\.html?$/i)) {
      setErrorMsg('Il file deve essere in formato HTML (export Chrome/Firefox/Safari).');
      setState('error');
      return;
    }
    setState('loading');
    setErrorMsg('');
    try {
      const res = await importApi.upload(file);
      setResult(res);
      setState('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Errore durante l'importazione");
      setState('error');
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function reset() {
    setState('idle');
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl text-zinc-100 mb-1">Importa segnalibri</h1>
          <p className="text-sm text-zinc-500">
            Esporta da Chrome, Firefox, Safari o Edge e carica il file HTML qui sotto.
          </p>
        </div>

        {/* Dropzone */}
        {(state === 'idle' || state === 'dragging') && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setState('dragging'); }}
            onDragLeave={() => setState('idle')}
            onClick={() => inputRef.current?.click()}
            className={`group cursor-pointer border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-5 transition-all duration-200 ${
              state === 'dragging'
                ? 'border-violet-500/50 bg-violet-500/5'
                : 'border-white/[0.08] hover:border-violet-500/30 hover:bg-violet-500/[0.03]'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center transition-all ${
              state === 'dragging'
                ? 'bg-violet-500/15 border-violet-500/30'
                : 'bg-zinc-900 border-white/[0.06] group-hover:bg-violet-500/10 group-hover:border-violet-500/20'
            }`}>
              <Upload className={`w-7 h-7 transition-colors ${
                state === 'dragging' ? 'text-violet-400' : 'text-zinc-500 group-hover:text-violet-400'
              }`} />
            </div>

            <div className="text-center">
              <p className="font-medium text-zinc-300 mb-1">
                {state === 'dragging' ? 'Rilascia il file qui' : 'Trascina o clicca per selezionare'}
              </p>
              <p className="text-sm text-zinc-600">File HTML — Chrome · Firefox · Safari · Edge</p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl p-12 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-sm text-zinc-400 font-medium">Importazione in corso…</p>
            <p className="text-xs text-zinc-600">I segnalibri verranno arricchiti in background.</p>
          </div>
        )}

        {/* Done */}
        {state === 'done' && result && (
          <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl overflow-hidden animate-fade-in">
            {/* Success header */}
            <div className="flex items-center gap-3 px-6 py-5 bg-emerald-500/5 border-b border-emerald-500/15">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-zinc-100">Importazione completata</p>
                <p className="text-xs text-zinc-500 mt-0.5">Il worker sta arricchendo i segnalibri in background</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.04] mx-6 mt-6 border border-white/[0.06] rounded-xl overflow-hidden">
              <StatBox icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} value={result.imported} label="Importati" />
              <StatBox icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} value={result.duplicates} label="Duplicati" />
              <StatBox icon={<XCircle className="w-4 h-4 text-red-400" />} value={result.errors} label="Errori" />
            </div>

            {/* Details */}
            <div className="px-6 py-4 mt-2 space-y-1.5">
              {[
                ['Segnalibri nel file', result.stats.totalBookmarks],
                ['Cartelle create', result.stats.totalFolders],
                ['Duplicati saltati', result.stats.duplicatesSkipped],
                ['URL non validi', result.stats.malformedSkipped],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between text-sm">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-300 font-medium tabular-nums">{val}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={reset} className="btn-secondary flex-1">
                Importa altro
              </button>
              <Link href="/bookmarks" className="btn-primary flex-1">
                Vai ai segnalibri <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6 animate-fade-in">
            <div className="flex items-start gap-3 mb-5">
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-zinc-100">Importazione fallita</p>
                <p className="text-sm text-zinc-400 mt-1">{errorMsg}</p>
              </div>
            </div>
            <button onClick={reset} className="btn-primary bg-red-600 hover:bg-red-500">
              Riprova
            </button>
          </div>
        )}

        {/* How-to */}
        {(state === 'idle' || state === 'dragging') && (
          <div className="mt-5 bg-zinc-900 border border-white/[0.06] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-600" />
              Come esportare i segnalibri
            </h3>
            <ul className="space-y-2">
              {[
                ['Chrome', 'Menu → Segnalibri → Gestione → ⋮ → Esporta'],
                ['Firefox', 'Menu → Segnalibri → Gestione → Importa e backup → Esporta'],
                ['Safari', 'File → Esporta segnalibri…'],
                ['Edge', 'Menu → Preferiti → Gestisci → ⋯ → Esporta'],
              ].map(([browser, steps]) => (
                <li key={String(browser)} className="flex gap-2 text-sm">
                  <span className="text-zinc-400 font-medium shrink-0 w-14">{browser}</span>
                  <span className="text-zinc-500">{steps}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="p-4 text-center flex flex-col items-center gap-1">
      {icon}
      <p className="text-2xl font-bold text-zinc-100 tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
