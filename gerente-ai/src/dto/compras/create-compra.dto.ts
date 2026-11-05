import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateDetalleCompraDto } from './create-detalle-compra.dto';

export class CreateCompraDto {
  @IsString()
  @IsNotEmpty()
  sedeId!: string;

  // Opcional: el schema permite Compra sin proveedor y es común comprar
  // en una distribuidora de paso que no está registrada.
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  proveedorId?: string;

  // Si llega, se compara contra el total calculado en el servidor y se rechaza si no cuadra.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  total?: number;

  @IsString()
  @IsOptional()
  fechaVencimiento?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  numeroCuotas?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  @IsOptional()
  interesMensualPorcentaje?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDetalleCompraDto)
  detalles!: CreateDetalleCompraDto[];
}
