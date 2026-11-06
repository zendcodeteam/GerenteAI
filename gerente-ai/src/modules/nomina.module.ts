import { Module } from '@nestjs/common';
import { NominaController } from '../controllers/nomina.controller';
import { NominaService } from '../services/nomina.service';
import { NegociosModule } from './negocios.module';

@Module({
  imports: [NegociosModule],
  controllers: [NominaController],
  providers: [NominaService],
  exports: [NominaService],
})
export class NominaModule {}
