import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GoogleRegisterDto {
  /**
   * ID Token entregado por Google Identity Services.
   */
  @IsString()
  @IsNotEmpty()
  credential!: string;

  /**
   * Número de teléfono del usuario.
   *
   * Se espera un número móvil colombiano.
   *
   * Ejemplos válidos:
   *
   * +573001234567
   * 3001234567
   * 573001234567
   *
   * AuthService se encarga posteriormente de normalizarlo
   * al formato +57XXXXXXXXXX.
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?:\+?57)?3\d{9}$/, {
    message:
      'El teléfono debe ser un número celular colombiano válido, por ejemplo +573001234567',
  })
  telefono!: string;

  /**
   * Nombre del negocio que el usuario está registrando.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'El nombre del negocio debe tener al menos 2 caracteres',
  })
  @MaxLength(100, {
    message: 'El nombre del negocio no puede superar los 100 caracteres',
  })
  nombreNegocio!: string;

  /**
   * Usuario de WhatsApp del negocio.
   *
   * Es opcional porque no todos los usuarios necesariamente
   * tendrán uno durante el registro.
   *
   * Puede enviarse con o sin @:
   *
   * @mi_negocio
   * mi_negocio
   */
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message:
      'El usuario de WhatsApp no puede superar los 100 caracteres',
  })
  whatsappUsername?: string;

  /**
   * Aceptación de los Términos de servicio.
   *
   * Debe ser true para completar el registro.
   */
  @IsDefined({
    message: 'Debes aceptar los Términos de servicio',
  })
  @IsBoolean({
    message: 'termsAccepted debe ser un valor booleano',
  })
  termsAccepted!: boolean;

  /**
   * Autorización para el tratamiento de datos personales
   * conforme a la Política de privacidad.
   *
   * Debe ser true para completar el registro.
   */
  @IsDefined({
    message: 'Debes aceptar la Política de privacidad',
  })
  @IsBoolean({
    message: 'privacyAccepted debe ser un valor booleano',
  })
  privacyAccepted!: boolean;
}