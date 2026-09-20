import type {
  BusinessSnapshot,
  ProfitShare,
  Receivable,
  Transaction,
} from '../domain/finance.types';

/**
 * Puerto de datos financieros.
 *
 * La capa de IA nunca toca la base de datos: pide informacion a traves de este
 * puerto. Hoy lo implementa un adaptador en memoria con datos de demostracion;
 * cuando exista el esquema real, se sustituye por uno de Prisma sin tocar los
 * servicios de IA.
 */

export interface TransactionQuery {
  businessId: string;
  from?: string;
  to?: string;
  type?: Transaction['type'];
  category?: string;
  limit?: number;
}

/** Lo que se puede corregir de un movimiento ya registrado. */
export interface TransactionChanges {
  amount?: number;
  description?: string;
}

/** Un pago que le hicieron al negocio sobre un fiado. */
export interface PaymentRequest {
  businessId: string;
  /** A quien se le cobra. Se busca por nombre dentro de la sede. */
  customerName: string;
  /**
   * Cuanto abono. null = pagar toda la deuda ("Rosa ya me pago").
   *
   * Si el monto supera lo que debe, se aplica solo lo que debia: cobrar de mas
   * dejaria el saldo en negativo, y es mucho mas probable que sea un error de
   * dictado que un pago adelantado.
   */
  amount: number | null;
  /** Fecha del pago en YYYY-MM-DD. */
  date: string;
  /**
   * Instante exacto del pago, cuando el usuario no dijo una fecha. ISO 8601.
   * null cuando si la dijo: ahi no hay hora que registrar.
   */
  occurredAt: string | null;
}

/** Como quedo la deuda despues de aplicar un pago. */
export interface PaymentResult {
  /** false = no habia a que aplicarlo; nada se guardo. */
  applied: boolean;
  /** Por que no se aplico. null cuando si se aplico. */
  reason: 'cliente_no_encontrado' | 'sin_deuda' | null;
  /** El nombre tal como esta guardado, que puede diferir del dictado. */
  customerName: string;
  /** Lo que efectivamente se abono, ya recortado a la deuda existente. */
  amount: number;
  /** Lo que el cliente sigue debiendo despues del abono. */
  remaining: number;
  /**
   * Lo que sobro porque el cliente debia menos de lo que le pagaron.
   * 0 en el caso normal.
   */
  excess: number;
  /** Cuantas ventas fiadas quedaron saldadas con este pago. */
  settledSales: number;
}

/** Un reparto de utilidades listo para guardar. */
export interface ProfitDistribution {
  businessId: string;
  /** Utilidad que se repartio. */
  total: number;
  shares: ProfitShare[];
  date: string;
  groupId: string;
}

export interface FinanceDataPort {
  getSnapshot(businessId: string): Promise<BusinessSnapshot>;
  listTransactions(query: TransactionQuery): Promise<Transaction[]>;
  saveTransactions(transactions: Transaction[]): Promise<Transaction[]>;

  /**
   * Aplica un pago a las ventas fiadas de un cliente.
   *
   * No crea un ingreso nuevo: baja el saldo de las ventas que ya estaban
   * registradas, de la mas antigua a la mas reciente. El ingreso aparece solo
   * cuando el dinero entra, y entra aqui: el abono se lee despues como un
   * movimiento de la categoria "cobros" con la fecha del pago.
   *
   * Nunca lanza por "no encontre al cliente" ni por "no debia nada": son
   * respuestas normales de un mensaje de WhatsApp mal dictado, y quien llama
   * necesita poder contestarle al usuario en vez de fallar.
   */
  registerPayment(payment: PaymentRequest): Promise<PaymentResult>;

  /** Quien le debe al negocio, cuanto y desde cuando. */
  listReceivables(businessId: string): Promise<Receivable[]>;

  /**
   * Sustituye un movimiento por las partes en que se desglosa.
   *
   * Existe para el caso "primero el total, despues el desglose": el usuario
   * registra "hoy vendi 2.000.000" y minutos despues aclara como lo recibio.
   * Guardar las partes sin quitar el total duplicaria el dinero, asi que la
   * sustitucion tiene que ser atomica.
   */
  replaceTransaction(
    businessId: string,
    transactionId: string,
    parts: Transaction[],
    actor?: string,
  ): Promise<Transaction[]>;

  /** Guarda un reparto de utilidades. */
  saveProfitDistribution(
    distribution: ProfitDistribution,
  ): Promise<ProfitDistribution>;

  /**
   * Corrige un movimiento ya registrado.
   *
   * Solo se permiten el monto y el concepto: son los dos datos que la gente
   * dicta mal por WhatsApp. Cambiar el tipo (de gasto a ingreso) implicaria
   * mover la fila de tabla, y para eso es mas claro borrar y volver a
   * registrar.
   *
   * Devuelve el movimiento ya actualizado, o null si no existe.
   */
  updateTransaction(
    businessId: string,
    transactionId: string,
    changes: TransactionChanges,
    actor?: string,
  ): Promise<Transaction | null>;

  /** Elimina un movimiento. Devuelve false si no existia. */
  deleteTransaction(
    businessId: string,
    transactionId: string,
    actor?: string,
  ): Promise<boolean>;

  /** Consulta la bitácora de auditoría de operaciones destructivas. */
  listAuditLogs?(
    businessId: string,
    limit?: number,
  ): Promise<unknown[]>;
}

export const FINANCE_DATA_PORT = Symbol('FINANCE_DATA_PORT');
