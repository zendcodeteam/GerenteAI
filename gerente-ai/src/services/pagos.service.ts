import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CicloPago, EstadoPago, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { PLANES } from './planes.service';
import { CrearCheckoutDto } from '../dto/pagos/crear-checkout.dto';
import type { Ciclo } from '../dto/negocios/cambiar-plan.dto';
import {
  estadoDesdeWompi,
  eventoEsAutentico,
  firmaDeIntegridad,
  type EventoWompi,
  type TransaccionWompi,
} from './wompi';

const MONEDA = 'COP';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  /**
   * Prepara un cobro y devuelve lo que el frontend necesita para abrir el
   * checkout de Wompi.
   *
   * El pago nace PENDIENTE y solo el webhook lo mueve de ahí. Lo que el
   * navegador diga después —"pagué", "salió bien"— es informativo: quien activa
   * el plan es el evento firmado que manda Wompi.
   */
  async crearCheckout(
    userId: string,
    rolGlobal: string,
    dto: CrearCheckoutDto,
  ) {
    // Pagar el plan es del dueño del negocio. Un administrador de sede opera en
    // su sede, pero no contrata en nombre del negocio.
    await this.negociosService.verificarPropietario(
      userId,
      dto.negocioId,
      rolGlobal,
    );

    const ciclo: Ciclo = dto.ciclo ?? 'mensual';
    const definicion = PLANES[dto.plan];

    // Se comprueba `contratacion` y no el precio: el Asistente es gratuito y el
    // Corporativo se cotiza en una reunión, y ambos valen 0 en el catálogo.
    if (!definicion || definicion.contratacion !== 'directo') {
      throw new BadRequestException('Ese plan no está a la venta');
    }

    // El precio sale del catálogo del servidor, nunca de la petición.
    const precio =
      ciclo === 'anual' ? definicion.precioAnual : definicion.precioMensual;

    // Un plan puede no tener ciclo anual. Sin esto se cobraría cero, que es
    // peor que fallar: el pago saldría aprobado y el plan se activaría gratis.
    if (precio === null) {
      throw new BadRequestException(
        `El plan ${definicion.nombre} solo se vende por mes`,
      );
    }

    const montoEnCentavos = precio * 100;

    // El prefijo hace que la referencia se reconozca de un vistazo en el panel
    // de Wompi; el uuid es lo que garantiza que no se repita.
    const referencia = `LUKA-${randomUUID().replace(/-/g, '')}`;

    const pago = await this.prisma.pago.create({
      data: {
        referencia,
        negocioId: dto.negocioId,
        usuarioId: userId,
        plan: dto.plan,
        ciclo: ciclo === 'anual' ? CicloPago.ANUAL : CicloPago.MENSUAL,
        montoEnCentavos,
        moneda: MONEDA,
      },
    });

    return {
      referencia: pago.referencia,
      montoEnCentavos,
      moneda: MONEDA,
      firmaDeIntegridad: firmaDeIntegridad(
        referencia,
        montoEnCentavos,
        MONEDA,
        this.secreto('WOMPI_INTEGRITY_SECRET'),
      ),
      llavePublica: this.secreto('WOMPI_PUBLIC_KEY'),
      plan: { id: definicion.id, nombre: definicion.nombre },
      ciclo,
    };
  }

  /**
   * Punto de entrada del webhook. Es público —Wompi no tiene forma de mandar un
   * JWT— así que la firma del evento es lo único que separa un cobro real de
   * alguien regalándose el plan Administrador con un `curl`.
   *
   * Los errores del emisor se responden 200 igualmente: Wompi reintenta lo que
   * no confirma, y un evento que nunca vamos a poder procesar se reintentaría
   * para siempre. Lo que sí queda es el log.
   */
  async procesarEvento(cuerpo: unknown): Promise<{ recibido: boolean }> {
    const evento = this.leerEvento(cuerpo);
    if (!evento) {
      this.logger.warn('Evento de Wompi con formato inesperado; se descarta');
      return { recibido: true };
    }

    if (!eventoEsAutentico(evento, this.secreto('WOMPI_EVENTS_SECRET'))) {
      this.logger.error(
        `Firma inválida en el evento de la referencia ${evento.transaccion.reference}; se descarta`,
      );
      return { recibido: true };
    }

    await this.aplicarTransaccion(evento.transaccion, cuerpo);
    return { recibido: true };
  }

  private getWompiApiUrl(): string {
    const pubKey = process.env.WOMPI_PUBLIC_KEY || '';
    if (pubKey.startsWith('pub_prod_')) {
      return 'https://production.wompi.co/v1';
    }
    return 'https://sandbox.wompi.co/v1';
  }

  private async consultarTransaccionWompi(
    wompiId: string,
  ): Promise<TransaccionWompi | null> {
    try {
      const baseUrl = this.getWompiApiUrl();
      const res = await fetch(
        `${baseUrl}/transactions/${encodeURIComponent(wompiId)}`,
        {
          headers: {
            Authorization: `Bearer ${this.secreto('WOMPI_PUBLIC_KEY')}`,
          },
        },
      );
      if (!res.ok) {
        this.logger.warn(
          `Error al consultar transacción Wompi ${wompiId}: HTTP ${res.status}`,
        );
        return null;
      }
      const body = (await res.json()) as { data?: Record<string, unknown> };
      const data = body?.data;
      if (
        !data ||
        typeof data.id !== 'string' ||
        typeof data.reference !== 'string' ||
        typeof data.status !== 'string' ||
        typeof data.amount_in_cents !== 'number' ||
        typeof data.currency !== 'string'
      ) {
        return null;
      }
      return {
        id: data.id,
        reference: data.reference,
        status: data.status,
        amount_in_cents: data.amount_in_cents,
        currency: data.currency,
      };
    } catch (error) {
      this.logger.error(
        `Excepción al consultar transacción Wompi ${wompiId}:`,
        error,
      );
      return null;
    }
  }

  private async aplicarTransaccion(
    transaccion: TransaccionWompi,
    cuerpoCrudo: unknown,
  ) {
    const estado = estadoDesdeWompi(transaccion.status);

    // PSE y Nequi pasan por PENDING antes de resolverse. No se toca el pago:
    // sigue esperando el evento definitivo.
    if (estado === 'PENDIENTE') return;

    const pago = await this.prisma.pago.findUnique({
      where: { referencia: transaccion.reference },
    });
    if (!pago) {
      this.logger.warn(
        `Evento para una referencia desconocida: ${transaccion.reference}`,
      );
      return;
    }
    if (pago.estado !== EstadoPago.PENDIENTE) {
      // Wompi reintenta cuando no confirmamos a tiempo o ya se activó por verificación activa.
      // Volver a aplicarlo extendería el plan dos veces por un solo cobro.
      return;
    }

    // Que la firma o consulta sea válida prueba que viene de Wompi, no que
    // corresponda a lo que cobramos. Si el monto no cuadra, algo se torció: se
    // deja constancia y no se activa nada.
    const montoCuadra =
      transaccion.amount_in_cents === pago.montoEnCentavos &&
      transaccion.currency === pago.moneda;

    if (!montoCuadra) {
      this.logger.error(
        `El pago ${pago.referencia} esperaba ${pago.montoEnCentavos} ${pago.moneda} y llegó ${transaccion.amount_in_cents} ${transaccion.currency}`,
      );
    }

    const estadoFinal = montoCuadra ? estado : EstadoPago.ERROR;

    await this.prisma.$transaction(async (tx) => {
      // Condicional sobre el estado: si dos entregas del mismo evento o verificación
      // entran a la vez, solo una encuentra el pago PENDIENTE y solo una activa el plan.
      const { count } = await tx.pago.updateMany({
        where: { id: pago.id, estado: EstadoPago.PENDIENTE },
        data: {
          estado: estadoFinal,
          wompiTransaccionId: transaccion.id,
          datosWompi: cuerpoCrudo as Prisma.InputJsonValue,
          procesadoEl: new Date(),
        },
      });
      if (count === 0) return;

      if (estadoFinal !== EstadoPago.APROBADO) return;

      await this.negociosService.activarPlan(
        pago.negocioId,
        pago.plan,
        pago.ciclo === CicloPago.ANUAL ? 'anual' : 'mensual',
        // Un cobro confirmado renueva: suma a los días que el cliente ya pagó.
        { renovacion: true, tx },
      );
    });

    this.logger.log(
      `Pago ${pago.referencia} quedó en ${estadoFinal} (transacción ${transaccion.id})`,
    );
  }

  /** Historial de pagos de los negocios del usuario. */
  async findAll(userId: string, rolGlobal: string, negocioId?: string) {
    if (negocioId) {
      await this.negociosService.verificarPropietario(
        userId,
        negocioId,
        rolGlobal,
      );
      const pagos = await this.prisma.pago.findMany({
        where: { negocioId },
        orderBy: { createdAt: 'desc' },
      });
      return pagos.map((pago) => this.publicPayment(pago));
    }

    if (rolGlobal === 'MASTER') {
      const pagos = await this.prisma.pago.findMany({ orderBy: { createdAt: 'desc' } });
      return pagos.map((pago) => this.publicPayment(pago));
    }

    const pagos = await this.prisma.pago.findMany({
      where: { negocio: { usuariosNegocio: { some: { usuarioId: userId } } } },
      orderBy: { createdAt: 'desc' },
    });
    return pagos.map((pago) => this.publicPayment(pago));
  }

  private publicPayment(pago: Prisma.PagoGetPayload<{}>) {
    return {
      id: pago.id,
      referencia: pago.referencia,
      estado: pago.estado,
      plan: pago.plan,
      ciclo: pago.ciclo,
      montoEnCentavos: pago.montoEnCentavos,
      moneda: pago.moneda,
      wompiTransaccionId: pago.wompiTransaccionId,
      procesadoEl: pago.procesadoEl,
      createdAt: pago.createdAt,
      metodoPago: pago.estado === EstadoPago.APROBADO
        ? paymentMethodFromWompi(pago.datosWompi)
        : null,
    };
  }

  /**
   * Estado de un cobro concreto. Es lo que consulta el frontend cuando el
   * usuario vuelve del checkout.
   *
   * Si el pago sigue PENDIENTE y se proporciona el `wompiId` (que Wompi
   * adjunta en la redirección) o ya se conoce el ID de transacción, consulta
   * activamente a la API de Wompi para no depender únicamente del webhook.
   */
  async porReferencia(
    referencia: string,
    userId: string,
    rolGlobal: string,
    wompiId?: string,
  ) {
    let pago = await this.prisma.pago.findUnique({ where: { referencia } });
    if (!pago) {
      throw new NotFoundException('No existe un pago con esa referencia');
    }
    await this.negociosService.verificarPropietario(
      userId,
      pago.negocioId,
      rolGlobal,
    );

    const idParaConsultar = wompiId || pago.wompiTransaccionId;
    if (pago.estado === EstadoPago.PENDIENTE && idParaConsultar) {
      const transaccion = await this.consultarTransaccionWompi(idParaConsultar);
      if (transaccion && transaccion.reference === pago.referencia) {
        await this.aplicarTransaccion(transaccion, {
          data: transaccion,
          origen: 'consulta_directa_wompi',
        });
        const pagoActualizado = await this.prisma.pago.findUnique({
          where: { referencia },
        });
        if (pagoActualizado) {
          pago = pagoActualizado;
        }
      }
    }

    return this.publicPayment(pago);
  }

  /**
   * Una credencial ausente no puede degradarse en silencio: sin el secreto de
   * integridad se firmaría con la cadena vacía y Wompi rechazaría todos los
   * cobros; sin el de eventos, cualquier webhook pasaría por auténtico.
   */
  private secreto(nombre: string): string {
    const valor = process.env[nombre]?.trim();
    if (!valor) {
      this.logger.error(`Falta la variable de entorno ${nombre}`);
      throw new InternalServerErrorException(
        'La pasarela de pagos no está configurada',
      );
    }
    return valor;
  }

  /** El cuerpo del webhook es JSON de fuera: se comprueba antes de usarlo. */
  private leerEvento(cuerpo: unknown): EventoWompi | null {
    if (typeof cuerpo !== 'object' || cuerpo === null) return null;

    const raiz = cuerpo as Record<string, unknown>;
    const data = raiz.data as Record<string, unknown> | undefined;
    const transaccion = data?.transaction as
      Record<string, unknown> | undefined;
    const firma = raiz.signature as Record<string, unknown> | undefined;

    if (
      typeof transaccion?.id !== 'string' ||
      typeof transaccion.reference !== 'string' ||
      typeof transaccion.status !== 'string' ||
      typeof transaccion.amount_in_cents !== 'number' ||
      typeof transaccion.currency !== 'string' ||
      typeof raiz.timestamp !== 'number' ||
      typeof firma?.checksum !== 'string' ||
      !Array.isArray(firma.properties) ||
      !firma.properties.every((ruta) => typeof ruta === 'string')
    ) {
      return null;
    }

    return {
      data: raiz.data,
      transaccion: {
        id: transaccion.id,
        reference: transaccion.reference,
        status: transaccion.status,
        amount_in_cents: transaccion.amount_in_cents,
        currency: transaccion.currency,
      },
      timestamp: raiz.timestamp,
      signature: {
        properties: firma.properties,
        checksum: firma.checksum,
      },
    };
  }
}

function paymentMethodFromWompi(data: Prisma.JsonValue | null) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;

  const root = data as Prisma.JsonObject;
  const eventData = root.data;
  if (!eventData || typeof eventData !== 'object' || Array.isArray(eventData)) {
    return null;
  }

  const transaction = (eventData as Prisma.JsonObject).transaction;
  if (!transaction || typeof transaction !== 'object' || Array.isArray(transaction)) {
    return null;
  }

  const transactionData = transaction as Prisma.JsonObject;
  const method = transactionData.payment_method;
  const methodData = method && typeof method === 'object' && !Array.isArray(method)
    ? method as Prisma.JsonObject
    : null;
  const extra = methodData?.extra;
  const extraData = extra && typeof extra === 'object' && !Array.isArray(extra)
    ? extra as Prisma.JsonObject
    : null;
  const type = transactionData.payment_method_type ?? methodData?.type;
  const lastFour = extraData?.last_four
    ?? extraData?.lastFour
    ?? extraData?.account_last_four
    ?? extraData?.bank_account_last_four;

  return {
    tipo: typeof type === 'string' ? type : 'DESCONOCIDO',
    ultimos4: typeof lastFour === 'string' && /^\d{4}$/.test(lastFour)
      ? lastFour
      : null,
  };
}
