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
          <h1 className="text-2xl font-bold text-zinc-100 mb-1">Importa segnalibri</h1>
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
                ? 'border-violet-500/60 bg-violet-500/5 shadow-glow-violet-sm'
                : 'border-zinc-700/60 hover:border-violet-500/40 hover:bg-violet-500/[0.03]'
            }`}
          >
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center transition-all ${
              state === 'dragging'
                ? 'bg-violet-500/20 border-violet-500/40'
                : 'bg-zinc-800/60 border-zinc-700/40 group-hover:bg-violet-500/10 group-hover:border-violet-500/30'
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
          <div className="border border-zinc-800/60 bg-[#14141f] rounded-2xl p-12 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-sm text-zinc-400 font-medium">Importazione in corso…</p>
            <p className="text-xs text-zinc-600">I segnalibri verranno arricchiti in background.</p>
          </div>
        )}

        {/* Done */}
        {state === 'done' && result && (
          <div className="border border-zinc-800/60 bg-[#14141f] rounded-2xl overflow-hidden animate-fade-in">
            {/* Success header */}
            <div className="flex items-center gap-3 px-6 py-5 bg-emerald-500/5 border-b border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-zinc-100">Importazione completata</p>
                <p className="text-xs text-zinc-500">Il worker sta arricchendo i segnalibri in background</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-px bg-zinc-800/40 mx-6 mt-6 rounded-xl overflow-hidden">
              <StatBox icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} value={result.imported} label="Importati" color="bg-emerald-500/10" />
              <StatBox icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} value={result.duplicates} label="Duplicati" color="bg-amber-500/10" />
              <StatBox icon={<XCircle className="w-4 h-4 text-red-400" />} value={result.errors} label="Errori" color="bg-red-500/10" />
            </div>

            {/* Details */}
            <div className="px-6 py-4 mt-2 space-y-1.5 text-sm">
              {[
                ['Segnalibri nel file', result.stats.totalBookmarks],
                ['Cartelle create', result.stats.totalFolders],
                ['Duplicati saltati', result.stats.duplicatesSkipped],
                ['URL non validi', result.stats.malformedSkipped],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between text-zinc-500">
                  <span>{label}</span>
                  <span className="text-zinc-300 font-medium">{val}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-2.5 border border-zinc-700/60 text-zinc-400 text-sm rounded-xl hover:bg-white/[0.04] transition-colors"
              >
                Importa altro
              </button>
              <Link
                href="/bookmarks"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all hover:shadow-glow-violet-sm"
              >
                Vai ai segnalibri <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6 animate-fade-in">
            <div className="flex items-start gap-3 mb-5">
              <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-100">Importazione fallita</p>
                <p className="text-sm text-zinc-400 mt-1">{errorMsg}</p>
              </div>
            </div>
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Riprova
            </button>
          </div>
        )}

        {/* How-to */}
        {(state === 'idle' || state === 'dragging') && (
          <div className="mt-6 border border-zinc-800/60 bg-[#14141f] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-500" />
              Come esportare i segnalibri
            </h3>
            <ul className="space-y-2 text-sm text-zinc-500">
              {[
                ['Chrome', 'Menu → Segnalibri → Gestione → ⋮ → Esporta'],
                ['Firefox', 'Menu → Segnalibri → Gestione → Importa e backup → Esporta'],
                ['Safari', 'File → Esporta segnalibri…'],
                ['Edge', 'Menu → Preferiti → Gestisci → ⋯ → Esporta'],
              ].map(([browser, steps]) => (
                <li key={String(browser)} className="flex gap-2">
                  <span className="text-zinc-400 font-medium shrink-0 w-14">{browser}</span>
                  <span>{steps}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className={`${color} p-4 text-center flex flex-col items-center gap-1`}>
      {icon}
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}
