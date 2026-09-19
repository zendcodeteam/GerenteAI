import { Injectable, Logger } from '@nestjs/common';
import {
  BeneficiarioReparto,
  CategoriaGasto,
  MetodoPago,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../../services/prisma.service';
import {
  fechaColombiana,
  finDelDia,
  inicioDelDia,
} from '../domain/dia-colombia';
import {
  CATEGORY_LABELS,
  type BusinessSnapshot,
  type CategoryTotal,
  type MonthlyTotals,
  type PaymentMethod,
  type ProfitBeneficiary,
  type Receivable,
  type Transaction,
  type TransactionCategory,
  type TransactionType,
} from '../domain/finance.types';
import type {
  FinanceDataPort,
  PaymentRequest,
  PaymentResult,
  ProfitDistribution,
  TransactionChanges,
  TransactionQuery,
} from '../ports/finance-data.port';

/**
 * Adaptador real: la IA lee y escribe en PostgreSQL a traves de Prisma.
 *
 * ---------------------------------------------------------------------------
 * DECISIONES DE MAPEO (documentadas porque el dominio de IA y el esquema de la
 * base no nacieron con la misma forma):
 *
 *   businessId (dominio IA)  ==  Sede.id (base de datos)
 *       Gasto, Venta y Compra cuelgan de Sede, no de Negocio. La sede es la
 *       unidad contable real, asi que es la que identifica al "negocio" para
 *       la IA. El WhatsappRoutingService resuelve telefono -> sede.
 *
 *   expense     -> Gasto
 *   investment  -> Gasto con descripcion prefijada "Inversion · ..."
 *   income      -> Venta (tipo CONTADO, sin detalle de productos)
 *   cobro de un fiado -> Abono (no una Venta nueva)
 *
 *   Una venta FIADO no es un ingreso: es una cuenta por cobrar. El ingreso
 *   nace cuando el cliente paga, y por eso cada Abono se lee como un
 *   movimiento de tipo income y categoria "cobros", con la fecha del pago.
 *   Registrar el cobro como una venta nueva —que es lo que se hacia antes—
 *   contaba la misma plata dos veces y dejaba la deuda intacta.
 *
 * LIMITACIONES CONOCIDAS (aceptadas a proposito, no son descuidos):
 *   1. `CategoriaGasto` en Prisma solo tiene 5 valores (ARRIENDO, SERVICIOS,
 *      NOMINA, TRANSPORTE, OTROS) y la IA maneja 8. Las que no tienen equivalente
 *      caen en OTROS y su etiqueta se conserva en `descripcion` para que un
 *      humano la vea. Al releer, esos gastos vuelven como "otros_gastos".
 *   2. Una inversion releida se ve como gasto: la base no distingue el tipo.
 *   Ambas se resuelven agregando valores al enum (ver docs/INTEGRACIONES.md).
 * ---------------------------------------------------------------------------
 */
@Injectable()
export class PrismaFinanceDataAdapter implements FinanceDataPort {
  private readonly logger = new Logger(PrismaFinanceDataAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------ lectura

  async listTransactions(query: TransactionQuery): Promise<Transaction[]> {
    // `undefined` en un filtro de Prisma significa "no filtres por esto".
    const fecha = dateRange(query.from, query.to);
    const take = query.limit ?? 500;

    // Se consultan las tres tablas siempre y se filtra por tipo al final: son
    // tres indices por sedeId + fecha, y el codigo queda sin ramas.
    const [gastos, ventas, compras, abonos] = await Promise.all([
      this.prisma.gasto.findMany({
        where: { sedeId: query.businessId, fecha },
        orderBy: { fecha: 'desc' },
        take,
      }),
      this.prisma.venta.findMany({
        where: { sedeId: query.businessId, fecha },
        orderBy: { fecha: 'desc' },
        // El nombre del cliente es lo que permite decir "el fiado de Rosa" en
        // vez de "una venta a credito": sin el, las cuentas por cobrar son
        // una cifra sin dueno y no hay a quien llamar.
        include: { cliente: true },
        take,
      }),
      this.prisma.compra.findMany({
        where: { sedeId: query.businessId, fecha },
        orderBy: { fecha: 'desc' },
        take,
      }),
      this.prisma.abono.findMany({
        where: { sedeId: query.businessId, fecha },
        orderBy: { fecha: 'desc' },
        include: { cliente: true },
        take,
      }),
    ]);

    const rows: Transaction[] = [
      ...gastos.map((gasto): Transaction => ({
        id: gasto.id,
        businessId: gasto.sedeId,
        date: isoDate(gasto.fecha),
        description: gasto.descripcion,
        category: CATEGORY_FROM_PRISMA[gasto.categoria],
        amount: toNumber(gasto.monto),
        type: 'expense',
        currency: 'COP',
        source: 'manual' as const,
        createdAt: gasto.fecha.toISOString(),
        paymentMethod: gasto.metodoPago
          ? PAYMENT_FROM_PRISMA[gasto.metodoPago]
          : null,
        isCredit: false,
        customerName: null,
        groupId: gasto.grupoId,
      })),
      ...ventas.map((venta): Transaction => ({
        id: venta.id,
        businessId: venta.sedeId,
        date: isoDate(venta.fecha),
        // El concepto real cuando existe. Sin este campo no habia forma de
        // buscar un ingreso por su nombre, como si se hace con los gastos.
        description:
          venta.descripcion ??
          `Venta ${venta.tipo === 'FIADO' ? 'a credito' : 'de contado'}`,
        category: 'ventas',
        amount: toNumber(venta.total),
        type: 'income',
        currency: 'COP',
        source: 'manual' as const,
        createdAt: venta.fecha.toISOString(),
        paymentMethod: venta.metodoPago
          ? PAYMENT_FROM_PRISMA[venta.metodoPago]
          : null,
        isCredit: venta.tipo === 'FIADO',
        // Lo que falta por cobrar, no lo que se vendio. Baja con cada abono y
        // llega a 0 cuando el cliente termina de pagar; antes no se leia y un
        // fiado saldado seguia contando entero en las cuentas por cobrar.
        pendingAmount:
          venta.tipo === 'FIADO' ? toNumber(venta.saldoPendiente) : null,
        customerName: venta.cliente?.nombre ?? null,
        groupId: venta.grupoId,
      })),
      // Cada abono ES el ingreso del fiado, con la fecha en que entro la
      // plata. La venta a credito quedo fuera de los ingresos precisamente
      // para que el dinero se cuente aqui una sola vez, cuando se cobra.
      ...abonos.map((abono): Transaction => ({
        id: abono.id,
        businessId: abono.sedeId,
        date: isoDate(abono.fecha),
        description: `Abono de ${abono.cliente.nombre}`,
        category: 'cobros',
        amount: toNumber(abono.monto),
        type: 'income',
        currency: 'COP',
        source: 'manual' as const,
        createdAt: abono.fecha.toISOString(),
        paymentMethod: null,
        isCredit: false,
        pendingAmount: null,
        customerName: abono.cliente.nombre,
        groupId: null,
      })),
      ...compras.map((compra): Transaction => ({
        id: compra.id,
        businessId: compra.sedeId,
        date: isoDate(compra.fecha),
        description: 'Compra a proveedor',
        category: 'mercancia',
        amount: toNumber(compra.total),
        type: 'expense',
        currency: 'COP',
        source: 'manual' as const,
        createdAt: compra.fecha.toISOString(),
      })),
    ];

    return rows
      .filter((row) => !query.type || row.type === query.type)
      .filter((row) => !query.category || row.category === query.category)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, take);
  }

  async getSnapshot(businessId: string): Promise<BusinessSnapshot> {
    const sede = await this.prisma.sede.findUnique({
      where: { id: businessId },
      include: { negocio: true },
    });

    // Ultimos 6 meses: suficiente para tendencias, acotado para no traer todo.
    const from = new Date();
    from.setMonth(from.getMonth() - 5);
    from.setDate(1);

    const [rows, receivables] = await Promise.all([
      this.listTransactions({
        businessId,
        from: isoDate(from),
        limit: 2_000,
      }),
      this.listReceivables(businessId),
    ]);

    // Lo fiado se aparta antes de sumar nada: si entrara en los ingresos, las
    // recomendaciones hablarian de una facturacion que no esta en la caja.
    const contado = rows.filter((row) => !row.isCredit);
    const totalCreditSales = rows
      .filter((row) => row.isCredit)
      .reduce((suma, row) => suma + row.amount, 0);

    // Lo que falta por cobrar HOY, no lo que se vendio a credito: es la cifra
    // que el dueno puede ir a reclamar.
    const totalReceivable = receivables.reduce(
      (suma, cliente) => suma + cliente.pending,
      0,
    );

    const totalIncome = sumByType(contado, 'income');
    const totalExpense = sumByType(contado, 'expense');
    const totalInvestment = sumByType(contado, 'investment');
    const dates = rows.map((row) => row.date).sort();

    return {
      businessId,
      businessName: sede
        ? `${sede.negocio.nombre} - ${sede.nombre}`
        : 'Negocio',
      currency: 'COP',
      periodStart: dates[0] ?? isoDate(from),
      periodEnd: dates[dates.length - 1] ?? isoDate(new Date()),
      totalIncome,
      totalCreditSales,
      totalReceivable,
      receivables,
      totalExpense,
      totalInvestment,
      balance: totalIncome - totalExpense - totalInvestment,
      monthly: groupByMonth(contado),
      topCategories: topCategories(contado),
      recentTransactions: rows.slice(0, 15),
    };
  }

  // ----------------------------------------------------------------- escritura

  async saveTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    if (!transactions.length) return [];

    // Los clientes de los fiados se resuelven antes de abrir la transaccion:
    // buscar o crear un cliente es una consulta aparte y no puede ir dentro de
    // la lista de operaciones atomicas.
    const clientes = await this.resolveCustomers(transactions);

    const operations: Prisma.PrismaPromise<unknown>[] = transactions.flatMap(
      (transaction) => this.buildWriteOperations(transaction, clientes),
    );

    await this.prisma.$transaction(operations);

    this.logger.log(
      `Guardados ${transactions.length} movimientos en sede ${transactions[0].businessId} (origen: ${transactions[0].source}).`,
    );

    return transactions;
  }

  /**
   * Sustituye un movimiento por sus partes, en una sola transaccion de base.
   *
   * Si se guardaran las partes sin borrar el total, el dinero quedaria contado
   * dos veces; si se borrara primero y fallara la insercion, se perderia la
   * venta. Por eso las dos cosas van juntas o no van.
   */
  async replaceTransaction(
    businessId: string,
    transactionId: string,
    parts: Transaction[],
    actor?: string,
  ): Promise<Transaction[]> {
    const [originalVenta, originalGasto] = await Promise.all([
      this.prisma.venta.findFirst({
        where: { id: transactionId, sedeId: businessId },
        include: { detalles: true },
      }),
      this.prisma.gasto.findFirst({
        where: { id: transactionId, sedeId: businessId },
      }),
    ]);

    const original = originalVenta || originalGasto;
    const entidad = originalVenta ? 'Venta' : 'Gasto';
    const valorAnterior = original
      ? JSON.parse(JSON.stringify(original))
      : null;

    const clientes = await this.resolveCustomers(parts);

    // El movimiento original puede ser una venta o un gasto: se intenta borrar
    // en ambas tablas y solo una encuentra la fila.
    const operations: Prisma.PrismaPromise<unknown>[] = [
      ...(original
        ? [
            this.prisma.bitacoraAuditoria.create({
              data: {
                sedeId: businessId,
                usuarioId: actor ?? null,
                operacion: 'SUSTITUCION',
                entidad,
                entidadId: transactionId,
                valorAnterior: valorAnterior ?? {},
                valorNuevo: JSON.parse(JSON.stringify(parts)),
                motivo: 'replaceTransaction',
              },
            }),
          ]
        : []),
      this.prisma.venta.deleteMany({
        where: { id: transactionId, sedeId: businessId },
      }),
      this.prisma.gasto.deleteMany({
        where: { id: transactionId, sedeId: businessId },
      }),
      ...parts.flatMap((part) => this.buildWriteOperations(part, clientes)),
    ];

    await this.prisma.$transaction(operations);

    this.logger.log(
      `Movimiento ${transactionId} reemplazado por ${parts.length} partes en sede ${businessId} (auditado).`,
    );

    return parts;
  }

  /** Guarda el reparto de utilidades: una fila por beneficiario. */
  async saveProfitDistribution(
    distribution: ProfitDistribution,
  ): Promise<ProfitDistribution> {
    await this.prisma.repartoUtilidad.createMany({
      data: distribution.shares.map((share) => ({
        beneficiario: BENEFICIARY_TO_PRISMA[share.beneficiary],
        nombre: share.name,
        porcentaje: new Prisma.Decimal(share.percentage),
        monto: new Prisma.Decimal(share.amount),
        totalRepartido: new Prisma.Decimal(distribution.total),
        grupoId: distribution.groupId,
        sedeId: distribution.businessId,
        fecha: new Date(`${distribution.date}T12:00:00.000Z`),
      })),
    });

    this.logger.log(
      `Reparto de utilidades de ${distribution.total} entre ${distribution.shares.length} beneficiarios en sede ${distribution.businessId}.`,
    );

    return distribution;
  }

  // -------------------------------------------------------- fiados y abonos

  /**
   * Aplica un pago a las ventas fiadas de un cliente, de la mas antigua a la
   * mas reciente.
   *
   * Es el mismo criterio del panel (`AbonosService`): saldar primero lo viejo
   * evita que una deuda antigua se quede eternamente abierta mientras se pagan
   * las recientes. Aqui no se piden permisos porque el remitente de WhatsApp ya
   * fue resuelto a una sede.
   *
   * No crea ningun ingreso: el ingreso aparece solo al releer, porque el abono
   * se lee como movimiento de la categoria "cobros". Registrarlo ademas como
   * venta contaria la plata dos veces.
   */
  async registerPayment(payment: PaymentRequest): Promise<PaymentResult> {
    const nombre = payment.customerName.trim();

    const cliente = await this.prisma.cliente.findFirst({
      where: {
        sedeId: payment.businessId,
        nombre: { equals: nombre, mode: 'insensitive' },
      },
    });

    if (!cliente) return sinAplicar('cliente_no_encontrado', nombre);

    const pendientes = await this.prisma.venta.findMany({
      where: {
        sedeId: payment.businessId,
        clienteId: cliente.id,
        saldoPendiente: { gt: 0 },
      },
      orderBy: { fecha: 'asc' },
    });

    const deuda = redondear(
      pendientes.reduce(
        (suma, venta) => suma + toNumber(venta.saldoPendiente),
        0,
      ),
    );

    if (deuda <= 0) return sinAplicar('sin_deuda', cliente.nombre);

    // Sin monto ("Rosa ya me pago") se salda todo. Un monto mayor a la deuda
    // se recorta al saldo real: dejarlo en negativo esconderia un error de
    // dictado, que es mucho mas probable que un pago adelantado.
    const pedido = payment.amount ?? deuda;
    const aplicado = redondear(Math.min(pedido, deuda));
    const restante = redondear(deuda - aplicado);
    // Mismo criterio que los movimientos: la hora real cuando la hay, el
    // mediodia cuando el usuario dicto una fecha suelta.
    const fecha = fechaDelPago(payment);

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    let porRepartir = aplicado;
    let saldadas = 0;

    for (const venta of pendientes) {
      if (porRepartir <= 0) break;

      const saldo = toNumber(venta.saldoPendiente);
      const parte = redondear(Math.min(porRepartir, saldo));

      operations.push(
        this.prisma.venta.update({
          where: { id: venta.id },
          data: { saldoPendiente: { decrement: new Prisma.Decimal(parte) } },
        }),
        // Un abono por venta, no uno suelto: es lo que permite saber cual
        // quedo saldada y cual sigue vencida, y poder revertirlo con exactitud.
        this.prisma.abono.create({
          data: {
            monto: new Prisma.Decimal(parte),
            clienteId: cliente.id,
            sedeId: payment.businessId,
            ventaId: venta.id,
            fecha,
          },
        }),
      );

      if (parte >= saldo) saldadas += 1;
      porRepartir = redondear(porRepartir - parte);
    }

    // Se ESCRIBE el saldo, no se decrementa. `Cliente.saldoPendiente` puede
    // venir descuadrado de los fiados que se registraron antes de que esto
    // existiera; recalcularlo desde las ventas lo deja bien de una vez.
    operations.push(
      this.prisma.cliente.update({
        where: { id: cliente.id },
        data: { saldoPendiente: new Prisma.Decimal(restante) },
      }),
    );

    await this.prisma.$transaction(operations);

    this.logger.log(
      `Abono de ${aplicado} de "${cliente.nombre}" en sede ${payment.businessId}: quedan ${restante} por cobrar (${saldadas} ventas saldadas).`,
    );

    return {
      applied: true,
      reason: null,
      customerName: cliente.nombre,
      amount: aplicado,
      remaining: restante,
      excess: redondear(pedido - aplicado),
      settledSales: saldadas,
    };
  }

  /**
   * Quien le debe al negocio, cuanto y desde cuando.
   *
   * Solo entran las ventas con saldo vivo: una vez cobradas dejan de ser una
   * cuenta por cobrar y no tienen por que seguir apareciendo.
   */
  async listReceivables(businessId: string): Promise<Receivable[]> {
    const ventas = await this.prisma.venta.findMany({
      where: {
        sedeId: businessId,
        tipo: 'FIADO',
        saldoPendiente: { gt: 0 },
      },
      include: { cliente: true },
      orderBy: { fecha: 'asc' },
    });

    if (!ventas.length) return [];

    const clienteIds = [
      ...new Set(
        ventas
          .map((venta) => venta.clienteId)
          .filter((id): id is string => !!id),
      ),
    ];

    // Todos los abonos del cliente, no solo los de estas ventas: para decir
    // "hace 12 dias que no te paga" cuenta cualquier pago suyo.
    const abonos = clienteIds.length
      ? await this.prisma.abono.findMany({
          where: { sedeId: businessId, clienteId: { in: clienteIds } },
          orderBy: { fecha: 'desc' },
        })
      : [];

    const hoy = isoDate(new Date());
    const acumulado = new Map<string, Receivable>();

    for (const venta of ventas) {
      // Un fiado sin cliente no se puede cobrar, pero tampoco se puede
      // esconder: se agrupa aparte para que el dueno vea que le falta el dato.
      const clave = venta.clienteId ?? SIN_CLIENTE;
      const nombre = venta.cliente?.nombre ?? 'Cliente sin identificar';
      const desde = isoDate(venta.fecha);

      const ficha = acumulado.get(clave) ?? {
        customerId: clave,
        customerName: nombre,
        pending: 0,
        paid: 0,
        total: 0,
        oldestSince: desde,
        daysOutstanding: 0,
        lastPaymentDate: null,
        daysSinceLastPayment: null,
        openSales: 0,
      };

      ficha.pending = redondear(ficha.pending + toNumber(venta.saldoPendiente));
      // Lo ya abonado de ESTA venta: total menos lo que sigue debiendo.
      ficha.paid = redondear(
        ficha.paid + (toNumber(venta.total) - toNumber(venta.saldoPendiente)),
      );
      ficha.total = redondear(ficha.total + toNumber(venta.total));
      ficha.openSales += 1;
      if (desde < ficha.oldestSince) ficha.oldestSince = desde;

      acumulado.set(clave, ficha);
    }

    for (const ficha of acumulado.values()) {
      ficha.daysOutstanding = diasEntre(ficha.oldestSince, hoy);

      const ultimo = abonos.find(
        (abono) => abono.clienteId === ficha.customerId,
      );
      if (ultimo) {
        ficha.lastPaymentDate = isoDate(ultimo.fecha);
        ficha.daysSinceLastPayment = diasEntre(ficha.lastPaymentDate, hoy);
      }
    }

    // La deuda mas vieja primero: es la que hay que cobrar hoy.
    return [...acumulado.values()].sort(
      (a, b) => b.daysOutstanding - a.daysOutstanding,
    );
  }

  /**
   * Corrige un movimiento en PostgreSQL.
   *
   * Al escribir en las mismas tablas que lee el panel (`Venta`, `Gasto`), la
   * correccion hecha por WhatsApp aparece en la web sin ningun paso extra: no
   * hay copia que sincronizar.
   *
   * Un movimiento puede ser venta o gasto y el id no dice cual, asi que se
   * intenta en las dos tablas; solo una tiene la fila.
   */
  async updateTransaction(
    businessId: string,
    transactionId: string,
    changes: TransactionChanges,
    actor?: string,
  ): Promise<Transaction | null> {
    const monto =
      changes.amount !== undefined
        ? new Prisma.Decimal(changes.amount)
        : undefined;

    const [originalVenta, originalGasto] = await Promise.all([
      this.prisma.venta.findFirst({
        where: { id: transactionId, sedeId: businessId },
      }),
      this.prisma.gasto.findFirst({
        where: { id: transactionId, sedeId: businessId },
      }),
    ]);

    const original = originalVenta || originalGasto;
    if (!original) {
      return null;
    }

    const entidad = originalVenta ? 'Venta' : 'Gasto';
    const valorAnterior = JSON.parse(JSON.stringify(original));

    const venta = await this.prisma.venta.updateMany({
      where: { id: transactionId, sedeId: businessId },
      data: {
        total: monto,
        descripcion: changes.description,
        // Un fiado corregido debe reflejar el nuevo saldo por cobrar; si no,
        // el reporte de cuentas por cobrar seguiria mostrando el monto viejo.
        // Se descuenta lo ya abonado: corregir "eran 60.000, no 50.000" no
        // puede resucitar los 20.000 que el cliente ya pago.
        ...(monto !== undefined && originalVenta
          ? { saldoPendiente: nuevoSaldo(originalVenta, changes.amount!) }
          : {}),
      },
    });

    // La deuda del cliente tiene que moverse lo mismo que el saldo de la venta,
    // o el panel mostrara un total que no coincide con sus ventas.
    if (
      venta.count > 0 &&
      monto !== undefined &&
      originalVenta?.clienteId &&
      originalVenta.tipo === 'FIADO'
    ) {
      const diferencia = redondear(
        toNumber(nuevoSaldo(originalVenta, changes.amount!)) -
          toNumber(originalVenta.saldoPendiente),
      );

      if (diferencia !== 0) {
        await this.prisma.cliente.update({
          where: { id: originalVenta.clienteId },
          data: {
            saldoPendiente: { increment: new Prisma.Decimal(diferencia) },
          },
        });
      }
    }

    if (venta.count === 0) {
      const gasto = await this.prisma.gasto.updateMany({
        where: { id: transactionId, sedeId: businessId },
        data: { monto, descripcion: changes.description },
      });
      if (gasto.count === 0) return null;
    }

    // Registrar en bitácora de auditoría la modificación efectuada
    await this.prisma.bitacoraAuditoria.create({
      data: {
        sedeId: businessId,
        usuarioId: actor ?? null,
        operacion: 'ACTUALIZACION',
        entidad,
        entidadId: transactionId,
        valorAnterior,
        valorNuevo: JSON.parse(JSON.stringify(changes)),
        motivo: 'updateTransaction',
      },
    });

    this.logger.log(
      `Movimiento ${transactionId} corregido en sede ${businessId}: ${JSON.stringify(changes)} (auditado).`,
    );

    return this.findTransaction(businessId, transactionId);
  }

  async deleteTransaction(
    businessId: string,
    transactionId: string,
    actor?: string,
  ): Promise<boolean> {
    // 1. Obtener el movimiento antes de borrarlo para registrar su estado previo en la bitácora
    const [originalVenta, originalGasto] = await Promise.all([
      this.prisma.venta.findFirst({
        where: { id: transactionId, sedeId: businessId },
        include: { detalles: true },
      }),
      this.prisma.gasto.findFirst({
        where: { id: transactionId, sedeId: businessId },
      }),
    ]);

    const original = originalVenta || originalGasto;
    if (!original) {
      return false;
    }

    const entidad = originalVenta ? 'Venta' : 'Gasto';
    const valorAnterior = JSON.parse(JSON.stringify(original));

    // Borrar un fiado tiene que devolverle al cliente lo que ya no debe. Se
    // resta el SALDO, no el total: lo que ya abono es plata que si entro y
    // sigue siendo un ingreso.
    // Va en la misma transaccion que el borrado: la bitácora queda registrada de forma atómica.
    const [, venta, gasto] = await this.prisma.$transaction([
      this.prisma.bitacoraAuditoria.create({
        data: {
          sedeId: businessId,
          usuarioId: actor ?? null,
          operacion: 'ELIMINACION',
          entidad,
          entidadId: transactionId,
          valorAnterior,
          valorNuevo: Prisma.JsonNull,
          motivo: 'deleteTransaction',
        },
      }),
      this.prisma.venta.deleteMany({
        where: { id: transactionId, sedeId: businessId },
      }),
      this.prisma.gasto.deleteMany({
        where: { id: transactionId, sedeId: businessId },
      }),
      ...(originalVenta?.clienteId && originalVenta.tipo === 'FIADO'
        ? [
            this.prisma.cliente.update({
              where: { id: originalVenta.clienteId },
              data: { saldoPendiente: { decrement: originalVenta.saldoPendiente } },
            }),
          ]
        : []),
    ]);

    const borrado = (venta?.count ?? 0) + (gasto?.count ?? 0) > 0;
    if (borrado) {
      this.logger.log(
        `Movimiento ${transactionId} (${entidad}) eliminado y registrado en bitácora de auditoría para sede ${businessId}.`,
      );
    }
    return borrado;
  }

  /** Consulta la bitácora de auditoría para una sede. */
  async listAuditLogs(businessId: string, limit = 50) {
    return this.prisma.bitacoraAuditoria.findMany({
      where: { sedeId: businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Relee un movimiento por su id, venga de la tabla que venga. */
  private async findTransaction(
    businessId: string,
    transactionId: string,
  ): Promise<Transaction | null> {
    const rows = await this.listTransactions({ businessId, limit: 1_000 });
    return rows.find((row) => row.id === transactionId) ?? null;
  }

  // ------------------------------------------------------- escritura: detalle

  /**
   * Traduce un movimiento del dominio a las operaciones de Prisma que le
   * corresponden. Un ingreso es una Venta; todo lo demas, un Gasto.
   *
   * Devuelve una LISTA porque un fiado son dos escrituras: la venta y la deuda
   * del cliente. Antes solo se creaba la venta, asi que `Cliente.saldoPendiente`
   * se quedaba en cero y el panel mostraba a un cliente sin deudas mientras la
   * venta decia lo contrario; peor aun, el registro de abonos lo rechazaba
   * ("el abono supera el saldo pendiente del cliente"). Las dos filas van en la
   * misma transaccion para que no puedan quedar desalineadas.
   */
  private buildWriteOperations(
    transaction: Transaction,
    clientes: Map<string, string>,
  ): Prisma.PrismaPromise<unknown>[] {
    const clienteId = transaction.customerName
      ? (clientes.get(customerKey(transaction)) ?? null)
      : null;

    const esFiado = transaction.type === 'income' && !!transaction.isCredit;

    const movimiento =
      transaction.type === 'income'
        ? this.prisma.venta.create({
            data: {
              id: transaction.id,
              sedeId: transaction.businessId,
              total: new Prisma.Decimal(transaction.amount),
              // Un fiado se registra como venta a credito con su saldo por
              // cobrar. Antes todo entraba como CONTADO y el reporte de fiados,
              // que filtra por saldoPendiente > 0, nunca los veia.
              tipo: esFiado ? 'FIADO' : 'CONTADO',
              saldoPendiente: new Prisma.Decimal(
                esFiado ? transaction.amount : 0,
              ),
              // Sin plazo no hay deuda "vencida", y el panel no puede avisar.
              fechaVencimiento: esFiado
                ? sumarDiasAFecha(
                    fechaDelMovimiento(transaction),
                    DIAS_CREDITO_POR_DEFECTO,
                  )
                : null,
              descripcion: transaction.description,
              metodoPago: transaction.paymentMethod
                ? PAYMENT_TO_PRISMA[transaction.paymentMethod]
                : null,
              grupoId: transaction.groupId ?? null,
              clienteId,
              fecha: fechaDelMovimiento(transaction),
            },
          })
        : this.prisma.gasto.create({
            data: {
              id: transaction.id,
              sedeId: transaction.businessId,
              descripcion: buildDescription(transaction),
              monto: new Prisma.Decimal(transaction.amount),
              categoria: CATEGORY_TO_PRISMA[transaction.category] ?? 'OTROS',
              metodoPago: transaction.paymentMethod
                ? PAYMENT_TO_PRISMA[transaction.paymentMethod]
                : null,
              grupoId: transaction.groupId ?? null,
              fecha: fechaDelMovimiento(transaction),
            },
          });

    if (!esFiado || !clienteId) return [movimiento];

    return [
      movimiento,
      this.prisma.cliente.update({
        where: { id: clienteId },
        data: { saldoPendiente: { increment: transaction.amount } },
      }),
    ];
  }

  /**
   * Busca o crea los clientes de las ventas fiadas y devuelve sus ids.
   *
   * Un fiado sin cliente no sirve para nada: el reporte de cuentas por cobrar
   * necesita saber a quien cobrarle. Se busca por nombre dentro de la sede,
   * sin distinguir mayusculas, y se crea si no existe.
   */
  private async resolveCustomers(
    transactions: Transaction[],
  ): Promise<Map<string, string>> {
    const resultado = new Map<string, string>();

    const pendientes = transactions.filter(
      (transaction) => transaction.isCredit && transaction.customerName,
    );

    for (const transaction of pendientes) {
      const clave = customerKey(transaction);
      if (resultado.has(clave)) continue;

      const nombre = transaction.customerName!.trim();
      const existente = await this.prisma.cliente.findFirst({
        where: {
          sedeId: transaction.businessId,
          nombre: { equals: nombre, mode: 'insensitive' },
        },
      });

      const cliente =
        existente ??
        (await this.prisma.cliente.create({
          data: { nombre, sedeId: transaction.businessId },
        }));

      resultado.set(clave, cliente.id);
    }

    return resultado;
  }
}

// -------------------------------------------------------------------- mapeos

const CATEGORY_TO_PRISMA: Partial<Record<TransactionCategory, CategoriaGasto>> =
  {
    renta: CategoriaGasto.ARRIENDO,
    servicios: CategoriaGasto.SERVICIOS,
    nomina: CategoriaGasto.NOMINA,
    transporte: CategoriaGasto.TRANSPORTE,
    // mercancia, insumos, mantenimiento, otros_gastos y las de inversion
    // no tienen equivalente: caen en OTROS (ver cabecera del archivo).
  };

const PAYMENT_TO_PRISMA: Record<PaymentMethod, MetodoPago> = {
  efectivo: MetodoPago.EFECTIVO,
  transferencia: MetodoPago.TRANSFERENCIA,
  tarjeta: MetodoPago.TARJETA,
  otro: MetodoPago.OTRO,
};

const PAYMENT_FROM_PRISMA: Record<MetodoPago, PaymentMethod> = {
  EFECTIVO: 'efectivo',
  TRANSFERENCIA: 'transferencia',
  TARJETA: 'tarjeta',
  OTRO: 'otro',
};

const BENEFICIARY_TO_PRISMA: Record<ProfitBeneficiary, BeneficiarioReparto> = {
  dueno: BeneficiarioReparto.DUENO,
  trabajador: BeneficiarioReparto.TRABAJADOR,
};

/** Plazo estandar de un fiado. El mismo que usa el panel en VentasService. */
const DIAS_CREDITO_POR_DEFECTO = 30;
const UN_DIA_MS = 86_400_000;

/** Clave para agrupar los fiados que se registraron sin cliente. */
const SIN_CLIENTE = 'sin-cliente';

function sumarDiasAFecha(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * UN_DIA_MS);
}

/** Dias completos entre dos fechas YYYY-MM-DD. Nunca negativo. */
function diasEntre(desde: string, hasta: string): number {
  const inicio = new Date(`${desde}T00:00:00.000Z`).getTime();
  const fin = new Date(`${hasta}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((fin - inicio) / UN_DIA_MS));
}

/**
 * Dos decimales. Los pesos no tienen centavos, pero sumar Decimals convertidos
 * a number deja colas de coma flotante que despues se ven en el mensaje.
 */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Saldo que le queda a un fiado cuando se corrige su total.
 *
 * Lo ya abonado no se toca: se resta del nuevo total. Si el cliente ya habia
 * pagado mas que el total corregido, el saldo queda en cero y no en negativo.
 */
function nuevoSaldo(
  venta: { total: Prisma.Decimal; saldoPendiente: Prisma.Decimal },
  nuevoTotal: number,
): Prisma.Decimal {
  const abonado = toNumber(venta.total) - toNumber(venta.saldoPendiente);
  return new Prisma.Decimal(Math.max(0, redondear(nuevoTotal - abonado)));
}

/** Ver `fechaDelMovimiento`: es el mismo criterio para un abono. */
function fechaDelPago(payment: PaymentRequest): Date {
  if (payment.occurredAt) {
    const instante = new Date(payment.occurredAt);
    if (!Number.isNaN(instante.getTime())) return instante;
  }

  return new Date(`${payment.date}T12:00:00.000Z`);
}

/** Respuesta cuando el pago no se pudo aplicar a nada. */
function sinAplicar(
  reason: PaymentResult['reason'],
  customerName: string,
): PaymentResult {
  return {
    applied: false,
    reason,
    customerName,
    amount: 0,
    remaining: 0,
    excess: 0,
    settledSales: 0,
  };
}

/** Identifica a un cliente dentro de una sede, sin distinguir mayusculas. */
function customerKey(transaction: Transaction): string {
  return `${transaction.businessId}:${(transaction.customerName ?? '').trim().toLowerCase()}`;
}

const CATEGORY_FROM_PRISMA: Record<CategoriaGasto, TransactionCategory> = {
  ARRIENDO: 'renta',
  SERVICIOS: 'servicios',
  NOMINA: 'nomina',
  TRANSPORTE: 'transporte',
  OTROS: 'otros_gastos',
};

/**
 * Conserva en texto lo que el enum de la base no puede guardar: la categoria
 * fina de la IA y si era una inversion. Asi el dato no se pierde para quien
 * lea la tabla, aunque el enum diga OTROS.
 */
/**
 * Instante con el que se guarda el movimiento. Son dos casos distintos.
 *
 * 1. EL USUARIO DIJO LA FECHA ("el 23 de agosto vendi una cama").
 *    No hay hora que registrar, asi que se usa el mediodia UTC: cualquier otra
 *    hora podria correr el movimiento al dia anterior o al siguiente al
 *    convertirlo de zona horaria.
 *
 * 2. NO DIJO NADA.
 *    Entonces si hay una hora real, la del mensaje, y guardarla importa: es la
 *    que se le muestra al usuario y la que ordena los movimientos dentro del
 *    dia. Antes se tiraba y todo quedaba a las 7:00 a. m. hora Colombia, con
 *    dos consecuencias: la hora que veia era falsa, y un fiado y su abono del
 *    mismo dia compartian instante, asi que no habia forma de saber cual fue
 *    primero.
 *
 * En los dos casos la FECHA que se lee despues es la misma: `fechaColombiana`
 * la resuelve en horario de Bogota, y los reportes por dia no cambian.
 */
export function fechaDelMovimiento(transaction: Transaction): Date {
  if (transaction.occurredAt) {
    const instante = new Date(transaction.occurredAt);
    if (!Number.isNaN(instante.getTime())) return instante;
  }

  return new Date(`${transaction.date}T12:00:00.000Z`);
}

function buildDescription(transaction: Transaction): string {
  const prefix =
    transaction.type === 'investment'
      ? 'Inversion'
      : CATEGORY_TO_PRISMA[transaction.category]
        ? null
        : CATEGORY_LABELS[transaction.category];

  return prefix
    ? `${prefix} · ${transaction.description}`
    : transaction.description;
}

// ------------------------------------------------------------------- helpers

/**
 * Rango de fechas para Prisma.
 *
 * `from` y `to` son dias COLOMBIANOS, y aqui se convierten a los instantes UTC
 * que los delimitan: el 30 de agosto va de las 05:00Z de ese dia a las 04:59Z
 * del siguiente. Antes se interpretaban como dias UTC, y entonces todo lo
 * registrado despues de las 7 p.m. hora local caia fuera de "hoy".
 */
function dateRange(
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;

  return {
    gte: from ? inicioDelDia(from) : undefined,
    lte: to ? finDelDia(to) : undefined,
  };
}

/**
 * El dia que se le muestra al usuario. Es el colombiano y no el UTC: a quien
 * registro un gasto a las 11 p.m. del 30 hay que responderle "30", no "31".
 */
function isoDate(date: Date): string {
  return fechaColombiana(date);
}

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function sumByType(rows: Transaction[], type: TransactionType): number {
  return rows
    .filter((row) => row.type === type)
    .reduce((total, row) => total + row.amount, 0);
}

function groupByMonth(rows: Transaction[]): MonthlyTotals[] {
  const months = new Map<string, MonthlyTotals>();

  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const bucket = months.get(month) ?? {
      month,
      income: 0,
      expense: 0,
      investment: 0,
    };
    bucket[row.type] += row.amount;
    months.set(month, bucket);
  }

  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function topCategories(rows: Transaction[]): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();

  for (const row of rows) {
    const key = `${row.type}:${row.category}`;
    const bucket = totals.get(key) ?? {
      category: row.category,
      type: row.type,
      total: 0,
    };
    bucket.total += row.amount;
    totals.set(key, bucket);
  }

  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, 8);
}
