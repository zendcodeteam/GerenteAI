import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { authApi } from '../api/authApi';

import {
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
} from '../types';

import { ApiError } from '@/lib/apiClient';

interface LegalConsent {
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  googleLogin: (credential: string) => Promise<AuthUser>;
  googleRegister: (
    credential: string,
    telefono: string,
    nombreNegocio: string,
    whatsappUsername?: string,
    legalConsent?: LegalConsent,
  ) => Promise<AuthUser>;
  register: (credentials: RegisterCredentials) => Promise<AuthUser>;

  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const TOKEN_KEY = 'access_token';
export const USER_KEY = 'user_session';
export const SESSION_EXPIRES_AT_KEY = 'session_expires_at';
export const SESSION_LOGIN_TIME_KEY = 'session_login_time';

/** Tiempo máximo de inactividad / duración de sesión: 1 hora exacta */
export const SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 3.600.000 ms

/**
 * Validador seguro de expiración de JWT en el cliente sin llamadas de red.
 */
function isTokenExpired(jwtToken: string): boolean {
  try {
    const payloadBase64 = jwtToken.split('.')[1];

    if (!payloadBase64) return true;

    const normalized = payloadBase64
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const jsonPayload = decodeURIComponent(
      atob(normalized)
        .split('')
        .map(
          (c) =>
            '%' +
            ('00' + c.charCodeAt(0).toString(16)).slice(-2),
        )
        .join(''),
    );

    const decoded = JSON.parse(jsonPayload);

    if (!decoded.exp) return false;

    // Si expira en los próximos 10 segundos, considerarlo expirado.
    return decoded.exp * 1000 < Date.now() + 10000;
  } catch {
    return true;
  }
}

/**
 * Verifica si la sesión de 1 hora o el JWT han expirado.
 */
function isSessionExpired(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) return true;

  if (isTokenExpired(token)) return true;

  const expiresAt = localStorage.getItem(SESSION_EXPIRES_AT_KEY);

  if (expiresAt && Date.now() >= Number(expiresAt)) {
    return true;
  }

  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (isSessionExpired()) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
      localStorage.removeItem(SESSION_LOGIN_TIME_KEY);

      return null;
    }

    return localStorage.getItem(TOKEN_KEY);
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    if (isSessionExpired()) {
      return null;
    }

    const savedUser = localStorage.getItem(USER_KEY);

    if (!savedUser) return null;

    try {
      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearBusinessStorage = useCallback(() => {
    localStorage.removeItem('active_business_id');
    localStorage.removeItem('active_business_name');
    localStorage.removeItem('active_sede_id');
    localStorage.removeItem('active_sede_name');
    localStorage.removeItem('active_business_plan');

    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('business_plan_')) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Ignorar errores de acceso a storage.
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
    localStorage.removeItem(SESSION_LOGIN_TIME_KEY);

    clearBusinessStorage();

    setToken(null);
    setUser(null);
    setError(null);
  }, [clearBusinessStorage]);

  /**
   * Guarda una sesión autenticada en localStorage y React state.
   *
   * Se utiliza tanto para login tradicional como para Google.
   */
  const persistSession = useCallback(
    (accessToken: string, authenticatedUser: AuthUser) => {
      const expiresAt = Date.now() + SESSION_MAX_AGE_MS;

      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(authenticatedUser));
      localStorage.setItem(
        SESSION_EXPIRES_AT_KEY,
        expiresAt.toString(),
      );
      localStorage.setItem(
        SESSION_LOGIN_TIME_KEY,
        Date.now().toString(),
      );

      setToken(accessToken);
      setUser(authenticatedUser);
    },
    [],
  );

  // Verificación proactiva de expiración de sesión
  // mediante temporizador y foco de ventana.
  useEffect(() => {
    const checkExpiration = () => {
      if (token && isSessionExpired()) {
        logout();
      }
    };

    checkExpiration();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkExpiration();
      }
    };

    window.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    window.addEventListener('focus', checkExpiration);

    // Revisión periódica cada 30 segundos.
    const interval = setInterval(checkExpiration, 30000);

    return () => {
      window.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.removeEventListener('focus', checkExpiration);

      clearInterval(interval);
    };
  }, [token, logout]);

  /**
   * Sincronización entre pestañas.
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        if (!e.newValue) {
          setToken(null);
          setUser(null);
        } else {
          setToken(e.newValue);
        }
      }

      if (e.key === USER_KEY) {
        if (!e.newValue) {
          setUser(null);
        } else {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {
            setUser(null);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  /**
   * Login normal.
   *
   * Almacenamos el JWT y limpiamos datos residuales
   * de comercios de sesiones previas.
   */
  const login = async (
    credentials: LoginCredentials,
  ): Promise<AuthUser> => {
    setIsLoading(true);
    setError(null);

    try {
      clearBusinessStorage();

      const response = await authApi.login(credentials);

      persistSession(
        response.access_token,
        response.user,
      );

      return response.user;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Error al iniciar sesión';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login mediante Google para usuarios que ya tienen una cuenta.
   *
   * Google entrega un ID Token (credential).
   * El backend lo valida y devuelve el mismo JWT
   * utilizado por el login tradicional.
   */
  const googleLogin = async (
    credential: string,
  ): Promise<AuthUser> => {
    setIsLoading(true);
    setError(null);

    try {
      clearBusinessStorage();

      const response = await authApi.googleLogin(credential);

      persistSession(
        response.access_token,
        response.user,
      );

      return response.user;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Error al iniciar sesión con Google';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Registro mediante Google.
   *
   * Google ya proporciona un correo electrónico verificado.
   * Por eso el usuario solamente debe completar los datos
   * adicionales requeridos por Luka:
   *
   * - Teléfono celular colombiano.
   * - Nombre del negocio.
   * - Usuario de WhatsApp opcional.
   * - Aceptación de Términos de servicio.
   * - Aceptación de Política de privacidad.
   *
   * El backend valida nuevamente el credential de Google,
   * crea la cuenta y registra los consentimientos legales
   * asociados a la cuenta.
   */
  const googleRegister = async (
    credential: string,
    telefono: string,
    nombreNegocio: string,
    whatsappUsername?: string,
    legalConsent?: LegalConsent,
  ): Promise<AuthUser> => {
    setIsLoading(true);
    setError(null);

    try {
      clearBusinessStorage();

      const response = await authApi.googleRegister(
        credential,
        telefono,
        nombreNegocio,
        whatsappUsername,
        legalConsent ?? {
          termsAccepted: false,
          privacyAccepted: false,
        },
      );

      persistSession(
        response.access_token,
        response.user,
      );

      return response.user;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Error al crear la cuenta con Google';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Registro.
   *
   * IMPORTANTE: No almacena token porque requiere
   * verificación por correo previo al login.
   */
  const register = async (
    credentials: RegisterCredentials,
  ): Promise<AuthUser> => {
    setIsLoading(true);
    setError(null);

    try {
      const newUser = await authApi.register(credentials);

      return newUser;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Error al registrar usuario';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    error,
    login,
    googleLogin,
    googleRegister,
    register,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth debe ser utilizado dentro de un <AuthProvider>',
    );
  }

  return context;
}