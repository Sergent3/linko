'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const MIN_PASSWORD = 8;

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Le password non corrispondono: riscrivile uguali nei due campi.');
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      router.push('/bookmarks');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registrazione non riuscita. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6">
      <h1 className="text-xl font-bold text-fg-strong mb-1">Crea il tuo account</h1>
      <p className="text-sm text-fg-muted mb-6">Salva, organizza e segui i tuoi link preferiti.</p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="field-label" htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
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
          />
        </div>

        <div className="mb-4">
          <label className="field-label" htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            name="new-password"
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-describedby="reg-password-hint"
          />
          <p id="reg-password-hint" className="field-hint">Almeno {MIN_PASSWORD} caratteri.</p>
        </div>

        <div className="mb-5">
          <label className="field-label" htmlFor="reg-confirm">Conferma password</label>
          <input
            id="reg-confirm"
            name="confirm-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            aria-invalid={mismatch || undefined}
            aria-describedby={mismatch ? 'reg-confirm-error' : undefined}
          />
          {mismatch && <p id="reg-confirm-error" className="field-hint" style={{ color: 'var(--danger)' }}>Le password non corrispondono.</p>}
        </div>

        <div aria-live="polite">
          {error && <div className="alert-error mb-4">{error}</div>}
        </div>

        <button type="submit" className="btn btn-primary w-full" style={{ height: 38 }} disabled={loading}>
          {loading && <span className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} aria-hidden="true" />}
          {loading ? 'Registrazione in corso…' : 'Crea account'}
        </button>

        <p className="mt-5 text-sm text-fg-muted text-center">
          Hai già un account?{' '}
          <Link href="/login" className="text-accent-text font-medium hover:underline">Accedi</Link>
        </p>
      </form>
    </div>
  );
}
