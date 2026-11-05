import { Injectable } from '@nestjs/common';

import { randomUUID } from 'node:crypto';

import {
  type BusinessSnapshot,
  type CategoryTotal,
  type MonthlyTotals,
  type Receivable,
  type Transaction,
  type TransactionCategory,
  type TransactionType,
} from '../domain/finance.types';
import type {
  FinanceDataPort,
  PaymentRequest,
  PaymentResult,
  PayrollPayment,
  ProfitDistribution,
  TransactionChanges,
  TransactionQuery,
} from '../ports/finance-data.port';

/**
 * Adaptador en memoria con datos de demostracion, para que los endpoints de IA
 * funcionen antes de que exista la base de datos.
 *
 * Sustituir por `PrismaFinanceDataAdapter` cuando el esquema este listo:
 * solo hay que cambiar el `useClass` en `FinanceAiModule`.
 */
@Injectable()
export class InMemoryFinanceDataAdapter implements FinanceDataPort {
  private readonly businessNames: Record<string, string> = {
    'demo-business': 'El Virrey',
  };

  private readonly transactions: Transaction[] = seedTransactions();
  private readonly profitDistributions: ProfitDistribution[] = [];
  readonly payrolls: PayrollPayment[] = [];

  getSnapshot(businessId: string): Promise<BusinessSnapshot> {
    const rows = this.transactions.filter(
      (transaction) => transaction.businessId === businessId,
    );

    // Mismo criterio que el adaptador real: lo fiado no es caja.
    const contado = rows.filter((row) => !row.isCredit);
    const totalCreditSales = rows
      .filter((row) => row.isCredit)
      .reduce((suma, row) => suma + row.amount, 0);

    const totalIncome = sumByType(contado, 'income');
    const totalExpense = sumByType(contado, 'expense');
    const totalInvestment = sumByType(contado, 'investment');
    const dates = rows.map((row) => row.date).sort();

    return Promise.resolve({
      businessId,
      businessName: this.businessNames[businessId] ?? 'Negocio',
      currency: 'COP',
      periodStart: dates[0] ?? today(),
      periodEnd: dates[dates.length - 1] ?? today(),
      totalIncome,
      totalCreditSales,
      totalExpense,
      totalInvestment,
      balance: totalIncome - totalExpense - totalInvestment,
      totalReceivable: this.deudaViva(businessId).total,
      receivables: this.cuentasPorCobrar(businessId),
      monthly: groupByMonth(contado),
      topCategories: topCategories(contado),
      recentTransactions: [...rows]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 15),
    });
  }

  listTransactions(query: TransactionQuery): Promise<Transaction[]> {
    const rows = this.transactions
      .filter((transaction) => transaction.businessId === query.businessId)
      .filter((transaction) => !query.from || transaction.date >= query.from)
      .filter((transaction) => !query.to || transaction.date <= query.to)
      .filter((transaction) => !query.type || transaction.type === query.type)
      .filter(
        (transaction) =>
          !query.category || transaction.category === query.category,
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    return Promise.resolve(rows.slice(0, query.limit ?? 50));
  }

  saveTransactions(transactions: Transaction[]): Promise<Transaction[]> {
    this.transactions.push(...transactions);
    return Promise.resolve(transactions);
  }

  replaceTransaction(
    businessId: string,
    transactionId: string,
    parts: Transaction[],
  ): Promise<Transaction[]> {
    const indice = this.transactions.findIndex(
      (row) => row.id === transactionId && row.businessId === businessId,
    );

    if (indice >= 0) this.transactions.splice(indice, 1);
    this.transactions.push(...parts);

    return Promise.resolve(parts);
  }

  /**
   * Version en memoria del cobro de un fiado: baja el saldo de las ventas a
   * credito del cliente y deja el abono como un ingreso de categoria "cobros".
   *
   * Replica el criterio del adaptador real —lo mas viejo primero, y el ingreso
   * nace al cobrar, no al fiar— para que las pruebas que corren contra este
   * adaptador digan la verdad sobre el de produccion.
   */
  registerPayment(payment: PaymentRequest): Promise<PaymentResult> {
    const nombre = payment.customerName.trim().toLowerCase();

    const pendientes = this.transactions
      .filter(
        (row) =>
          row.businessId === payment.businessId &&
          row.isCredit &&
          (row.customerName ?? '').trim().toLowerCase() === nombre,
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!pendientes.length) {
      return Promise.resolve(
        sinAplicar('cliente_no_encontrado', payment.customerName),
      );
    }

    const abiertas = pendientes.filter((row) => saldoDe(row) > 0);
    const deuda = redondear(
      abiertas.reduce((suma, row) => suma + saldoDe(row), 0),
    );

    const real = pendientes[0].customerName ?? payment.customerName;
    if (deuda <= 0) return Promise.resolve(sinAplicar('sin_deuda', real));

    const pedido = payment.amount ?? deuda;
    const aplicado = redondear(Math.min(pedido, deuda));

    let porRepartir = aplicado;
    let saldadas = 0;

    for (const fila of abiertas) {
      if (porRepartir <= 0) break;
      const saldo = saldoDe(fila);
      const parte = redondear(Math.min(porRepartir, saldo));
      fila.pendingAmount = redondear(saldo - parte);
      if (fila.pendingAmount === 0) saldadas += 1;
      porRepartir = redondear(porRepartir - parte);
    }

    this.transactions.push({
      id: randomUUID(),
      businessId: payment.businessId,
      date: payment.date,
      description: `Abono de ${real}`,
      category: 'cobros',
      amount: aplicado,
      type: 'income',
      currency: 'COP',
      source: 'whatsapp',
      createdAt: new Date().toISOString(),
      isCredit: false,
      pendingAmount: null,
      customerName: real,
    });

    return Promise.resolve({
      applied: true,
      reason: null,
      customerName: real,
      amount: aplicado,
      remaining: redondear(deuda - aplicado),
      excess: redondear(pedido - aplicado),
      settledSales: saldadas,
    });
  }

  listReceivables(businessId: string): Promise<Receivable[]> {
    return Promise.resolve(this.cuentasPorCobrar(businessId));
  }

  /** Fiados con saldo vivo, agrupados por cliente. */
  private cuentasPorCobrar(businessId: string): Receivable[] {
    const hoy = today();
    const fichas = new Map<string, Receivable>();

    for (const fila of this.transactions) {
      if (fila.businessId !== businessId || !fila.isCredit) continue;
      if (saldoDe(fila) <= 0) continue;

      const nombre = fila.customerName ?? 'Cliente sin identificar';
      const clave = nombre.trim().toLowerCase();

      const ficha = fichas.get(clave) ?? {
        customerId: clave,
        customerName: nombre,
        pending: 0,
        paid: 0,
        total: 0,
        oldestSince: fila.date,
        daysOutstanding: 0,
        lastPaymentDate: null,
        daysSinceLastPayment: null,
        openSales: 0,
      };

      ficha.pending = redondear(ficha.pending + saldoDe(fila));
      ficha.paid = redondear(ficha.paid + (fila.amount - saldoDe(fila)));
      ficha.total = redondear(ficha.total + fila.amount);
      ficha.openSales += 1;
      if (fila.date < ficha.oldestSince) ficha.oldestSince = fila.date;

      fichas.set(clave, ficha);
    }

    for (const ficha of fichas.values()) {
      ficha.daysOutstanding = diasEntre(ficha.oldestSince, hoy);

      const ultimo = this.transactions
        .filter(
          (row) =>
            row.businessId === businessId &&
            row.category === 'cobros' &&
            (row.customerName ?? '').trim().toLowerCase() === ficha.customerId,
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0];

      if (ultimo) {
        ficha.lastPaymentDate = ultimo.date;
        ficha.daysSinceLastPayment = diasEntre(ultimo.date, hoy);
      }
    }

    return [...fichas.values()].sort(
      (a, b) => b.daysOutstanding - a.daysOutstanding,
    );
  }

  private deudaViva(businessId: string): { total: number } {
    return {
      total: redondear(
        this.cuentasPorCobrar(businessId).reduce(
          (suma, ficha) => suma + ficha.pending,
          0,
        ),
      ),
    };
  }

  savePayroll(payment: PayrollPayment): Promise<PayrollPayment> {
    this.payrolls.push(payment);
    return Promise.resolve(payment);
  }

  saveProfitDistribution(
    distribution: ProfitDistribution,
  ): Promise<ProfitDistribution> {
    this.profitDistributions.push(distribution);
    return Promise.resolve(distribution);
  }

  updateTransaction(
    businessId: string,
    transactionId: string,
    changes: TransactionChanges,
  ): Promise<Transaction | null> {
    const fila = this.transactions.find(
      (row) => row.id === transactionId && row.businessId === businessId,
    );
    if (!fila) return Promise.resolve(null);

    if (changes.amount !== undefined) fila.amount = changes.amount;
    if (changes.description !== undefined)
      fila.description = changes.description;

    return Promise.resolve(fila);
  }

  deleteTransaction(
    businessId: string,
    transactionId: string,
  ): Promise<boolean> {
    const indice = this.transactions.findIndex(
      (row) => row.id === transactionId && row.businessId === businessId,
    );
    if (indice < 0) return Promise.resolve(false);

    this.transactions.splice(indice, 1);
    return Promise.resolve(true);
  }
}

// ------------------------------------------------------------------ helpers

function sumByType(rows: Transaction[], type: TransactionType): number {
  return rows
    .filter((row) => row.type === type)
    .reduce((total, row) => total + row.amount, 0);
}

function groupByMonth(rows: Transaction[]): MonthlyTotals[] {
  const buckets = new Map<string, MonthlyTotals>();

  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const bucket = buckets.get(month) ?? {
      month,
      income: 0,
      expense: 0,
      investment: 0,
    };
    bucket[row.type] += row.amount;
    buckets.set(month, bucket);
  }

  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function topCategories(rows: Transaction[]): CategoryTotal[] {
  const buckets = new Map<string, CategoryTotal>();

  for (const row of rows) {
    const key = `${row.type}:${row.category}`;
    const bucket = buckets.get(key) ?? {
      category: row.category,
      type: row.type,
      total: 0,
    };
    bucket.total += row.amount;
    buckets.set(key, bucket);
  }

  return [...buckets.values()].sort((a, b) => b.total - a.total).slice(0, 8);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Datos de demostracion equivalentes a `src/mocks/index.ts` del frontend. */
function seedTransactions(): Transaction[] {
  const rows: [string, string, TransactionCategory, number, TransactionType][] =
    [
      [
        '2025-07-15',
        'Venta mostrador — Cliente Ramirez',
        'ventas',
        4_800_000,
        'income',
      ],
      [
        '2025-07-15',
        'Compra inventario — Dist. Norte',
        'mercancia',
        2_150_000,
        'expense',
      ],
      [
        '2025-07-14',
        'Venta online — Mercado Libre',
        'ventas',
        1_340_000,
        'income',
      ],
      ['2025-07-14', 'Renta local julio', 'renta', 4_500_000, 'expense'],
      [
        '2025-07-14',
        'Venta mostrador — Cliente Lopez',
        'ventas',
        2_200_000,
        'income',
      ],
      ['2025-07-13', 'Nomina semanal', 'nomina', 5_600_000, 'expense'],
      [
        '2025-07-13',
        'Venta mayoreo — Tienda XYZ',
        'ventas',
        9_800_000,
        'income',
      ],
      [
        '2025-07-12',
        'Publicidad Meta Ads',
        'otros_gastos',
        1_200_000,
        'expense',
      ],
      [
        '2025-07-12',
        'Venta mostrador — Cliente Garcia',
        'ventas',
        3_100_000,
        'income',
      ],
      [
        '2025-07-11',
        'Servicios (agua, luz, internet)',
        'servicios',
        780_000,
        'expense',
      ],
      [
        '2025-07-10',
        'Compra de nevera industrial',
        'maquinaria',
        3_200_000,
        'investment',
      ],
      [
        '2025-06-28',
        'Venta mayoreo — Supermercado Sur',
        'ventas',
        7_400_000,
        'income',
      ],
      [
        '2025-06-27',
        'Compra inventario — Proveedor Meza',
        'mercancia',
        3_950_000,
        'expense',
      ],
      ['2025-06-20', 'Venta mostrador — varios', 'ventas', 5_100_000, 'income'],
      ['2025-06-15', 'Renta local junio', 'renta', 4_500_000, 'expense'],
      ['2025-06-10', 'Nomina quincena', 'nomina', 5_600_000, 'expense'],
    ];

  return rows.map(([date, description, category, amount, type], index) => ({
    id: `seed-${index + 1}`,
    businessId: 'demo-business',
    date,
    description,
    category,
    amount,
    type,
    currency: 'COP',
    source: 'import' as const,
    createdAt: new Date(`${date}T12:00:00.000Z`).toISOString(),
  }));
}

/** Lo que falta por cobrar de una venta fiada. Sin abonos, es el total. */
function saldoDe(fila: Transaction): number {
  return fila.pendingAmount ?? fila.amount;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function diasEntre(desde: string, hasta: string): number {
  const inicio = new Date(`${desde}T00:00:00.000Z`).getTime();
  const fin = new Date(`${hasta}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((fin - inicio) / 86_400_000));
}

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
