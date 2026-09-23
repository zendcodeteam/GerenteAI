import { Inject, Injectable, Logger } from '@nestjs/common';

import { AiQuotaExceededError } from '../core/llm.errors';
import type { LlmResponse } from '../core/llm.types';
import {
  AI_USAGE_REPOSITORY,
  type AiUsageRepository,
  type AiUsageSummary,
  type QuotaReservation,
} from './usage.repository';
import type { AiCallContext } from './usage.repository';
export type { AiCallContext } from './usage.repository';

/**
 * Planes comerciales de Luka AI. Los limites reflejan la pantalla de
 * suscripcion del frontend (mensajes de IA por mes).
 */
export type PlanId =
  'asistente' | 'gerente' | 'director' | 'socio' | 'corporativo';

export interface PlanLimits {
  id: PlanId;
  label: string;
  /** Llamadas al modelo por mes. `Infinity` = sin tope. */
  monthlyAiMessages: number;
  whatsappNumbers: number;
  businesses: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  // Los topes de mensajes los fija el area comercial. El nombre de cada plan
  // sale de `planes.service.ts`, que es el catalogo oficial; aqui solo se
  // define cuanta IA incluye cada uno.
  //
  // `whatsappNumbers` sigue al tope de sedes del catalogo, porque cada sede
  // tiene su propia linea. `businesses` es 1 en todos: el plan se compra POR
  // negocio, asi que quien maneja dos paga dos. Ninguno de los dos autoriza
  // nada hoy; el que se aplica es `monthlyAiMessages`.
  asistente: {
    id: 'asistente',
    label: 'Asistente',
    monthlyAiMessages: 100,
    whatsappNumbers: 1,
    businesses: 1,
  },
  gerente: {
    id: 'gerente',
    label: 'Gerente',
    monthlyAiMessages: 500,
    whatsappNumbers: 1,
    businesses: 1,
  },
  director: {
    id: 'director',
    label: 'Administrador',
    monthlyAiMessages: 1_500,
    whatsappNumbers: 3,
    businesses: 1,
  },
  socio: {
    id: 'socio',
    label: 'Socio',
    monthlyAiMessages: 3_000,
    whatsappNumbers: 5,
    businesses: 1,
  },
  // Plan interno de socios: no se vende y no tiene tope.
  corporativo: {
    id: 'corporativo',
    label: 'Socio',
    monthlyAiMessages: Number.POSITIVE_INFINITY,
    whatsappNumbers: Number.POSITIVE_INFINITY,
    businesses: Number.POSITIVE_INFINITY,
  },
};

export function resolvePlan(plan: string | undefined): PlanLimits {
  const key = (plan ?? '').toLowerCase() as PlanId;
  // Ante un plan vacio o desconocido se cae al MAS restrictivo. Caer a
  // "gerente" regalaba 500 mensajes al mes a cualquiera cuyo plan no se pudiera
  // resolver, incluidos los del plan gratuito.
  return PLAN_LIMITS[key] ?? PLAN_LIMITS.asistente;
}

export interface QuotaStatus {
  plan: PlanLimits;
  used: number;
  limit: number;
  remaining: number;
  periodStart: Date;
  periodEnd: Date;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @Inject(AI_USAGE_REPOSITORY)
    private readonly repository: AiUsageRepository,
  ) {}

  /** Lanza `AiQuotaExceededError` si el tenant agoto su plan del mes. */
  async assertWithinQuota(context: AiCallContext): Promise<QuotaStatus> {
    const status = await this.getQuotaStatus(
      context.tenantId,
      context.plan,
      context.periodo,
    );

    if (status.remaining <= 0) {
      this.logger.warn(
        `Cuota agotada · tenant=${context.tenantId} plan=${status.plan.id} uso=${status.used}/${status.limit}`,
      );
      throw new AiQuotaExceededError(
        status.used,
        status.limit,
        `el plan ${status.plan.label}`,
      );
    }

    return status;
  }

  async getQuotaStatus(
    tenantId: string,
    plan?: string,
    periodo?: { inicio: Date; fin: Date },
  ): Promise<QuotaStatus> {
    const limits = resolvePlan(plan);

    // El mes de calendario es el respaldo, no la regla: cuando el negocio tiene
    // un ciclo de cobro, la cuota se alinea con el. Contarla por mes hacia que
    // quien pagaba el 25 estrenara cuota completa el 1.
    const { start, end } = periodo
      ? { start: periodo.inicio, end: periodo.fin }
      : currentMonthRange();

    const used = await this.repository.countMessages(tenantId, start, end);

    return {
      plan: limits,
      used,
      limit: limits.monthlyAiMessages,
      remaining: Math.max(0, limits.monthlyAiMessages - used),
      periodStart: start,
      periodEnd: end,
    };
  }

  async reserveWhatsAppMessage(
    context: AiCallContext,
    requestId: string,
  ): Promise<QuotaReservation> {
    return this.repository.reserveWhatsAppMessage(context, requestId);
  }

  async releaseWhatsAppMessage(tenantId: string, requestId: string) {
    await this.repository.releaseWhatsAppMessage(tenantId, requestId);
  }

  async recordSuccess(
    context: AiCallContext,
    response: LlmResponse,
  ): Promise<void> {
    await this.repository.record({
      tenantId: context.tenantId,
      businessId: context.businessId,
      feature: context.feature,
      providerId: response.providerId,
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      costUsd: response.costUsd,
      latencyMs: response.latencyMs,
      success: true,
      createdAt: new Date(),
    });
  }

  async recordFailure(
    context: AiCallContext,
    providerId: string,
    model: string,
    errorCode: string,
    latencyMs: number,
  ): Promise<void> {
    // Los fallos se registran para diagnostico pero NO descuentan cuota.
    await this.repository.record({
      tenantId: context.tenantId,
      businessId: context.businessId,
      feature: context.feature,
      providerId,
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs,
      success: false,
      errorCode,
      createdAt: new Date(),
    });
  }

  async summarizeCurrentMonth(
    tenantId: string,
    periodo?: { inicio: Date; fin: Date },
  ): Promise<AiUsageSummary> {
    const { start, end } = periodo
      ? { start: periodo.inicio, end: periodo.fin }
      : currentMonthRange();
    return this.repository.summarize(tenantId, start, end);
  }
}

function currentMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}
