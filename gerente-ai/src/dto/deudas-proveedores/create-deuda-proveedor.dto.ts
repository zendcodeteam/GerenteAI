import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { ModalidadDeudaProveedor, EstadoDeudaProveedor } from '@prisma/client';

export class CreateDeudaProveedorDto {
  @IsString()
  @IsNotEmpty({ message: 'El proveedor es obligatorio' })
  proveedorId!: string;

  @IsString()
  @IsNotEmpty({ message: 'La sede es obligatoria' })
  sedeId!: string;

  @IsString()
  @IsNotEmpty({ message: 'El suministro es obligatorio' })
  suministro!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'El monto total debe ser mayor a cero' })
  @Type(() => Number)
  montoTotal!: number;

  @IsString()
  @IsNotEmpty({ message: 'La fecha límite es obligatoria' })
  fechaLimite!: string;

  @IsEnum(ModalidadDeudaProveedor, {
    message: 'La modalidad debe ser UNICO o CUOTAS',
  })
  modalidad!: ModalidadDeudaProveedor;

  @ValidateIf(
    (o: CreateDeudaProveedorDto) =>
      o.modalidad === ModalidadDeudaProveedor.CUOTAS,
  )
  @IsInt({ message: 'El número de cuotas debe ser un número entero' })
  @Min(2, { message: 'El número de cuotas debe ser mayor o igual a 2' })
  @IsNotEmpty({
    message:
      'El número de cuotas es obligatorio cuando la modalidad es en cuotas',
  })
  @Type(() => Number)
  numeroCuotas?: number;

  @IsBoolean({ message: 'El campo aplicaInteres debe ser un booleano' })
  aplicaInteres!: boolean;

  @ValidateIf((o: CreateDeudaProveedorDto) => o.aplicaInteres === true)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El porcentaje de interés debe ser un número válido' },
  )
  @Min(0, { message: 'El porcentaje de interés no puede ser negativo' })
  @IsNotEmpty({
    message: 'El porcentaje de interés es obligatorio cuando aplica interés',
  })
  @Type(() => Number)
  porcentajeInteres?: number;

  @IsEnum(EstadoDeudaProveedor, {
    message: 'El estado debe ser PENDIENTE, PAGADA, VENCIDA o CANCELADA',
  })
  @IsOptional()
  estado?: EstadoDeudaProveedor;
}
