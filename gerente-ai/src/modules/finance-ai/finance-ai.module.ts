import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InMemoryFinanceDataAdapter } from './adapters/in-memory-finance-data.adapter';
import { PrismaFinanceDataAdapter } from './adapters/prisma-finance-data.adapter';
import { FinanceAiController } from './finance-ai.controller';
import {
  FINANCE_DATA_PORT,
  type FinanceDataPort,
} from './ports/finance-data.port';
import { AssistantService } from './services/assistant.service';
import { ConversationStateService } from './services/conversation-state.service';
import { InsightsService } from './services/insights.service';
import { WhatsAppMessageService } from './services/whatsapp-message.service';
import { NegociosModule } from '../negocios.module';

/**
 * Casos de uso de IA sobre las finanzas del negocio.
 *
 * Depende de `LlmService` (que expone `AiModule`, marcado como global) y del
 * puerto de datos.
 *
 * FINANCE_DATA_SOURCE decide de donde salen los numeros:
 *   prisma  (por defecto) → PostgreSQL real. Es lo que debe correr en produccion
 *                           y lo que hace que el bot de WhatsApp guarde de verdad.
 *   memory                → datos de demostracion, sin base de datos. Util para
 *                           levantar el frontend o hacer demos sin infraestructura.
 */
@Module({
  imports: [NegociosModule],
  controllers: [FinanceAiController],
  providers: [
    PrismaFinanceDataAdapter,
    InMemoryFinanceDataAdapter,
    {
      provide: FINANCE_DATA_PORT,
      inject: [
        ConfigService,
        PrismaFinanceDataAdapter,
        InMemoryFinanceDataAdapter,
      ],
      useFactory: (
        config: ConfigService,
        prismaAdapter: PrismaFinanceDataAdapter,
        memoryAdapter: InMemoryFinanceDataAdapter,
      ): FinanceDataPort => {
        const source = (
          config.get<string>('FINANCE_DATA_SOURCE') ?? 'prisma'
        ).toLowerCase();

        if (source === 'memory') {
          new Logger('FinanceAiModule').warn(
            'FINANCE_DATA_SOURCE=memory: la IA usa datos de demostracion y NO guarda nada en PostgreSQL.',
          );
          return memoryAdapter;
        }

        return prismaAdapter;
      },
    },
    ConversationStateService,
    WhatsAppMessageService,
    InsightsService,
    AssistantService,
  ],
  exports: [
    WhatsAppMessageService,
    InsightsService,
    AssistantService,
    FINANCE_DATA_PORT,
  ],
})
export class FinanceAiModule {}
