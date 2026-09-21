import { apiClient } from '@/lib/apiClient';

import {
  AuthResponse,
  AuthUser,
  BackendAuthResponse,
  ForgotPasswordCredentials,
  LoginCredentials,
  RegisterCredentials,
  ResendVerificationResponse,
  ResetPasswordCredentials,
  VerifyEmailResponse,
} from '../types';

type LegalConsentCredentials = {
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

/**
 * Normaliza una respuesta de autenticación del backend.
 *
 * Puede representar:
 *
 * 1. Una sesión autenticada con access_token.
 * 2. Un flujo MFA pendiente para un usuario MASTER.
 *
 * IMPORTANTE:
 *
 * Un mfaToken NO se considera access_token.
 * Mientras MFA esté pendiente, el frontend no debe
 * persistir ninguna sesión definitiva.
 */
function normalizeAuthResponse(
  raw: BackendAuthResponse,
): AuthResponse {
  const user =
    raw.usuario ||
    raw.user || {
      id: '',
      nombre: '',
      rolGlobal: 'CLIENTE',
    };

  /**
   * MASTER pendiente de MFA.
   *
   * En este estado el backend deliberadamente NO entrega
   * un access_token definitivo.
   */
  if (
    raw.requiresMfa === true &&
    raw.mfaToken &&
    raw.mfaRequiredAction
  ) {
    return {
      requiresMfa: true,
      mfaToken: raw.mfaToken,
      mfaRequiredAction: raw.mfaRequiredAction,
      user,
    };
  }

  /**
   * Usuario autenticado normalmente.
   */
  const token =
    raw.accessToken ||
    raw.access_token ||
    '';

  if (!token) {
    throw new Error(
      'El servidor no devolvió un token de autenticación válido.',
    );
  }

  return {
    requiresMfa: false,
    access_token: token,
    user,
  };
}

export const authApi = {
  /**
   * Iniciar sesión con email y password.
   *
   * CLIENTE:
   *   Devuelve directamente la sesión.
   *
   * MASTER sin MFA:
   *   Devuelve un flujo temporal para configurar MFA.
   *
   * MASTER con MFA:
   *   Devuelve un flujo temporal para verificar MFA.
   *
   * IMPORTANTE:
   *
   * Cuando MFA está pendiente NO se devuelve ni se
   * interpreta un access_token definitivo.
   */
  async login(
    credentials: LoginCredentials,
  ): Promise<AuthResponse> {
    const payload = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    };

    const raw = await apiClient<BackendAuthResponse>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    return normalizeAuthResponse(raw);
  },

  /**
   * Iniciar sesión mediante Google.
   *
   * Google entrega un ID Token (credential) al frontend.
   *
   * El frontend NO valida ni decodifica el token.
   * Lo envía directamente al backend, donde Google
   * es validado mediante google-auth-library.
   *
   * Si la cuenta pertenece a un MASTER:
   *
   *   Google → MFA → access_token
   *
   * El access_token definitivo solamente se entrega
   * después de completar MFA.
   *
   * POST /auth/google
   */
  async googleLogin(
    credential: string,
  ): Promise<AuthResponse> {
    if (!credential?.trim()) {
      throw new Error(
        'No se recibió la credencial de Google.',
      );
    }

    const raw = await apiClient<BackendAuthResponse>(
      '/auth/google',
      {
        method: 'POST',
        body: JSON.stringify({
          credential: credential.trim(),
        }),
      },
    );

    return normalizeAuthResponse(raw);
  },

  /**
   * Registrar una nueva cuenta mediante Google.
   *
   * Google proporciona:
   *
   *   - Nombre
   *   - Email
   *   - Google ID
   *
   * Luka solicita adicionalmente:
   *
   *   - Teléfono colombiano
   *   - Nombre del negocio
   *   - Usuario de WhatsApp (opcional)
   *   - Aceptación de Términos de servicio
   *   - Aceptación de Política de privacidad
   *
   * Los consentimientos legales se envían explícitamente
   * al backend para que sean registrados junto con:
   *
   *   - Usuario
   *   - Documento
   *   - Versión
   *   - Fecha y hora
   *   - IP
   *
   * POST /auth/google/register
   */
  async googleRegister(
    credential: string,
    telefono: string,
    nombreNegocio: string,
    whatsappUsername: string | undefined,
    legalConsent: LegalConsentCredentials,
  ): Promise<AuthResponse> {
    if (!credential?.trim()) {
      throw new Error(
        'No se recibió la credencial de Google.',
      );
    }

    if (!telefono?.trim()) {
      throw new Error(
        'El número de teléfono es obligatorio.',
      );
    }

    if (!nombreNegocio?.trim()) {
      throw new Error(
        'El nombre del negocio es obligatorio.',
      );
    }

    if (!legalConsent.termsAccepted) {
      throw new Error(
        'Debes aceptar los Términos de servicio.',
      );
    }

    if (!legalConsent.privacyAccepted) {
      throw new Error(
        'Debes aceptar la Política de privacidad.',
      );
    }

    const cleanUsername = whatsappUsername
      ? whatsappUsername.trim().replace(/^@+/, '')
      : undefined;

    const payload = {
      credential: credential.trim(),
      telefono: telefono.trim(),
      nombreNegocio: nombreNegocio.trim(),

      termsAccepted: legalConsent.termsAccepted,
      privacyAccepted: legalConsent.privacyAccepted,

      ...(cleanUsername
        ? {
            whatsappUsername: cleanUsername,
          }
        : {}),
    };

    const raw = await apiClient<BackendAuthResponse>(
      '/auth/google/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    return normalizeAuthResponse(raw);
  },

  /**
   * Registrar un nuevo usuario.
   *
   * El backend NO devuelve accessToken en el registro
   * porque requiere activación previa mediante el correo
   * de verificación.
   *
   * Los consentimientos legales se envían junto con el registro.
   *
   * POST /auth/register
   */
  async register(
    credentials: RegisterCredentials &
      LegalConsentCredentials,
  ): Promise<AuthUser> {
    const cleanUsername = credentials.whatsappUsername
      ? credentials.whatsappUsername.trim().replace(/^@+/, '')
      : undefined;

    if (!credentials.termsAccepted) {
      throw new Error(
        'Debes aceptar los Términos de servicio.',
      );
    }

    if (!credentials.privacyAccepted) {
      throw new Error(
        'Debes aceptar la Política de privacidad.',
      );
    }

    const payload = {
      nombre: credentials.nombre.trim(),
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,

      ...(credentials.telefono?.trim()
        ? {
            telefono: credentials.telefono.trim(),
          }
        : {}),

      nombreNegocio:
        credentials.nombreNegocio?.trim() ||
        `Negocio de ${credentials.nombre.trim()}`,

      ...(cleanUsername
        ? {
            whatsappUsername: cleanUsername,
          }
        : {}),

      termsAccepted: credentials.termsAccepted,
      privacyAccepted: credentials.privacyAccepted,
    };

    const raw = await apiClient<
      BackendAuthResponse | AuthUser
    >('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if ('usuario' in raw && raw.usuario) {
      return raw.usuario;
    }

    if ('user' in raw && raw.user) {
      return raw.user;
    }

    return raw as AuthUser;
  },

  /**
   * Iniciar activación de MFA para un MASTER.
   *
   * POST /auth/mfa/activar
   *
   * Este endpoint todavía NO entrega access_token.
   */
  async activarMfa(
    mfaToken: string,
  ): Promise<{
    requiresMfa: true;
    mfaRequiredAction: 'verify-activation';
    secret: string;
    otpauthUrl: string;
    user: AuthUser;
  }> {
    if (!mfaToken?.trim()) {
      throw new Error(
        'No se recibió el token temporal de MFA.',
      );
    }

    return apiClient<{
      requiresMfa: true;
      mfaRequiredAction: 'verify-activation';
      secret: string;
      otpauthUrl: string;
      user: AuthUser;
    }>('/auth/mfa/activar', {
      method: 'POST',
      body: JSON.stringify({
        mfaToken: mfaToken.trim(),
      }),
    });
  },

  /**
   * Confirmar la activación inicial de MFA.
   *
   * El MASTER introduce el código TOTP generado
   * por su aplicación autenticadora.
   *
   * Si es correcto, el backend entrega el
   * access_token definitivo.
   *
   * POST /auth/mfa/verificar-activacion
   */
  async verificarActivacionMfa(
    mfaToken: string,
    codigo: string,
  ): Promise<AuthResponse> {
    if (!mfaToken?.trim()) {
      throw new Error(
        'No se recibió el token temporal de MFA.',
      );
    }

    const normalizedCode = codigo
      ?.trim()
      .replace(/\s/g, '');

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new Error(
        'El código de autenticación debe tener 6 dígitos.',
      );
    }

    const raw = await apiClient<BackendAuthResponse>(
      '/auth/mfa/verificar-activacion',
      {
        method: 'POST',
        body: JSON.stringify({
          mfaToken: mfaToken.trim(),
          codigo: normalizedCode,
        }),
      },
    );

    return normalizeAuthResponse(raw);
  },

  /**
   * Verificar MFA durante el inicio de sesión.
   *
   * El MASTER ya tiene MFA configurado.
   *
   * POST /auth/mfa/verificar
   */
  async verificarMfa(
    mfaToken: string,
    codigo: string,
  ): Promise<AuthResponse> {
    if (!mfaToken?.trim()) {
      throw new Error(
        'No se recibió el token temporal de MFA.',
      );
    }

    const normalizedCode = codigo
      ?.trim()
      .replace(/\s/g, '');

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new Error(
        'El código de autenticación debe tener 6 dígitos.',
      );
    }

    const raw = await apiClient<BackendAuthResponse>(
      '/auth/mfa/verificar',
      {
        method: 'POST',
        body: JSON.stringify({
          mfaToken: mfaToken.trim(),
          codigo: normalizedCode,
        }),
      },
    );

    return normalizeAuthResponse(raw);
  },

  /**
   * Obtener perfil del usuario autenticado actual.
   *
   * Requiere token JWT.
   */
  async getMe(): Promise<AuthUser> {
    return apiClient<AuthUser>(
      '/auth/usuarios/me',
      {
        method: 'GET',
      },
    );
  },

  /**
   * Verificar correo electrónico mediante el token
   * recibido por email.
   *
   * GET /auth/verificar-email?token=...
   */
  async verificarEmail(
    token: string,
  ): Promise<VerifyEmailResponse> {
    return apiClient<VerifyEmailResponse>(
      `/auth/verificar-email?token=${encodeURIComponent(
        token.trim(),
      )}`,
      {
        method: 'GET',
      },
    );
  },

  /**
   * Reenviar correo de verificación.
   *
   * POST /auth/reenviar-verificacion
   */
  async reenviarVerificacion(
    email: string,
  ): Promise<ResendVerificationResponse> {
    return apiClient<ResendVerificationResponse>(
      '/auth/reenviar-verificacion',
      {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      },
    );
  },

  /**
   * Solicitar correo de recuperación de contraseña.
   *
   * POST /auth/forgot-password
   */
  async forgotPassword(
    data: ForgotPasswordCredentials,
  ): Promise<{ mensaje: string }> {
    return apiClient<{ mensaje: string }>(
      '/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
        }),
      },
    );
  },

  /**
   * Restablecer contraseña con token.
   *
   * POST /auth/reset-password
   */
  async resetPassword(
    data: ResetPasswordCredentials,
  ): Promise<{ mensaje: string }> {
    return apiClient<{ mensaje: string }>(
      '/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify({
          token: data.token.trim(),
          newPassword: data.newPassword,
        }),
      },
    );
  },
};