import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../services/prisma.service';
import {
  fechaColombiana,
  finDelDia,
  inicioDelDia,
} from '../../finance-ai/domain/dia-colombia';
import { maskPhone } from './whatsapp-routing.service';

/**
 * Quien puede recibir un mensaje del bot, y por que numero.
 *
 * ---------------------------------------------------------------------------
 * POR QUE EXISTE ESTE SERVICIO
 *
 * "Quien es un contacto" estaba definido en dos sitios que no coincidian:
 *
 *   - `WhatsappRoutingService` (entrada): resuelve a quien ESCRIBE. Acepta la
 *     linea de la sede, el BSUID y ademas el telefono personal de un socio o
 *     empleado (`Usuario.telefono`).
 *   - El SQL del workflow de n8n (salida): solo miraba `Sede.telefono` y
 *     `Sede.whatsappUserId`.
 *
 * Resultado: quien usaba el bot desde su numero personal, con la sede sin linea
 * propia, escribia sin problema pero nunca recibia el recordatorio nocturno.
 * Es exactamente el sintoma reportado: "a algunos contactos no les llega".
 *
 * La definicion vive ahora aqui, una sola vez, y n8n la consulta en vez de
 * mantener su propia consulta SQL.
 * ---------------------------------------------------------------------------
 */

export interface Destinatario {
  sedeId: string;
  sede: string;
  negocio: string;
  /** Telefono en digitos o BSUID: lo que Meta necesita para escribirle. */
  destinatario: string;
  /** Primer nombre de la persona, para saludarla. */
  contacto: string;
  /** Como se resolvio, util para depurar por que alguien recibe o no. */
  via: 'sede_telefono' | 'sede_identidad' | 'usuario_telefono';
}

export interface ResumenNocturno extends Destinatario {
  ingresos: number;
  gastos: number;
  balance: number;
  movimientos: number;
}

@Injectable()
export class DestinatariosService {
  private readonly logger = new Logger(DestinatariosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sedes que hoy no registraron ningun movimiento.
   *
   * Es la lista del recordatorio de las 9 p.m.: se le escribe a quien no anoto
   * nada para que no pierda el dia.
   */
  async sedesSinMovimientosHoy(ahora = new Date()): Promise<Destinatario[]> {
    const hoy = fechaColombiana(ahora);
    const desde = inicioDelDia(hoy);
    const hasta = finDelDia(hoy);

    const alcanzables = await this.sedesAlcanzables();
    if (alcanzables.length === 0) return [];

    const conMovimiento = await this.sedesConMovimientoEntre(desde, hasta);

    const pendientes = alcanzables.filter(
      (destino) => !conMovimiento.has(destino.sedeId),
    );

    this.logger.log(
      `Recordatorio nocturno: ${pendientes.length} de ${alcanzables.length} sedes alcanzables no registraron nada hoy (${hoy}).`,
    );

    return pendientes;
  }

  /** Sedes con actividad financiera para recibir el resumen de las 21:00. */
  async resumenesConMovimientosHoy(
    ahora = new Date(),
  ): Promise<ResumenNocturno[]> {
    const hoy = fechaColombiana(ahora);
    const rango = { gte: inicioDelDia(hoy), lte: finDelDia(hoy) };
    const alcanzables = await this.sedesAlcanzables();
    const ids = alcanzables.map((destino) => destino.sedeId);
    if (ids.length === 0) return [];

    const [gastos, compras, ventas, abonos] = await Promise.all([
      this.prisma.gasto.findMany({ where: { sedeId: { in: ids }, fecha: rango }, select: { sedeId: true, monto: true } }),
      this.prisma.compra.findMany({ where: { sedeId: { in: ids }, fecha: rango }, select: { sedeId: true, total: true } }),
      this.prisma.venta.findMany({ where: { sedeId: { in: ids }, fecha: rango }, select: { sedeId: true, total: true, tipo: true } }),
      this.prisma.abono.findMany({ where: { sedeId: { in: ids }, fecha: rango }, select: { sedeId: true, monto: true } }),
    ]);

    const totals = new Map<string, { ingresos: number; gastos: number; movimientos: number }>();
    const add = (sedeId: string, field: 'ingresos' | 'gastos', amount: number) => {
      const current = totals.get(sedeId) ?? { ingresos: 0, gastos: 0, movimientos: 0 };
      current[field] += amount;
      current.movimientos += 1;
      totals.set(sedeId, current);
    };

    for (const venta of ventas) {
      if (venta.tipo === 'FIADO') {
        const current = totals.get(venta.sedeId) ?? { ingresos: 0, gastos: 0, movimientos: 0 };
        current.movimientos += 1;
        totals.set(venta.sedeId, current);
      } else add(venta.sedeId, 'ingresos', Number(venta.total));
    }
    for (const abono of abonos) add(abono.sedeId, 'ingresos', Number(abono.monto));
    for (const gasto of gastos) add(gasto.sedeId, 'gastos', Number(gasto.monto));
    for (const compra of compras) add(compra.sedeId, 'gastos', Number(compra.total));

    return alcanzables
      .filter((destino) => (totals.get(destino.sedeId)?.movimientos ?? 0) > 0)
      .map((destino) => {
        const total = totals.get(destino.sedeId)!;
        return { ...destino, ...total, balance: total.ingresos - total.gastos };
      });
  }

  // ----------------------------------------------------------------- interno

  /**
   * Todas las sedes a las que el bot puede escribirle, con la misma definicion
   * que usa el enrutamiento de entrada.
   *
   * Prioridad: la linea propia de la sede, luego su identidad de WhatsApp, y
   * como ultimo recurso el telefono personal de alguien del negocio. Ese
   * ultimo caso es el que faltaba y por el que no llegaban los recordatorios.
   */
  private async sedesAlcanzables(): Promise<Destinatario[]> {
    const sedes = await this.prisma.sede.findMany({
      include: {
        negocio: {
          include: {
            usuariosNegocio: {
              orderBy: { id: 'asc' },
              include: { usuario: true },
            },
          },
        },
        usuariosSede: {
          orderBy: { id: 'asc' },
          include: { usuario: true },
        },
      },
    });

    const destinos: Destinatario[] = [];

    for (const sede of sedes) {
      const personas = [
        ...sede.usuariosSede.map((vinculo) => vinculo.usuario),
        ...sede.negocio.usuariosNegocio.map((vinculo) => vinculo.usuario),
      ];

      const contacto = primerNombre(personas[0]?.nombre);

      const base = {
        sedeId: sede.id,
        sede: sede.nombre,
        negocio: sede.negocio.nombre,
        contacto,
      };

      if (sede.telefono?.trim()) {
        destinos.push({
          ...base,
          destinatario: soloDigitos(sede.telefono),
          via: 'sede_telefono',
        });
        continue;
      }

      if (sede.whatsappUserId) {
        destinos.push({
          ...base,
          destinatario: sede.whatsappUserId,
          via: 'sede_identidad',
        });
        continue;
      }

      // La sede no tiene linea propia: se le escribe a la primera persona del
      // negocio que tenga telefono. Antes este caso quedaba fuera.
      const conTelefono = personas.find((persona) => persona.telefono?.trim());

      if (conTelefono?.telefono) {
        destinos.push({
          ...base,
          destinatario: soloDigitos(conTelefono.telefono),
          via: 'usuario_telefono',
        });
        continue;
      }

      this.logger.warn(
        `La sede "${sede.nombre}" (${sede.id}) no tiene ningun contacto alcanzable.`,
      );
    }

    // Un numero sin indicativo se acepta en el envio y nunca llega: se avisa
    // para que alguien corrija el dato en vez de perseguir un fantasma.
    for (const destino of destinos) {
      if (
        destino.via !== 'sede_identidad' &&
        destino.destinatario.length < 11
      ) {
        this.logger.warn(
          `La sede "${destino.sede}" tiene el telefono sin codigo de pais: ${maskPhone(destino.destinatario)}. Corregirlo o el mensaje no llegara.`,
        );
      }
    }

    return destinos;
  }

  /** Sedes con al menos un movimiento en el rango, mirando todas las tablas. */
  private async sedesConMovimientoEntre(
    desde: Date,
    hasta: Date,
  ): Promise<Set<string>> {
    const rango = { gte: desde, lte: hasta };

    const [gastos, ventas, compras, abonos] = await Promise.all([
      this.prisma.gasto.findMany({
        where: { fecha: rango },
        select: { sedeId: true },
        distinct: ['sedeId'],
      }),
      this.prisma.venta.findMany({
        where: { fecha: rango },
        select: { sedeId: true },
        distinct: ['sedeId'],
      }),
      this.prisma.compra.findMany({
        where: { fecha: rango },
        select: { sedeId: true },
        distinct: ['sedeId'],
      }),
      this.prisma.abono.findMany({
        where: { fecha: rango },
        select: { sedeId: true },
        distinct: ['sedeId'],
      }),
    ]);

    return new Set(
      [...gastos, ...ventas, ...compras, ...abonos].map(
        (fila) => fila.sedeId,
      ),
    );
  }
}

// ------------------------------------------------------------------- helpers

/** Meta exige el numero en digitos, sin espacios ni signos. */
function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function primerNombre(nombre: string | undefined): string {
  return nombre?.trim().split(' ')[0] || 'por aquí';
}