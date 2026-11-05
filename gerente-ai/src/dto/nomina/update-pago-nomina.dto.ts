import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePagoNominaDto } from './create-pago-nomina.dto';

export class UpdatePagoNominaDto extends PartialType(
  OmitType(CreatePagoNominaDto, ['sedeId'] as const),
) {}
