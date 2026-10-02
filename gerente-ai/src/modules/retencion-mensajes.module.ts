import { Module } from '@nestjs/common';
import { RetencionMensajesController } from '../controllers/retencion-mensajes.controller';
import { RetencionMensajesService } from '../services/retencion-mensajes.service';

@Module({
  controllers: [RetencionMensajesController],
  providers: [RetencionMensajesService],
  exports: [RetencionMensajesService],
})
export class RetencionMensajesModule {}
