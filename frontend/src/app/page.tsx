'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bookmark, Upload, Sparkles, FolderOpen, ArrowRight, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const features = [
  {
    icon: Upload,
    title: 'Import da qualsiasi browser',
    desc: 'Esporta da Chrome, Firefox, Safari o Edge. Un file HTML e tutti i tuoi link sono dentro.',
    color: 'from-violet-500/20 to-violet-600/5',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: Sparkles,
    title: 'AI tagging automatico',
    desc: 'Tag istantanei basati sul dominio. Integrazione Claude API pronta per categorizzazione avanzata.',
    color: 'from-indigo-500/20 to-indigo-600/5',
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  {
    icon: FolderOpen,
    title: 'Cartelle e ricerca',
    desc: 'Organizza in cartelle annidate. Cerca per titolo, URL o descrizione in tempo reale.',
    color: 'from-fuchsia-500/20 to-fuchsia-600/5',
    iconColor: 'text-fuchsia-400',
    iconBg: 'bg-fuchsia-500/10 border-fuchsia-500/20',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/bookmarks');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-[#0a0a10] text-zinc-100 overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-24 w-[500px] h-[500px] bg-violet-700/20 rounded-full blur-[100px] animate-glow-pulse" />
        <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] bg-indigo-700/15 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-0 left-1/4 w-[350px] h-[350px] bg-violet-900/10 rounded-full blur-[80px] animate-float-slow" />
      </div>

      {/* Dot grid */}
      <div className="fixed inset-0 dot-grid opacity-100 pointer-events-none" />

      {/* Navbar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-700 rounded-lg flex items-center justify-center shadow-glow-violet-sm">
            <Bookmark className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Linko</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Accedi
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-all hover:shadow-glow-violet-sm"
          >
            Inizia gratis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-4 pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-violet-950/60 border border-violet-500/25 rounded-full px-4 py-1.5 text-sm text-violet-300 mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          AI-powered · Open source ready
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 max-w-4xl leading-[1.1]">
          I tuoi segnalibri,{' '}
          <span className="gradient-text">organizzati dall&apos;AI</span>
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 max-w-xl mb-10 leading-relaxed">
          Salva link da qualsiasi browser. L&apos;AI li categorizza automaticamente.
          Ritrova tutto in secondi.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-semibold text-base transition-all hover:shadow-glow-violet active:scale-95"
          >
            Inizia gratis <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-300 rounded-xl font-semibold text-base transition-all"
          >
            Accedi
          </Link>
        </div>

        {/* Fake search bar decoration */}
        <div className="mt-16 w-full max-w-2xl bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur hidden sm:block">
          <div className="flex items-center gap-3 text-zinc-600 text-sm mb-3 border-b border-zinc-800/60 pb-3">
            <Search className="w-4 h-4 text-violet-500" />
            <span className="text-zinc-500">Cerca segnalibri...</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { title: 'Next.js Documentation', tags: ['#docs', '#react'], domain: 'nextjs.org' },
              { title: 'Vercel Dashboard', tags: ['#devops', '#hosting'], domain: 'vercel.com' },
              { title: 'GitHub - vercel/next.js', tags: ['#dev', '#code'], domain: 'github.com' },
            ].map((item) => (
              <div key={item.domain} className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl p-3 text-left">
                <p className="text-xs font-medium text-zinc-300 line-clamp-1 mb-1">{item.title}</p>
                <p className="text-[10px] text-zinc-600 mb-2">{item.domain}</p>
                <div className="flex gap-1 flex-wrap">
                  {item.tags.map((t) => (
                    <span key={t} className="text-[10px] bg-violet-950/60 text-violet-400 border border-violet-800/40 rounded px-1.5 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-4 sm:px-6 max-w-5xl mx-auto pb-32">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc, color, iconColor, iconBg }) => (
            <div
              key={title}
              className={`group relative bg-gradient-to-br ${color} border border-white/[0.06] hover:border-violet-500/30 rounded-2xl p-6 transition-all duration-300 hover:shadow-card-hover`}
            >
              <div className={`w-10 h-10 ${iconBg} border rounded-xl flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <h3 className="font-semibold text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] px-6 py-6 text-center text-xs text-zinc-600">
        Linko · Smart Bookmark Manager
      </footer>
    </div>
  );
}
