'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { auth, tokens } from '@/lib/api';
import type { User } from '@/types/api';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref per accesso sincrono: evita il race condition tra setUser (async) e
  // router.push — il layout legge userRef.current prima che lo state committi.
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('linko_user');
    if (stored && tokens.access) {
      try {
        const u = JSON.parse(stored) as User;
        userRef.current = u;
        setUser(u);
      } catch {
        /* dati corrotti — ignora */
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await auth.login(email, password);
    tokens.set(data.accessToken, data.refreshToken);
    localStorage.setItem('linko_user', JSON.stringify(data.user));
    userRef.current = data.user;  // sincrono: disponibile subito per il layout
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const data = await auth.register(email, password);
    tokens.set(data.accessToken, data.refreshToken);
    localStorage.setItem('linko_user', JSON.stringify(data.user));
    userRef.current = data.user;
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    localStorage.removeItem('linko_user');
    userRef.current = null;
    setUser(null);
  }, []);

  // effectiveUser: usa lo state se disponibile, altrimenti cade sul ref.
  // Questo copre la finestra tra la chiamata a setUser e il commit del re-render.
  const effectiveUser = user ?? userRef.current;

  return (
    <AuthContext.Provider value={{ user: effectiveUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
