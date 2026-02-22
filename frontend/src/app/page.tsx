'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Upload, Sparkles, Search, FolderOpen, Shield, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/bookmarks');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen page-bg text-zinc-100">

      {/* ── Nav ── */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-base text-zinc-100">Linko</span>
        </div>

        <div className="flex items-center gap-1">
          <Link href="/login" className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
            Accedi
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Inizia gratis <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-zinc-800/60 border border-white/[0.08] rounded-full px-3 py-1 text-xs text-zinc-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            AI tagging · Import da Chrome · Ricerca istantanea
          </div>

          <h1 className="font-display font-extrabold text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-6">
            I tuoi link.<br />
            <span className="text-violet-400">Organizzati.</span><br />
            Trovati subito.
          </h1>

          <p className="text-lg text-zinc-400 max-w-xl mb-8 leading-relaxed">
            Salva segnalibri da qualsiasi browser, taggati automaticamente dall&apos;AI.
            Ritrova tutto in secondi con la ricerca full-text.
          </p>

          <div className="flex items-center gap-3">
            <Link href="/register" className="btn-primary">
              Crea account gratuito <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-secondary">
              Accedi
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bento grid ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-12 gap-3 auto-rows-[minmax(140px,auto)]">

          {/* Import — large */}
          <div className="col-span-12 md:col-span-7 bento group hover:border-white/[0.12] transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/[0.07] flex items-center justify-center">
                <Upload className="w-5 h-5 text-violet-400" />
              </div>
              <span className="text-[10px] text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5 font-medium uppercase tracking-wide">Import</span>
            </div>
            <h3 className="font-display font-bold text-xl text-zinc-100 mb-2">
              Da qualsiasi browser
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
              Esporta il file HTML da Chrome, Firefox, Safari o Edge. Linko ricrea cartelle, importa tutto e accoda l&apos;arricchimento automaticamente.
            </p>
            {/* Fake import file UI */}
            <div className="absolute bottom-5 right-5 w-36 h-20 bg-zinc-800/80 border border-white/[0.07] rounded-xl flex flex-col items-center justify-center gap-1 opacity-40 group-hover:opacity-70 transition-opacity">
              <div className="w-8 h-10 border-2 border-zinc-600 rounded-md flex items-end justify-center pb-1">
                <div className="w-5 h-0.5 bg-zinc-600 rounded" />
              </div>
              <span className="text-[9px] text-zinc-500">bookmarks.html</span>
            </div>
          </div>

          {/* AI Tags */}
          <div className="col-span-12 md:col-span-5 bento hover:border-white/[0.12] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/[0.07] flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-display font-bold text-xl text-zinc-100 mb-2">
              Tag automatici
            </h3>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Regex istantanee per dominio (GitHub → #dev, YouTube → #video). Placeholder Claude API pronto per tagging avanzato.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {['#dev', '#react', '#docs', '#design', '#video', '#ai'].map((t, i) => (
                <span key={t}
                  className="text-xs px-2 py-0.5 rounded-md border"
                  style={{
                    background: i % 3 === 0 ? 'rgba(139,92,246,0.1)' : i % 3 === 1 ? 'rgba(99,102,241,0.1)' : 'rgba(39,39,42,0.8)',
                    borderColor: i % 3 === 0 ? 'rgba(139,92,246,0.3)' : i % 3 === 1 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)',
                    color: i % 3 === 0 ? '#a78bfa' : i % 3 === 1 ? '#818cf8' : '#71717a',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="col-span-12 sm:col-span-6 md:col-span-4 bento hover:border-white/[0.12] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/[0.07] flex items-center justify-center mb-4">
              <Search className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-display font-bold text-lg text-zinc-100 mb-1">Ricerca full-text</h3>
            <p className="text-sm text-zinc-500">Titolo, URL, descrizione. Debounce 400ms.</p>
            <div className="mt-4 flex items-center gap-2 bg-zinc-800/60 border border-white/[0.06] rounded-lg px-3 py-2">
              <Search className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-xs text-zinc-600">next.js hooks...</span>
              <span className="ml-auto text-[10px] text-zinc-700">3 risultati</span>
            </div>
          </div>

          {/* Organize */}
          <div className="col-span-12 sm:col-span-6 md:col-span-4 bento hover:border-white/[0.12] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/[0.07] flex items-center justify-center mb-4">
              <FolderOpen className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-display font-bold text-lg text-zinc-100 mb-1">Cartelle annidate</h3>
            <p className="text-sm text-zinc-500">Struttura gerarchica illimitata, conteggio per cartella.</p>
            <div className="mt-4 space-y-1">
              {[['Dev', 12], ['  ↳ React', 5], ['  ↳ Next.js', 3], ['Design', 8]].map(([name, count]) => (
                <div key={String(name)} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 font-mono">{name}</span>
                  <span className="text-zinc-700">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy */}
          <div className="col-span-12 sm:col-span-12 md:col-span-4 bento hover:border-white/[0.12] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/[0.07] flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="font-display font-bold text-lg text-zinc-100 mb-1">Self-hosted</h3>
            <p className="text-sm text-zinc-500">I tuoi dati rimangono sui tuoi server. JWT auth, soft-delete, nessun tracking.</p>
          </div>

        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] px-6 py-5 text-center">
        <p className="text-xs text-zinc-700">Linko · Stack: Next.js · Express · PostgreSQL · BullMQ</p>
      </footer>
    </div>
  );
}
