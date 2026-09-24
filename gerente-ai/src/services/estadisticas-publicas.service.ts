import { Injectable } from '@nestjs/common';
import { EstadoPago } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { PLANES } from './planes.service';

const MESES_HISTORIAL = 6;
const DIA_MS = 86_400_000;

const NOMBRES_MES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

interface BucketMensual {
  anio: number;
  mes: number;
  etiqueta: string;
  valor: number;
}

/**
 * Estadísticas agregadas de toda la plataforma, para la página pública de
 * inversores (`/investors`).
 *
 * Todo lo que devuelve sale de conteos y sumas reales sobre la base de datos:
 * nada se inventa. No se expone ningún dato identificable de un negocio, un
 * usuario o un cliente concreto (ni nombres, ni teléfonos, ni ids reales) —
 * solo números agregados y una bitácora de eventos anónima.
 */
@Injectable()
export class EstadisticasPublicasService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const ahora = new Date();
    const hace30Dias = new Date(ahora.getTime() - 30 * DIA_MS);
    const inicioHistorial = this.inicioDeMes(ahora, MESES_HISTORIAL - 1);

    const [
      usuariosTotal,
      negociosTotal,
      mensajesTotal,
      ventasTotal,
      gastosTotal,
      interaccionesIaTotal,
      recordatoriosFiadosTotal,
      reportesTotal,
      pagosAprobadosPorNegocio,
      sedesActivasPorNegocio,
      negociosPorPlan,
      negociosConPlanVigentePago,
      usuariosAntes,
      negociosAntes,
      usuariosRecientes,
      negociosRecientes,
      pagosRecientes,
      ultimosNegocios,
      ultimosPagos,
      ultimosUsuarios,
    ] = await Promise.all([
      this.prisma.usuario.count(),
      this.prisma.negocio.count(),
      this.prisma.mensaje.count(),
      this.prisma.venta.count(),
      this.prisma.gasto.count(),
      this.prisma.consumoIa.count({ where: { exitosa: true } }),
      this.prisma.recordatorioFiado.count(),
      this.prisma.reporte.count(),

      this.prisma.pago.findMany({
        where: { estado: EstadoPago.APROBADO },
        select: { negocioId: true },
        distinct: ['negocioId'],
      }),

      this.prisma.sede.findMany({
        where: { mensajes: { some: { fecha: { gte: hace30Dias } } } },
        select: { negocioId: true },
        distinct: ['negocioId'],
      }),

      this.prisma.negocio.groupBy({
        by: ['plan'],
        _count: { _all: true },
      }),

      this.prisma.negocio.findMany({
        where: {
          plan: { gt: 1 },
          OR: [{ planVenceEl: null }, { planVenceEl: { gt: ahora } }],
        },
        select: { plan: true },
      }),

      this.prisma.usuario.count({
        where: { createdAt: { lt: inicioHistorial } },
      }),

      this.prisma.negocio.count({
        where: { createdAt: { lt: inicioHistorial } },
      }),

      this.prisma.usuario.findMany({
        where: { createdAt: { gte: inicioHistorial } },
        select: { createdAt: true },
      }),

      this.prisma.negocio.findMany({
        where: { createdAt: { gte: inicioHistorial } },
        select: { createdAt: true },
      }),

      this.prisma.pago.findMany({
        where: {
          estado: EstadoPago.APROBADO,
          procesadoEl: { gte: inicioHistorial },
        },
        select: { procesadoEl: true, montoEnCentavos: true },
      }),

      this.prisma.negocio.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { createdAt: true },
      }),

      this.prisma.pago.findMany({
        where: { estado: EstadoPago.APROBADO },
        orderBy: { procesadoEl: 'desc' },
        take: 4,
        select: { plan: true, procesadoEl: true },
      }),

      this.prisma.usuario.findMany({
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { createdAt: true },
      }),
    ]);

    const mrrEstimado = negociosConPlanVigentePago.reduce(
      (total, negocio) => total + (PLANES[negocio.plan]?.precioMensual ?? 0),
      0,
    );

    const negociosQuePagaronAlgunaVez = pagosAprobadosPorNegocio.length;

    const tasaRetencionPagos =
      negociosQuePagaronAlgunaVez > 0
        ? Math.round(
            (negociosConPlanVigentePago.length / negociosQuePagaronAlgunaVez) *
              1000,
          ) / 10
        : 0;

    const distribucionPorPlan = negociosPorPlan
      .slice()
      .sort((a, b) => a.plan - b.plan)
      .map((grupo) => ({
        plan: PLANES[grupo.plan]?.nombre ?? `Plan ${grupo.plan}`,
        total: grupo._count._all,
      }));

    const eventos = [
      ...ultimosNegocios.map((negocio) => ({
        tipo: 'negocio' as const,
        titulo: 'Nuevo negocio registrado',
        descripcion: 'Un nuevo negocio se unió a Luka.',
        fecha: negocio.createdAt,
      })),
      ...ultimosPagos
        .filter((pago) => pago.procesadoEl !== null)
        .map((pago) => ({
          tipo: 'pago' as const,
          titulo: 'Nueva suscripción activada',
          descripcion: `Un negocio activó el plan ${PLANES[pago.plan]?.nombre ?? 'de pago'}.`,
          fecha: pago.procesadoEl as Date,
        })),
      ...ultimosUsuarios.map((usuario) => ({
        tipo: 'usuario' as const,
        titulo: 'Nuevo usuario registrado',
        descripcion: 'Un nuevo usuario creó su cuenta en Luka.',
        fecha: usuario.createdAt,
      })),
    ]
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .slice(0, 6)
      .map((evento) => ({ ...evento, fecha: evento.fecha.toISOString() }));

    return {
      generadoEl: ahora.toISOString(),

      usuarios: {
        total: usuariosTotal,
      },

      negocios: {
        total: negociosTotal,
        activosUltimos30Dias: sedesActivasPorNegocio.length,
        conPlanPagoVigente: negociosConPlanVigentePago.length,
      },

      monetizacion: {
        mrrEstimado,
        negociosQuePagaronAlgunaVez,
        tasaRetencionPagos,
        distribucionPorPlan,
      },

      actividadPlataforma: {
        mensajesWhatsapp: mensajesTotal,
        ventasRegistradas: ventasTotal,
        gastosRegistrados: gastosTotal,
        interaccionesIa: interaccionesIaTotal,
        recordatoriosFiadosEnviados: recordatoriosFiadosTotal,
        reportesGenerados: reportesTotal,
      },

      crecimiento: {
        usuarios: this.serieAcumulada(
          usuariosRecientes.map((u) => u.createdAt),
          usuariosAntes,
          ahora,
        ).map(({ etiqueta, valor }) => ({ mes: etiqueta, total: valor })),

        negocios: this.serieAcumulada(
          negociosRecientes.map((n) => n.createdAt),
          negociosAntes,
          ahora,
        ).map(({ etiqueta, valor }) => ({ mes: etiqueta, total: valor })),

        ingresosMensuales: this.serieMensualSumada(
          pagosRecientes.map((p) => ({
            fecha: p.procesadoEl as Date,
            monto: p.montoEnCentavos / 100,
          })),
          ahora,
        ).map(({ etiqueta, valor }) => ({ mes: etiqueta, ingresos: valor })),
      },

      actividadReciente: eventos,
    };
  }

  private inicioDeMes(referencia: Date, mesesAtras: number): Date {
    return new Date(
      referencia.getFullYear(),
      referencia.getMonth() - mesesAtras,
      1,
    );
  }

  private bucketsVacios(ahora: Date): BucketMensual[] {
    const buckets: BucketMensual[] = [];

    for (let i = MESES_HISTORIAL - 1; i >= 0; i--) {
      const referencia = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);

      buckets.push({
        anio: referencia.getFullYear(),
        mes: referencia.getMonth(),
        etiqueta: NOMBRES_MES[referencia.getMonth()],
        valor: 0,
      });
    }

    return buckets;
  }

  /** Total acumulado (usuarios o negocios) al cierre de cada uno de los últimos meses. */
  private serieAcumulada(
    fechas: Date[],
    lineaBase: number,
    ahora: Date,
  ): BucketMensual[] {
    const buckets = this.bucketsVacios(ahora);

    for (const fecha of fechas) {
      const bucket = buckets.find(
        (b) => b.anio === fecha.getFullYear() && b.mes === fecha.getMonth(),
      );

      if (bucket) {
        bucket.valor += 1;
      }
    }

    let acumulado = lineaBase;

    return buckets.map((bucket) => {
      acumulado += bucket.valor;
      return { ...bucket, valor: acumulado };
    });
  }

  /** Suma mensual (ingresos aprobados), sin acumular entre meses. */
  private serieMensualSumada(
    registros: { fecha: Date; monto: number }[],
    ahora: Date,
  ): BucketMensual[] {
    const buckets = this.bucketsVacios(ahora);

    for (const registro of registros) {
      const bucket = buckets.find(
        (b) =>
          b.anio === registro.fecha.getFullYear() &&
          b.mes === registro.fecha.getMonth(),
      );

      if (bucket) {
        bucket.valor += registro.monto;
      }
    }

    return buckets;
  }
}
