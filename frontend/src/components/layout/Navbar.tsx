'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Zap, Upload, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const nav = [
    { href: '/bookmarks', label: 'Dashboard' },
    { href: '/import', label: 'Importa', icon: Upload },
  ];

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: 'var(--bar-bg)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderColor: 'var(--bar-border)',
      }}
    >
      <div className="flex items-center h-10 px-5 gap-4">

        {/* Logo */}
        <Link href="/bookmarks" className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <span className="font-display font-bold text-sm hidden sm:block tracking-tight"
            style={{ color: 'var(--text-strong)' }}>
            Linko
          </span>
        </Link>

        <div className="h-3.5 w-px shrink-0" style={{ background: 'var(--widget-border)' }} />

        {/* Nav tabs */}
        <nav className="flex items-center gap-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                style={{
                  background: active ? 'rgba(139,92,246,0.18)' : 'transparent',
                  color: active ? '#a78bfa' : 'var(--text-muted)',
                }}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* ── Right side ─────────────────────────────────────────────────── */}
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <span className="hidden lg:block text-[11px] font-mono truncate max-w-[200px]"
              style={{ color: 'var(--text-muted)' }}>
              {user.email}
            </span>
          )}

          {/* Theme toggle — always visible, with label on md+ */}
          <button
            onClick={toggle}
            className="theme-toggle flex items-center gap-1.5 px-2 h-7 rounded-lg text-[11px] font-medium transition-colors"
            title={theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
            style={{ color: 'var(--text-muted)' }}
          >
            {theme === 'dark'
              ? <><Sun  className="w-3.5 h-3.5" /><span className="hidden md:block">Chiaro</span></>
              : <><Moon className="w-3.5 h-3.5" /><span className="hidden md:block">Scuro</span></>
            }
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 h-7 text-[11px] rounded-lg transition-colors"
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
