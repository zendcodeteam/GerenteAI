import { Module } from '@nestjs/common';

import { FinanceAiModule } from '../finance-ai/finance-ai.module';
import { PlanesModule } from '../planes.module';
import { DestinatariosService } from './services/destinatarios.service';
import { LimitePorRemitenteService } from './services/limite-por-remitente.service';
import { MessageDedupeService } from './services/message-dedupe.service';
import { WhatsappInterpretService } from './services/whatsapp-interpret.service';
import { WhatsappRoutingService } from './services/whatsapp-routing.service';
import { WhatsappController } from './whatsapp.controller';

/**
 * Canal de WhatsApp (Persona 5).
 *
 * Importa `FinanceAiModule` para reutilizar el cerebro que ya existe: aqui no
 * hay ni un prompt ni una llamada al modelo. Este modulo solo traduce entre el
 * mundo de n8n/Meta (telefonos, wamid, texto plano) y el dominio del backend
 * (sedes, movimientos, intenciones).
 *
 * `PlanesModule` aporta `PlanesService`, que traduce el plan del negocio a la
 * cuota de IA que le corresponde (y aplica el vencimiento).
 *
 * `PrismaService` no se importa: `PrismaModule` es @Global.
 */
@Module({
  imports: [FinanceAiModule, PlanesModule],
  controllers: [WhatsappController],
  providers: [
    WhatsappInterpretService,
    WhatsappRoutingService,
    MessageDedupeService,
    LimitePorRemitenteService,
    DestinatariosService,
  ],
  exports: [
    WhatsappInterpretService,
    WhatsappRoutingService,
    DestinatariosService,
  ],
})
export class WhatsappModule {}
