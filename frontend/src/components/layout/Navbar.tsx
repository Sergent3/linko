'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Zap, Upload, Sun, Moon, LogOut, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSearch } from '@/contexts/SearchContext';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { setSearch } = useSearch();
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  function handleSearch(value: string) {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setSearch(value), 250);
  }

  const nav = [
    { href: '/bookmarks', label: 'Dashboard' },
    { href: '/import', label: 'Importa', icon: Upload },
  ];

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{ background: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}
    >
      <div className="flex items-center h-9 px-4 gap-4">

        {/* Logo */}
        <Link href="/bookmarks" className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="font-display font-bold text-sm tracking-tight hidden sm:block"
            style={{ color: 'var(--text-main)' }}>
            Linko
          </span>
        </Link>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0.5 shrink-0">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                style={{
                  background: active ? 'rgba(139,92,246,0.15)' : 'transparent',
                  color: active ? '#8b5cf6' : 'var(--text-muted)',
                }}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Search — integrated in navbar, drives widget filter via SearchContext */}
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: 'var(--search-placeholder)' }} />
          <input
            type="search"
            placeholder="Cerca segnalibri…"
            onChange={e => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {user && (
            <span className="hidden xl:block text-[11px] font-mono truncate max-w-[180px]"
              style={{ color: 'var(--text-muted)' }}>
              {user.email}
            </span>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === 'light' ? 'Tema scuro' : 'Tema chiaro'}
            className="p-1.5 rounded-full transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--item-hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {theme === 'light'
              ? <Moon className="w-4 h-4" />
              : <Sun  className="w-4 h-4" />}
          </button>

          {/* Logout */}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#f87171';
              (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Esci</span>
          </button>
        </div>

      </div>
    </header>
  );
}
