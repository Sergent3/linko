'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, Upload, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-4 shrink-0">
      <Link href="/bookmarks" className="flex items-center gap-2 font-semibold text-gray-900">
        <div className="bg-slate-900 p-1.5 rounded-lg">
          <Bookmark className="w-4 h-4 text-white" />
        </div>
        Linko
      </Link>

      <nav className="flex items-center gap-1 ml-4">
        <Link
          href="/bookmarks"
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Segnalibri
        </Link>
        <Link
          href="/import"
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          Importa
        </Link>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {user && (
          <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
        )}
        <button
          onClick={handleLogout}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Esci"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
