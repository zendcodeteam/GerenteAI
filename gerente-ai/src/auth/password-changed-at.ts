import { createHash } from 'node:crypto';

/**
 * Regla que usa JwtStrategy para decidir si un token de sesión quedó
 * invalidado por un cambio de contraseña.
 *
 * `iat` viene en segundos y redondeado hacia abajo, mientras que
 * `passwordChangedAt` tiene milisegundos. Por eso la comparación es por
 * segundos cumplidos: un token firmado en el MISMO segundo del cambio se
 * acepta. Si no, alguien que cambia su contraseña y entra un instante después
 * podría quedar fuera con una sesión recién emitida. La holgura es de menos de
 * un segundo, así que no le sirve de nada a quien tenga un token viejo.
 */
export function tokenEsAnteriorAlCambio(
  iat: number | undefined,
  passwordChangedAt: Date | null,
): boolean {
  // Nadie pierde la sesión por desplegar esto: los usuarios que aún no han
  // cambiado su contraseña tienen la fecha vacía y sus tokens siguen valiendo.
  if (!passwordChangedAt) return false;

  // Un token de sesión sin `iat` no debería existir (lo pone la librería al
  // firmar), pero si llegara uno no hay forma de fecharlo: se rechaza.
  if (typeof iat !== 'number') return true;

  return Math.floor(passwordChangedAt.getTime() / 1_000) > iat;
}

/**
 * Huella corta del hash de la contraseña, para meterla en el enlace de
 * recuperación.
 *
 * No se mete el hash tal cual: el token lo lleva el usuario en un correo y el
 * payload de un JWT se lee sin ninguna clave. Un SHA-256 recortado alcanza
 * para notar que la contraseña cambió, y de él no se puede volver al hash.
 *
 * La fecha del cambio no sirve para esto: `iat` está en segundos, así que dos
 * enlaces pedidos en el mismo segundo no se distinguirían entre sí.
 */
export function huellaDeContrasena(hash: string): string {
  return createHash('sha256').update(hash).digest('hex').slice(0, 16);
}
