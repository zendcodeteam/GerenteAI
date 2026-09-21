export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errors?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

function translateErrorMessage(msg: string): string {
  if (!msg || typeof msg !== 'string') {
    return 'Ocurrió un error inesperado.';
  }

  const lower = msg.toLowerCase();

  if (lower.includes('email must be an email')) {
    return 'Debes ingresar un correo electrónico válido.';
  }

  if (
    lower.includes(
      'password must be longer than or equal to 8 characters',
    ) ||
    lower.includes('must be longer than or equal to 8')
  ) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }

  if (
    lower.includes('password must match') ||
    lower.includes('password should contain')
  ) {
    return 'La contraseña debe incluir mayúscula, minúscula, número y un carácter especial.';
  }

  if (
    lower.includes('nombre should not be empty') ||
    lower.includes('nombre must be a string')
  ) {
    return 'El nombre completo es obligatorio.';
  }

  if (
    lower.includes('whatsappusername solo admite') ||
    lower.includes('whatsappusername')
  ) {
    return 'El usuario de WhatsApp solo admite letras, números, punto, guion y guion bajo (sin @).';
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('err_failed') ||
    lower.includes('bad gateway') ||
    lower.includes('502')
  ) {
    return 'No pudimos conectar con el servidor. Por favor verifica tu conexión o intenta nuevamente en unos momentos.';
  }

  return msg;
}

function formatErrorMessage(
  data: any,
  statusText: string,
  status: number,
): string {
  if (
    Array.isArray(data?.message) &&
    data.message.length > 0
  ) {
    const translated = data.message.map((m: string) =>
      translateErrorMessage(m),
    );

    return translated.join(' · ');
  }

  if (
    typeof data?.message === 'string' &&
    data.message.trim()
  ) {
    return translateErrorMessage(data.message);
  }

  if (data?.error && typeof data.error === 'string') {
    return translateErrorMessage(data.error);
  }

  if (status === 502 || status === 504) {
    return 'El servidor se está iniciando. Por favor intenta de nuevo en unos segundos.';
  }

  return `Error ${status}: ${
    statusText || 'Ocurrió un problema inesperado'
  }`;
}

// In-Flight Request Deduplication & Memory Cache
const inFlightRequests = new Map<string, Promise<any>>();
const memoryCache = new Map<
  string,
  { data: any; timestamp: number }
>();

const CACHE_TTL_MS = 15_000; // 15 segundos para configuración y perfil

const CACHEABLE_GET_ROUTES = [
  '/planes/catalogo',
  '/auth/usuarios/me',
];

export function clearApiCache(): void {
  memoryCache.clear();
  inFlightRequests.clear();
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit & { skipCache?: boolean } = {},
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('access_token');

  // skipCache es una opción interna de nuestro cliente.
  // No debe enviarse al fetch nativo del navegador.
  const { skipCache = false, ...requestOptions } = options;

  // Si es una mutación, invalidamos la caché de lectura.
  if (method !== 'GET') {
    memoryCache.clear();
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL}${endpoint}`;

  const cacheKey = `${token || 'anon'}:${method}:${url}`;

  // 1. Verificación de Caché en Memoria
  // Solo para GETs cacheables.
  if (method === 'GET' && !skipCache) {
    const isCacheable = CACHEABLE_GET_ROUTES.some((route) =>
      endpoint.includes(route),
    );

    if (isCacheable) {
      const cached = memoryCache.get(cacheKey);

      if (
        cached &&
        Date.now() - cached.timestamp < CACHE_TTL_MS
      ) {
        return cached.data as T;
      }
    }

    // 2. In-Flight Request Deduplication:
    // reutilizar Promise en curso.
    const inFlight = inFlightRequests.get(cacheKey);

    if (inFlight) {
      return inFlight as Promise<T>;
    }
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
    ...requestOptions.headers,
  };

  const executeRequest = async (): Promise<T> => {
    try {
      const response = await fetch(url, {
        ...requestOptions,
        headers,
      });

      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        /*
         * Si el token es inválido o expiró en una ruta protegida,
         * cerramos la sesión y enviamos al login.
         *
         * IMPORTANTE:
         * Las rutas de autenticación, incluyendo Google,
         * NO deben provocar este redirect automático.
         */
        if (
          response.status === 401 &&
          !endpoint.includes('/auth/login') &&
          !endpoint.includes('/auth/register') &&
          !endpoint.includes('/auth/google') &&
          !endpoint.includes('/auth/google/register') &&
          // Un código MFA incorrecto responde 401: debe mostrarse en la
          // pantalla de MFA (con los intentos restantes), no sacar al login.
          !endpoint.includes('/auth/mfa/') &&
          !endpoint.includes('/auth/verificar-email') &&
          !endpoint.includes('/auth/forgot-password') &&
          !endpoint.includes('/auth/reset-password')
        ) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_session');
          localStorage.removeItem('session_expires_at');
          localStorage.removeItem('session_login_time');

          window.location.href = '/login';
        }

        const errorMessage = formatErrorMessage(
          data,
          response.statusText,
          response.status,
        );

        throw new ApiError(
          response.status,
          errorMessage,
          Array.isArray(data.message)
            ? data.message
            : undefined,
        );
      }

      // Guardar en caché si es cacheable.
      if (method === 'GET') {
        const isCacheable = CACHEABLE_GET_ROUTES.some(
          (route) => endpoint.includes(route),
        );

        if (isCacheable) {
          memoryCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
          });
        }
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      const rawMsg =
        (error as Error)?.message || '';

      const cleanMsg = translateErrorMessage(rawMsg);

      throw new ApiError(
        500,
        cleanMsg.toLowerCase().includes('fetch') ||
        cleanMsg.toLowerCase().includes('failed')
          ? 'No pudimos conectar con el servidor. Por favor verifica tu conexión a internet o intenta en unos momentos.'
          : cleanMsg || 'No pudimos conectar con el servidor.',
      );
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  };

  if (method === 'GET') {
    const requestPromise = executeRequest();

    inFlightRequests.set(
      cacheKey,
      requestPromise,
    );

    return requestPromise;
  }

  return executeRequest();
}