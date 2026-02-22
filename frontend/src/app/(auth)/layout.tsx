import Link from 'next/link';
import { Bookmark } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a10] flex flex-col overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-24 w-[500px] h-[500px] bg-violet-700/15 rounded-full blur-[100px] animate-glow-pulse" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] bg-indigo-700/10 rounded-full blur-[100px] animate-float-slow" />
      </div>
      <div className="fixed inset-0 dot-grid pointer-events-none" />

      {/* Logo */}
      <header className="relative z-10 flex items-center gap-2.5 px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-700 rounded-lg flex items-center justify-center shadow-glow-violet-sm">
            <Bookmark className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-zinc-100">Linko</span>
        </Link>
      </header>

      {/* Form centered */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
