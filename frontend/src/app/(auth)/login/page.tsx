'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#2a2a2a',
  border: '1px solid #4a4a4a',
  borderRadius: 3,
  color: '#e0e0e0',
  padding: '8px 12px',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#aaaaaa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 4,
};

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
      router.push(next && next.startsWith('/') ? next : '/bookmarks');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenziali non valide');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: '#2e2e2e',
        border: '1px solid #444',
        borderRadius: 6,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Card header */}
      <div
        style={{
          background: '#383838',
          padding: '10px 16px',
          borderBottom: '1px solid #444',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#cccccc',
          }}
        >
          Accedi al tuo account
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@esempio.com"
            required
            autoFocus
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: '7px 12px',
              background: '#4a1a1a',
              border: '1px solid #7a3030',
              borderRadius: 3,
              fontSize: 12,
              color: '#ffaaaa',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#3a3a3a' : '#3a7bd5',
            border: 'none',
            borderRadius: 3,
            color: loading ? '#888' : 'white',
            padding: '9px 0',
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Accesso in corso...' : 'Accedi'}
        </button>

        <p
          style={{
            marginTop: 14,
            fontSize: 12,
            color: '#888',
            textAlign: 'center',
          }}
        >
          Nessun account?{' '}
          <Link
            href="/register"
            style={{ color: '#5b9bd5', textDecoration: 'none' }}
          >
            Registrati
          </Link>
        </p>
      </form>
    </div>
  );
}
