'use client';

import { DragEvent, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { importApi } from '@/lib/api';
import type { ImportResult } from '@/types/api';

type State = 'idle' | 'dragging' | 'loading' | 'done' | 'error';

export default function ImportPage() {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
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
      setErrorMsg(err instanceof Error ? err.message : 'Errore durante l\'importazione');
      setState('error');
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setState('dragging');
  }

  function handleDragLeave() {
    setState('idle');
  }

  function reset() {
    setState('idle');
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-8 overflow-y-auto">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Importa segnalibri</h1>
        <p className="text-sm text-gray-500 mb-8">
          Esporta i tuoi segnalibri da Chrome, Firefox o Safari (formato HTML Netscape) e caricali qui.
        </p>

        {/* Dropzone */}
        {(state === 'idle' || state === 'dragging') && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-colors ${
              state === 'dragging'
                ? 'border-slate-900 bg-slate-50'
                : 'border-gray-300 hover:border-slate-400 hover:bg-gray-50'
            }`}
          >
            <div
              className={`p-4 rounded-full transition-colors ${
                state === 'dragging' ? 'bg-slate-900' : 'bg-gray-100'
              }`}
            >
              <Upload
                className={`w-8 h-8 ${state === 'dragging' ? 'text-white' : 'text-gray-400'}`}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">
                {state === 'dragging' ? 'Rilascia il file qui' : 'Trascina il file o clicca per selezionarlo'}
              </p>
              <p className="text-xs text-gray-500 mt-1">File HTML — Chrome, Firefox, Safari, Edge</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {/* Loading */}
        {state === 'loading' && (
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Importazione in corso…</p>
            <p className="text-xs text-gray-400">
              I segnalibri verranno arricchiti in background dal worker.
            </p>
          </div>
        )}

        {/* Success */}
        {state === 'done' && result && (
          <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <h2 className="font-semibold text-gray-900">Importazione completata</h2>
                <p className="text-sm text-gray-500">
                  Il worker inizierà ad arricchire i segnalibri a breve.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard
                icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                value={result.imported}
                label="Importati"
                color="bg-green-50"
              />
              <StatCard
                icon={<AlertCircle className="w-5 h-5 text-yellow-500" />}
                value={result.duplicates}
                label="Duplicati"
                color="bg-yellow-50"
              />
              <StatCard
                icon={<XCircle className="w-5 h-5 text-red-500" />}
                value={result.errors}
                label="Errori"
                color="bg-red-50"
              />
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Segnalibri nel file</span>
                <span className="font-medium">{result.stats.totalBookmarks}</span>
              </div>
              <div className="flex justify-between">
                <span>Cartelle create</span>
                <span className="font-medium">{result.stats.totalFolders}</span>
              </div>
              <div className="flex justify-between">
                <span>Duplicati saltati</span>
                <span className="font-medium">{result.stats.duplicatesSkipped}</span>
              </div>
              <div className="flex justify-between">
                <span>URL non validi</span>
                <span className="font-medium">{result.stats.malformedSkipped}</span>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={reset}
                className="flex-1 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Importa un altro file
              </button>
              <a
                href="/bookmarks"
                className="flex-1 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors text-center"
              >
                Vai ai segnalibri
              </a>
            </div>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="border border-red-200 rounded-2xl p-6 bg-red-50">
            <div className="flex items-start gap-3 mb-4">
              <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-red-900">Importazione fallita</h2>
                <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
              </div>
            </div>
            <button
              onClick={reset}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Riprova
            </button>
          </div>
        )}

        {/* How-to */}
        {(state === 'idle' || state === 'dragging') && (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Come esportare i segnalibri
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>
                <strong>Chrome:</strong> Menu → Segnalibri → Gestione segnalibri → ⋮ → Esporta
              </li>
              <li>
                <strong>Firefox:</strong> Menu → Segnalibri → Gestione segnalibri → Importa e backup → Esporta
              </li>
              <li>
                <strong>Safari:</strong> File → Esporta segnalibri…
              </li>
              <li>
                <strong>Edge:</strong> Menu → Preferiti → Gestisci preferiti → ⋯ → Esporta preferiti
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className={`${color} rounded-xl p-3 text-center`}>
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );
}
