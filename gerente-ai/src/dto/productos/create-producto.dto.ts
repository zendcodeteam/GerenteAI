import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stockMinimo?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioCompra!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioVenta!: number;

  @IsString()
  @IsNotEmpty()

  @IsString()
  @IsOptional()
  categoria?: string;

  @IsString({ each: true })
  @IsOptional()
  alias?: string[];
  sedeId!: string;
}