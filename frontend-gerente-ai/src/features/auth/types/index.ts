export type RolGlobal = 'MASTER' | 'CLIENTE';

export interface AuthUser {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string | null;
  rolGlobal: RolGlobal;
  plan?: number;
  emailVerificado?: boolean;
  negocioId?: string | null;
  role?: string | null;
  createdAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
  nombreNegocio?: string;
  whatsappUsername?: string;

  /**
   * Consentimientos legales aceptados durante el registro.
   *
   * El backend registra cada documento por separado:
   * - Términos de servicio
   * - Política de privacidad
   */
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

/**
 * Respuesta genérica que puede devolver el backend
 * durante los diferentes flujos de autenticación.
 */
export interface BackendAuthResponse {
  accessToken?: string;
  access_token?: string;
  mensaje?: string;
  usuario?: AuthUser;
  user?: AuthUser;

  /**
   * Indica que el usuario todavía no tiene una sesión
   * definitiva y debe completar MFA.
   */
  requiresMfa?: boolean;

  /**
   * Token temporal utilizado exclusivamente para
   * completar el flujo MFA.
   *
   * IMPORTANTE:
   * No es un access_token de sesión.
   */
  mfaToken?: string;

  /**
   * Acción que debe realizar el frontend para completar MFA.
   *
   * setup:
   *   El MASTER debe configurar MFA por primera vez.
   *
   * verify:
   *   El MASTER ya tiene MFA configurado y debe
   *   introducir su código TOTP.
   *
   * verify-activation:
   *   El MASTER acaba de configurar MFA y debe
   *   confirmar el código generado por su autenticador.
   */
  mfaRequiredAction?:
    | 'setup'
    | 'verify'
    | 'verify-activation';
}

/**
 * Respuesta cuando el usuario ya está autenticado.
 *
 * Aquí sí existe un access_token definitivo.
 */
export interface AuthenticatedResponse {
  requiresMfa?: false;
  access_token: string;
  user: AuthUser;
}

/**
 * Respuesta cuando el MASTER debe completar MFA
 * antes de recibir su access_token definitivo.
 */
export interface MfaRequiredResponse {
  requiresMfa: true;
  mfaToken: string;
  mfaRequiredAction: 'setup' | 'verify' | 'verify-activation';
  user: AuthUser;
}

/**
 * Respuesta final del flujo de autenticación.
 *
 * Puede ser:
 * - Una sesión autenticada.
 * - Un flujo pendiente de MFA.
 */
export type AuthResponse =
  | AuthenticatedResponse
  | MfaRequiredResponse;

export interface VerifyEmailResponse {
  mensaje: string;
  usuarioId?: string;
}

export interface ResendVerificationResponse {
  mensaje: string;
}

export interface ForgotPasswordCredentials {
  email: string;
}

export interface ResetPasswordCredentials {
  token: string;
  newPassword: string;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}