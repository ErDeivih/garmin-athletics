import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../api/client';
import { clearToken, readToken, saveToken } from '../api/token';
import type { TokenResponse, UserProfile } from '../api/types';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: UserProfile | null;
  error: string | null;
  /** Un 401 a mitad de sesión: se explica en la entrada en vez de echarte sin más. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Cierra la sesión local sin llamar al backend (cuenta ya borrada). */
  forgetSession: () => void;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * La sesión es un Bearer opaco en localStorage (30 días, sin refresh). Al
 * arrancar se valida contra `/auth/me`; un 401 limpia la sesión, un fallo de red
 * no borra nada y se puede reintentar.
 *
 * La caché de React Query se vacía en cada cambio de sesión: los datos de salud
 * de otra persona no pueden sobrevivir a un logout en el mismo navegador.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(() => (readToken() ? 'loading' : 'anonymous'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
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
          queryClient.clear();
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
  }, [attempt, queryClient]);

  useEffect(() => {
    const onUnauthorized = () => {
      queryClient.clear();
      setUser(null);
      setSessionExpired(true);
      setStatus('anonymous');
    };
    window.addEventListener('ga:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ga:unauthorized', onUnauthorized);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const token = await apiFetch<TokenResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      // Una sesión nueva nunca hereda la caché de la anterior.
      queryClient.clear();
      saveToken(token.access_token);
      try {
        const profile = await apiFetch<UserProfile>('/api/v1/auth/me');
        setUser(profile);
        setStatus('authenticated');
        setError(null);
        setSessionExpired(false);
      } catch (cause) {
        clearToken();
        throw cause;
      }
    },
    [queryClient],
  );

  const forgetSession = useCallback(() => {
    clearToken();
    queryClient.clear();
    setUser(null);
    setSessionExpired(false);
    setStatus('anonymous');
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await apiFetch<{ status: string }>('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Un fallo al revocar no puede dejar la sesión abierta en el navegador.
    } finally {
      forgetSession();
    }
  }, [forgetSession]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, sessionExpired, login, logout, forgetSession, retry }),
    [status, user, error, sessionExpired, login, logout, forgetSession, retry],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth se usa dentro de <AuthProvider>.');
  return context;
}
