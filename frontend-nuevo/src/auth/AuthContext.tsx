import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, apiFetch } from '../api/client';
import { clearToken, readToken, saveToken } from '../api/token';
import type { TokenResponse, UserProfile } from '../api/types';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * La sesión es un Bearer opaco en localStorage (30 días, sin refresh). Al
 * arrancar se valida contra `/auth/me`; un 401 limpia la sesión, un fallo de red
 * no borra nada y se puede reintentar.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() => (readToken() ? 'loading' : 'anonymous'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setStatus('anonymous');
      setUser(null);
      return;
    }
    let cancelled = false;
    setStatus('loading');
    apiFetch<UserProfile>('/api/v1/auth/me')
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        setStatus('authenticated');
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          clearToken();
          setUser(null);
          setStatus('anonymous');
          return;
        }
        setError(cause instanceof Error ? cause.message : 'No se pudo comprobar la sesión.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener('ga:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ga:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const token = await apiFetch<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    saveToken(token.access_token);
    try {
      const profile = await apiFetch<UserProfile>('/api/v1/auth/me');
      setUser(profile);
      setStatus('authenticated');
      setError(null);
    } catch (cause) {
      clearToken();
      throw cause;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch<{ status: string }>('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Un fallo al revocar no puede dejar la sesión abierta en el navegador.
    } finally {
      clearToken();
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, login, logout, retry }),
    [status, user, error, login, logout, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth se usa dentro de <AuthProvider>.');
  return context;
}
