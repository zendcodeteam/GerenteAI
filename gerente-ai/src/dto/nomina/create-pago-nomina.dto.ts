import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreatePagoNominaDto {
  @IsString({
    message: 'El nombre del trabajador debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'El nombre del trabajador es obligatorio' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  nombreTrabajador!: string;

  /**
   * Porcentaje de pago asignado/liquidado (entre 0 y 100).
   */
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El porcentaje de pago debe ser un número válido con hasta 2 decimales',
    },
  )
  @Min(0, { message: 'El porcentaje de pago no puede ser menor a 0' })
  @Max(100, { message: 'El porcentaje de pago no puede ser mayor a 100' })
  porcentajePago!: number;

  /**
   * Monto exacto liquidado/pagado (> 0).
   */
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El monto exacto debe ser un número válido con hasta 2 decimales',
    },
  )
  @IsPositive({ message: 'El monto exacto debe ser mayor a 0' })
  montoExacto!: number;

  /**
   * Fecha en la que se efectuó o liquidó el pago (opcional, por defecto now()).
   */
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de pago debe tener un formato ISO válido' },
  )
  fechaPago?: string;

  @IsString({ message: 'La sede es obligatoria' })
  @IsNotEmpty({ message: 'La sede es obligatoria' })
  sedeId!: string;
}
