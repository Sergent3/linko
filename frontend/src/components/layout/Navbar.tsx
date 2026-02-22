'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Bookmark, Upload, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const links = [
    { href: '/bookmarks', label: 'Segnalibri' },
    { href: '/import', label: 'Importa', icon: Upload },
  ];

  return (
    <header className="glass border-b border-white/[0.05] shrink-0 z-30 sticky top-0">
      <div className="flex items-center gap-3 px-4 h-14">

        {/* Logo */}
        <Link href="/bookmarks" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-violet-700 rounded-lg flex items-center justify-center shadow-glow-violet-sm">
            <Bookmark className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-zinc-100 hidden sm:block">Linko</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-0.5 ml-2">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'text-violet-300 bg-violet-500/10'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <span className="hidden lg:block text-xs text-zinc-600 bg-zinc-800/60 border border-zinc-700/40 px-2.5 py-1 rounded-lg">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Esci"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Esci</span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.05] px-4 pb-3 pt-2 flex flex-col gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] rounded-lg transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
