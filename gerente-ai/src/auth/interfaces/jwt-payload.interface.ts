/**
 * Tokens que emite el sistema. Todos se firman con el mismo secreto, así que el
 * `type` es lo único que distingue para qué sirve cada uno: sin él, el token que
 * viaja dentro de un correo de verificación serviría como credencial de sesión.
 */
export type TipoDeToken =
  'session' | 'email-verification' | 'password-reset' | 'email-change';

export interface JwtPayload {
  sub: string; // id del usuario
  type: TipoDeToken;
  negocioId: string;
  role: string;
  rolGlobal: 'MASTER' | 'CLIENTE';
  /**
   * Momento en que se firmó el token, en segundos. Lo pone `jsonwebtoken` solo.
   *
   * Es lo que permite saber si el token es anterior al último cambio de
   * contraseña y, por lo tanto, si hay que rechazarlo.
   */
  iat?: number;
  exp?: number;
}
