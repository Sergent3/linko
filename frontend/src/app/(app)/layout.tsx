'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SearchProvider } from '@/contexts/SearchContext';
import AppHeader from '@/components/layout/AppHeader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?next=${next}`);
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-busy="true">
        <div className="spinner" aria-label="Caricamento…" />
      </div>
    );
  }

  return (
    <SearchProvider>
      <AppHeader />
      <main id="main">{children}</main>
    </SearchProvider>
  );
}
