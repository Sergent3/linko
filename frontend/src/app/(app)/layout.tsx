'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { tokens } from '@/lib/api';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { tokens } from '@/lib/api';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar'; // Import Sidebar

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for sidebar

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

  // Placeholder for pages in the sidebar. In a real app, this would come from an API or context.
  const sidebarPages = [
    { id: 'dashboard', name: 'Work Dashboard', active: true },
    { id: 'personal', name: 'Personal Space', active: false },
    // Add more pages as needed
  ];

  return (
    <SearchProvider>
      <div className="relative min-h-screen flex flex-col" style={{ zIndex: 1 }}>
        <Navbar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <Sidebar
          isOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          pages={sidebarPages}
          onPageSelect={() => { /* Handle page selection */ }} // This will be handled by the specific page
        />
        <main className={`flex-1 w-full transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
          {children}
        </main>
      </div>
    </SearchProvider>
  );
}
