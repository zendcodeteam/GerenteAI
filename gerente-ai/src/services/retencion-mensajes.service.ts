import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';

export interface ResumenPurgaMensajes {
  eliminados: number;
  fechaLimite: Date;
  mesesRetencion: number;
}

@Injectable()
export class RetencionMensajesService {
  private readonly logger = new Logger(RetencionMensajesService.name);

  /**
   * Plazo por defecto de conservación de mensajes en base de datos (12 meses).
   * Configurable por variable de entorno `RETENCION_MENSAJES_MESES`.
   */
  readonly mesesRetencionPorDefecto: number;

  constructor(private readonly prisma: PrismaService) {
    const envMeses = parseInt(process.env.RETENCION_MENSAJES_MESES || '12', 10);
    this.mesesRetencionPorDefecto =
      !isNaN(envMeses) && envMeses > 0 ? envMeses : 12;
  }

  /**
   * Calcula la fecha de corte anterior a la cual los mensajes deben ser eliminados.
   */
  calcularFechaLimite(
    meses: number = this.mesesRetencionPorDefecto,
    ahora: Date = new Date(),
  ): Date {
    const fechaLimite = new Date(ahora.getTime());
    fechaLimite.setMonth(fechaLimite.getMonth() - meses);
    return fechaLimite;
  }

  /**
   * Tarea programada (Cron).
   * Se ejecuta automáticamente todos los días a las 3:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async porCron() {
    try {
      const resumen = await this.purgarMensajes();
      if (resumen.eliminados > 0) {
        this.logger.log(
          `[CRON] Purga de retención completada: ${resumen.eliminados} mensajes eliminados (corte: ${resumen.fechaLimite.toISOString()})`,
        );
      }
    } catch (error) {
      this.logger.error(
        '[CRON] Error al ejecutar la purga automática de mensajes',
        error,
      );
    }
  }

  /**
   * Ejecuta la eliminación física de mensajes que superen el plazo de retención.
   *
   * @param meses Número opcional de meses de antigüedad (por defecto 12).
   * @param ahora Fecha de referencia para pruebas o ejecuciones programadas.
   */
  async purgarMensajes(
    meses: number = this.mesesRetencionPorDefecto,
    ahora: Date = new Date(),
  ): Promise<ResumenPurgaMensajes> {
    const fechaLimite = this.calcularFechaLimite(meses, ahora);

    const resultado = await this.prisma.mensaje.deleteMany({
      where: {
        fecha: {
          lt: fechaLimite,
        },
      },
    });

    this.logger.log(
      `Purga de retención ejecutada: ${resultado.count} mensajes eliminados anteriores a ${fechaLimite.toISOString()} (${meses} meses de retención)`,
    );

    return {
      eliminados: resultado.count,
      fechaLimite,
      mesesRetencion: meses,
    };
  }
}
