import { Module } from '@nestjs/common';
import { EstadisticasPublicasController } from '../controllers/estadisticas-publicas.controller';
import { EstadisticasPublicasService } from '../services/estadisticas-publicas.service';

@Module({
  controllers: [EstadisticasPublicasController],
  providers: [EstadisticasPublicasService],
})
export class EstadisticasPublicasModule {}
