import { Injectable } from '@nestjs/common';

import type {
  AiCallContext,
  AiUsageRecord,
  AiUsageRepository,
  AiUsageSummary,
} from './usage.repository';

/**
 * Implementacion en memoria del registro de consumo.
 *
 * Suficiente para desarrollo y pruebas. Al conectar Postgres basta con crear
 * `PrismaAiUsageRepository` y cambiar el proveedor en `AiModule`.
 *
 * Advertencia: los datos se pierden al reiniciar el proceso y no se comparten
 * entre instancias. No usar en produccion para facturar.
 */
@Injectable()
export class InMemoryAiUsageRepository implements AiUsageRepository {
  private readonly entries = new Map<string, AiUsageRecord[]>();
  /** Tope por tenant para que un proceso largo no consuma memoria sin limite. */
  private readonly maxEntriesPerTenant = 5_000;

  async reserveWhatsAppMessage(context: AiCallContext, requestId: string) {
    const entries = this.entries.get(context.tenantId) ?? [];
    const existing = entries.some((entry) => entry.solicitudId === requestId);
    const limit = ({ asistente: 100, gerente: 500, director: 1500, socio: 3000, corporativo: Infinity } as Record<string, number>)[context.plan ?? 'asistente'] ?? 100;
    const used = entries.filter((entry) => entry.success && entry.feature !== 'whatsapp.internal').length;
    if (!existing && used >= limit) throw new Error('quota_exceeded');
    if (!existing) {
      await this.record({
        tenantId: context.tenantId,
        businessId: context.businessId,
        feature: 'whatsapp.request',
        solicitudId: requestId,
        providerId: 'whatsapp-request',
        model: 'reserved',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        success: true,
        createdAt: new Date(),
      });
    }
    return { used: existing ? used : used + 1, limit, remaining: Math.max(0, limit - (existing ? used : used + 1)) };
  }

  async releaseWhatsAppMessage(tenantId: string, requestId: string) {
    const entries = this.entries.get(tenantId) ?? [];
    this.entries.set(tenantId, entries.filter((entry) => entry.solicitudId !== requestId));
  }

  record(entry: AiUsageRecord): Promise<void> {
    const list = this.entries.get(entry.tenantId) ?? [];
    list.push(entry);

    if (list.length > this.maxEntriesPerTenant) {
      list.splice(0, list.length - this.maxEntriesPerTenant);
    }

    this.entries.set(entry.tenantId, list);
    return Promise.resolve();
  }

  countMessages(tenantId: string, from: Date, to: Date): Promise<number> {
    return Promise.resolve(
      this.inRange(tenantId, from, to).filter((entry) => entry.success && entry.feature !== 'whatsapp.internal').length,
    );
  }

  summarize(tenantId: string, from: Date, to: Date): Promise<AiUsageSummary> {
    const records = this.inRange(tenantId, from, to).filter(
      (entry) => entry.success,
    );

    const summary: AiUsageSummary = {
      tenantId,
      from,
      to,
      messages: records.filter((entry) => entry.feature !== 'whatsapp.internal').length,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      byProvider: {},
    };

    for (const record of records) {
      summary.inputTokens += record.inputTokens;
      summary.outputTokens += record.outputTokens;
      summary.costUsd += record.costUsd;
      summary.byProvider[record.providerId] =
        (summary.byProvider[record.providerId] ?? 0) + 1;
    }

    summary.costUsd = Number(summary.costUsd.toFixed(6));
    return Promise.resolve(summary);
  }

  private inRange(tenantId: string, from: Date, to: Date): AiUsageRecord[] {
    return (this.entries.get(tenantId) ?? []).filter(
      (entry) => entry.createdAt >= from && entry.createdAt <= to,
    );
  }
}
