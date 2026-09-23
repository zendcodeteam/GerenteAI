import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * DTOs de entrada. La validacion ocurre antes de gastar un solo token:
 * una peticion mal formada nunca debe llegar al modelo.
 *
 * `tenantId` viaja hoy en el cuerpo porque aun no hay autenticacion. Cuando
 * exista JWT debe salir del token y eliminarse de estos DTOs.
 */

const PLANS = ['asistente', 'gerente', 'director', 'corporativo'] as const;

export class WhatsAppMessageDto {
  @IsString()
  @Length(1, 2_000, {
    message: 'El mensaje debe tener entre 1 y 2000 caracteres.',
  })
  message!: string;

  @IsString()
  @Length(1, 64)
  businessId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  businessName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3, {
    message: 'La moneda debe ser un codigo ISO de 3 letras (COP, USD).',
  })
  currency?: string;

  /** Si es true, los movimientos detectados se guardan. */
  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}

export class GenerateInsightsDto {
  @IsString()
  @Length(1, 64)
  businessId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  tenantId?: string;

  @IsOptional()
  @IsIn(PLANS)
  plan?: (typeof PLANS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  limit?: number;
}

export class AssistantTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @Length(1, 4_000)
  content!: string;
}

export class AskAssistantDto {
  @IsString()
  @Length(1, 1_000)
  question!: string;

  @IsString()
  @Length(1, 64)
  businessId!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  tenantId?: string;

  @IsOptional()
  @IsIn(PLANS)
  plan?: (typeof PLANS)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantTurnDto)
  history?: AssistantTurnDto[];
}
