'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Zap, Upload, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const nav = [
    { href: '/bookmarks', label: 'Segnalibri' },
    { href: '/import', label: 'Importa', icon: Upload },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-zinc-950/90 backdrop-blur-sm">
      <div className="flex items-center h-14 px-5 gap-5">
        <Link href="/bookmarks" className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-bold text-sm text-zinc-100 hidden sm:block">Linko</span>
        </Link>

        <div className="h-4 w-px bg-zinc-800" />

        <nav className="flex items-center gap-0.5">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'text-zinc-100 bg-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user && (
            <span className="hidden md:block text-xs text-zinc-600 font-mono truncate max-w-[180px]">
              {user.email}
            </span>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Esci</span>
          </button>
        </div>
      </div>
    </header>
  );
}
