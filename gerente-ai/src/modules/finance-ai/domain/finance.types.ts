/** Modelo de dominio financiero de Luka AI. Independiente de la IA y del ORM. */

/**
 * Intenciones que puede tener un mensaje de WhatsApp.
 * Coincide exactamente con el campo `type` del JSON que devuelve el modelo.
 */
export type MessageIntentType =
  | 'income'
  | 'expense'
  | 'investment'
  | 'query'
  | 'correction'
  | 'unclear'
  /**
   * Desglose de un total que ya se registro antes ("de esos 2 millones,
   * 1.500.000 fueron en efectivo"). No suma dinero nuevo: reemplaza el
   * movimiento total por sus partes.
   */
  | 'breakdown'
  /** Reparto de utilidades entre el dueno y los trabajadores. */
  | 'profit_share'
  /** Le pidieron algo que no son las finanzas del negocio (codigo, poemas...). */
  | 'out_of_scope'
  /** Pidio una funcion que solo existe en los planes pagos. */
  | 'premium'
  /**
   * Le pagaron un fiado, entero o en parte ("Rosa me abono 20.000",
   * "Juan ya me pago todo").
   *
   * No es un movimiento nuevo: es el cobro de una venta a credito que ya
   * estaba registrada. Antes caia en "income" y se registraba como una venta
   * aparte, con lo cual el dinero se contaba dos veces y la deuda del cliente
   * nunca bajaba.
   */
  | 'payment'
  /**
   * Contesto que si o que no a algo que Luka le pregunto.
   *
   * Solo tiene sentido cuando hay una pregunta abierta. Sirve para que borrar
   * nunca ocurra en el mismo turno en que se pide: primero se le enseña que se
   * va a ir, y solo despues se ejecuta.
   */
  | 'confirmation';

/** Solo estas tres intenciones producen un movimiento contable. */
export type TransactionType = 'income' | 'expense' | 'investment';

export type QueryPeriod = 'day' | 'week' | 'month';

/** Categorias cerradas por tipo de movimiento. */
export const EXPENSE_CATEGORIES = [
  'mercancia',
  'insumos',
  'servicios',
  'nomina',
  'renta',
  'transporte',
  'mantenimiento',
  'otros_gastos',
] as const;

export const INCOME_CATEGORIES = [
  'ventas',
  'servicios_prestados',
  'cobros',
  'otros_ingresos',
] as const;

export const INVESTMENT_CATEGORIES = [
  'equipo',
  'maquinaria',
  'infraestructura',
  'tecnologia',
] as const;

export const TRANSACTION_CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...INVESTMENT_CATEGORIES,
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

/** Categorias validas para cada tipo, y a cual caer si el modelo se equivoca. */
export const CATEGORIES_BY_TYPE: Record<
  TransactionType,
  readonly TransactionCategory[]
> = {
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES,
  investment: INVESTMENT_CATEGORIES,
};

export const DEFAULT_CATEGORY_BY_TYPE: Record<
  TransactionType,
  TransactionCategory
> = {
  expense: 'otros_gastos',
  income: 'otros_ingresos',
  investment: 'equipo',
};

/** Etiquetas para mostrar en el panel. La base guarda la clave, no el texto. */
export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  mercancia: 'Mercancía',
  insumos: 'Insumos',
  servicios: 'Servicios',
  nomina: 'Nómina',
  renta: 'Renta',
  transporte: 'Transporte',
  mantenimiento: 'Mantenimiento',
  otros_gastos: 'Otros gastos',
  ventas: 'Ventas',
  servicios_prestados: 'Servicios prestados',
  cobros: 'Cobros',
  otros_ingresos: 'Otros ingresos',
  equipo: 'Equipo',
  maquinaria: 'Maquinaria',
  infraestructura: 'Infraestructura',
  tecnologia: 'Tecnología',
};

/**
 * Como entro o salio el dinero. Espeja el enum `MetodoPago` de la base.
 *
 * Sirve para desglosar un total en sus partes ("de los $2.000.000, $1.500.000
 * fueron en efectivo") sin perder la relacion con el total: las partes se
 * agrupan con `groupId`.
 */
export const PAYMENT_METHODS = [
  'efectivo',
  'transferencia',
  'tarjeta',
  'otro',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

/** A quien le toca una parte de las utilidades repartidas. */
export const PROFIT_BENEFICIARIES = ['dueno', 'trabajador'] as const;

export type ProfitBeneficiary = (typeof PROFIT_BENEFICIARIES)[number];

export const PROFIT_BENEFICIARY_LABELS: Record<ProfitBeneficiary, string> = {
  dueno: 'Dueño',
  trabajador: 'Trabajador',
};

/** Una parte del reparto de utilidades, ya validada. */
export interface ProfitShare {
  beneficiary: ProfitBeneficiary;
  /** Nombre concreto si se dijo ("Maria"). null si solo se dijo el rol. */
  name: string | null;
  /** Porcentaje del total repartido, de 0 a 100. */
  percentage: number;
  /** Monto que le corresponde, ya calculado sobre el total. */
  amount: number;
}

/**
 * Un movimiento suelto tal como lo entendio el modelo.
 *
 * Un mensaje puede contener varios ("pague 50.000 de transporte y 30.000 de
 * almuerzo"), y cada uno termina siendo una fila propia. Antes solo cabia uno
 * y el modelo se veia obligado a sumarlos en un unico registro.
 */
export interface MovementDraft {
  type: TransactionType;
  /** Siempre positivo. */
  amount: number;
  category: TransactionCategory;
  concept: string | null;
  /** null = el usuario no dijo como pago. */
  paymentMethod: PaymentMethod | null;
  /** true = venta fiada: quedo registrada pero el dinero aun no entro. */
  isCredit: boolean;
  /** A quien se le fio, cuando se menciona. */
  customerName: string | null;
  /**
   * Cuantas unidades, cuando el mensaje o la factura lo dicen.
   *
   * No cambia el monto (ese ya viene total), pero se conserva en la
   * descripcion: "480 cajas de gaseosa" y "480" a secas no dicen lo mismo
   * cuando uno relee sus gastos tres meses despues.
   */
  quantity: number | null;
  /**
   * Fecha del movimiento en YYYY-MM-DD, si el usuario la dijo.
   *
   * null = no la menciono, y entonces vale hoy. Sin esto, quien registra el
   * lunes lo del fin de semana veia todo con la fecha de hoy y sus reportes
   * por dia quedaban mal.
   */
  date: string | null;
}

/**
 * Un pago que le hicieron al negocio sobre un fiado.
 *
 * El monto puede faltar: "Rosa ya me pago" no dice cuanto, y lo correcto es
 * saldar toda su deuda, no adivinar una cifra.
 */
export interface PaymentDraft {
  /** A quien se le cobro. Sin nombre no hay a que deuda aplicarlo. */
  customerName: string | null;
  /** Monto abonado. null cuando el mensaje dice que pago todo. */
  amount: number | null;
  /** true = "ya me pago todo": se salda el saldo completo del cliente. */
  settlesDebt: boolean;
  /** Fecha del pago en YYYY-MM-DD. null = hoy. */
  date: string | null;
}

/**
 * Lo que el usuario quiere cambiar de un movimiento ya registrado.
 *
 * La gente dicta mal por WhatsApp ("eran 60.000, no 50.000") y hasta ahora la
 * unica salida era entrar al panel a corregirlo. Solo se admiten el monto y el
 * concepto: cambiar el tipo implicaria mover la fila de tabla, y para eso es
 * mas claro borrar y volver a registrar.
 */
export interface CorrectionRequest {
  action: 'update' | 'delete';
  /**
   * Texto que identifica el movimiento ("el de transporte").
   *
   * null y sin ningun otro identificador significa "el ultimo que registre".
   * Ojo: null NO puede tomarse como "el ultimo" cuando se esta resolviendo una
   * ambiguedad; ahi hay una lista concreta contra la cual decidir.
   */
  reference: string | null;
  /**
   * Monto que IDENTIFICA cual movimiento es ("es la de 1.530.000").
   *
   * Existe porque sin el no habia forma de usar la respuesta del usuario: Luka
   * preguntaba "dime la fecha o el monto" y despues solo sabia buscar dentro
   * de la descripcion, donde no hay ni fechas ni montos. Peor todavia, el
   * monto dictado se colaba en `newAmount` y terminaba SOBRESCRIBIENDO un
   * movimiento con la cifra que solo servia para nombrarlo.
   */
  referenceAmount: number | null;
  /** Fecha que IDENTIFICA cual movimiento es, en YYYY-MM-DD. */
  referenceDate: string | null;
  /**
   * Posiciones de la lista que Luka acaba de mostrar, empezando en 1.
   *
   * Es una LISTA porque la gente escoge varios de una: "borra el segundo y el
   * tercero, el primero dejalo". Con un solo numero eso no se podia expresar:
   * el modelo o marcaba "todos" —y Luka ofrecia borrar los tres— o se quedaba
   * con uno solo. Los dos casos se vieron en produccion.
   *
   * Vacia cuando el usuario no señalo ninguna posicion.
   */
  referenceIndexes: number[];
  /** Monto corregido. Solo el valor NUEVO, nunca el que identifica. */
  newAmount: number | null;
  newConcept: string | null;
  /**
   * true cuando pidio borrar TODO un periodo ("borra todo lo de hoy"), no un
   * movimiento suelto. El periodo viaja en `queryPeriod`.
   */
  deleteAll: boolean;
  /**
   * true cuando habla de un GRUPO de movimientos, no de uno: "elimina estos
   * dos", "borra esos", "ambos".
   *
   * Sin esto, referirse a varios caia en el camino de "buscar uno" y Luka
   * respondia que no encontraba nada o preguntaba cual, cuando el usuario ya
   * habia dicho que eran todos los que estaba senalando.
   */
  matchAll: boolean;
}

/** Que clase de consulta hizo el usuario. */
export type QueryKind =
  /** "¿Como voy?" → totales del periodo. */
  | 'summary'
  /** "¿Cuales son esos 8 movimientos?" → el detalle, uno por uno. */
  | 'list'
  /** "¿Que dia compre jabones?" → busqueda por concepto. */
  | 'search'
  /**
   * "¿Quien me debe?" → la cartera completa, con nombres y saldos.
   *
   * Es distinto de buscar los fiados de UNA persona: eso es consultar lo
   * propio y va por "search". Esto es la vista consolidada y ordenada por
   * antiguedad, que es lo que se cobra en los planes pagos.
   */
  | 'receivables';

/**
 * Lo que el modelo entiende de un mensaje. Es exactamente el JSON del
 * system prompt, ya validado y normalizado.
 */
export interface MessageIntent {
  type: MessageIntentType;
  /**
   * Movimientos detectados en el mensaje, ya validados. Vacio si el mensaje no
   * registraba nada (una consulta, un saludo).
   */
  movements: MovementDraft[];
  /**
   * Total general que el usuario declaro de viva voz ("hoy vendi $2.000.000").
   * Se compara contra la suma de `movements` para detectar desgloses que no
   * cuadran. null = no dijo un total, solo las partes.
   */
  declaredTotal: number | null;
  /**
   * Descuento aplicado al conjunto del mensaje.
   *
   * Una factura trae subtotal, descuento y total a pagar. Sin este campo, las
   * lineas sumaban el subtotal, el usuario decia el total, y el backend lo
   * tomaba por un error de dedo: respondia "las partes no cuadran" y no
   * registraba nada. El descuento explica la diferencia.
   *
   * Se reparte entre los movimientos, porque lo que salio de la caja es el
   * total pagado y no el subtotal: guardar el subtotal inflaria los gastos del
   * mes por plata que nunca se movio.
   */
  discount: number | null;
  /** Reparto de utilidades, cuando el mensaje lo menciona. */
  profitShares: ProfitShare[];
  /** Que corregir, cuando el mensaje pide arreglar algo ya registrado. */
  correction: CorrectionRequest | null;
  /** El abono, cuando el mensaje avisa que le pagaron un fiado. */
  payment: PaymentDraft | null;
  /**
   * Respuesta a una pregunta de si o no. null cuando el mensaje no contesta
   * ninguna, o cuando contesto algo que no es ni si ni no.
   */
  confirmed: boolean | null;
  /**
   * Cuantos movimientos dijo el usuario al confirmar ("borrar los 4").
   *
   * Un borrado de varios no se acepta con un "si" a secas. Paso de verdad: Luka
   * ofrecio borrar cinco movimientos, el usuario contesto "Si" sin leer la
   * lista y perdio todo el dia. Obligar a repetir el numero convierte el visto
   * bueno en un acto consciente.
   */
  confirmedCount: number | null;
  /**
   * Suma de los movimientos. Se conserva por compatibilidad: los consumidores
   * que solo manejan un movimiento (n8n, el panel) siguen leyendo aqui.
   */
  amount: number | null;
  /** Categoria del movimiento cuando hay exactamente uno. */
  category: string | null;
  concept: string | null;
  responseText: string;
  /** Que clase de consulta es. Solo para type "query". */
  queryKind: QueryKind | null;
  queryPeriod: QueryPeriod | null;
  /**
   * Que tan seguro esta el modelo de su propia interpretacion (0 a 1).
   *
   * Lo pide el prompt, pero nunca se confia en el a ciegas: si el modelo no lo
   * devuelve o devuelve basura, el backend lo deriva de la calidad de los datos
   * extraidos (ver `normalizeConfidence`). Sirve para dos cosas: avisar en los
   * logs cuando la interpretacion es floja, y exponerlo a los canales externos
   * (n8n / WhatsApp) que deciden si pedir confirmacion al usuario.
   */
  confidence: number;
}

export interface Transaction {
  id: string;
  businessId: string;
  /** Fecha del movimiento en formato YYYY-MM-DD. */
  date: string;
  description: string;
  category: TransactionCategory;
  /** Siempre positivo; el signo lo determina `type`. */
  amount: number;
  type: TransactionType;
  currency: string;
  source: 'whatsapp' | 'manual' | 'import';
  createdAt: string;
  /**
   * Campos opcionales: los movimientos antiguos y los creados desde el panel
   * no los tienen, y todo el codigo existente sigue funcionando sin ellos.
   */
  /** Como se movio el dinero. */
  paymentMethod?: PaymentMethod | null;
  /** true = venta fiada: registrada, pero todavia por cobrar. */
  isCredit?: boolean;
  /**
   * Lo que TODAVIA se debe de esta venta fiada. null en las de contado.
   *
   * Es distinto de `amount`: `amount` es lo que se vendio y no cambia nunca;
   * `pendingAmount` baja con cada abono y llega a 0 cuando el cliente termina
   * de pagar. Sin este campo, un fiado ya cobrado seguia apareciendo entero en
   * las cuentas por cobrar.
   */
  pendingAmount?: number | null;
  /** Cliente al que se le fio. */
  customerName?: string | null;
  /** Une el total con sus desgloses por metodo de pago. */
  groupId?: string | null;
  /**
   * Instante exacto en que ocurrio, cuando se conoce. ISO 8601.
   *
   * Solo se llena cuando el usuario NO dijo una fecha: entonces el momento del
   * mensaje es la hora real del hecho y hay que conservarla. Si dijo "el 23 de
   * agosto", no hay hora que guardar y este campo va null.
   *
   * Existe porque antes todo se guardaba al mediodia UTC, o sea las 7:00 a. m.
   * en Colombia: un gasto de las 5:55 p. m. se mostraba a las 7 de la manana, y
   * todos los movimientos del mismo dia compartian el mismo instante, asi que
   * la lista de "ultimos movimientos" los ordenaba al azar. En un fiado y su
   * abono del mismo dia no habia forma de saber cual fue primero.
   */
  occurredAt?: string | null;
}

export interface MonthlyTotals {
  month: string;
  income: number;
  expense: number;
  investment: number;
}

export interface CategoryTotal {
  category: TransactionCategory;
  type: TransactionType;
  total: number;
}

/** Resultado de una consulta ("¿cómo voy esta semana?"). */
export interface PeriodSummary {
  period: QueryPeriod;
  from: string;
  to: string;
  currency: string;
  income: number;
  expense: number;
  investment: number;
  balance: number;
  /**
   * Lo que queda por cobrar de las ventas fiadas del periodo.
   *
   * Es el SALDO, no lo vendido: si se fiaron 300.000 y el cliente ya abono
   * 100.000, aqui hay 200.000. Antes se sumaba la venta completa y la cuenta
   * por cobrar seguia igual por mucho que el cliente pagara.
   *
   * NO esta incluido en `income`. Lo fiado entra a los ingresos cuando se
   * cobra, y entonces lo hace como abono, con la fecha del cobro.
   */
  pendingCollection: number;
  transactionCount: number;
  byCategory: CategoryTotal[];
  /** Ingresos cobrados, agrupados por forma de pago. */
  byPaymentMethod: Partial<Record<PaymentMethod, number>>;
}

/**
 * Lo que un cliente concreto le debe al negocio.
 *
 * Existe para que las recomendaciones puedan decir "Rosa te debe 200.000 desde
 * hace 47 dias" en vez de un total anonimo: al dueno lo que le sirve es saber
 * a quien llamar.
 */
export interface Receivable {
  customerId: string;
  customerName: string;
  /** Lo que aun debe, sumando todas sus ventas fiadas abiertas. */
  pending: number;
  /** Lo que ya abono sobre esas ventas. 0 si nunca ha pagado nada. */
  paid: number;
  /** Lo que se le fio en total (pending + paid). */
  total: number;
  /** Fecha del fiado sin pagar mas antiguo, en YYYY-MM-DD. */
  oldestSince: string;
  /** Dias transcurridos desde ese fiado. Es la antiguedad de la deuda. */
  daysOutstanding: number;
  /** Fecha del ultimo abono. null si nunca ha abonado. */
  lastPaymentDate: string | null;
  /** Dias desde el ultimo abono. null si nunca ha abonado. */
  daysSinceLastPayment: number | null;
  /** Cuantas ventas fiadas suyas siguen abiertas. */
  openSales: number;
}

/** Foto del negocio que se le entrega al modelo para razonar. */
export interface BusinessSnapshot {
  businessId: string;
  businessName: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  /** Solo caja: no incluye las ventas fiadas. */
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  balance: number;
  /** Vendido a credito en el periodo. Nunca sumado a `totalIncome`. */
  totalCreditSales: number;
  /**
   * Lo que le deben al negocio HOY, sin importar cuando se fio.
   *
   * Distinto de `totalCreditSales`: aquel dice cuanto se vendio a credito en
   * el periodo, este cuanto falta por cobrar despues de los abonos.
   */
  totalReceivable: number;
  /** Quien debe, cuanto y desde cuando. Ordenado por deuda mas antigua. */
  receivables: Receivable[];
  monthly: MonthlyTotals[];
  topCategories: CategoryTotal[];
  recentTransactions: Transaction[];
}

export type InsightType = 'warning' | 'success' | 'info';

export interface Insight {
  id: string;
  businessId: string;
  type: InsightType;
  title: string;
  body: string;
  /** Accion concreta sugerida al dueno del negocio. */
  action: string;
  /** 1 = urgente, 5 = informativo. */
  priority: number;
  generatedAt: string;
  read: boolean;
}
