import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { UIProvider } from '@/components/ui/UIProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Linko – Bookmarks',
  description: 'I tuoi segnalibri organizzati e accessibili ovunque.',
  applicationName: 'Linko',
  appleWebApp: { capable: true, title: 'Linko', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0b1020',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={inter.variable}>
      <body>
        <AuthProvider>
          <UIProvider>{children}</UIProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
