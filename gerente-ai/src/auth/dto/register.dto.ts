import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsOptional()
  telefono?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  nombreNegocio?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._-]{3,30}$/, {
    message:
      'whatsappUsername solo admite letras, números, punto, guion y guion bajo',
  })
  whatsappUsername?: string;

  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  @Matches(/(?=.*[a-z])/, {
    message: 'La contraseña debe contener al menos una letra minúscula',
  })
  @Matches(/(?=.*[A-Z])/, {
    message: 'La contraseña debe contener al menos una letra mayúscula',
  })
  @Matches(/(?=.*\d)/, {
    message: 'La contraseña debe contener al menos un número',
  })
  @Matches(/(?=.*[!@#$%^&*(),.?":{}|<>])/, {
    message:
      'La contraseña debe contener al menos un carácter especial',
  })
  password!: string;

  @IsBoolean()
  termsAccepted!: boolean;

  @IsBoolean()
  privacyAccepted!: boolean;
}