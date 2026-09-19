import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Cuerpo de `POST /auth/mfa/activar`.
 *
 * `mfaToken` es el token temporal que devuelve el login de un MASTER, no el
 * access token de sesión.
 */
export class ActivarMfaDto {
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;
}

/**
 * Cuerpo de `POST /auth/mfa/verificar` y `POST /auth/mfa/verificar-activacion`.
 *
 * El código admite espacios ("123 456", como lo muestran algunas apps) porque
 * AuthService los quita antes de verificar; lo que no admite es un número JSON
 * ni nada que no sean seis dígitos.
 */
export class VerificarMfaDto extends ActivarMfaDto {
  @IsString()
  @Matches(/^\s*(\d\s*){6}$/, {
    message: 'El código MFA debe tener exactamente 6 dígitos',
  })
  codigo!: string;
}
