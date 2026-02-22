import { Bookmark, Upload, Tag } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-white px-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-4">
        <Bookmark className="w-10 h-10 text-indigo-400" />
        <h1 className="text-5xl font-bold tracking-tight">Linko</h1>
      </div>

      <p className="text-gray-400 text-lg mb-12 text-center max-w-md">
        I tuoi segnalibri, organizzati dall&apos;AI. Accessibili ovunque.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-3 justify-center mb-12">
        {[
          { icon: Upload, label: 'Import da browser' },
          { icon: Tag, label: 'Tag automatici via AI' },
          { icon: Bookmark, label: 'CRUD con soft-delete' },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800 text-sm text-gray-300"
          >
            <Icon className="w-4 h-4 text-indigo-400" />
            {label}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div className="flex gap-4">
        <Link
          href="/bookmarks"
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-colors"
        >
          Apri libreria
        </Link>
        <Link
          href="/import"
          className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
        >
          Importa file
        </Link>
      </div>
    </main>
  );
}
