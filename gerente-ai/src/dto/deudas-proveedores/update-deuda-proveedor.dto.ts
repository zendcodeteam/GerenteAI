import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { ModalidadDeudaProveedor, EstadoDeudaProveedor } from '@prisma/client';

export class UpdateDeudaProveedorDto {
  @IsString()
  @IsOptional()
  proveedorId?: string;

  @IsString()
  @IsOptional()
  suministro?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  @Type(() => Number)
  montoTotal?: number;

  @IsString()
  @IsOptional()
  fechaLimite?: string;

  @IsEnum(ModalidadDeudaProveedor)
  @IsOptional()
  modalidad?: ModalidadDeudaProveedor;

  @ValidateIf(
    (o: UpdateDeudaProveedorDto) =>
      o.modalidad === ModalidadDeudaProveedor.CUOTAS,
  )
  @IsInt()
  @Min(2, { message: 'El número de cuotas debe ser mayor o igual a 2' })
  @IsOptional()
  @Type(() => Number)
  numeroCuotas?: number;

  @IsBoolean()
  @IsOptional()
  aplicaInteres?: boolean;

  @ValidateIf((o: UpdateDeudaProveedorDto) => o.aplicaInteres === true)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  porcentajeInteres?: number;

  @IsEnum(EstadoDeudaProveedor)
  @IsOptional()
  estado?: EstadoDeudaProveedor;
}
