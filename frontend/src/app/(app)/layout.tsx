'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { tokens } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user && !tokens.access) router.replace('/login');
  }, [user, loading, router]);

  const spinner = (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090b' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Caricamento…</p>
      </div>
    </div>
  );

  if (loading) return spinner;
  if (!user && !tokens.access) return spinner;

  return (
    /* body::before handles the overlay — no extra div needed here */
    <SearchProvider>
      <div className="relative min-h-screen flex flex-col" style={{ zIndex: 1 }}>
        <Navbar />
        <main className="flex-1 flex overflow-hidden">{children}</main>
      </div>
    </SearchProvider>
  );
}
