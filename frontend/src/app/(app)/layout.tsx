'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { tokens } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user && !tokens.access) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  const spinner = (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f17]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        <p className="text-xs text-zinc-600">Caricamento…</p>
      </div>
    </div>
  );

  if (loading) return spinner;
  if (!user && !tokens.access) return spinner;

  return (
    <div className="min-h-screen flex flex-col bg-[#0f0f17]">
      <Navbar />
      <main className="flex-1 flex overflow-hidden">{children}</main>
    </div>
  );
}
