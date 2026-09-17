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

export const authApi = {
  /**
   * Iniciar sesión con email y password.
   *
   * Normaliza la respuesta del backend y sanitiza email.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const payload = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    };

    const raw = await apiClient<BackendAuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const token = raw.accessToken || raw.access_token || '';

    const user =
      raw.usuario ||
      raw.user || {
        id: '',
        nombre: '',
        rolGlobal: 'CLIENTE',
      };

    return {
      access_token: token,
      user,
    };
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
   * IMPORTANTE:
   * Este método SOLO inicia sesión.
   *
   * Si la cuenta de Google no existe en Luka,
   * el backend devolverá un error y el frontend
   * deberá llevar al usuario al flujo de registro.
   *
   * POST /auth/google
   */
  async googleLogin(credential: string): Promise<AuthResponse> {
    if (!credential?.trim()) {
      throw new Error('No se recibió la credencial de Google.');
    }

    const raw = await apiClient<BackendAuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        credential: credential.trim(),
      }),
    });

    const token = raw.accessToken || raw.access_token || '';

    const user =
      raw.usuario ||
      raw.user || {
        id: '',
        nombre: '',
        rolGlobal: 'CLIENTE',
      };

    return {
      access_token: token,
      user,
    };
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
    legalConsent: {
      termsAccepted: boolean;
      privacyAccepted: boolean;
    },
  ): Promise<AuthResponse> {
    if (!credential?.trim()) {
      throw new Error('No se recibió la credencial de Google.');
    }

    if (!telefono?.trim()) {
      throw new Error('El número de teléfono es obligatorio.');
    }

    if (!nombreNegocio?.trim()) {
      throw new Error('El nombre del negocio es obligatorio.');
    }

    if (!legalConsent.termsAccepted) {
      throw new Error('Debes aceptar los Términos de servicio.');
    }

    if (!legalConsent.privacyAccepted) {
      throw new Error('Debes aceptar la Política de privacidad.');
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

    const token = raw.accessToken || raw.access_token || '';

    const user =
      raw.usuario ||
      raw.user || {
        id: '',
        nombre: '',
        rolGlobal: 'CLIENTE',
      };

    return {
      access_token: token,
      user,
    };
  },

  /**
   * Registrar un nuevo usuario.
   *
   * El backend NO devuelve accessToken en el registro porque requiere
   * activación previa mediante el correo de verificación.
   *
   * Los consentimientos legales se envían junto con el registro.
   *
   * POST /auth/register
   */
  async register(
    credentials: RegisterCredentials & LegalConsentCredentials,
  ): Promise<AuthUser> {
    const cleanUsername = credentials.whatsappUsername
      ? credentials.whatsappUsername.trim().replace(/^@+/, '')
      : undefined;

    if (!credentials.termsAccepted) {
      throw new Error('Debes aceptar los Términos de servicio.');
    }

    if (!credentials.privacyAccepted) {
      throw new Error('Debes aceptar la Política de privacidad.');
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

    const raw = await apiClient<BackendAuthResponse | AuthUser>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    if ('usuario' in raw && raw.usuario) {
      return raw.usuario;
    }

    if ('user' in raw && raw.user) {
      return raw.user;
    }

    return raw as AuthUser;
  },

  /**
   * Obtener perfil del usuario autenticado actual.
   *
   * Requiere token JWT.
   */
  async getMe(): Promise<AuthUser> {
    return apiClient<AuthUser>('/auth/usuarios/me', {
      method: 'GET',
    });
  },

  /**
   * Verificar correo electrónico mediante el token
   * recibido por email.
   *
   * GET /auth/verificar-email?token=...
   */
  async verificarEmail(token: string): Promise<VerifyEmailResponse> {
    return apiClient<VerifyEmailResponse>(
      `/auth/verificar-email?token=${encodeURIComponent(token.trim())}`,
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
    return apiClient<{ mensaje: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: data.email.trim().toLowerCase(),
      }),
    });
  },

  /**
   * Restablecer contraseña con token.
   *
   * POST /auth/reset-password
   */
  async resetPassword(
    data: ResetPasswordCredentials,
  ): Promise<{ mensaje: string }> {
    return apiClient<{ mensaje: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: data.token.trim(),
        newPassword: data.newPassword,
      }),
    });
  },
};