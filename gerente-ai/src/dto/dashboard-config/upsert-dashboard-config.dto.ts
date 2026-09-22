import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertDashboardConfigDto {
  @IsString()
  @MaxLength(80)
  clave!: string;

  @IsObject()
  valor!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sedeId?: string;
}