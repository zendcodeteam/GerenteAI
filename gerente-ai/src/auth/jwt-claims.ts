import type { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';

/**
 * Quién emite los tokens. Va en `iss` y se exige al verificar, así que un JWT
 * firmado por otro sistema con el mismo secreto no sirve aquí.
 */
export const JWT_ISSUER = 'luka-ai';

/**
 * Para qué sirve cada token, en `aud`.
 *
 * Hasta ahora todos se firmaban igual y solo los distinguía el campo `type`,
 * que es una comprobación que hay que acordarse de escribir en cada sitio: si
 * un flujo nuevo se olvida de mirarlo, el token del correo de verificación
 * vuelve a servir como credencial de sesión.
 *
 * Con `aud` la separación la hace la librería al verificar la firma. Un token
 * de reseteo presentado como sesión ni siquiera llega a la comprobación de
 * `type`: `jsonwebtoken` lo rechaza antes. Los `type` se quedan igual, como
 * segunda barrera.
 */
export const AUDIENCIA = {
  session: 'luka:session',
  'email-verification': 'luka:email-verification',
  'password-reset': 'luka:password-reset',
  'email-change': 'luka:email-change',
  'mfa-pending': 'luka:mfa-pending',
} as const;

export type TipoDeTokenFirmado = keyof typeof AUDIENCIA;

/** Opciones de firma para un tipo de token. `extra` lleva el `expiresIn`. */
export function firmaDe(
  tipo: TipoDeTokenFirmado,
  extra: JwtSignOptions = {},
): JwtSignOptions {
  return {
    ...extra,
    issuer: JWT_ISSUER,
    audience: AUDIENCIA[tipo],
  };
}

/**
 * Opciones de verificación para un tipo de token. Si el token no trae el
 * emisor y la audiencia que toca, `verify` lanza y no hay nada más que mirar.
 */
export function verificacionDe(tipo: TipoDeTokenFirmado): JwtVerifyOptions {
  return {
    issuer: JWT_ISSUER,
    audience: AUDIENCIA[tipo],
  };
}
