import { IsDateString, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryPagoNominaDto {
  @IsOptional()
  @IsString()
  sedeId?: string;

  /**
   * Filtro por nombre o coincidencia del trabajador.
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  trabajador?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  nombreTrabajador?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de inicio debe tener formato ISO válido' },
  )
  fechaInicio?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de fin debe tener formato ISO válido' },
  )
  fechaFin?: string;
}
