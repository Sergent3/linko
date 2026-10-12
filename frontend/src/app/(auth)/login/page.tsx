'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/bookmarks');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenziali non valide: controlla email e password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6">
      <h1 className="text-xl font-bold text-fg-strong mb-1">Bentornato</h1>
      <p className="text-sm text-fg-muted mb-6">Accedi per ritrovare i tuoi segnalibri.</p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="field-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@esempio.com"
            required
            autoFocus
            aria-invalid={!!error || undefined}
          />
        </div>

        <div className="mb-5">
          <label className="field-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-invalid={!!error || undefined}
          />
        </div>

        <div aria-live="polite">
          {error && <div className="alert-error mb-4">{error}</div>}
        </div>

        <button type="submit" className="btn btn-primary w-full" style={{ height: 38 }} disabled={loading}>
          {loading && <span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} aria-hidden="true" />}
          {loading ? 'Accesso in corso…' : 'Accedi'}
        </button>

        <p className="mt-5 text-sm text-fg-muted text-center">
          Non hai un account?{' '}
          <Link href="/register" className="text-accent-text font-medium hover:underline">Registrati</Link>
        </p>
      </form>
    </div>
  );
}
