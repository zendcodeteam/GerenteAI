import type { LlmResponse } from '../../../ai/core/llm.types';
import type { LlmService } from '../../../ai/services/llm.service';
import { ConversationStateService } from './conversation-state.service';
import type {
  PeriodSummary,
  Receivable,
  Transaction,
} from '../domain/finance.types';
import type {
  FinanceDataPort,
  ProfitDistribution,
  PaymentRequest,
  PaymentResult,
  TransactionChanges,
} from '../ports/finance-data.port';
import type { WhatsAppIntentOutput } from '../prompts/whatsapp-assistant.prompt';
import {
  WhatsAppMessageService,
  checkBreakdown,
  periodRange,
  renderMovementList,
  renderSummary,
  repartirDescuento,
} from './whatsapp-message.service';

/**
 * El modelo se sustituye por un doble que devuelve el JSON que queremos
 * probar. Asi se verifica la logica del chatbot (validacion, ramas, consultas)
 * sin gastar cuota y sin depender de que proveedor este configurado.
 */
function fakeLlm(intent: Partial<WhatsAppIntentOutput>): LlmService {
  const response: LlmResponse = {
    text: '',
    toolCalls: [],
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    providerId: 'fake',
    model: 'fake-1',
    latencyMs: 1,
    costUsd: 0,
  };

  return {
    completeJson: () =>
      Promise.resolve({
        data: {
          type: 'unclear',
          movements: [],
          declaredTotal: null,
          profitShares: [],
          concept: null,
          queryKind: null,
          queryPeriod: null,
          responseText: 'ok',
          ...intent,
        },
        response,
      }),
  } as unknown as LlmService;
}

/** Atajo para no repetir los campos que casi nunca cambian en las pruebas. */
function movimiento(
  parcial: Partial<NonNullable<WhatsAppIntentOutput['movements']>[number]>,
): NonNullable<WhatsAppIntentOutput['movements']>[number] {
  return {
    type: 'expense',
    amount: 1000,
    category: 'otros_gastos',
    concept: null,
    paymentMethod: null,
    isCredit: false,
    customerName: null,
    ...parcial,
  };
}

const SEED: Transaction[] = [
  {
    id: '1',
    businessId: 'b1',
    date: '2026-07-14',
    description: 'Compra de harina',
    category: 'mercancia',
    amount: 700_000,
    type: 'expense',
    currency: 'COP',
    source: 'import',
    createdAt: '2026-07-14T12:00:00.000Z',
  },
  {
    id: '2',
    businessId: 'b1',
    date: '2026-07-15',
    description: 'Ventas del dia',
    category: 'ventas',
    amount: 1_500_000,
    type: 'income',
    currency: 'COP',
    source: 'import',
    createdAt: '2026-07-15T12:00:00.000Z',
  },
];

interface FakeFinanceData extends FinanceDataPort {
  saved: Transaction[];
  replaced: { id: string; parts: Transaction[] }[];
  distributions: ProfitDistribution[];
  updated: { id: string; changes: TransactionChanges }[];
  deleted: string[];
  /** Abonos que se pidieron aplicar, para comprobar que llegan bien. */
  payments: PaymentRequest[];
  /** Lo que devolvera `registerPayment`. Cada prueba lo ajusta a su caso. */
  paymentResult: PaymentResult;
  /** La cartera que ve la consulta "quien me debe". */
  receivables: Receivable[];
}

function fakeFinanceData(rows: Transaction[] = SEED): FakeFinanceData {
  const payments: PaymentRequest[] = [];
  const saved: Transaction[] = [];
  const replaced: { id: string; parts: Transaction[] }[] = [];
  const distributions: ProfitDistribution[] = [];
  const updated: { id: string; changes: TransactionChanges }[] = [];
  const deleted: string[] = [];

  const fake: FakeFinanceData = {
    saved,
    replaced,
    distributions,
    payments,
    paymentResult: {
      applied: true,
      reason: null,
      customerName: 'Doña Rosa',
      amount: 20_000,
      remaining: 30_000,
      excess: 0,
      settledSales: 0,
    },
    registerPayment: (payment: PaymentRequest) => {
      payments.push(payment);
      return Promise.resolve(fake.paymentResult);
    },
    receivables: [],
    listReceivables: () => Promise.resolve(fake.receivables),
    getSnapshot: () => Promise.reject(new Error('no usado en estas pruebas')),
    listTransactions: () => Promise.resolve(rows),
    saveTransactions: (transactions: Transaction[]) => {
      saved.push(...transactions);
      return Promise.resolve(transactions);
    },
    replaceTransaction: (
      _businessId: string,
      transactionId: string,
      parts: Transaction[],
    ) => {
      replaced.push({ id: transactionId, parts });
      return Promise.resolve(parts);
    },
    saveProfitDistribution: (distribution: ProfitDistribution) => {
      distributions.push(distribution);
      return Promise.resolve(distribution);
    },
    updated,
    deleted,
    updateTransaction: (
      _businessId: string,
      transactionId: string,
      changes: TransactionChanges,
    ) => {
      updated.push({ id: transactionId, changes });
      const fila = rows.find((row) => row.id === transactionId);
      return Promise.resolve(fila ? { ...fila, ...changes } : null);
    },
    deleteTransaction: (_businessId: string, transactionId: string) => {
      deleted.push(transactionId);
      return Promise.resolve(true);
    },
  };

  return fake;
}

function buildService(
  intent: Partial<WhatsAppIntentOutput>,
  rows: Transaction[] = SEED,
) {
  const financeData = fakeFinanceData(rows);
  const state = new ConversationStateService();
  const service = new WhatsAppMessageService(
    fakeLlm(intent),
    financeData,
    state,
  );
  return { service, financeData, state };
}

function espiarLlm(intent: Partial<WhatsAppIntentOutput>) {
  const visto: { system?: string; messages?: unknown[] } = {};

  const llm = {
    completeJson: (req: { system?: string; messages?: unknown[] }) => {
      visto.system = req.system;
      visto.messages = req.messages;
      return Promise.resolve({
        data: {
          type: 'unclear',
          movements: [],
          declaredTotal: null,
          profitShares: [],
          concept: null,
          queryKind: null,
          queryPeriod: null,
          responseText: 'ok',
          confidence: 0.9,
          ...intent,
        },
        response: {
          text: '',
          toolCalls: [],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          providerId: 'fake',
          model: 'fake-1',
          latencyMs: 1,
          costUsd: 0,
        },
      });
    },
  } as unknown as LlmService;

  return { llm, visto };
}

const BASE_REQUEST = {
  tenantId: 't1',
  businessId: 'b1',
  message: 'mensaje de prueba',
};

describe('WhatsAppMessageService', () => {
  it('registra un gasto y responde con el texto del modelo', async () => {
    const { service, financeData } = buildService({
      type: 'expense',
      movements: [
        movimiento({
          amount: 8000,
          category: 'mercancia',
          concept: 'Compra de mercancía',
        }),
      ],
      responseText: '✅ Registré un gasto de $8.000 en mercancía.',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.intent.type).toBe('expense');
    expect(result.transaction?.amount).toBe(8000);
    expect(result.transaction?.category).toBe('mercancia');
    expect(result.transaction?.source).toBe('whatsapp');
    expect(result.replyText).toContain('Registré un gasto');
    expect(financeData.saved).toHaveLength(1);
  });

  it('no guarda nada si no se pidió persistir', async () => {
    const { service, financeData } = buildService({
      type: 'income',
      movements: [
        movimiento({ type: 'income', amount: 750, category: 'ventas' }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.transaction).not.toBeNull();
    expect(financeData.saved).toHaveLength(0);
  });

  it('rechaza una categoría que no corresponde al tipo', async () => {
    // "ventas" es categoría de ingreso: en un gasto no puede pasar.
    const { service } = buildService({
      type: 'expense',
      movements: [movimiento({ amount: 5000, category: 'ventas' })],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.transaction?.category).toBe('otros_gastos');
  });

  it('convierte montos negativos en positivos', async () => {
    const { service } = buildService({
      type: 'expense',
      movements: [movimiento({ amount: -3000, category: 'insumos' })],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.transaction?.amount).toBe(3000);
  });

  it('pide aclaración si el modelo dice "gasto" pero no deja monto', async () => {
    const { service, financeData } = buildService({
      type: 'expense',
      movements: [movimiento({ amount: null, category: 'insumos' })],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.intent.type).toBe('unclear');
    expect(result.intent.category).toBeNull();
    expect(result.transaction).toBeNull();
    expect(result.replyText).toContain('monto');
    expect(financeData.saved).toHaveLength(0);
  });

  it('responde una consulta con las cifras reales del negocio', async () => {
    const { service } = buildService({
      type: 'query',
      queryPeriod: 'week',
      responseText: 'Dame un momento, voy a consultar tu resumen.',
    });

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.summary).not.toBeNull();
    expect(result.summary?.income).toBe(1_500_000);
    expect(result.summary?.expense).toBe(700_000);
    expect(result.summary?.balance).toBe(800_000);
    // El texto que se envía lleva los números del backend, no el "dame un momento".
    expect(result.replyText).toContain('$1.500.000');
    expect(result.replyText).not.toContain('Dame un momento');
  });

  it('respeta la confianza que reporta el modelo', async () => {
    const { service } = buildService({
      type: 'expense',
      movements: [movimiento({ amount: 8000, category: 'mercancia' })],
      confidence: 0.95,
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.intent.confidence).toBe(0.95);
  });

  it('deriva la confianza si el modelo no la envía o manda basura', async () => {
    // Modelo pequeño que ignora el campo: se infiere de lo que sí extrajo.
    const sinCampo = buildService({
      type: 'expense',
      movements: [
        movimiento({
          amount: 8000,
          category: 'mercancia',
          concept: 'Compra de harina',
        }),
      ],
      responseText: 'ok',
      confidence: undefined,
    });
    const conConcepto = await sinCampo.service.handleMessage(BASE_REQUEST);
    expect(conConcepto.intent.confidence).toBe(0.9);

    // Fuera de rango: tampoco se acepta.
    const fueraDeRango = buildService({
      type: 'query',
      queryPeriod: 'week',
      confidence: 42,
      responseText: 'ok',
    });
    const consulta = await fueraDeRango.service.handleMessage(BASE_REQUEST);
    expect(consulta.intent.confidence).toBe(0.85);
  });

  it('baja la confianza cuando degrada el mensaje a unclear', async () => {
    const { service } = buildService({
      type: 'expense',
      movements: [movimiento({ amount: null, category: 'insumos' })],
      confidence: 0.99,
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.intent.type).toBe('unclear');
    expect(result.intent.confidence).toBeLessThanOrEqual(0.4);
  });

  it('trata un tipo desconocido como unclear', async () => {
    const { service } = buildService({
      type: 'transferencia',
      movements: [movimiento({ amount: 1000 })],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.intent.type).toBe('unclear');
    expect(result.transaction).toBeNull();
  });
});

describe('periodRange', () => {
  // Miercoles 15 de julio de 2026.
  const wednesday = new Date(2026, 6, 15, 10, 0, 0);

  it('day: solo hoy', () => {
    expect(periodRange('day', wednesday)).toEqual({
      from: '2026-07-15',
      to: '2026-07-15',
    });
  });

  it('week: desde el lunes de la semana en curso', () => {
    expect(periodRange('week', wednesday)).toEqual({
      from: '2026-07-13',
      to: '2026-07-15',
    });
  });

  it('week: el domingo cierra la semana que arrancó el lunes', () => {
    const sunday = new Date(2026, 6, 19, 10, 0, 0);
    expect(periodRange('week', sunday)).toEqual({
      from: '2026-07-13',
      to: '2026-07-19',
    });
  });

  it('month: desde el primero del mes', () => {
    expect(periodRange('month', wednesday)).toEqual({
      from: '2026-07-01',
      to: '2026-07-15',
    });
  });
});

describe('renderSummary', () => {
  const base: PeriodSummary = {
    period: 'week',
    from: '2026-07-13',
    to: '2026-07-15',
    currency: 'COP',
    income: 1_500_000,
    expense: 900_000,
    investment: 0,
    balance: 600_000,
    pendingCollection: 0,
    transactionCount: 4,
    byPaymentMethod: {},
    byCategory: [
      { category: 'mercancia', type: 'expense', total: 700_000 },
      { category: 'ventas', type: 'income', total: 1_500_000 },
    ],
  };

  it('incluye las cifras reales del periodo', () => {
    const text = renderSummary(base);
    expect(text).toContain('esta semana');
    expect(text).toContain('$1.500.000');
    expect(text).toContain('$900.000');
    expect(text).toContain('Mercancía');
  });

  it('omite inversiones cuando no hubo', () => {
    expect(renderSummary(base)).not.toContain('Inversiones');
    expect(renderSummary({ ...base, investment: 500_000 })).toContain(
      'Inversiones',
    );
  });

  it('avisa cuando no hay movimientos, sin inventar cifras', () => {
    const text = renderSummary({ ...base, transactionCount: 0 });
    expect(text).toContain('Todavía no tienes movimientos');
    expect(text).not.toContain('$');
  });

  it('no usa markdown: el texto va a WhatsApp', () => {
    const text = renderSummary(base);
    expect(text).not.toMatch(/[*_`#]/);
  });
});

describe('WhatsAppMessageService · contexto de la conversación', () => {
  /** Captura lo que se le manda al modelo, para verificar prompt e historial. */

  it('le pasa al modelo los turnos anteriores', async () => {
    // Sin esto, Luka preguntaba el monto, el usuario lo respondía suelto y
    // volvía a preguntar lo mismo: cada mensaje llegaba sin pasado.
    const { llm, visto } = espiarLlm({ type: 'unclear' });
    const service = new WhatsAppMessageService(
      llm,
      fakeFinanceData(),
      new ConversationStateService(),
    );

    await service.handleMessage({
      ...BASE_REQUEST,
      message: 'Mejoras en local',
      history: [
        { role: 'user', content: 'Invertí 1530000' },
        { role: 'assistant', content: '¿En qué invertiste los $1.530.000?' },
      ],
    });

    expect(visto.messages).toEqual([
      { role: 'user', content: 'Invertí 1530000' },
      { role: 'assistant', content: '¿En qué invertiste los $1.530.000?' },
      { role: 'user', content: 'Mejoras en local' },
    ]);
  });

  it('le dice al modelo qué plan tiene el negocio', async () => {
    const { llm, visto } = espiarLlm({ type: 'unclear' });
    const service = new WhatsAppMessageService(
      llm,
      fakeFinanceData(),
      new ConversationStateService(),
    );

    await service.handleMessage({
      ...BASE_REQUEST,
      planName: 'Asistente',
      planIsFree: true,
    });

    expect(visto.system).toContain('Plan contratado: Asistente');
    expect(visto.system).toContain('gratuito');
  });

  it('acepta la intención de función de pago sin degradarla', async () => {
    const { llm } = espiarLlm({
      type: 'premium',
      concept: 'reporte por producto',
      responseText: 'Eso está en los planes pagos.',
    });
    const service = new WhatsAppMessageService(
      llm,
      fakeFinanceData(),
      new ConversationStateService(),
    );

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.intent.type).toBe('premium');
    expect(result.transaction).toBeNull();
  });
});

describe('WhatsAppMessageService · búsqueda por concepto', () => {
  it('busca movimientos por texto en vez de devolver el resumen', async () => {
    // "¿Qué día compré harina?" antes caía en el resumen del mes y el usuario
    // recibía los mismos totales sin importar qué hubiera preguntado.
    const { service } = buildService({
      type: 'query',
      concept: 'harina',
      responseText: 'Déjame buscar.',
    });

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.summary).toBeNull();
    expect(result.replyText).toContain('Compra de harina');
    expect(result.replyText).toContain('$700.000');
  });

  it('encuentra sin importar tildes ni mayúsculas', async () => {
    const { service } = buildService({
      type: 'query',
      concept: 'HARÍNA',
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.replyText).toContain('Compra de harina');
  });

  it('lo dice claro cuando no encuentra nada, sin inventar', async () => {
    const { service } = buildService({
      type: 'query',
      concept: 'jabones',
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.replyText).toContain('No encontré movimientos');
    expect(result.replyText).toContain('jabones');
    expect(result.replyText).not.toContain('$');
  });

  it('sin concepto sigue devolviendo el resumen del periodo', async () => {
    const { service } = buildService({
      type: 'query',
      queryPeriod: 'week',
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.summary).not.toBeNull();
  });
});

// ===========================================================================
// Error 2 - varios movimientos en un mismo mensaje
// ===========================================================================

describe('WhatsAppMessageService - varios movimientos', () => {
  it('registra un movimiento por cada gasto, no la suma', async () => {
    // "Pague 50.000 de transporte y 30.000 de almuerzo" terminaba como un solo
    // gasto de 80.000, y despues no habia forma de consultar uno por separado.
    const { service, financeData } = buildService({
      type: 'expense',
      movements: [
        movimiento({
          amount: 50_000,
          category: 'transporte',
          concept: 'Transporte',
        }),
        movimiento({
          amount: 30_000,
          category: 'otros_gastos',
          concept: 'Almuerzo',
        }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((row) => row.amount)).toEqual([
      50_000, 30_000,
    ]);
    expect(result.transactions.map((row) => row.description)).toEqual([
      'Transporte',
      'Almuerzo',
    ]);
    expect(financeData.saved).toHaveLength(2);
  });

  it('agrupa los movimientos del mismo mensaje con un groupId comun', async () => {
    const { service } = buildService({
      type: 'expense',
      movements: [
        movimiento({ amount: 50_000, concept: 'Transporte' }),
        movimiento({ amount: 30_000, concept: 'Almuerzo' }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    const grupos = new Set(result.transactions.map((row) => row.groupId));

    expect(grupos.size).toBe(1);
    expect([...grupos][0]).toBeTruthy();
  });

  it('un solo movimiento no se agrupa: no hay nada que agrupar', async () => {
    const { service } = buildService({
      type: 'expense',
      movements: [movimiento({ amount: 50_000 })],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.transactions[0].groupId).toBeNull();
  });

  it('el texto de respuesta detalla cada movimiento con su monto', async () => {
    const { service } = buildService({
      type: 'expense',
      movements: [
        movimiento({ amount: 50_000, concept: 'Transporte' }),
        movimiento({ amount: 30_000, concept: 'Almuerzo' }),
      ],
      responseText: 'Registre todo.',
    });

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.replyText).toContain('$50.000');
    expect(result.replyText).toContain('$30.000');
    expect(result.replyText).toContain('$80.000');
  });

  it('descarta los movimientos sin monto y conserva los validos', async () => {
    const { service } = buildService({
      type: 'expense',
      movements: [
        movimiento({ amount: 50_000, concept: 'Transporte' }),
        movimiento({ amount: null, concept: 'Algo sin precio' }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(50_000);
  });
});

// ===========================================================================
// Error 1 - total general, desglose y validacion de la suma
// ===========================================================================

describe('checkBreakdown', () => {
  it('acepta un desglose que cuadra con el total', () => {
    expect(
      checkBreakdown(2_000_000, [
        { amount: 1_500_000 },
        { amount: 200_000 },
        { amount: 300_000 },
      ]),
    ).toBeNull();
  });

  it('detecta cuando faltan pesos por asignar', () => {
    const descuadre = checkBreakdown(2_000_000, [
      { amount: 1_500_000 },
      { amount: 200_000 },
    ]);

    expect(descuadre).not.toBeNull();
    expect(descuadre?.sum).toBe(1_700_000);
    expect(descuadre?.difference).toBe(300_000);
  });

  it('detecta cuando las partes se pasan del total', () => {
    const descuadre = checkBreakdown(1_000_000, [
      { amount: 800_000 },
      { amount: 500_000 },
    ]);
    expect(descuadre?.difference).toBe(-300_000);
  });

  it('sin total declarado no hay nada que verificar', () => {
    expect(checkBreakdown(null, [{ amount: 100 }, { amount: 200 }])).toBeNull();
  });

  it('tolera un peso de diferencia por redondeos', () => {
    expect(
      checkBreakdown(1_000_000, [{ amount: 999_999.5 }, { amount: 0.5 }]),
    ).toBeNull();
  });
});

describe('WhatsAppMessageService - total con desglose', () => {
  it('registra las partes cuando el desglose cuadra con el total', async () => {
    const { service, financeData } = buildService({
      type: 'income',
      declaredTotal: 2_000_000,
      movements: [
        movimiento({
          type: 'income',
          amount: 1_500_000,
          category: 'ventas',
          concept: 'Ventas en efectivo',
          paymentMethod: 'efectivo',
        }),
        movimiento({
          type: 'income',
          amount: 500_000,
          category: 'ventas',
          concept: 'Ventas con tarjeta',
          paymentMethod: 'tarjeta',
        }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].paymentMethod).toBe('efectivo');
    expect(result.transactions[1].paymentMethod).toBe('tarjeta');
    expect(financeData.saved).toHaveLength(2);
  });

  it('NO registra nada cuando el desglose no cuadra: pregunta', async () => {
    // Registrar cifras que no suman es peor que no registrar: el error queda
    // escondido dentro de la contabilidad.
    const { service, financeData } = buildService({
      type: 'income',
      declaredTotal: 2_000_000,
      movements: [
        movimiento({ type: 'income', amount: 1_500_000, category: 'ventas' }),
        movimiento({ type: 'income', amount: 200_000, category: 'ventas' }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.intent.type).toBe('unclear');
    expect(result.transactions).toHaveLength(0);
    expect(financeData.saved).toHaveLength(0);
    expect(result.replyText).toContain('$2.000.000');
    expect(result.replyText).toContain('$1.700.000');
    expect(result.replyText).toContain('$300.000');
  });
});

describe('WhatsAppMessageService - desglose de un total ya registrado', () => {
  /** El total que el usuario registro antes, listo para ser desglosado. */
  const TOTAL_PREVIO: Transaction[] = [
    {
      id: 'venta-total',
      businessId: 'b1',
      date: '2026-07-15',
      description: 'Ventas del dia',
      category: 'ventas',
      amount: 2_000_000,
      type: 'income',
      currency: 'COP',
      source: 'whatsapp',
      createdAt: '2026-07-15T12:00:00.000Z',
      groupId: null,
    },
  ];

  const PARTES = [
    movimiento({
      type: 'income',
      amount: 1_500_000,
      category: 'ventas',
      concept: 'Ventas en efectivo',
      paymentMethod: 'efectivo',
    }),
    movimiento({
      type: 'income',
      amount: 500_000,
      category: 'ventas',
      concept: 'Ventas con tarjeta',
      paymentMethod: 'tarjeta',
    }),
  ];

  it('reemplaza el total por sus partes en vez de duplicar el dinero', async () => {
    const { service, financeData } = buildService(
      { type: 'breakdown', movements: PARTES, responseText: 'ok' },
      TOTAL_PREVIO,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.replaced).toHaveLength(1);
    expect(financeData.replaced[0].id).toBe('venta-total');
    expect(financeData.replaced[0].parts).toHaveLength(2);
    // Nada se guarda por la via normal: seria plata contada dos veces.
    expect(financeData.saved).toHaveLength(0);
    expect(result.replyText).toContain('$2.000.000');
  });

  it('las partes heredan la relacion con el total original', async () => {
    const conGrupo: Transaction[] = [{ ...TOTAL_PREVIO[0], groupId: null }];
    const { service, financeData } = buildService(
      { type: 'breakdown', movements: PARTES, responseText: 'ok' },
      conGrupo,
    );

    await service.handleMessage({ ...BASE_REQUEST, persist: true });
    const grupos = new Set(
      financeData.replaced[0].parts.map((row) => row.groupId),
    );

    expect(grupos.size).toBe(1);
    expect([...grupos][0]).toBeTruthy();
  });

  it('si no encuentra el total previo, registra las partes como nuevas', async () => {
    // El usuario puede desglosar algo que nunca registro: mejor guardarlo que
    // perderlo.
    const { service, financeData } = buildService(
      { type: 'breakdown', movements: PARTES, responseText: 'ok' },
      [],
    );

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(financeData.replaced).toHaveLength(0);
    expect(financeData.saved).toHaveLength(2);
  });

  it('no toca un movimiento que ya estaba desglosado', async () => {
    const yaDesglosado: Transaction[] = [
      { ...TOTAL_PREVIO[0], groupId: 'grupo-existente' },
    ];
    const { service, financeData } = buildService(
      { type: 'breakdown', movements: PARTES, responseText: 'ok' },
      yaDesglosado,
    );

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(financeData.replaced).toHaveLength(0);
    expect(financeData.saved).toHaveLength(2);
  });
});

// ===========================================================================
// Error 3 - fiados
// ===========================================================================

describe('WhatsAppMessageService - fiados', () => {
  it('marca la venta como fiada y guarda a quien se le fio', async () => {
    const { service, financeData } = buildService({
      type: 'income',
      movements: [
        movimiento({
          type: 'income',
          amount: 50_000,
          category: 'ventas',
          concept: 'Venta fiada a dona Rosa',
          isCredit: true,
          customerName: 'Dona Rosa',
        }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.transactions[0].isCredit).toBe(true);
    expect(result.transactions[0].customerName).toBe('Dona Rosa');
    expect(financeData.saved[0].isCredit).toBe(true);
  });

  it('una venta normal no queda marcada como fiada', async () => {
    const { service } = buildService({
      type: 'income',
      movements: [
        movimiento({ type: 'income', amount: 50_000, category: 'ventas' }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.transactions[0].isCredit).toBe(false);
  });

  it('el resumen separa lo fiado de lo cobrado', async () => {
    // Lo fiado suma como ingreso (la venta ocurrio) pero todavia no es caja.
    const conFiado: Transaction[] = [
      {
        id: 'f1',
        businessId: 'b1',
        date: '2026-07-15',
        description: 'Venta fiada',
        category: 'ventas',
        amount: 300_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-15T12:00:00.000Z',
        isCredit: true,
      },
      {
        id: 'f2',
        businessId: 'b1',
        date: '2026-07-15',
        description: 'Venta de contado',
        category: 'ventas',
        amount: 700_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-15T12:00:00.000Z',
        isCredit: false,
      },
    ];

    const { service } = buildService(
      {
        type: 'query',
        queryKind: 'summary',
        queryPeriod: 'month',
        responseText: 'ok',
      },
      conFiado,
    );

    const result = await service.handleMessage(BASE_REQUEST);

    // Los ingresos son SOLO lo cobrado: los 300.000 fiados no entran.
    // Sumarlos daba un ingreso que el duenno no tiene en el bolsillo y un
    // balance que no cuadraba con su caja.
    expect(result.summary?.income).toBe(700_000);
    expect(result.summary?.pendingCollection).toBe(300_000);
    expect(result.summary?.balance).toBe(700_000);
    expect(result.replyText).toContain('te deben');
  });
});

// ===========================================================================
// Error 4 - buscar ingresos por concepto, igual que los gastos
// ===========================================================================

describe('WhatsAppMessageService - busqueda de ingresos', () => {
  const MOVIMIENTOS: Transaction[] = [
    {
      id: 'g1',
      businessId: 'b1',
      date: '2026-07-14',
      description: 'Compra en Postobon',
      category: 'mercancia',
      amount: 200_000,
      type: 'expense',
      currency: 'COP',
      source: 'whatsapp',
      createdAt: '2026-07-14T12:00:00.000Z',
    },
    {
      id: 'i1',
      businessId: 'b1',
      date: '2026-07-15',
      description: 'Ganancia por ventas de gaseosa',
      category: 'ventas',
      amount: 3_000_000,
      type: 'income',
      currency: 'COP',
      source: 'whatsapp',
      createdAt: '2026-07-15T12:00:00.000Z',
    },
  ];

  it('encuentra un ingreso por su concepto', async () => {
    // Antes solo funcionaba con gastos: las ventas se guardaban sin concepto.
    const { service } = buildService(
      {
        type: 'query',
        queryKind: 'search',
        concept: 'gaseosa',
        responseText: 'ok',
      },
      MOVIMIENTOS,
    );

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.replyText).toContain('Ganancia por ventas de gaseosa');
    expect(result.replyText).toContain('$3.000.000');
    expect(result.replyText).toContain('+');
  });

  it('sigue encontrando gastos por su concepto', async () => {
    const { service } = buildService(
      {
        type: 'query',
        queryKind: 'search',
        concept: 'Postobon',
        responseText: 'ok',
      },
      MOVIMIENTOS,
    );

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.replyText).toContain('Compra en Postobon');
    expect(result.replyText).toContain('$200.000');
  });
});

// ===========================================================================
// Error 5 - listar los movimientos, no solo contarlos
// ===========================================================================

describe('WhatsAppMessageService - listado de movimientos', () => {
  it('devuelve el detalle de cada movimiento cuando lo piden', async () => {
    // El resumen decia "tienes 2 movimientos" y al preguntar cuales eran
    // devolvia el mismo resumen: un callejon sin salida.
    const { service } = buildService({
      type: 'query',
      queryKind: 'list',
      queryPeriod: 'month',
      responseText: 'Te los detallo.',
    });

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.replyText).toContain('Compra de harina');
    expect(result.replyText).toContain('$700.000');
    expect(result.replyText).toContain('Ventas del dia');
    expect(result.replyText).toContain('$1.500.000');
  });

  it('el resumen le dice al usuario que puede pedir el detalle', async () => {
    const { service } = buildService({
      type: 'query',
      queryKind: 'summary',
      queryPeriod: 'month',
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.replyText).toContain('movimientos');
    expect(result.replyText.toLowerCase()).toContain('uno por uno');
  });
});

describe('renderMovementList', () => {
  const FILAS: Transaction[] = [
    {
      id: '1',
      businessId: 'b1',
      date: '2026-07-15',
      description: 'Compra de harina',
      category: 'mercancia',
      amount: 700_000,
      type: 'expense',
      currency: 'COP',
      source: 'whatsapp',
      createdAt: '2026-07-15T12:00:00.000Z',
      paymentMethod: 'efectivo',
    },
    {
      id: '2',
      businessId: 'b1',
      date: '2026-07-15',
      description: 'Venta fiada',
      category: 'ventas',
      amount: 300_000,
      type: 'income',
      currency: 'COP',
      source: 'whatsapp',
      createdAt: '2026-07-15T12:00:00.000Z',
      isCredit: true,
    },
  ];

  it('muestra tipo, concepto, valor y fecha de cada movimiento', () => {
    const texto = renderMovementList(FILAS, 'month', 'COP');

    expect(texto).toContain('Compra de harina');
    expect(texto).toContain('-$700.000');
    expect(texto).toContain('Venta fiada');
    expect(texto).toContain('+$300.000');
    // El formato corto local incluye "de": "15 de jul".
    expect(texto).toContain('15 de jul');
  });

  it('anota la forma de pago y si fue fiado', () => {
    const texto = renderMovementList(FILAS, 'month', 'COP');
    expect(texto).toContain('Efectivo');
    expect(texto).toContain('fiado');
  });

  it('avisa cuando no hay movimientos, sin inventar', () => {
    const texto = renderMovementList([], 'week', 'COP');
    expect(texto).toContain('No tienes movimientos');
    expect(texto).not.toContain('$');
  });

  it('no usa markdown: el texto va a WhatsApp', () => {
    expect(renderMovementList(FILAS, 'month', 'COP')).not.toMatch(/[*_`#]/);
  });
});

// ===========================================================================
// Error 1 - reparto de utilidades
// ===========================================================================

describe('WhatsAppMessageService - reparto de utilidades', () => {
  it('calcula el monto de cada quien sobre la utilidad real', async () => {
    // SEED deja un balance de 800.000 (1.500.000 - 700.000).
    const { service, financeData } = buildService({
      type: 'profit_share',
      profitShares: [
        { beneficiary: 'dueno', name: null, percentage: 60 },
        { beneficiary: 'trabajador', name: null, percentage: 40 },
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.profitDistribution?.total).toBe(800_000);
    expect(result.profitDistribution?.shares[0].amount).toBe(480_000);
    expect(result.profitDistribution?.shares[1].amount).toBe(320_000);
    expect(financeData.distributions).toHaveLength(1);
    expect(result.replyText).toContain('$480.000');
  });

  it('pide los porcentajes cuando no los dan', async () => {
    const { service, financeData } = buildService({
      type: 'profit_share',
      profitShares: [],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.intent.type).toBe('unclear');
    expect(result.replyText).toContain('porcentaje');
    expect(financeData.distributions).toHaveLength(0);
  });

  it('rechaza porcentajes que no suman 100', async () => {
    const { service, financeData } = buildService({
      type: 'profit_share',
      profitShares: [
        { beneficiary: 'dueno', name: null, percentage: 60 },
        { beneficiary: 'trabajador', name: null, percentage: 30 },
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.replyText).toContain('100%');
    expect(financeData.distributions).toHaveLength(0);
  });

  it('no reparte cuando no hay utilidades', async () => {
    const enPerdida: Transaction[] = [
      {
        id: 'p1',
        businessId: 'b1',
        date: '2026-07-15',
        description: 'Compra grande',
        category: 'mercancia',
        amount: 900_000,
        type: 'expense',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-15T12:00:00.000Z',
      },
    ];

    const { service, financeData } = buildService(
      {
        type: 'profit_share',
        profitShares: [{ beneficiary: 'dueno', name: null, percentage: 100 }],
        responseText: 'ok',
      },
      enPerdida,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.replyText).toContain('no hay utilidades');
    expect(financeData.distributions).toHaveLength(0);
  });
});

describe('WhatsAppMessageService - el desglose encuentra el total aunque venga de la base', () => {
  it('no exige que el origen sea whatsapp', async () => {
    // El adaptador de Prisma devuelve source "manual" para todo, porque la
    // base no guarda el origen. Si el buscador exigiera "whatsapp", en
    // produccion nunca encontraria el total y duplicaria el dinero.
    const totalDesdeLaBase: Transaction[] = [
      {
        id: 'venta-total',
        businessId: 'b1',
        date: '2026-07-15',
        description: 'Ventas del dia',
        category: 'ventas',
        amount: 900_000,
        type: 'income',
        currency: 'COP',
        source: 'manual',
        createdAt: '2026-07-15T12:00:00.000Z',
        groupId: null,
      },
    ];

    const { service, financeData } = buildService(
      {
        type: 'breakdown',
        movements: [
          movimiento({
            type: 'income',
            amount: 600_000,
            category: 'ventas',
            paymentMethod: 'efectivo',
          }),
          movimiento({
            type: 'income',
            amount: 300_000,
            category: 'ventas',
            paymentMethod: 'tarjeta',
          }),
        ],
        responseText: 'ok',
      },
      totalDesdeLaBase,
    );

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(financeData.replaced).toHaveLength(1);
    expect(financeData.saved).toHaveLength(0);
  });
});

// ===========================================================================
// La fecha del movimiento es la de Colombia, no la del contenedor
// ===========================================================================

describe('WhatsAppMessageService - fecha colombiana', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('registra con el dia colombiano aunque en UTC ya sea manana', async () => {
    // 1 de septiembre, 7:53 p.m. en Colombia = 2 de septiembre 00:53 UTC.
    // La confirmacion decia "2 de sept" mientras el movimiento quedaba
    // guardado el 1: la fecha se calculaba con toISOString(), que da UTC.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-02T00:53:00.000Z'));

    const { service } = buildService({
      type: 'expense',
      movements: [
        movimiento({
          amount: 50_000,
          category: 'transporte',
          concept: 'Transporte',
        }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.transactions[0].date).toBe('2026-09-01');
  });

  it('el texto de confirmacion muestra esa misma fecha', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-02T00:53:00.000Z'));

    const { service } = buildService({
      type: 'expense',
      movements: [
        movimiento({ amount: 50_000, concept: 'Transporte' }),
        movimiento({ amount: 30_000, concept: 'Almuerzo' }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.replyText).toContain('1 de sept');
    expect(result.replyText).not.toContain('2 de sept');
  });

  it('antes de las 7 p.m. no hay diferencia', async () => {
    // Mediodia en Colombia: el dia UTC y el colombiano coinciden.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-01T17:00:00.000Z'));

    const { service } = buildService({
      type: 'expense',
      movements: [movimiento({ amount: 50_000 })],
      responseText: 'ok',
    });

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.transactions[0].date).toBe('2026-09-01');
  });
});

// ===========================================================================
// Pendiente 1 - corregir movimientos desde WhatsApp
// ===========================================================================

/** Movimientos recientes sobre los que se puede corregir. */
const RECIENTES: Transaction[] = [
  {
    id: 'ultimo',
    businessId: 'b1',
    date: '2026-09-01',
    description: 'Transporte',
    category: 'transporte',
    amount: 50_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-01T18:00:00.000Z',
  },
  {
    id: 'almuerzo',
    businessId: 'b1',
    date: '2026-09-01',
    description: 'Almuerzo',
    category: 'otros_gastos',
    amount: 30_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-01T17:00:00.000Z',
  },
];

function correccion(parcial: Record<string, unknown>) {
  return {
    action: 'update',
    reference: null,
    newAmount: null,
    newConcept: null,
    ...parcial,
  };
}

describe('WhatsAppMessageService - correcciones', () => {
  it('corrige el monto del ultimo movimiento', async () => {
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({ newAmount: 60_000 }),
        responseText: 'ok',
      },
      RECIENTES,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.updated).toEqual([
      { id: 'ultimo', changes: { amount: 60_000 } },
    ]);
    expect(result.replyText).toContain('$50.000');
    expect(result.replyText).toContain('$60.000');
  });

  it('avisa que el cambio tambien quedo en el panel', async () => {
    const { service } = buildService(
      {
        type: 'correction',
        correction: correccion({ newAmount: 60_000 }),
        responseText: 'ok',
      },
      RECIENTES,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });
    expect(result.replyText.toLowerCase()).toContain('panel');
  });

  it('ubica el movimiento por su concepto', async () => {
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({ reference: 'almuerzo', newAmount: 35_000 }),
        responseText: 'ok',
      },
      RECIENTES,
    );

    await service.handleMessage({ ...BASE_REQUEST, persist: true });
    expect(financeData.updated[0].id).toBe('almuerzo');
  });

  it('corrige el concepto sin tocar el monto', async () => {
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({
          reference: 'almuerzo',
          newConcept: 'Transporte',
        }),
        responseText: 'ok',
      },
      RECIENTES,
    );

    await service.handleMessage({ ...BASE_REQUEST, persist: true });
    expect(financeData.updated[0].changes).toEqual({
      description: 'Transporte',
    });
  });

  it('pide confirmación antes de borrar, mostrando qué se va a ir', async () => {
    // Borrar no se deshace: nunca ocurre en el mismo turno en que se pide.
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({ action: 'delete', reference: 'almuerzo' }),
        responseText: 'ok',
      },
      RECIENTES,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.deleted).toEqual([]);
    expect(result.replyText).toContain('Almuerzo');
    expect(result.replyText).toContain('$30.000');
    expect(result.replyText).toContain('¿Lo confirmas?');
  });
});

describe('WhatsAppMessageService - correcciones ambiguas o imposibles', () => {
  it('pregunta cual corregir cuando hay varios parecidos', async () => {
    // Corregir el equivocado deja el error escondido: mejor preguntar.
    const dosIguales: Transaction[] = [
      { ...RECIENTES[0], id: 'a', description: 'Transporte a la plaza' },
      { ...RECIENTES[0], id: 'b', description: 'Transporte de vuelta' },
    ];

    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({ reference: 'transporte', newAmount: 60_000 }),
        responseText: 'ok',
      },
      dosIguales,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.updated).toHaveLength(0);
    expect(result.replyText).toContain('Cuál');
  });

  it('lo dice claro cuando no encuentra el movimiento', async () => {
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({ reference: 'jabones', newAmount: 1000 }),
        responseText: 'ok',
      },
      RECIENTES,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.updated).toHaveLength(0);
    expect(result.replyText).toContain('jabones');
  });

  it('pide el valor si dicen corregir pero no dicen cual', async () => {
    const { service, financeData } = buildService(
      { type: 'correction', correction: correccion({}), responseText: 'ok' },
      RECIENTES,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.updated).toHaveLength(0);
    expect(result.replyText).toContain('valor correcto');
  });

  it('no toca la base si no se pidio persistir', async () => {
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({ newAmount: 60_000 }),
        responseText: 'ok',
      },
      RECIENTES,
    );

    await service.handleMessage(BASE_REQUEST);
    expect(financeData.updated).toHaveLength(0);
    expect(financeData.deleted).toHaveLength(0);
  });
});

// ===========================================================================
// Pendiente 2 - periodo contable configurable
// ===========================================================================

describe('periodRange con periodo contable propio', () => {
  const enSeptiembre = new Date('2026-09-05T17:00:00.000Z');

  it('sin configurar, el mes es el calendario', () => {
    expect(periodRange('month', enSeptiembre)).toEqual({
      from: '2026-09-01',
      to: '2026-09-05',
    });
  });

  it('con corte el 21, el mes arranca el 21 del mes anterior', () => {
    expect(periodRange('month', enSeptiembre, 21)).toEqual({
      from: '2026-08-21',
      to: '2026-09-05',
    });
  });

  it('el dia y la semana no dependen del corte', () => {
    expect(periodRange('day', enSeptiembre, 21).from).toBe('2026-09-05');
    expect(periodRange('week', enSeptiembre, 21).from).toBe('2026-08-31');
  });
});

describe('WhatsAppMessageService · fecha del movimiento', () => {
  /**
   * Quien el lunes registra lo del fin de semana espera verlo en el fin de
   * semana. Antes todo se guardaba con la fecha en que se le escribió al bot y
   * los reportes por día quedaban descuadrados.
   */
  const HOY = new Date().toISOString().slice(0, 10);

  const enFecha = (fecha: string | null) => ({
    type: 'income' as const,
    movements: [
      {
        type: 'income' as const,
        amount: 2_000_000,
        category: 'ventas',
        concept: 'Cama nube',
        paymentMethod: null,
        isCredit: false,
        customerName: null,
        date: fecha,
      },
    ],
    responseText: 'ok',
  });

  it('usa la fecha que dijo el usuario', async () => {
    const { service } = buildService(enFecha('2026-08-23'));

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.transactions[0].date).toBe('2026-08-23');
  });

  it('usa hoy cuando el usuario no dice ninguna fecha', async () => {
    const { service } = buildService(enFecha(null));

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.transactions[0].date).toBe(HOY);
  });

  it('ignora una fecha futura: nadie registra lo que no ha pasado', async () => {
    // Un año mal tecleado mandaría el movimiento a 2027 y lo sacaría de todos
    // los reportes sin que nadie lo note.
    const { service } = buildService(enFecha('2027-08-23'));

    const result = await service.handleMessage(BASE_REQUEST);

    expect(result.transactions[0].date).toBe(HOY);
  });

  it('ignora una fecha inválida', async () => {
    const { service } = buildService(enFecha('23/08/2026'));

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.transactions[0].date).toBe(HOY);
  });

  it('ignora un día que no existe', async () => {
    // "2026-02-31" pasa el formato pero se desbordaría a marzo.
    const { service } = buildService(enFecha('2026-02-31'));

    const result = await service.handleMessage(BASE_REQUEST);
    expect(result.transactions[0].date).toBe(HOY);
  });
});

describe('WhatsAppMessageService · lo fiado no infla las categorías', () => {
  it('el desglose por categoría cuadra con los ingresos', async () => {
    // Si lo fiado entrara en el desglose, las categorías sumarían más que los
    // ingresos y el resumen se contradiría a sí mismo.
    const conFiado: Transaction[] = [
      {
        id: 'c1',
        businessId: 'b1',
        date: '2026-07-10',
        description: 'Comedor fiado',
        category: 'ventas',
        amount: 3_200_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-10T12:00:00.000Z',
        isCredit: true,
      },
      {
        id: 'c2',
        businessId: 'b1',
        date: '2026-07-11',
        description: 'Venta de contado',
        category: 'ventas',
        amount: 500_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-11T12:00:00.000Z',
        isCredit: false,
      },
    ];

    const { service } = buildService(
      {
        type: 'query',
        queryKind: 'summary',
        queryPeriod: 'month',
        responseText: 'ok',
      },
      conFiado,
    );

    const result = await service.handleMessage(BASE_REQUEST);

    const ventas = result.summary?.byCategory.find(
      (fila) => fila.category === 'ventas',
    );

    expect(ventas?.total).toBe(500_000);
    expect(result.summary?.income).toBe(500_000);
    expect(result.summary?.pendingCollection).toBe(3_200_000);
  });
});

// ===========================================================================
// ABONOS: cobrar un fiado baja la deuda, no crea una venta nueva
// ===========================================================================

describe('WhatsAppMessageService · abonos de fiados', () => {
  const CON_ABONO: Partial<WhatsAppIntentOutput> = {
    type: 'payment',
    movements: [],
    payment: {
      customerName: 'Doña Rosa',
      amount: 20_000,
      settlesDebt: false,
      date: null,
    },
    responseText: 'Listo, registro el abono.',
  };

  it('aplica el abono al cliente y no registra ningún movimiento', async () => {
    // El error que se está corrigiendo: el cobro entraba como venta, la misma
    // plata quedaba contada dos veces y la deuda seguía intacta.
    const { service, financeData } = buildService(CON_ABONO);

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.saved).toHaveLength(0);
    expect(financeData.payments).toHaveLength(1);
    expect(financeData.payments[0].customerName).toBe('Doña Rosa');
    expect(financeData.payments[0].amount).toBe(20_000);
    expect(result.transactions).toHaveLength(0);
    expect(result.payment?.applied).toBe(true);
  });

  it('dice cuánto queda debiendo, que es lo que el dueño quiere saber', async () => {
    const { service } = buildService(CON_ABONO);

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.replyText).toContain('$20.000');
    expect(result.replyText).toContain('$30.000');
  });

  it('avisa cuando el cliente queda al día', async () => {
    const { service, financeData } = buildService(CON_ABONO);
    financeData.paymentResult = {
      applied: true,
      reason: null,
      customerName: 'Doña Rosa',
      amount: 50_000,
      remaining: 0,
      excess: 0,
      settledSales: 2,
    };

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.replyText).toContain('al día');
    expect(result.replyText).toContain('ya no te debe nada');
  });

  it('"ya me pagó todo" salda la deuda sin inventar un monto', async () => {
    const { service, financeData } = buildService({
      ...CON_ABONO,
      payment: {
        customerName: 'Juan',
        amount: null,
        settlesDebt: true,
        date: null,
      },
    });

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    // null significa "lo que deba": el sistema sí sabe cuánto es, el modelo no.
    expect(financeData.payments[0].amount).toBeNull();
  });

  it('respeta la fecha del pago cuando el usuario la dice', async () => {
    const { service, financeData } = buildService({
      ...CON_ABONO,
      payment: {
        customerName: 'Doña Rosa',
        amount: 20_000,
        settlesDebt: false,
        date: '2026-08-23',
      },
    });

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(financeData.payments[0].date).toBe('2026-08-23');
  });

  it('sin nombre de cliente pregunta en vez de adivinar a quién cobrarle', async () => {
    // Aplicárselo al cliente equivocado descuadra dos cuentas a la vez.
    const { service, financeData } = buildService({
      ...CON_ABONO,
      payment: null,
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.payments).toHaveLength(0);
    expect(result.intent.type).toBe('unclear');
    expect(result.replyText).toContain('¿De quién es el pago?');
  });

  it('cuando no hay a quién aplicarlo lo dice, no falla', async () => {
    const { service, financeData } = buildService(CON_ABONO);
    financeData.paymentResult = {
      applied: false,
      reason: 'cliente_no_encontrado',
      customerName: 'Doña Rosa',
      amount: 0,
      remaining: 0,
      excess: 0,
      settledSales: 0,
    };

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.replyText).toContain('No encontré');
    expect(result.replyText).toContain('Doña Rosa');
  });

  it('avisa cuando le pagaron más de lo que debía', async () => {
    const { service, financeData } = buildService(CON_ABONO);
    financeData.paymentResult = {
      applied: true,
      reason: null,
      customerName: 'Doña Rosa',
      amount: 50_000,
      remaining: 0,
      excess: 30_000,
      settledSales: 1,
    };

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    // Callarlo haría creer al dueño que registró una cifra que no registró.
    expect(result.replyText).toContain('$30.000');
    expect(result.replyText).toContain('no los registré');
  });
});

describe('WhatsAppMessageService · las cuentas por cobrar bajan con los abonos', () => {
  it('el resumen muestra el saldo, no lo que se fió', async () => {
    // Este era el síntoma: el fiado seguía apareciendo entero por mucho que el
    // cliente abonara.
    const conSaldo: Transaction[] = [
      {
        id: 'f1',
        businessId: 'b1',
        date: '2026-07-10',
        description: 'Fiado a Doña Rosa',
        category: 'ventas',
        amount: 300_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-10T12:00:00.000Z',
        isCredit: true,
        pendingAmount: 200_000,
        customerName: 'Doña Rosa',
      },
      {
        id: 'a1',
        businessId: 'b1',
        date: '2026-07-20',
        description: 'Abono de Doña Rosa',
        category: 'cobros',
        amount: 100_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-20T12:00:00.000Z',
        isCredit: false,
      },
    ];

    const { service } = buildService(
      {
        type: 'query',
        queryKind: 'summary',
        queryPeriod: 'month',
        responseText: 'ok',
      },
      conSaldo,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    // Lo cobrado es ingreso; lo que falta por cobrar, cuenta por cobrar.
    expect(result.summary?.income).toBe(100_000);
    expect(result.summary?.pendingCollection).toBe(200_000);
  });

  it('un fiado ya pagado deja de ser cuenta por cobrar', async () => {
    const saldado: Transaction[] = [
      {
        id: 'f1',
        businessId: 'b1',
        date: '2026-07-10',
        description: 'Fiado a Juan',
        category: 'ventas',
        amount: 80_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-10T12:00:00.000Z',
        isCredit: true,
        pendingAmount: 0,
        customerName: 'Juan',
      },
      {
        id: 'a1',
        businessId: 'b1',
        date: '2026-07-11',
        description: 'Abono de Juan',
        category: 'cobros',
        amount: 80_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-07-11T12:00:00.000Z',
        isCredit: false,
      },
    ];

    const { service } = buildService(
      {
        type: 'query',
        queryKind: 'summary',
        queryPeriod: 'month',
        responseText: 'ok',
      },
      saldado,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.summary?.pendingCollection).toBe(0);
    expect(result.summary?.income).toBe(80_000);
    expect(result.replyText).not.toContain('te deben');
  });
});

describe('WhatsAppMessageService · un fiado necesita saber de quién es', () => {
  it('pregunta el nombre en vez de registrar una deuda que nadie podrá cobrar', async () => {
    const { service, financeData } = buildService({
      type: 'income',
      movements: [
        movimiento({
          type: 'income',
          amount: 20_000,
          category: 'ventas',
          concept: 'Venta fiada',
          isCredit: true,
          customerName: null,
        }),
      ],
      responseText: 'Registré el fiado.',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.saved).toHaveLength(0);
    expect(result.intent.type).toBe('unclear');
    expect(result.replyText).toContain('¿A quién le fiaste?');
  });

  it('con nombre lo registra sin preguntar nada', async () => {
    const { service, financeData } = buildService({
      type: 'income',
      movements: [
        movimiento({
          type: 'income',
          amount: 20_000,
          category: 'ventas',
          concept: 'Venta fiada',
          isCredit: true,
          customerName: 'Doña Rosa',
        }),
      ],
      responseText: 'Registré el fiado de doña Rosa.',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(financeData.saved).toHaveLength(1);
    expect(financeData.saved[0].customerName).toBe('Doña Rosa');
    expect(financeData.saved[0].isCredit).toBe(true);
    expect(result.intent.type).toBe('income');
  });
});

// ===========================================================================
// DESAMBIGUAR UNA CORRECCIÓN
//
// Reproduce la conversación real que corrompió un dato: Luka mostró tres
// ventas parecidas, preguntó cuál corregir, y ninguna de las respuestas del
// usuario ("3 de septiembre", "la primera", "1.530.000") sirvió. Al final
// terminó cambiándole el monto a una compra que no estaba en la lista.
// ===========================================================================

/** Los tres movimientos de la captura, más el que salió dañado. */
const CONVERSACION: Transaction[] = [
  {
    id: 'galeria',
    businessId: 'b1',
    date: '2026-09-03',
    description: 'Mercancía · Galería',
    category: 'mercancia',
    amount: 1_840_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-03T20:00:00.000Z',
  },
  {
    id: 'venta-3',
    businessId: 'b1',
    date: '2026-09-03',
    description: 'Venta',
    category: 'ventas',
    amount: 1_530_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-03T15:00:00.000Z',
  },
  {
    id: 'venta-2',
    businessId: 'b1',
    date: '2026-09-02',
    description: 'Ventas',
    category: 'ventas',
    amount: 1_860_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-02T15:00:00.000Z',
  },
  {
    id: 'venta-1',
    businessId: 'b1',
    date: '2026-09-01',
    description: 'Venta',
    category: 'ventas',
    amount: 1_486_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-01T15:00:00.000Z',
  },
];

/**
 * Un servicio cuyo modelo responde distinto en cada turno, para poder simular
 * una conversación de varios mensajes contra el mismo estado.
 */
function buildConversacion(rows: Transaction[] = CONVERSACION) {
  let siguiente: Partial<WhatsAppIntentOutput> = { type: 'unclear' };

  const llm = {
    completeJson: () =>
      Promise.resolve({
        data: {
          type: 'unclear',
          movements: [],
          declaredTotal: null,
          profitShares: [],
          concept: null,
          queryKind: null,
          queryPeriod: null,
          responseText: 'ok',
          ...siguiente,
        },
        response: {
          text: '',
          toolCalls: [],
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          providerId: 'fake',
          model: 'fake-1',
          latencyMs: 1,
          costUsd: 0,
        },
      }),
  } as unknown as LlmService;

  const financeData = fakeFinanceData(rows);
  const state = new ConversationStateService();
  const service = new WhatsAppMessageService(llm, financeData, state);

  const decir = (
    intent: Partial<WhatsAppIntentOutput>,
    extra: Partial<Parameters<typeof service.handleMessage>[0]> = {},
  ) => {
    siguiente = intent;
    return service.handleMessage({ ...BASE_REQUEST, persist: true, ...extra });
  };

  return { decir, financeData, state };
}

describe('WhatsAppMessageService · desambiguar una corrección', () => {
  it('resuelve por fecha la venta que el usuario eligió', async () => {
    const { decir, financeData } = buildConversacion();

    const pregunta = await decir({
      type: 'correction',
      correction: correccion({ reference: 'venta', newAmount: 1_554_000 }),
    });

    expect(financeData.updated).toHaveLength(0);
    expect(pregunta.replyText).toContain('1)');

    // "3 de septiembre": antes respondía "no encontré ningún movimiento que
    // mencione 3 de septiembre", porque solo sabía buscar en la descripción.
    await decir({
      type: 'correction',
      correction: correccion({
        referenceDate: '2026-09-03',
        newAmount: 1_554_000,
      }),
    });

    expect(financeData.updated).toEqual([
      { id: 'venta-3', changes: { amount: 1_554_000 } },
    ]);
  });

  it('resuelve por posición: "la primera opción"', async () => {
    const { decir, financeData } = buildConversacion();

    await decir({
      type: 'correction',
      correction: correccion({ reference: 'venta', newAmount: 1_554_000 }),
    });

    await decir({
      type: 'correction',
      correction: correccion({ referenceIndex: 1, newAmount: 1_554_000 }),
    });

    expect(financeData.updated).toEqual([
      { id: 'venta-3', changes: { amount: 1_554_000 } },
    ]);
  });

  it('resuelve por monto sin sobrescribir con ese monto', async () => {
    const { decir, financeData } = buildConversacion();

    await decir({
      type: 'correction',
      correction: correccion({ reference: 'venta', newAmount: 1_554_000 }),
    });

    // "Es la de 1.530.000": ese número dice CUÁL, no cuánto debe quedar.
    await decir({
      type: 'correction',
      correction: correccion({
        referenceAmount: 1_530_000,
        newAmount: 1_554_000,
      }),
    });

    expect(financeData.updated).toEqual([
      { id: 'venta-3', changes: { amount: 1_554_000 } },
    ]);
  });

  it('con una pregunta abierta, no decir cuál NO significa "el último"', async () => {
    // Esta es la regresión del daño real. El modelo devolvió la corrección sin
    // ningún identificador y con el monto que el usuario había dado solo para
    // nombrar el movimiento. El código lo tomó como "el último registrado" y le
    // cambió el monto a una compra de mercancía que no estaba en la lista.
    const { decir, financeData } = buildConversacion();

    await decir({
      type: 'correction',
      correction: correccion({ reference: 'venta', newAmount: 1_554_000 }),
    });

    const respuesta = await decir({
      type: 'correction',
      correction: correccion({ newAmount: 1_530_000 }),
    });

    expect(financeData.updated).toHaveLength(0);
    expect(respuesta.replyText).toContain('Cuál');
    // Sobre todo: la compra de Galería quedó intacta.
    expect(financeData.updated.some((cambio) => cambio.id === 'galeria')).toBe(
      false,
    );
  });

  it('un identificador que no está en la lista abre una búsqueda nueva', async () => {
    // El usuario abandonó la duda y está hablando de otra cosa: no se le puede
    // dejar atrapado en la pregunta anterior.
    const { decir, financeData } = buildConversacion();

    await decir({
      type: 'correction',
      correction: correccion({ reference: 'venta', newAmount: 1_554_000 }),
    });

    await decir({
      type: 'correction',
      correction: correccion({ reference: 'Galería', newAmount: 1_900_000 }),
    });

    expect(financeData.updated).toEqual([
      { id: 'galeria', changes: { amount: 1_900_000 } },
    ]);
  });

  it('cambiar de tema cierra la pregunta abierta', async () => {
    const { decir, financeData } = buildConversacion();

    await decir({
      type: 'correction',
      correction: correccion({ reference: 'venta', newAmount: 1_554_000 }),
    });

    // Registra un gasto: la conversación se fue por otro lado.
    await decir({
      type: 'expense',
      movements: [
        movimiento({ amount: 12_000, category: 'transporte', concept: 'Taxi' }),
      ],
    });

    // Ahora "corrige el último a 20.000" debe volver a significar el último.
    await decir({
      type: 'correction',
      correction: correccion({ newAmount: 20_000 }),
    });

    expect(financeData.updated).toEqual([
      { id: 'galeria', changes: { amount: 20_000 } },
    ]);
  });

  it('sin valor nuevo pregunta cuál es, mostrando el monto actual', async () => {
    const { decir, financeData } = buildConversacion();

    const respuesta = await decir({
      type: 'correction',
      correction: correccion({ referenceAmount: 1_530_000 }),
    });

    expect(financeData.updated).toHaveLength(0);
    expect(respuesta.replyText).toContain('$1.530.000');
  });

  it('dice por qué no encontró, con la palabra del usuario', async () => {
    const { decir } = buildConversacion();

    const respuesta = await decir({
      type: 'correction',
      correction: correccion({
        referenceDate: '2026-08-15',
        newAmount: 90_000,
      }),
    });

    expect(respuesta.replyText).toContain('2026-08-15');
  });
});

describe('WhatsAppMessageService · la hora del mensaje no se tira', () => {
  it('sin fecha dicha guarda el instante real del mensaje', async () => {
    const { service, financeData } = buildService({
      type: 'expense',
      movements: [
        movimiento({
          amount: 120_000,
          category: 'mercancia',
          concept: 'Licuadora',
        }),
      ],
    });

    const antes = Date.now();
    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    const guardado = financeData.saved[0];
    const instante = new Date(guardado.occurredAt!).getTime();

    // Es la hora de verdad, no un marcador. Antes todo quedaba a las 7:00 a. m.
    expect(guardado.occurredAt).not.toBeNull();
    expect(instante).toBeGreaterThanOrEqual(antes);
    expect(instante).toBeLessThanOrEqual(Date.now());
  });

  it('con fecha dicha no inventa una hora', async () => {
    // "El 23 de agosto vendí una cama": no hay hora que registrar.
    const { service, financeData } = buildService({
      type: 'income',
      movements: [
        movimiento({
          type: 'income',
          amount: 800_000,
          category: 'ventas',
          concept: 'Cama',
          date: '2026-08-23',
        }),
      ],
    });

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(financeData.saved[0].date).toBe('2026-08-23');
    expect(financeData.saved[0].occurredAt).toBeNull();
  });

  it('un abono sin fecha dicha también lleva la hora del mensaje', async () => {
    const { service, financeData } = buildService({
      type: 'payment',
      movements: [],
      payment: {
        customerName: 'Doña Rosa',
        amount: 20_000,
        settlesDebt: false,
        date: null,
      },
    });

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(financeData.payments[0].occurredAt).not.toBeNull();
  });

  it('un abono con fecha dicha no la lleva', async () => {
    const { service, financeData } = buildService({
      type: 'payment',
      movements: [],
      payment: {
        customerName: 'Doña Rosa',
        amount: 20_000,
        settlesDebt: false,
        date: '2026-08-23',
      },
    });

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(financeData.payments[0].date).toBe('2026-08-23');
    expect(financeData.payments[0].occurredAt).toBeNull();
  });
});

// ===========================================================================
// "¿QUIÉN ME DEBE?" — la cartera y su corte por plan
// ===========================================================================

const CARTERA: Receivable[] = [
  {
    customerId: 'c1',
    customerName: 'Doña Rosa',
    pending: 200_000,
    paid: 100_000,
    total: 300_000,
    oldestSince: '2026-07-18',
    daysOutstanding: 47,
    lastPaymentDate: '2026-08-22',
    daysSinceLastPayment: 12,
    openSales: 1,
  },
  {
    customerId: 'c2',
    customerName: 'Juan',
    pending: 50_000,
    paid: 0,
    total: 50_000,
    oldestSince: '2026-08-20',
    daysOutstanding: 14,
    lastPaymentDate: null,
    daysSinceLastPayment: null,
    openSales: 1,
  },
];

describe('WhatsAppMessageService · ¿quién me debe?', () => {
  const PREGUNTA: Partial<WhatsAppIntentOutput> = {
    type: 'query',
    queryKind: 'receivables',
    responseText: 'Déjame revisar.',
  };

  it('responde quién, cuánto debe, cuánto abonó y desde cuándo', async () => {
    const { service, financeData } = buildService(PREGUNTA);
    financeData.receivables = CARTERA;

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      planIsFree: false,
    });

    expect(result.replyText).toContain('Doña Rosa');
    expect(result.replyText).toContain('$200.000');
    expect(result.replyText).toContain('$100.000');
    expect(result.replyText).toContain('47 días');
    expect(result.replyText).toContain('12 días');

    expect(result.replyText).toContain('Juan');
    expect(result.replyText).toContain('no ha abonado nada');

    // El total, para no tener que sumarlo a mano.
    expect(result.replyText).toContain('$250.000');
  });

  it('en el plan gratuito es una función de pago', async () => {
    // El corte lo hace el backend, no el modelo: de esto depende que una
    // función de pago no se regale por una clasificación floja.
    const { service, financeData } = buildService(PREGUNTA);
    financeData.receivables = CARTERA;

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      planIsFree: true,
    });

    expect(result.intent.type).toBe('premium');
    expect(result.replyText).not.toContain('Doña Rosa');
  });

  it('buscar los fiados de una persona SÍ es gratis', async () => {
    // La diferencia del punto 1: preguntar por una persona es consultar lo
    // propio; la lista completa de deudores es el reporte.
    const fiadoDeMary: Transaction[] = [
      {
        id: 'f1',
        businessId: 'b1',
        date: '2026-08-30',
        description: 'Fiado a doña Mary',
        category: 'ventas',
        amount: 45_000,
        type: 'income',
        currency: 'COP',
        source: 'whatsapp',
        createdAt: '2026-08-30T15:00:00.000Z',
        isCredit: true,
        pendingAmount: 45_000,
        customerName: 'Doña Mary',
      },
    ];

    const { service } = buildService(
      {
        type: 'query',
        queryKind: 'search',
        concept: 'Mary',
        responseText: 'Déjame buscar.',
      },
      fiadoDeMary,
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      planIsFree: true,
    });

    expect(result.intent.type).toBe('query');
    expect(result.replyText).toContain('Mary');
    expect(result.replyText).toContain('$45.000');
  });

  it('lo dice bonito cuando no le deben nada', async () => {
    const { service, financeData } = buildService(PREGUNTA);
    financeData.receivables = [];

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      planIsFree: false,
    });

    expect(result.replyText).toContain('Nadie te debe nada');
  });
});

// ===========================================================================
// BORRAR SIEMPRE PREGUNTA ANTES
//
// Borrar no se deshace. El que se equivoca de movimiento pierde el dato, así
// que nunca se ejecuta en el mismo turno en que se pide.
// ===========================================================================

describe('WhatsAppMessageService · borrar con confirmación', () => {
  it('el "sí" ejecuta el borrado que quedó pendiente', async () => {
    const { decir, financeData } = buildConversacion();

    const pregunta = await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', reference: 'Galería' }),
    });

    expect(financeData.deleted).toEqual([]);
    expect(pregunta.replyText).toContain('¿Lo confirmas?');

    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toEqual(['galeria']);
  });

  it('el "no" deja todo como estaba', async () => {
    const { decir, financeData } = buildConversacion();

    await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', reference: 'Galería' }),
    });

    const respuesta = await decir({ type: 'confirmation', confirmed: false });

    expect(financeData.deleted).toEqual([]);
    expect(respuesta.replyText).toContain('no borré nada');
  });

  it('un "sí" sin nada pendiente no borra nada', async () => {
    // Sin pregunta abierta no hay forma de saber qué estaría confirmando.
    const { decir, financeData } = buildConversacion();

    const respuesta = await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toEqual([]);
    expect(respuesta.intent.type).toBe('unclear');
  });

  it('cambiar de tema cancela el borrado pendiente', async () => {
    const { decir, financeData } = buildConversacion();

    await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', reference: 'Galería' }),
    });

    // Registra un gasto en vez de contestar.
    await decir({
      type: 'expense',
      movements: [
        movimiento({ amount: 9_000, category: 'transporte', concept: 'Bus' }),
      ],
    });

    // Y ahora un "sí" ya no puede resucitar el borrado.
    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toEqual([]);
  });

  it('"borra todo lo de hoy" enumera qué se va a ir antes de preguntar', async () => {
    // Un "¿seguro?" a ciegas sobre catorce movimientos no es una confirmación.
    const { decir, financeData } = buildConversacion();

    const pregunta = await decir({
      type: 'correction',
      queryPeriod: 'day',
      correction: correccion({ action: 'delete', deleteAll: true }),
    });

    expect(financeData.deleted).toEqual([]);
    expect(pregunta.replyText).toContain('TODOS');
    expect(pregunta.replyText).toContain('Mercancía · Galería');
    expect(pregunta.replyText).toContain('no se puede deshacer');

    // Un 'si' pelado ya no basta cuando son varios.
    await decir({ type: 'confirmation', confirmed: true });
    expect(financeData.deleted).toEqual([]);

    await decir({
      type: 'confirmation',
      confirmed: true,
      confirmedCount: 4,
    });

    // Los cuatro del fixture.
    expect(financeData.deleted).toHaveLength(4);
  });

  it('no hay nada que borrar y lo dice', async () => {
    const { decir, financeData } = buildConversacion([]);

    const respuesta = await decir({
      type: 'correction',
      queryPeriod: 'day',
      correction: correccion({ action: 'delete', deleteAll: true }),
    });

    expect(financeData.deleted).toEqual([]);
    expect(respuesta.replyText).toContain('No tienes movimientos');
  });
});

// ===========================================================================
// NOTAS DE VOZ Y FOTOS
//
// De un audio no le queda al usuario nada que releer, así que nada se guarda
// sin que vea antes lo que Luka entendió.
// ===========================================================================

const NOTA_DE_VOZ = {
  kind: 'audio' as const,
  mimeType: 'audio/ogg',
  dataBase64: 'T2dnUwACAAAAAAAAAAA=',
};

describe('WhatsAppMessageService · audio e imagen', () => {
  const UN_GASTO: Partial<WhatsAppIntentOutput> = {
    type: 'expense',
    movements: [
      movimiento({
        amount: 85_000,
        category: 'mercancia',
        concept: 'Mercancía',
      }),
    ],
    responseText: 'Registré el gasto.',
  };

  it('en el plan gratuito ni siquiera llama al modelo', async () => {
    // Interpretar un audio cuesta: gastarlo para después decir que no está
    // incluido es tirar la plata.
    const { llm, visto } = espiarLlm(UN_GASTO);
    const service = new WhatsAppMessageService(
      llm,
      fakeFinanceData(),
      new ConversationStateService(),
    );

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
      planIsFree: true,
      media: NOTA_DE_VOZ,
    });

    expect(visto.system).toBeUndefined();
    expect(result.intent.type).toBe('premium');
    expect(result.replyText).toContain('notas de voz');
  });

  it('en un plan de pago muestra lo entendido y NO guarda todavía', async () => {
    const { service, financeData } = buildService(UN_GASTO);

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
      planIsFree: false,
      media: NOTA_DE_VOZ,
    });

    expect(financeData.saved).toHaveLength(0);
    expect(result.replyText).toContain('Esto entendí de tu nota de voz');
    expect(result.replyText).toContain('$85.000');
    expect(result.replyText).toContain('¿Lo registro así?');
  });

  it('le manda al modelo el archivo junto al texto', async () => {
    const { llm, visto } = espiarLlm(UN_GASTO);
    const service = new WhatsAppMessageService(
      llm,
      fakeFinanceData(),
      new ConversationStateService(),
    );

    await service.handleMessage({
      ...BASE_REQUEST,
      message: '(nota de voz)',
      planIsFree: false,
      media: NOTA_DE_VOZ,
    });

    expect(visto.messages?.at(-1)).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: '(nota de voz)' },
        {
          type: 'audio',
          mimeType: 'audio/ogg',
          dataBase64: NOTA_DE_VOZ.dataBase64,
        },
      ],
    });
  });

  it('le quita al MIME los parámetros que manda Meta', async () => {
    // Meta manda "audio/ogg; codecs=opus"; los proveedores esperan el tipo
    // pelado.
    const { llm, visto } = espiarLlm(UN_GASTO);
    const service = new WhatsAppMessageService(
      llm,
      fakeFinanceData(),
      new ConversationStateService(),
    );

    await service.handleMessage({
      ...BASE_REQUEST,
      planIsFree: false,
      media: { ...NOTA_DE_VOZ, mimeType: 'audio/ogg; codecs=opus' },
    });

    const partes = (
      visto.messages?.at(-1) as { content: { mimeType?: string }[] }
    ).content;

    expect(partes[1].mimeType).toBe('audio/ogg');
  });

  it('un mensaje escrito normal sigue yendo como texto plano', async () => {
    const { llm, visto } = espiarLlm(UN_GASTO);
    const service = new WhatsAppMessageService(
      llm,
      fakeFinanceData(),
      new ConversationStateService(),
    );

    await service.handleMessage({ ...BASE_REQUEST, message: 'Gasté 85.000' });

    expect(visto.messages?.at(-1)).toEqual({
      role: 'user',
      content: 'Gasté 85.000',
    });
  });

  it('el "sí" guarda lo que había entendido del audio', async () => {
    const { decir, financeData } = buildConversacion();

    await decir(
      {
        type: 'expense',
        movements: [
          movimiento({
            amount: 85_000,
            category: 'mercancia',
            concept: 'Mercancía',
          }),
        ],
      },
      { planIsFree: false, media: NOTA_DE_VOZ },
    );

    expect(financeData.saved).toHaveLength(0);

    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.saved).toHaveLength(1);
    expect(financeData.saved[0].amount).toBe(85_000);
  });

  it('el "no" descarta lo entendido y pide que se lo cuenten de nuevo', async () => {
    const { decir, financeData } = buildConversacion();

    await decir(
      {
        type: 'expense',
        movements: [movimiento({ amount: 85_000, category: 'mercancia' })],
      },
      { planIsFree: false, media: NOTA_DE_VOZ },
    );

    const respuesta = await decir({ type: 'confirmation', confirmed: false });

    expect(financeData.saved).toHaveLength(0);
    expect(respuesta.replyText).toContain('no registré nada');
  });

  it('si no entendió nada del audio, lo dice en vez de inventar', async () => {
    const { service } = buildService({ type: 'unclear', movements: [] });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
      planIsFree: false,
      media: NOTA_DE_VOZ,
    });

    expect(result.intent.type).toBe('unclear');
  });
});

// ===========================================================================
// DESCUENTOS
//
// Una factura trae subtotal, descuento y total a pagar. Sin entender el
// descuento, las líneas sumaban el subtotal, el usuario decía el total, y Luka
// lo tomaba por un error de dedo: "las partes no cuadran" y no registraba nada.
// ===========================================================================

/** La factura real que rompió esto: 4 productos, subtotal 1.920.000. */
const FACTURA: Partial<WhatsAppIntentOutput> = {
  type: 'expense',
  movements: [
    movimiento({
      amount: 768_000,
      category: 'mercancia',
      concept: 'Postobón Manzana (350ml)',
      quantity: 480,
    }),
    movimiento({
      amount: 576_000,
      category: 'mercancia',
      concept: 'Postobón Naranja (350ml)',
      quantity: 360,
    }),
    movimiento({
      amount: 384_000,
      category: 'mercancia',
      concept: 'Postobón Uva (350ml)',
      quantity: 240,
    }),
    movimiento({
      amount: 192_000,
      category: 'mercancia',
      concept: 'Postobón Limonada (350ml)',
      quantity: 120,
    }),
  ],
  declaredTotal: 1_000_000,
  discount: 920_000,
  responseText: 'Leí tu factura.',
};

describe('WhatsAppMessageService · descuentos', () => {
  it('el descuento explica la diferencia y ya no reclama descuadre', async () => {
    const { service, financeData } = buildService(FACTURA);

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.intent.type).toBe('expense');
    expect(result.replyText).not.toContain('no cuadra');
    expect(financeData.saved).toHaveLength(4);
  });

  it('guarda lo que de verdad salió de la caja, no el subtotal', async () => {
    // Guardar 1.920.000 inflaría los gastos del mes por plata que nunca se
    // movió: es el mismo error que se corrigió con los fiados.
    const { service, financeData } = buildService(FACTURA);

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    const total = financeData.saved.reduce((suma, row) => suma + row.amount, 0);
    expect(total).toBe(1_000_000);
  });

  it('reparte el descuento en proporción a cada línea', () => {
    // 768.000 pesa el 40% del subtotal, así que se queda con el 40% del total.
    const netos = repartirDescuento(
      [{ amount: 768_000 }, { amount: 1_152_000 }],
      920_000,
    );

    expect(netos[0]).toBeCloseTo(400_000, 0);
    expect(netos[1]).toBeCloseTo(600_000, 0);
    expect(netos[0] + netos[1]).toBe(1_000_000);
  });

  it('el redondeo nunca deja la suma corrida', () => {
    // Tres partes iguales de un total impar: si cada una se redondeara por su
    // cuenta, el total quedaría a un peso del que dijo el usuario.
    const netos = repartirDescuento(
      [{ amount: 10_000 }, { amount: 10_000 }, { amount: 10_000 }],
      1_000,
    );

    expect(netos.reduce((a, b) => a + b, 0)).toBe(29_000);
  });

  it('un descuento mayor que la compra se ignora', () => {
    // Es un error de lectura, y dejar los montos en cero sería peor.
    const netos = repartirDescuento([{ amount: 5_000 }], 90_000);
    expect(netos).toEqual([5_000]);
  });

  it('conserva las unidades en la descripción', async () => {
    const { service, financeData } = buildService(FACTURA);

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(financeData.saved[0].description).toContain('480 u.');
  });

  it('le muestra al usuario las tres cifras de la factura', async () => {
    // Tiene la factura delante: quiere reconocer el subtotal que ahí dice.
    const { service } = buildService(FACTURA);

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.replyText).toContain('$1.920.000');
    expect(result.replyText).toContain('$920.000');
    expect(result.replyText).toContain('$1.000.000');
  });

  it('sin descuento, las cuentas siguen igual que antes', async () => {
    const { service, financeData } = buildService({
      ...FACTURA,
      declaredTotal: 1_920_000,
      discount: null,
    });

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    const total = financeData.saved.reduce((suma, row) => suma + row.amount, 0);
    expect(total).toBe(1_920_000);
  });
});

describe('WhatsAppMessageService · un descuadre no pierde lo leído', () => {
  it('guarda lo entendido para el siguiente turno', async () => {
    // La foto no viaja al siguiente mensaje. Sin esto, el usuario explicaba la
    // diferencia y Luka le pedía otra vez la lista que acababa de leer.
    const { decir, state } = buildConversacion();

    const respuesta = await decir({ ...FACTURA, discount: null });

    expect(respuesta.replyText).toContain('las partes suman');

    const pendiente = state.registroPendiente('b1');
    expect(pendiente?.reason).toBe('descuadre');
    expect(pendiente?.transactions).toHaveLength(4);
    expect(pendiente?.declaredTotal).toBe(1_000_000);
  });

  it('un "sí" no puede confirmar un descuadre', async () => {
    // Lo que se pidió ahí fue la cifra buena, no un visto bueno: confirmarlo
    // guardaría justo los montos que no cuadraban.
    const { decir, financeData } = buildConversacion();

    await decir({ ...FACTURA, discount: null });
    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.saved).toHaveLength(0);
  });
});

// ===========================================================================
// BORRAR UN GRUPO: "elimina estos dos"
//
// Referirse a varios movimientos a la vez caía en el camino de "buscar uno" y
// Luka respondía que no encontraba nada, aunque el usuario los tuviera a la
// vista en el mensaje que estaba citando.
// ===========================================================================

const DOS_DEL_MISMO_DIA: Transaction[] = [
  {
    id: 'silla',
    businessId: 'b1',
    date: '2026-09-04',
    description: 'Venta de silla gamer - abono Alexandra',
    category: 'ventas',
    amount: 250_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-04T20:18:00.000Z',
  },
  {
    id: 'mesa',
    businessId: 'b1',
    date: '2026-09-04',
    description: 'Venta de mesa',
    category: 'ventas',
    amount: 180_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-04T20:18:30.000Z',
  },
  {
    id: 'viejo',
    businessId: 'b1',
    date: '2026-09-02',
    description: 'Venta cama nube',
    category: 'ventas',
    amount: 2_000_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-02T15:00:00.000Z',
  },
];

describe('WhatsAppMessageService · "elimina estos dos"', () => {
  it('los enseña todos y los borra tras el sí', async () => {
    const { decir, financeData } = buildConversacion(DOS_DEL_MISMO_DIA);

    const pregunta = await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-04',
        matchAll: true,
      }),
    });

    // No pregunta "¿cuál de los dos?": el usuario ya dijo que son los dos.
    expect(pregunta.replyText).toContain('silla gamer');
    expect(pregunta.replyText).toContain('Venta de mesa');
    expect(pregunta.replyText).toContain('¿Seguro que son los 2?');
    expect(financeData.deleted).toEqual([]);

    await decir({
      type: 'confirmation',
      confirmed: true,
      confirmedCount: 2,
    });

    expect(financeData.deleted.sort()).toEqual(['mesa', 'silla']);
  });

  it('no toca los movimientos de otro día', async () => {
    const { decir, financeData } = buildConversacion(DOS_DEL_MISMO_DIA);

    await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-04',
        matchAll: true,
      }),
    });
    await decir({
      type: 'confirmation',
      confirmed: true,
      confirmedCount: 2,
    });

    expect(financeData.deleted).not.toContain('viejo');
  });

  it('sin matchAll sigue preguntando cuál de los dos', async () => {
    const { decir, financeData } = buildConversacion(DOS_DEL_MISMO_DIA);

    const respuesta = await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-04',
      }),
    });

    expect(respuesta.replyText).toContain('Cuál');
    expect(financeData.deleted).toEqual([]);
  });

  it('explica TODO lo que buscó cuando no encuentra nada', async () => {
    // Antes solo nombraba el primer criterio, así que un "no encontré ningún
    // movimiento del 2026-09-04" escondía que también estaba filtrando por
    // texto.
    const { decir } = buildConversacion(DOS_DEL_MISMO_DIA);

    const respuesta = await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-08-01',
        reference: 'jabones',
        matchAll: true,
      }),
    });

    expect(respuesta.replyText).toContain('2026-08-01');
    expect(respuesta.replyText).toContain('jabones');
  });

  it('"todos esos" sobre una lista ya mostrada los toma todos', async () => {
    const { decir, financeData } = buildConversacion(DOS_DEL_MISMO_DIA);

    // Primero una desambiguación: dos ventas parecidas.
    await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', reference: 'Venta' }),
    });

    // Y ahora "todos esos", sin decir cuál.
    const respuesta = await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', matchAll: true }),
    });

    expect(respuesta.replyText).toContain('¿Seguro que son los 3?');

    await decir({
      type: 'confirmation',
      confirmed: true,
      confirmedCount: 3,
    });

    expect(financeData.deleted.length).toBeGreaterThan(1);
  });
});

// ===========================================================================
// BORRAR CITANDO UN MENSAJE
//
// Dos casos reales, los dos con pérdida de datos o a un paso de tenerla:
//
//   1. Citando "Registré el fiado de $2.000 a Kevin", Luka ofreció borrar un
//      pago de gas de $60.000: la cita no identificaba nada y caía en la regla
//      "sin referencia = el último movimiento".
//
//   2. Citando un mensaje con cuatro compras, listó cinco —todos los del día,
//      porque acotaba por fecha—. El usuario contestó "Si" sin revisar y perdió
//      la jornada entera.
// ===========================================================================

const DEL_MENSAJE: Transaction[] = [
  {
    id: 'manzana',
    businessId: 'b1',
    date: '2026-09-04',
    description: 'POSTOBON MANZANA (350ml) · 480 u.',
    category: 'mercancia',
    amount: 400_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-04T20:00:00.000Z',
  },
  {
    id: 'naranja',
    businessId: 'b1',
    date: '2026-09-04',
    description: 'POSTOBON NARANJA (350ml) · 360 u.',
    category: 'mercancia',
    amount: 300_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-04T20:00:01.000Z',
  },
  {
    id: 'moto',
    businessId: 'b1',
    date: '2026-09-04',
    description: 'Venta fiada de moto',
    category: 'ventas',
    amount: 2_000_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-04T21:00:00.000Z',
    isCredit: true,
    customerName: 'Kevin',
  },
];

/** Como si el usuario citara el mensaje donde Luka reportó esos movimientos. */
function citando(ids: string[]) {
  return {
    ...BASE_REQUEST,
    persist: true,
    quotedMessage: {
      fromLuka: true,
      date: '2026-09-04',
      content: '✅ Registré 2 movimientos: ...',
      transactionIds: ids,
    },
  };
}

describe('WhatsAppMessageService · borrar lo que se está citando', () => {
  it('borra exactamente los del mensaje citado, ni uno más', async () => {
    // El caso 2: acotar por fecha traía los tres del día en vez de los dos que
    // el usuario tenía a la vista.
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({ action: 'delete' }),
      },
      DEL_MENSAJE,
    );

    const pregunta = await service.handleMessage(
      citando(['manzana', 'naranja']),
    );

    expect(pregunta.replyText).toContain('MANZANA');
    expect(pregunta.replyText).toContain('NARANJA');
    expect(pregunta.replyText).not.toContain('moto');
    expect(financeData.deleted).toEqual([]);
  });

  it('sin identificadores no cae en "el último movimiento"', async () => {
    // El caso 1: citando el fiado de Kevin, ofrecía borrar un pago de gas que
    // no tenía nada que ver, solo por ser el más reciente.
    const { service } = buildService(
      {
        type: 'correction',
        correction: correccion({ action: 'delete' }),
      },
      DEL_MENSAJE,
    );

    const pregunta = await service.handleMessage(citando(['moto']));

    expect(pregunta.replyText).toContain('moto');
    expect(pregunta.replyText).not.toContain('MANZANA');
  });

  it('dentro de la cita se puede escoger uno solo', async () => {
    const { service } = buildService(
      {
        type: 'correction',
        correction: correccion({ action: 'delete', referenceIndex: 2 }),
      },
      DEL_MENSAJE,
    );

    const pregunta = await service.handleMessage(
      citando(['manzana', 'naranja']),
    );

    expect(pregunta.replyText).toContain('NARANJA');
    expect(pregunta.replyText).not.toContain('MANZANA');
  });

  it('lo dice claro si esos movimientos ya no existen', async () => {
    const { service } = buildService(
      {
        type: 'correction',
        correction: correccion({ action: 'delete' }),
      },
      DEL_MENSAJE,
    );

    const respuesta = await service.handleMessage(citando(['ya-borrado']));

    expect(respuesta.replyText).toContain('ya no están');
  });
});

describe('WhatsAppMessageService · un "sí" distraído no borra varios', () => {
  it('exige repetir cuántos son', async () => {
    // Esto es lo que le costó a un usuario los movimientos de todo el día.
    const { decir, financeData } = buildConversacion(DEL_MENSAJE);

    const pregunta = await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-04',
        matchAll: true,
      }),
    });

    expect(pregunta.replyText).toContain('¿Seguro que son los 3?');

    const insiste = await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toEqual([]);
    expect(insiste.replyText).toContain('Espera, son 3 movimientos');

    await decir({
      type: 'confirmation',
      confirmed: true,
      confirmedCount: 3,
    });

    expect(financeData.deleted).toHaveLength(3);
  });

  it('un número que no coincide tampoco borra', async () => {
    const { decir, financeData } = buildConversacion(DEL_MENSAJE);

    await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-04',
        matchAll: true,
      }),
    });

    await decir({
      type: 'confirmation',
      confirmed: true,
      confirmedCount: 2,
    });

    expect(financeData.deleted).toEqual([]);
  });

  it('con uno solo sigue bastando un "sí"', async () => {
    // La fricción es para lo que no se puede deshacer en masa, no para todo.
    const { decir, financeData } = buildConversacion(DEL_MENSAJE);

    const pregunta = await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', reference: 'moto' }),
    });

    expect(pregunta.replyText).toContain('¿Lo confirmas?');

    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toEqual(['moto']);
  });

  it('en vez de confirmar, se puede escoger uno de la lista', async () => {
    // "Si solo era uno, dime cuál": reduce el borrado en vez de cancelarlo.
    const { decir, financeData } = buildConversacion(DEL_MENSAJE);

    await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-04',
        matchAll: true,
      }),
    });

    const acotado = await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', referenceIndex: 2 }),
    });

    expect(acotado.replyText).toContain('¿Lo confirmas?');

    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toHaveLength(1);
  });
});

// ===========================================================================
// ESCOGER VARIOS DE UNA LISTA
//
// Dos fallos reales, misma causa: `referenceIndex` era un solo número, así que
// una selección de dos no cabía. El modelo tenía que elegir entre marcar
// "todos" —y Luka ofrecía borrar los tres— o quedarse con uno.
//
//   1. "borra el segundo y tercero, el primero sí déjalo"  ->  listó los 3
//   2. "no, solo el 2 y el 3"                              ->  tomó 1
// ===========================================================================

const TRES_DEL_MENSAJE: Transaction[] = [
  {
    id: 'venta',
    businessId: 'b1',
    date: '2026-09-05',
    description: 'Venta',
    category: 'ventas',
    amount: 20_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-05T16:00:00.000Z',
  },
  {
    id: 'desayuno',
    businessId: 'b1',
    date: '2026-09-05',
    description: 'Desayuno para empleados',
    category: 'otros_gastos',
    amount: 1_000_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-05T16:00:01.000Z',
  },
  {
    id: 'insumos',
    businessId: 'b1',
    date: '2026-09-05',
    description: 'Insumos y herramientas',
    category: 'insumos',
    amount: 2_000_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-05T16:00:02.000Z',
  },
];

function citandoLosTres() {
  return {
    ...BASE_REQUEST,
    persist: true,
    quotedMessage: {
      fromLuka: true,
      date: '2026-09-05',
      content: '✅ Registré 3 movimientos: ...',
      transactionIds: ['venta', 'desayuno', 'insumos'],
    },
  };
}

describe('WhatsAppMessageService · escoger varios de una lista', () => {
  it('"el segundo y tercero, el primero déjalo" respeta el primero', async () => {
    // El modelo marca matchAll porque "el segundo y tercero" suena a varios.
    // La selección tiene que mandar sobre eso: si no, Luka ofrece borrar
    // también el que el usuario acaba de pedir que conserve.
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({
          action: 'delete',
          referenceIndexes: [2, 3],
          matchAll: true,
        }),
      },
      TRES_DEL_MENSAJE,
    );

    const pregunta = await service.handleMessage(citandoLosTres());

    expect(pregunta.replyText).toContain('Desayuno para empleados');
    expect(pregunta.replyText).toContain('Insumos y herramientas');
    expect(pregunta.replyText).toContain('estos 2 movimientos');
    expect(pregunta.replyText).not.toContain('+$20.000');
    expect(financeData.deleted).toEqual([]);
  });

  it('acota un borrado ya ofrecido a "solo el 2 y el 3"', async () => {
    const { decir, financeData } = buildConversacion(TRES_DEL_MENSAJE);

    const primera = await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-05',
        matchAll: true,
      }),
    });

    expect(primera.replyText).toContain('estos 3 movimientos');

    // Aquí antes se quedaba con uno solo.
    const acotado = await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceIndexes: [2, 3],
      }),
    });

    expect(acotado.replyText).toContain('estos 2 movimientos');
    expect(acotado.replyText).toContain('Desayuno');
    expect(acotado.replyText).toContain('Insumos');

    await decir({
      type: 'confirmation',
      confirmed: true,
      confirmedCount: 2,
    });

    expect(financeData.deleted.sort()).toEqual(['desayuno', 'insumos']);
  });

  it('una sola posición sigue funcionando igual', async () => {
    const { decir, financeData } = buildConversacion(TRES_DEL_MENSAJE);

    await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-05',
        matchAll: true,
      }),
    });

    const acotado = await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', referenceIndexes: [2] }),
    });

    expect(acotado.replyText).toContain('¿Lo confirmas?');

    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toEqual(['desayuno']);
  });

  it('acepta un número suelto por si el modelo no manda la lista', async () => {
    // Robustez: perder esa respuesta significaría borrar de más o preguntar
    // otra vez.
    const { decir, financeData } = buildConversacion(TRES_DEL_MENSAJE);

    await decir({
      type: 'correction',
      correction: correccion({
        action: 'delete',
        referenceDate: '2026-09-05',
        matchAll: true,
      }),
    });

    await decir({
      type: 'correction',
      correction: correccion({ action: 'delete', referenceIndex: 3 }),
    });

    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toEqual(['insumos']);
  });

  it('ignora las posiciones que no existen en la lista', async () => {
    const { service } = buildService(
      {
        type: 'correction',
        correction: correccion({
          action: 'delete',
          referenceIndexes: [2, 9],
        }),
      },
      TRES_DEL_MENSAJE,
    );

    const pregunta = await service.handleMessage(citandoLosTres());

    expect(pregunta.replyText).toContain('Voy a borrar este movimiento');
    expect(pregunta.replyText).toContain('Desayuno');
  });

  it('los enseña en el orden en que los vio el usuario', async () => {
    const { service } = buildService(
      {
        type: 'correction',
        correction: correccion({
          action: 'delete',
          // Los nombra al revés; la lista debe salir 2 y luego 3.
          referenceIndexes: [3, 2],
        }),
      },
      TRES_DEL_MENSAJE,
    );

    const pregunta = await service.handleMessage(citandoLosTres());
    const posDesayuno = pregunta.replyText.indexOf('Desayuno');
    const posInsumos = pregunta.replyText.indexOf('Insumos');

    expect(posDesayuno).toBeLessThan(posInsumos);
  });

  it('el modelo recibe la lista numerada del borrado pendiente', async () => {
    // Sin la lista delante, "solo el 2 y el 3" no se puede convertir en
    // posiciones y termina borrando otra cosa.
    const { llm, visto } = espiarLlm({ type: 'unclear' });
    const state = new ConversationStateService();
    const service = new WhatsAppMessageService(
      llm,
      fakeFinanceData(TRES_DEL_MENSAJE),
      state,
    );

    state.recordarBorrado('b1', {
      targets: TRES_DEL_MENSAJE,
      period: null,
    });

    await service.handleMessage({ ...BASE_REQUEST, persist: true });

    expect(visto.system).toContain('1) 2026-09-05 · Venta');
    expect(visto.system).toContain('referenceIndexes');
    expect(visto.system).toContain('solo el 2 y el 3');
  });
});

// ===========================================================================
// SCRUM-22 · Identificar el movimiento concreto que se pide borrar
//
// Tres casos que fallaban en producción con el prompt v17 ya desplegado:
//
//   1. "borra todos los registros de hoy" tiene que listar los de esa fecha.
//   2. Citar un mensaje de Luka con un movimiento y decir "bórralo".
//   3. Citar un mensaje con varios y decir "borra el primer registro": el
//      primero es el primero que Luka nombró, no el más reciente ni otro.
//
// El fallo de fondo: `deleteAll` se comprobaba antes que todo lo demás y
// cortaba el método. Cuando el usuario contestaba "el 1" a una lista, el
// modelo seguía devolviendo deleteAll —el hilo venía de un borrado masivo— y
// se volvía a ofrecer borrar el día entero.
// ===========================================================================

const DEL_DIA: Transaction[] = [
  {
    id: 'transporte',
    businessId: 'b1',
    date: '2026-09-21',
    description: 'Transporte',
    category: 'transporte',
    amount: 5_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-21T14:00:00.000Z',
  },
  {
    id: 'mercancia',
    businessId: 'b1',
    date: '2026-09-21',
    description: 'Compra de mercancía',
    category: 'mercancia',
    amount: 40_000,
    type: 'expense',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-21T14:00:01.000Z',
  },
  {
    id: 'venta',
    businessId: 'b1',
    date: '2026-09-21',
    description: 'Venta del día',
    category: 'ventas',
    amount: 50_000,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: '2026-09-21T14:00:02.000Z',
  },
];

/** Como si el usuario citara el mensaje donde Luka reportó esos movimientos. */
function citandoMensaje(ids: string[]) {
  return {
    ...BASE_REQUEST,
    persist: true,
    quotedMessage: {
      fromLuka: true,
      date: '2026-09-21',
      content: '✅ Registré 2 movimientos: ...',
      transactionIds: ids,
    },
  };
}

describe('SCRUM-22 · una posición nombrada nunca significa "todo"', () => {
  it('tras ofrecer borrar el día, "el 1" acota a ese movimiento', async () => {
    // Esta es la regresión: el modelo sigue devolviendo deleteAll porque el
    // hilo viene de un borrado masivo, pero el usuario acaba de escoger uno.
    const { decir, financeData } = buildConversacion(DEL_DIA);

    const lista = await decir({
      type: 'correction',
      queryPeriod: 'day',
      correction: correccion({ action: 'delete', deleteAll: true }),
    });

    expect(lista.replyText).toContain('TODOS');

    const acotado = await decir({
      type: 'correction',
      queryPeriod: 'day',
      correction: correccion({
        action: 'delete',
        deleteAll: true,
        referenceIndexes: [1],
      }),
    });

    expect(acotado.replyText).toContain('este movimiento');
    expect(acotado.replyText).not.toContain('TODOS');

    await decir({ type: 'confirmation', confirmed: true });

    expect(financeData.deleted).toHaveLength(1);
  });

  it('"borra todo lo de hoy" sigue funcionando cuando no se escoge nada', async () => {
    const { decir, financeData } = buildConversacion(DEL_DIA);

    const lista = await decir({
      type: 'correction',
      queryPeriod: 'day',
      correction: correccion({ action: 'delete', deleteAll: true }),
    });

    expect(lista.replyText).toContain('TODOS');
    expect(lista.replyText).toContain('no se puede deshacer');
    expect(financeData.deleted).toEqual([]);

    await decir({
      type: 'confirmation',
      confirmed: true,
      confirmedCount: 3,
    });

    expect(financeData.deleted).toHaveLength(3);
  });

  it('nunca borra sin confirmación previa', async () => {
    const { decir, financeData } = buildConversacion(DEL_DIA);

    await decir({
      type: 'correction',
      queryPeriod: 'day',
      correction: correccion({ action: 'delete', deleteAll: true }),
    });

    expect(financeData.deleted).toEqual([]);
  });
});

describe('SCRUM-22 · citar un mensaje de Luka', () => {
  it('con un solo movimiento, "bórralo" identifica ese', async () => {
    const { service, financeData } = buildService(
      {
        type: 'correction',
        correction: correccion({ action: 'delete' }),
      },
      DEL_DIA,
    );

    const pregunta = await service.handleMessage(citandoMensaje(['mercancia']));

    expect(pregunta.replyText).toContain('Compra de mercancía');
    expect(pregunta.replyText).not.toContain('Transporte');
    expect(financeData.deleted).toEqual([]);
  });

  it('"el primer registro" es el primero que Luka nombró', async () => {
    // El mensaje citado listó transporte y después mercancía. "El primero" es
    // transporte, aunque mercancía sea más reciente.
    const { service } = buildService(
      {
        type: 'correction',
        correction: correccion({ action: 'delete', referenceIndexes: [1] }),
      },
      DEL_DIA,
    );

    const pregunta = await service.handleMessage(
      citandoMensaje(['transporte', 'mercancia']),
    );

    expect(pregunta.replyText).toContain('Transporte');
    expect(pregunta.replyText).not.toContain('Compra de mercancía');
  });

  it('"el segundo" es el segundo de ese mensaje', async () => {
    const { service } = buildService(
      {
        type: 'correction',
        correction: correccion({ action: 'delete', referenceIndexes: [2] }),
      },
      DEL_DIA,
    );

    const pregunta = await service.handleMessage(
      citandoMensaje(['transporte', 'mercancia']),
    );

    expect(pregunta.replyText).toContain('Compra de mercancía');
    expect(pregunta.replyText).not.toContain('Transporte');
  });

  it('un deleteAll sobre un mensaje citado no borra el día entero', async () => {
    // El modelo puede marcar deleteAll por inercia del hilo. La cita manda:
    // son los movimientos de ese mensaje y ninguno más.
    const { service } = buildService(
      {
        type: 'correction',
        queryPeriod: 'day',
        correction: correccion({ action: 'delete', deleteAll: true }),
      },
      DEL_DIA,
    );

    const pregunta = await service.handleMessage(
      citandoMensaje(['transporte', 'mercancia']),
    );

    expect(pregunta.replyText).not.toContain('TODOS');
    expect(pregunta.replyText).toContain('estos 2 movimientos');
    expect(pregunta.replyText).not.toContain('Venta del día');
  });
});

describe('SCRUM-22 · los registros se numeran', () => {
  it('con varios movimientos, la lista lleva números', async () => {
    // Sin números, "borra el primero" obliga al usuario y al modelo a deducir
    // el orden, y el modelo lo deducía mal.
    const { service } = buildService({
      type: 'expense',
      movements: [
        movimiento({ amount: 5_000, category: 'transporte', concept: 'Taxi' }),
        movimiento({
          amount: 40_000,
          category: 'mercancia',
          concept: 'Mercancía',
        }),
      ],
      responseText: 'ok',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.replyText).toContain('1)');
    expect(result.replyText).toContain('2)');
  });

  it('con uno solo no se numera nada', async () => {
    const { service } = buildService({
      type: 'expense',
      movements: [
        movimiento({ amount: 5_000, category: 'transporte', concept: 'Taxi' }),
      ],
      responseText: '✅ Registré un gasto de $5.000.',
    });

    const result = await service.handleMessage({
      ...BASE_REQUEST,
      persist: true,
    });

    expect(result.replyText).not.toContain('1)');
  });
});
