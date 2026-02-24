import Link from 'next/link';
import { Zap } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1e1e1e',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: '#3a7bd5',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={16} color="white" />
          </div>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#e0e0e0',
              letterSpacing: '-0.3px',
            }}
          >
            Linko
          </span>
        </Link>
      </header>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>{children}</div>
      </div>
    </div>
  );
}
