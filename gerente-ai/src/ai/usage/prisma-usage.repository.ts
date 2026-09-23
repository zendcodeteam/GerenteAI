import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../services/prisma.service';
import type {
  AiCallContext,
  AiUsageRecord,
  AiUsageRepository,
  AiUsageSummary,
} from './usage.repository';

/**
 * Registro de consumo de IA sobre Postgres.
 *
 * Sustituye a la version en memoria, que se reiniciaba con el proceso. Eso hacia
 * que los topes por plan no se aplicaran de verdad: bastaba con un despliegue
 * —o con que Render durmiera el servicio— para que la cuota volviera a cero. Y
 * con los planes actuales, la cuota de mensajes es de lo poco que diferencia un
 * plan de pago de otro, asi que no era un detalle.
 *
 * De paso queda historico, que antes no existia en ninguna parte: cuanto
 * consumio cada negocio, con que proveedor y a que coste.
 */
@Injectable()
export class PrismaAiUsageRepository implements AiUsageRepository {
  private readonly logger = new Logger(PrismaAiUsageRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Un fallo al registrar no puede tumbar la llamada que ya se hizo.
   *
   * El modelo ya respondio y el usuario espera su respuesta; perder una fila de
   * contabilidad es mucho menos grave que devolver un error por ella. Queda en
   * el log, que es donde hay que mirar si las cuentas no cuadran.
   */
  async record(entry: AiUsageRecord): Promise<void> {
    try {
      await this.prisma.consumoIa.create({
        data: {
          negocioId: entry.tenantId,
          sedeId: entry.businessId ?? null,
          feature: entry.feature,
          solicitudId: entry.solicitudId ?? null,
          providerId: entry.providerId,
          model: entry.model,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          costoUsd: new Prisma.Decimal(entry.costUsd),
          latenciaMs: entry.latencyMs,
          exitosa: entry.success,
          errorCode: entry.errorCode ?? null,
          createdAt: entry.createdAt,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el consumo de IA del negocio ${entry.tenantId}`,
        error,
      );
    }
  }

  /**
   * Llamadas que cuentan contra la cuota.
   *
   * Solo las exitosas: si al cliente no le llego respuesta, no se le descuenta.
   * Las fallidas se guardan igual, para poder diagnosticar despues.
   */
  countMessages(tenantId: string, from: Date, to: Date): Promise<number> {
    return this.prisma.consumoIa.count({
      where: {
        negocioId: tenantId,
        exitosa: true,
        feature: { not: 'whatsapp.internal' },
        createdAt: { gte: from, lte: to },
      },
    });
  }

  async reserveWhatsAppMessage(context: AiCallContext, requestId: string) {
    const limit = ({ asistente: 100, gerente: 500, director: 1500, socio: 3000, corporativo: Infinity } as Record<string, number>)[context.plan ?? 'asistente'] ?? 100;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const used = await tx.consumoIa.count({
          where: {
            negocioId: context.tenantId,
            exitosa: true,
            feature: { not: 'whatsapp.internal' },
            createdAt: context.periodo ? { gte: context.periodo.inicio, lte: context.periodo.fin } : undefined,
          },
        });
        if (used >= limit) throw new Error('quota_exceeded');
        return tx.consumoIa.create({
          data: {
            negocioId: context.tenantId,
            sedeId: context.businessId ?? null,
            feature: 'whatsapp.request',
            solicitudId: requestId,
            providerId: 'whatsapp-request',
            model: 'reserved',
            inputTokens: 0,
            outputTokens: 0,
            costoUsd: new Prisma.Decimal(0),
            latenciaMs: 0,
            exitosa: true,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { used: 1, limit, remaining: Math.max(0, limit - Number(Boolean(created))) };
    } catch (error) {
      if (error instanceof Error && error.message === 'quota_exceeded') throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { used: 0, limit, remaining: limit };
      }
      throw error;
    }
  }

  async releaseWhatsAppMessage(tenantId: string, requestId: string) {
    await this.prisma.consumoIa.deleteMany({ where: { negocioId: tenantId, solicitudId: requestId } });
  }

  async summarize(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<AiUsageSummary> {
    const where: Prisma.ConsumoIaWhereInput = {
      negocioId: tenantId,
      exitosa: true,
      createdAt: { gte: from, lte: to },
    };

    // Los totales los suma Postgres y el desglose por proveedor sale de un
    // groupBy: traer las filas y sumarlas en memoria no escala, y esta tabla
    // crece con cada mensaje de WhatsApp.
    const [totales, porProveedor, internos] = await Promise.all([
      this.prisma.consumoIa.aggregate({
        where,
        _count: true,
        _sum: { inputTokens: true, outputTokens: true, costoUsd: true },
      }),
      this.prisma.consumoIa.groupBy({
        by: ['providerId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.consumoIa.count({
        where: { ...where, feature: 'whatsapp.internal' },
      }),
    ]);

    return {
      tenantId,
      from,
      to,
      messages: totales._count - internos,
      inputTokens: totales._sum.inputTokens ?? 0,
      outputTokens: totales._sum.outputTokens ?? 0,
      // Se redondea a 6 decimales igual que la version en memoria: es la
      // precision de la columna, y sumar decimales sin acotar arrastra ruido.
      costUsd: Number(
        (totales._sum.costoUsd ?? new Prisma.Decimal(0)).toFixed(6),
      ),
      byProvider: Object.fromEntries(
        porProveedor.map((fila) => [fila.providerId, fila._count._all]),
      ),
    };
  }
}
