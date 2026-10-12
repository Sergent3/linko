import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-5 py-4">
        <Link href="/" className="inline-flex items-center gap-2" aria-label="Linko, home">
          <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <Zap size={15} color="#fff" aria-hidden="true" />
          </span>
          <span className="font-bold text-[15px] text-fg-strong" translate="no">Linko</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}
