import { IsNumber, Min } from 'class-validator';

export class CreatePagoProveedorDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;
}
