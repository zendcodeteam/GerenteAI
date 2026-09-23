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

/** Un fiado que lleva dias sin cobrarse. */
export interface FiadoPorCobrar extends Destinatario {
  ventaId: string;
  cliente: string;
  saldo: number;
  /** Dias transcurridos desde que se registro el fiado. */
  diasTranscurridos: number;
  fecha: string;
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

  /**
   * Fiados que llevan `diasLimite` dias sin cobrarse y de los que todavia no se
   * ha avisado.
   *
   * El aviso se marca como enviado al servirlo, no despues: si se marcara al
   * final, dos ejecuciones simultaneas mandarian el mismo recordatorio dos
   * veces. Se prefiere el riesgo de perder uno al de repetirlo cada dia.
   */
  async fiadosPorCobrar(
    diasLimite: number,
    ahora = new Date(),
  ): Promise<FiadoPorCobrar[]> {
    const limite = new Date(ahora.getTime() - diasLimite * 86_400_000);

    const ventas = await this.prisma.venta.findMany({
      where: {
        tipo: 'FIADO',
        // Si ya lo pagaron, `saldoPendiente` quedo en 0 y no hay nada que cobrar.
        saldoPendiente: { gt: 0 },
        fecha: { lte: limite },

        // RecordatorioFiado es una relacion opcional singular, no una lista.
        // Por eso se busca que no exista un recordatorio asociado.
        recordatorios: { is: null },
      },
      include: {
        sede: { include: { negocio: true } },
      },
      orderBy: { fecha: 'asc' },
      take: 200,
    });

    const alcanzables = new Map(
      (await this.sedesAlcanzables()).map((destino) => [
        destino.sedeId,
        destino,
      ]),
    );

    const pendientes: FiadoPorCobrar[] = [];

    for (const venta of ventas) {
      const destino = alcanzables.get(venta.sedeId);

      if (!destino) {
        // Sin forma de escribirle al duenno, avisar es imposible. No se marca
        // como enviado para que se recupere cuando registre su linea.
        this.logger.warn(
          `Fiado ${venta.id} sin destinatario alcanzable en la sede ${venta.sedeId}.`,
        );
        continue;
      }

      let cliente = 'un cliente';

      if (venta.clienteId) {
        const clienteEncontrado = await this.prisma.cliente.findUnique({
          where: { id: venta.clienteId },
          select: { nombre: true },
        });

        cliente = clienteEncontrado?.nombre ?? 'un cliente';
      }

      pendientes.push({
        ...destino,
        ventaId: venta.id,
        cliente,
        saldo: Number(venta.saldoPendiente),
        diasTranscurridos: Math.floor(
          (ahora.getTime() - venta.fecha.getTime()) / 86_400_000,
        ),
        fecha: fechaColombiana(venta.fecha),
      });
    }

    return pendientes;
  }

  /** Deja constancia de que ya se aviso por estos fiados. */
  async marcarFiadosAvisados(fiados: FiadoPorCobrar[]): Promise<void> {
    if (fiados.length === 0) return;

    await this.prisma.recordatorioFiado.createMany({
      data: fiados.map((fiado) => ({
        ventaId: fiado.ventaId,
        saldo: fiado.saldo,
      })),

      // Si otra ejecucion se adelanto, no es un error: el aviso ya salio.
      skipDuplicates: true,
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