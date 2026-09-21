import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { authApi } from '../api/authApi';

import {
  AuthResponse,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
} from '../types';

import { ApiError } from '@/lib/apiClient';

interface LegalConsent {
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

interface MfaState {
  mfaToken: string;
  action: 'setup' | 'verify' | 'verify-activation';
  user: AuthUser;
}

/**
 * Resultado del flujo de autenticación.
 *
 * authenticated:
 *   La sesión definitiva ya fue creada.
 *
 * mfa-required:
 *   El usuario MASTER todavía debe completar
 *   el flujo MFA antes de recibir el access_token.
 */
export type AuthFlowResult =
  | {
      status: 'authenticated';
      user: AuthUser;
    }
  | {
      status: 'mfa-required';
      user: AuthUser;
      mfaToken: string;
      action: 'setup' | 'verify' | 'verify-activation';
    };

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  /**
   * Estado temporal del flujo MFA de un usuario MASTER.
   *
   * Existe únicamente mientras todavía no se ha
   * generado la sesión definitiva.
   */
  mfa: MfaState | null;

  login: (
    credentials: LoginCredentials,
  ) => Promise<AuthFlowResult>;

  googleLogin: (
    credential: string,
  ) => Promise<AuthFlowResult>;

  googleRegister: (
    credential: string,
    telefono: string,
    nombreNegocio: string,
    whatsappUsername?: string,
    legalConsent?: LegalConsent,
  ) => Promise<AuthUser>;

  register: (
    credentials: RegisterCredentials,
  ) => Promise<AuthUser>;

  /**
   * Completar la activación inicial de MFA.
   *
   * Después de verificar correctamente el código,
   * se crea la sesión definitiva.
   */
  activateMfa: () => Promise<{
    secret: string;
    otpauthUrl: string;
    user: AuthUser;
  }>;

  verifyMfaActivation: (
    codigo: string,
  ) => Promise<AuthUser>;

  /**
   * Completar MFA durante el login de un MASTER
   * que ya tiene MFA configurado.
   */
  verifyMfa: (
    codigo: string,
  ) => Promise<AuthUser>;

  clearMfa: () => void;

  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const TOKEN_KEY = 'access_token';
export const USER_KEY = 'user_session';
export const SESSION_EXPIRES_AT_KEY =
  'session_expires_at';
export const SESSION_LOGIN_TIME_KEY =
  'session_login_time';

/** Tiempo máximo de duración de sesión: 1 hora exacta */
export const SESSION_MAX_AGE_MS =
  60 * 60 * 1000;

/**
 * Validador seguro de expiración de JWT en el cliente
 * sin llamadas de red.
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
            ('00' +
              c.charCodeAt(0).toString(16)
            ).slice(-2),
        )
        .join(''),
    );

    const decoded = JSON.parse(jsonPayload);

    if (!decoded.exp) return false;

    // Si expira en los próximos 10 segundos,
    // considerarlo expirado.
    return (
      decoded.exp * 1000 <
      Date.now() + 10000
    );
  } catch {
    return true;
  }
}

/**
 * Verifica si la sesión de 1 hora o el JWT
 * han expirado.
 */
function isSessionExpired(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) return true;

  if (isTokenExpired(token)) return true;

  const expiresAt = localStorage.getItem(
    SESSION_EXPIRES_AT_KEY,
  );

  if (
    expiresAt &&
    Date.now() >= Number(expiresAt)
  ) {
    return true;
  }

  return false;
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(
    () => {
      if (isSessionExpired()) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(
          SESSION_EXPIRES_AT_KEY,
        );
        localStorage.removeItem(
          SESSION_LOGIN_TIME_KEY,
        );

        return null;
      }

      return localStorage.getItem(TOKEN_KEY);
    },
  );

  const [user, setUser] =
    useState<AuthUser | null>(() => {
      if (isSessionExpired()) {
        return null;
      }

      const savedUser =
        localStorage.getItem(USER_KEY);

      if (!savedUser) return null;

      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    });

  const [mfa, setMfa] =
    useState<MfaState | null>(null);

  const [isLoading, setIsLoading] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearBusinessStorage =
    useCallback(() => {
      localStorage.removeItem(
        'active_business_id',
      );
      localStorage.removeItem(
        'active_business_name',
      );
      localStorage.removeItem(
        'active_sede_id',
      );
      localStorage.removeItem(
        'active_sede_name',
      );
      localStorage.removeItem(
        'active_business_plan',
      );

      try {
        Object.keys(localStorage).forEach(
          (key) => {
            if (
              key.startsWith(
                'business_plan_',
              )
            ) {
              localStorage.removeItem(key);
            }
          },
        );
      } catch {
        // Ignorar errores de acceso a storage.
      }
    }, []);

  /**
   * Limpia únicamente el estado temporal de MFA.
   *
   * El mfaToken no se persiste en localStorage.
   */
  const clearMfa = useCallback(() => {
    setMfa(null);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(
      SESSION_EXPIRES_AT_KEY,
    );
    localStorage.removeItem(
      SESSION_LOGIN_TIME_KEY,
    );

    clearBusinessStorage();

    setToken(null);
    setUser(null);
    setMfa(null);
    setError(null);
  }, [clearBusinessStorage]);

  /**
   * Guarda una sesión autenticada en localStorage
   * y React state.
   *
   * IMPORTANTE:
   *
   * Esta función solamente debe ejecutarse cuando
   * ya existe un access_token definitivo.
   *
   * Nunca debe utilizarse con mfaToken.
   */
  const persistSession = useCallback(
    (
      accessToken: string,
      authenticatedUser: AuthUser,
    ) => {
      if (!accessToken?.trim()) {
        throw new Error(
          'No se puede crear una sesión sin un access_token válido.',
        );
      }

      const expiresAt =
        Date.now() + SESSION_MAX_AGE_MS;

      localStorage.setItem(
        TOKEN_KEY,
        accessToken,
      );

      localStorage.setItem(
        USER_KEY,
        JSON.stringify(authenticatedUser),
      );

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

      /**
       * Una vez creada la sesión definitiva,
       * cualquier estado MFA pendiente deja de ser necesario.
       */
      setMfa(null);
    },
    [],
  );

  /**
   * Procesa una respuesta de autenticación.
   *
   * CLIENTE:
   *   access_token → sesión inmediata.
   *
   * MASTER:
   *   requiresMfa → solamente se conserva
   *   el estado temporal del flujo MFA.
   */
  const processAuthResponse = useCallback(
    (response: AuthResponse): AuthFlowResult => {
      if (response.requiresMfa === true) {
        /**
         * MUY IMPORTANTE:
         *
         * No llamar persistSession().
         *
         * El MASTER todavía NO está autenticado
         * completamente.
         */

        setToken(null);
        setUser(null);

        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(
          SESSION_EXPIRES_AT_KEY,
        );
        localStorage.removeItem(
          SESSION_LOGIN_TIME_KEY,
        );

        setMfa({
          mfaToken: response.mfaToken,
          action:
            response.mfaRequiredAction,
          user: response.user,
        });

        return {
          status: 'mfa-required',
          user: response.user,
          mfaToken: response.mfaToken,
          action:
            response.mfaRequiredAction,
        };
      }

      /**
       * Respuesta autenticada.
       *
       * Aquí sí existe el JWT definitivo.
       */
      persistSession(
        response.access_token,
        response.user,
      );

      return {
        status: 'authenticated',
        user: response.user,
      };
    },
    [persistSession],
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
      if (
        document.visibilityState ===
        'visible'
      ) {
        checkExpiration();
      }
    };

    window.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    window.addEventListener(
      'focus',
      checkExpiration,
    );

    // Revisión periódica cada 30 segundos.
    const interval = setInterval(
      checkExpiration,
      30000,
    );

    return () => {
      window.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.removeEventListener(
        'focus',
        checkExpiration,
      );

      clearInterval(interval);
    };
  }, [token, logout]);

  /**
   * Sincronización entre pestañas.
   */
  useEffect(() => {
    const handleStorageChange = (
      e: StorageEvent,
    ) => {
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

    window.addEventListener(
      'storage',
      handleStorageChange,
    );

    return () => {
      window.removeEventListener(
        'storage',
        handleStorageChange,
      );
    };
  }, []);

  /**
   * Login normal.
   *
   * CLIENTE:
   *   Guarda inmediatamente la sesión.
   *
   * MASTER:
   *   Devuelve explícitamente que MFA
   *   es obligatorio.
   */
  const login = async (
    credentials: LoginCredentials,
  ): Promise<AuthFlowResult> => {
    setIsLoading(true);
    setError(null);

    try {
      clearBusinessStorage();

      const response =
        await authApi.login(credentials);

      return processAuthResponse(response);
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
   * Login mediante Google.
   *
   * CLIENTE:
   *   Google → sesión.
   *
   * MASTER:
   *   Google → MFA → sesión.
   */
  const googleLogin = async (
    credential: string,
  ): Promise<AuthFlowResult> => {
    setIsLoading(true);
    setError(null);

    try {
      clearBusinessStorage();

      const response =
        await authApi.googleLogin(
          credential,
        );

      return processAuthResponse(response);
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
   * Google ya proporciona un correo electrónico
   * verificado.
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

      const response =
        await authApi.googleRegister(
          credential,
          telefono,
          nombreNegocio,
          whatsappUsername,
          legalConsent ?? {
            termsAccepted: false,
            privacyAccepted: false,
          },
        );

      const result =
        processAuthResponse(response);

      /**
       * El registro actual está pensado para CLIENTE.
       * Si en el futuro el backend permite registrar
       * MASTER mediante Google, este punto evita
       * devolver silenciosamente un usuario sin
       * completar MFA.
       */
      if (result.status === 'mfa-required') {
        throw new Error(
          'Este registro requiere completar la autenticación multifactor.',
        );
      }

      return result.user;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Error al crear la cuenta con Google';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Inicia la activación de MFA.
   *
   * Solamente se puede ejecutar cuando el backend
   * indicó que el MASTER debe configurar MFA.
   */
  const activateMfa = async (): Promise<{
    secret: string;
    otpauthUrl: string;
    user: AuthUser;
  }> => {
    if (!mfa) {
      throw new Error(
        'No existe un flujo MFA pendiente.',
      );
    }

    if (mfa.action !== 'setup') {
      throw new Error(
        'El flujo actual no corresponde a una activación de MFA.',
      );
    }

    setIsLoading(true);
    setError(null);

    try {
      const response =
        await authApi.activarMfa(
          mfa.mfaToken,
        );

      /**
       * Conservamos el mismo mfaToken temporal,
       * pero actualizamos la acción para que la
       * interfaz pase a la verificación inicial.
       */
      setMfa((current) => {
        if (!current) return null;

        return {
          ...current,
          action:
            response.mfaRequiredAction,
          user: response.user,
        };
      });

      return {
        secret: response.secret,
        otpauthUrl:
          response.otpauthUrl,
        user: response.user,
      };
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Error al activar la autenticación de dos factores';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Confirma la activación inicial de MFA.
   *
   * Si el código es correcto, AuthService devuelve
   * el access_token definitivo.
   */
  const verifyMfaActivation = async (
    codigo: string,
  ): Promise<AuthUser> => {
    if (!mfa) {
      throw new Error(
        'No existe un flujo MFA pendiente.',
      );
    }

    if (
      mfa.action !==
      'verify-activation'
    ) {
      throw new Error(
        'El flujo actual no corresponde a la verificación de activación de MFA.',
      );
    }

    setIsLoading(true);
    setError(null);

    try {
      const response =
        await authApi.verificarActivacionMfa(
          mfa.mfaToken,
          codigo,
        );

      const result =
        processAuthResponse(response);

      if (result.status !== 'authenticated') {
        throw new Error(
          'La activación de MFA no pudo completar la sesión.',
        );
      }

      return result.user;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Código de autenticación incorrecto';

      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verifica MFA durante el login de un MASTER
   * que ya tiene MFA configurado.
   */
  const verifyMfa = async (
    codigo: string,
  ): Promise<AuthUser> => {
    if (!mfa) {
      throw new Error(
        'No existe un flujo MFA pendiente.',
      );
    }

    if (mfa.action !== 'verify') {
      throw new Error(
        'El flujo actual no corresponde a la verificación de MFA.',
      );
    }

    setIsLoading(true);
    setError(null);

    try {
      const response =
        await authApi.verificarMfa(
          mfa.mfaToken,
          codigo,
        );

      const result =
        processAuthResponse(response);

      if (result.status !== 'authenticated') {
        throw new Error(
          'La verificación MFA no pudo completar la sesión.',
        );
      }

      return result.user;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Código de autenticación incorrecto';

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
      const newUser =
        await authApi.register(
          credentials,
        );

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
    isAuthenticated:
      !!token && !!user,
    isLoading,
    error,
    mfa,
    login,
    googleLogin,
    googleRegister,
    register,
    activateMfa,
    verifyMfaActivation,
    verifyMfa,
    clearMfa,
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
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth debe ser utilizado dentro de un <AuthProvider>',
    );
  }

  return context;
}