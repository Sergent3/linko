'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SearchProvider } from '@/contexts/SearchContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#2b2b2b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: 14,
        }}
      >
        Caricamento...
      </div>
    );
  }

  return (
    <SearchProvider>
      <div style={{ minHeight: '100vh', background: '#2b2b2b' }}>
        {children}
      </div>
    </SearchProvider>
  );
}
