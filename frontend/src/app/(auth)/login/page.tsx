'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/bookmarks');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenziali non valide');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-zinc-100 mb-1">Bentornato.</h1>
      <p className="text-sm text-zinc-500 mb-8">Accedi al tuo account</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@esempio.com" className="input" />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">Password</label>
          <input type="password" required minLength={8} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="input" />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            : <><span>Accedi</span><ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600 text-center">
        Nessun account?{' '}
        <Link href="/register" className="text-violet-400 hover:text-violet-300 transition-colors">
          Registrati
        </Link>
      </p>
    </div>
  );
}
