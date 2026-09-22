import { Body, Controller, Get, Param, Post, UseFilters } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { LlmExceptionFilter } from '../../ai/filters/llm-exception.filter';
import { LlmService } from '../../ai/services/llm.service';
import { AiUsageService } from '../../ai/usage/usage.service';
import {
  AskAssistantDto,
  WhatsAppMessageDto,
  GenerateInsightsDto,
} from './dto/finance-ai.dto';
import { AssistantService } from './services/assistant.service';
import { InsightsService } from './services/insights.service';
import { WhatsAppMessageService } from './services/whatsapp-message.service';
import { PrismaService } from '../../services/prisma.service';
import { periodoContableActual } from './domain/periodo-contable';

/**
 * API de IA que consume el frontend (y, mas adelante, el webhook de WhatsApp).
 *
 * Ninguna ruta menciona un proveedor: el contrato HTTP es estable aunque
 * debajo se cambie Groq por Anthropic.
 *
 * Pendiente de autenticacion: hoy `tenantId` llega en el cuerpo. Cuando exista
 * JWT debe salir del token y dejar de ser un dato que el cliente elige.
 */
/**
 * 20 llamadas por minuto y por IP.
 *
 * Cada una cuesta dinero (una llamada al modelo) y hoy estas rutas no piden
 * sesion, asi que el limite es lo unico que hay entre un desconocido y la
 * cuota de IA. Nadie las usa mas rapido desde la interfaz.
 */
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('ai')
@UseFilters(LlmExceptionFilter)
export class FinanceAiController {
  constructor(
    private readonly whatsapp: WhatsAppMessageService,
    private readonly insights: InsightsService,
    private readonly assistant: AssistantService,
    private readonly llm: LlmService,
    private readonly usage: AiUsageService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Punto de entrada del chatbot: recibe un mensaje de WhatsApp y devuelve la
   * intencion interpretada, el movimiento creado (si aplica) y el texto de
   * respuesta listo para enviar al usuario.
   */
  @Post('whatsapp/message')
  async handleWhatsAppMessage(@Body() dto: WhatsAppMessageDto) {
    const result = await this.whatsapp.handleMessage({
      tenantId: dto.tenantId ?? 'demo-tenant',
      businessId: dto.businessId,
      message: dto.message,
      businessName: dto.businessName,
      currency: dto.currency,
      plan: dto.plan,
      persist: dto.persist ?? false,
    });

    return { success: true, data: result };
  }

  /** Genera las recomendaciones del panel a partir de los datos del negocio. */
  @Post('insights')
  async generateInsights(@Body() dto: GenerateInsightsDto) {
    const result = await this.insights.generate({
      tenantId: dto.tenantId ?? 'demo-tenant',
      businessId: dto.businessId,
      plan: dto.plan,
      limit: dto.limit,
    });

    return { success: true, data: result };
  }

  /** Pregunta libre sobre las finanzas del negocio. */
  @Post('assistant/ask')
  async ask(@Body() dto: AskAssistantDto) {
    const result = await this.assistant.ask({
      tenantId: dto.tenantId ?? 'demo-tenant',
      businessId: dto.businessId,
      question: dto.question,
      history: dto.history,
      plan: dto.plan,
    });

    return { success: true, data: result };
  }

  /** Que proveedor esta activo y con que capacidades. Util para el panel de admin. */
  @Get('status')
  status() {
    return { success: true, data: this.llm.describe() };
  }

  /** Prueba real contra el proveedor configurado (gasta unos pocos tokens). */
  @Get('health')
  async health() {
    const checks = await this.llm.health();
    return { success: checks.every((check) => check.ok), data: checks };
  }

  /** Consumo y cuota del mes en curso. */
  @Get('usage/:tenantId')
  async usageByTenant(@Param('tenantId') tenantId: string) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { id: tenantId },
      select: { plan: true, planVenceEl: true, diaInicioPeriodo: true },
    });
    const plan = planIdForBusiness(negocio);
    const periodoContable = periodoContableActual(
      negocio?.diaInicioPeriodo ?? 1,
    );
    const periodo = {
      inicio: new Date(`${periodoContable.desde}T00:00:00-05:00`),
      fin: new Date(`${periodoContable.hasta}T23:59:59.999-05:00`),
    };

    const [quota, summary] = await Promise.all([
      this.usage.getQuotaStatus(tenantId, plan, periodo),
      this.usage.summarizeCurrentMonth(tenantId, periodo),
    ]);

    return { success: true, data: { quota, summary } };
  }
}

function planIdForBusiness(negocio: {
  plan?: number;
  planVenceEl?: Date | null;
} | null): string {
  const plan = negocio?.planVenceEl && negocio.planVenceEl <= new Date()
    ? 1
    : negocio?.plan ?? 1;
  return {
    1: 'asistente',
    2: 'gerente',
    3: 'director',
    4: 'socio',
    5: 'corporativo',
  }[plan ?? 1] ?? 'asistente';
}
