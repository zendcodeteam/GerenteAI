import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProductoDto {
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  nombre!: string;

  @IsString({ message: 'La categoría debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  categoria!: string;

  /**
   * Costo de compra (o precio de compra).
   * Obligatorio si no se provee costoCompra.
   * Debe ser estrictamente numérico > 0.
   */
  @ValidateIf(
    (o: CreateProductoDto) =>
      o.costoCompra === undefined || o.precioCompra !== undefined,
  )
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El costo de compra debe ser un número válido con máximo 2 decimales',
    },
  )
  @IsPositive({ message: 'El costo de compra debe ser mayor a 0' })
  precioCompra!: number;

  /**
   * Alias opcional para costo de compra según la especificación del issue.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El costo de compra debe ser un número válido con máximo 2 decimales',
    },
  )
  @IsPositive({ message: 'El costo de compra debe ser mayor a 0' })
  costoCompra?: number;

  /**
   * Precio de venta.
   * Obligatorio y estrictamente numérico > 0.
   */
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message:
        'El precio de venta debe ser un número válido con máximo 2 decimales',
    },
  )
  @IsPositive({ message: 'El precio de venta debe ser mayor a 0' })
  precioVenta!: number;

  /**
   * Cantidad en inventario (stock). Entero >= 0.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  stock?: number;

  /**
   * Alias de stock para satisfacer la especificación literal 'cantidad'.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(0, { message: 'La cantidad no puede ser negativa' })
  cantidad?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El stock mínimo debe ser un número entero' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  stockMinimo?: number;

  @IsOptional()
  @IsArray({ message: 'Los alias deben ser un arreglo de cadenas' })
  @IsString({ each: true, message: 'Cada alias debe ser una cadena de texto' })
  alias?: string[];

  /**
   * Visto bueno para registrar el producto a pérdida (precio de venta por
   * debajo del costo).
   *
   * NO se guarda en la base: es una decisión del momento de la petición. Está
   * aquí porque el `ValidationPipe` corre con `forbidNonWhitelisted`, así que
   * un campo que no esté declarado hace rebotar la petición entera.
   */
  @IsOptional()
  @IsBoolean({
    message: 'aceptoVenderConPerdida debe ser verdadero o falso',
  })
  aceptoVenderConPerdida?: boolean;

  @IsString({ message: 'La sede es obligatoria' })
  @IsNotEmpty({ message: 'La sede es obligatoria' })
  sedeId!: string;
}
