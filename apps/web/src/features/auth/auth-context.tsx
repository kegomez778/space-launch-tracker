import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUserDto } from '@slt/shared';
import { ApiError, api } from '../../lib/api-client';

interface AuthState {
  readonly user: AuthUserDto | null;
  readonly isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, countryCode?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * La sesión es el único estado verdaderamente global de la aplicación, y es un
 * solo objeto. Añadir una librería de estado para esto sería coste sin beneficio
 * (ADR-003): el resto del estado vive en TanStack Query o en la URL.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .get<AuthUserDto | null>('/auth/me')
      .then((current) => {
        if (!cancelled) {
          setUser(current);
        }
      })
      // Un 401 al arrancar es lo normal para un visitante anónimo, no un fallo.
      .catch((error: unknown) => {
        if (!cancelled && !(error instanceof ApiError && error.isUnauthenticated)) {
          console.error(error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await api.post<AuthUserDto>('/auth/login', { email, password }));
  }, []);

  const register = useCallback(async (email: string, password: string, countryCode?: string) => {
    setUser(await api.post<AuthUserDto>('/auth/register', { email, password, countryCode }));
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const context = use(AuthContext);

  if (context === null) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
}
