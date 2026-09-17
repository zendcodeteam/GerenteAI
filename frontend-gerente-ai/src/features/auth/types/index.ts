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

export interface BackendAuthResponse {
  accessToken?: string;
  access_token?: string;
  mensaje?: string;
  usuario?: AuthUser;
  user?: AuthUser;
}

export interface AuthResponse {
  access_token: string;
  user: AuthUser;
}

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