import type { LlmResponse } from '../../../ai/core/llm.types';
import type { LlmService } from '../../../ai/services/llm.service';
import { InMemoryFinanceDataAdapter } from '../adapters/in-memory-finance-data.adapter';
import {
  fechaColombiana,
  finDelDia,
  inicioDelDia,
} from '../domain/dia-colombia';
import type { CorrectionRequest, Transaction } from '../domain/finance.types';
import type { WhatsAppIntentOutput } from '../prompts/whatsapp-assistant.prompt';
import { ConversationStateService } from './conversation-state.service';
import {
  WhatsAppMessageService,
  periodRange,
  rangoParaCorregir,
  renderSummary,
} from './whatsapp-message.service';

/**
 * SCRUM-32: Luka no recordaba los registros del mes anterior.
 *
 * Los periodos solo existian "en curso" (hoy, esta semana, este mes) y el 4
 * de noviembre "la semana pasada" terminaba siendo del 1 o del 2 de noviembre
 * en adelante. Estas pruebas fijan la fecha del sistema y usan el adaptador en
 * memoria, que SI filtra por rango: asi se comprueba que lo de octubre llega de
 * verdad, no solo que el rango se calcula bien.
 */

/** Un instante a una hora de Bogota (UTC-5, sin horario de verano). */
function enBogota(fecha: string, hora = '10:00'): Date {
  return new Date(`${fecha}T${hora}:00.000-05:00`);
}

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
          confidence: 0.95,
          ...intent,
        },
        response,
      }),
  } as unknown as LlmService;
}

let contador = 0;

function fila(
  date: string,
  amount: number,
  parcial: Partial<Transaction> = {},
): Transaction {
  contador += 1;
  return {
    id: `t${contador}`,
    businessId: 'b1',
    date,
    description: 'Ventas del dia',
    category: 'ventas',
    amount,
    type: 'income',
    currency: 'COP',
    source: 'whatsapp',
    createdAt: enBogota(date).toISOString(),
    ...parcial,
  };
}

async function servicio(
  intent: Partial<WhatsAppIntentOutput>,
  filas: Transaction[],
) {
  const financeData = new InMemoryFinanceDataAdapter();
  await financeData.saveTransactions(filas);
  const service = new WhatsAppMessageService(
    fakeLlm(intent),
    financeData,
    new ConversationStateService(),
  );
  return { service, financeData };
}

const REQUEST = { tenantId: 't1', businessId: 'b1', message: 'prueba' };

function correccion(parcial: Partial<CorrectionRequest>): CorrectionRequest {
  return {
    action: 'update',
    reference: null,
    referenceAmount: null,
    referenceDate: null,
    referenceIndexes: [],
    newAmount: null,
    newConcept: null,
    deleteAll: false,
    matchAll: false,
    ...parcial,
  };
}

afterEach(() => {
  jest.useRealTimers();
});

describe('SCRUM-32 · rangos que cruzan el cambio de mes', () => {
  // Miercoles 4 de noviembre de 2026.
  const CUATRO_NOV = enBogota('2026-11-04');

  it('"la semana pasada" el 4 de noviembre va del lunes 26 al domingo 1', () => {
    expect(periodRange('last_week', CUATRO_NOV)).toEqual({
      from: '2026-10-26',
      to: '2026-11-01',
    });
  });

  it('"ayer" el dia 1 del mes es el ultimo dia del mes anterior', () => {
    expect(periodRange('yesterday', enBogota('2026-11-01'))).toEqual({
      from: '2026-10-31',
      to: '2026-10-31',
    });
    // Y el 1 de marzo, el 28 de febrero: el mes anterior no siempre tiene 31.
    expect(periodRange('yesterday', enBogota('2026-03-01')).from).toBe(
      '2026-02-28',
    );
  });

  it('"ultimos N dias" cuenta hoy y se mete en el mes anterior', () => {
    expect(periodRange('last_7_days', CUATRO_NOV)).toEqual({
      from: '2026-10-29',
      to: '2026-11-04',
    });
    expect(periodRange('last_15_days', CUATRO_NOV)).toEqual({
      from: '2026-10-21',
      to: '2026-11-04',
    });
    expect(periodRange('last_30_days', CUATRO_NOV)).toEqual({
      from: '2026-10-06',
      to: '2026-11-04',
    });
  });

  it('"el mes pasado" es el mes contable anterior completo', () => {
    expect(periodRange('last_month', CUATRO_NOV)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    // Con corte el 21, el 4 de noviembre esta en el periodo 21/10 a 20/11:
    // el anterior es del 21 de septiembre al 20 de octubre.
    expect(periodRange('last_month', CUATRO_NOV, 21)).toEqual({
      from: '2026-09-21',
      to: '2026-10-20',
    });
  });

  it('cambio de año: la semana pasada del 3 de enero queda en diciembre', () => {
    // El 3 de enero de 2027 es domingo: su semana arranca el lunes 28 de
    // diciembre, y la anterior va del 21 al 27 de diciembre de 2026.
    const tresEnero = enBogota('2027-01-03');

    expect(periodRange('last_week', tresEnero)).toEqual({
      from: '2026-12-21',
      to: '2026-12-27',
    });
    expect(periodRange('week', tresEnero)).toEqual({
      from: '2026-12-28',
      to: '2027-01-03',
    });
    expect(periodRange('yesterday', enBogota('2027-01-01')).from).toBe(
      '2026-12-31',
    );
    expect(periodRange('last_month', tresEnero)).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('regresion: dentro del mismo mes los periodos de siempre no cambian', () => {
    // Miercoles 18 de noviembre: nada cruza de mes.
    const dieciocho = enBogota('2026-11-18');

    expect(periodRange('day', dieciocho)).toEqual({
      from: '2026-11-18',
      to: '2026-11-18',
    });
    expect(periodRange('week', dieciocho)).toEqual({
      from: '2026-11-16',
      to: '2026-11-18',
    });
    expect(periodRange('month', dieciocho)).toEqual({
      from: '2026-11-01',
      to: '2026-11-18',
    });
    expect(periodRange('last_week', dieciocho)).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
  });
});

describe('SCRUM-32 · el resumen de una semana que cruza dos meses', () => {
  it('estando el 4 de noviembre, "la semana pasada" suma octubre y noviembre', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-04'));

    const { service } = await servicio(
      { type: 'query', queryKind: 'summary', queryPeriod: 'last_week' },
      [
        fila('2026-10-25', 999_000), // domingo anterior: fuera
        fila('2026-10-27', 100_000),
        fila('2026-10-31', 50_000, {
          type: 'expense',
          category: 'transporte',
          description: 'Transporte',
        }),
        fila('2026-11-01', 20_000),
        fila('2026-11-02', 777_000), // esta semana: fuera
      ],
    );

    const result = await service.handleMessage(REQUEST);

    expect(result.summary).toMatchObject({
      period: 'last_week',
      from: '2026-10-26',
      to: '2026-11-01',
      income: 120_000,
      expense: 50_000,
      balance: 70_000,
      transactionCount: 3,
    });
    expect(result.replyText).toContain('Resumen de la semana pasada');
    expect(result.replyText).toContain('entre 2026-10-26 y 2026-11-01');
  });

  it('cambio de año: estando el 3 de enero, la semana pasada trae diciembre', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2027-01-03'));

    const { service } = await servicio(
      { type: 'query', queryKind: 'summary', queryPeriod: 'last_week' },
      [
        fila('2026-12-22', 300_000),
        fila('2026-12-27', 200_000),
        fila('2027-01-02', 555_000), // semana en curso: fuera
      ],
    );

    const result = await service.handleMessage(REQUEST);

    expect(result.summary).toMatchObject({
      from: '2026-12-21',
      to: '2026-12-27',
      income: 500_000,
      transactionCount: 2,
    });
  });

  it('"ayer" estando el dia 1 trae lo del ultimo dia del mes anterior', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-01', '08:00'));

    const { service } = await servicio(
      { type: 'query', queryKind: 'summary', queryPeriod: 'yesterday' },
      [fila('2026-10-30', 1_000), fila('2026-10-31', 45_000)],
    );

    const result = await service.handleMessage(REQUEST);

    expect(result.summary).toMatchObject({
      from: '2026-10-31',
      to: '2026-10-31',
      income: 45_000,
      transactionCount: 1,
    });
    expect(result.replyText).toContain('Resumen de ayer');
  });

  it('el listado de "los ultimos 15 dias" incluye los de octubre', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-04'));

    const { service } = await servicio(
      { type: 'query', queryKind: 'list', queryPeriod: 'last_15_days' },
      [
        fila('2026-10-22', 10_000, { description: 'Venta de octubre' }),
        fila('2026-11-03', 20_000, { description: 'Venta de noviembre' }),
      ],
    );

    const result = await service.handleMessage(REQUEST);

    expect(result.replyText).toContain(
      'Tus 2 movimientos en los últimos 15 días',
    );
    expect(result.replyText).toContain('Venta de octubre');
    expect(result.replyText).toContain('Venta de noviembre');
  });

  it('regresion: "este mes" sigue contando solo el mes en curso', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-18'));

    const { service } = await servicio(
      { type: 'query', queryKind: 'summary', queryPeriod: 'month' },
      [
        fila('2026-10-31', 999_000),
        fila('2026-11-02', 10_000),
        fila('2026-11-17', 15_000),
      ],
    );

    const result = await service.handleMessage(REQUEST);

    expect(result.summary).toMatchObject({
      period: 'month',
      from: '2026-11-01',
      to: '2026-11-18',
      income: 25_000,
      transactionCount: 2,
    });
    expect(result.replyText).toContain('Resumen de este mes');
  });
});

describe('SCRUM-32 · corregir registros de un mes anterior', () => {
  it('corrige un registro del 28 de octubre estando en noviembre', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-04'));

    const viejo = fila('2026-10-28', 50_000, {
      type: 'expense',
      category: 'transporte',
      description: 'Transporte',
    });
    const { service, financeData } = await servicio(
      {
        type: 'correction',
        correction: correccion({
          referenceDate: '2026-10-28',
          newAmount: 60_000,
        }),
      },
      [viejo, fila('2026-11-03', 80_000)],
    );

    const result = await service.handleMessage({ ...REQUEST, persist: true });

    expect(result.replyText).toContain('Corregido');
    const [corregido] = await financeData.listTransactions({
      businessId: 'b1',
      from: '2026-10-28',
      to: '2026-10-28',
    });
    expect(corregido).toMatchObject({ id: viejo.id, amount: 60_000 });
  });

  it('ubica "el transporte de la semana pasada" aunque sea de octubre', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-04'));

    const deOctubre = fila('2026-10-28', 50_000, {
      type: 'expense',
      category: 'transporte',
      description: 'Transporte',
    });
    const { service, financeData } = await servicio(
      {
        type: 'correction',
        queryPeriod: 'last_week',
        correction: correccion({ reference: 'transporte', newAmount: 60_000 }),
      },
      [
        deOctubre,
        // Otro transporte de esta semana: el periodo es lo que los distingue.
        fila('2026-11-03', 9_000, {
          type: 'expense',
          category: 'transporte',
          description: 'Transporte',
        }),
      ],
    );

    await service.handleMessage({ ...REQUEST, persist: true });

    const filas = await financeData.listTransactions({ businessId: 'b1' });
    expect(filas.find((row) => row.id === deOctubre.id)?.amount).toBe(60_000);
    expect(filas.find((row) => row.date === '2026-11-03')?.amount).toBe(9_000);
  });

  it('encuentra una fecha exacta de hace mas de un mes', async () => {
    // La ventana de 31 dias solo aplica cuando no se dice de cuando es.
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-30'));

    const septiembre = fila('2026-09-20', 70_000, {
      type: 'expense',
      category: 'servicios',
      description: 'Luz',
    });
    const { service, financeData } = await servicio(
      {
        type: 'correction',
        correction: correccion({
          referenceDate: '2026-09-20',
          newAmount: 75_000,
        }),
      },
      [septiembre],
    );

    await service.handleMessage({ ...REQUEST, persist: true });

    const [corregido] = await financeData.listTransactions({
      businessId: 'b1',
      from: '2026-09-20',
      to: '2026-09-20',
    });
    expect(corregido.amount).toBe(75_000);
  });

  it('un negocio con mucho movimiento no pierde lo de octubre al buscar', async () => {
    // Antes se traian solo los 200 mas recientes y se filtraba despues: con
    // 250 ventas en noviembre, el transporte de octubre ni entraba al filtro.
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-04'));

    const muchas = Array.from({ length: 250 }, (_, i) =>
      fila(`2026-11-0${1 + (i % 4)}`, 1_000),
    );
    const deOctubre = fila('2026-10-28', 50_000, {
      type: 'expense',
      category: 'transporte',
      description: 'Transporte',
    });
    const { service, financeData } = await servicio(
      {
        type: 'correction',
        correction: correccion({ reference: 'transporte', newAmount: 60_000 }),
      },
      [...muchas, deOctubre],
    );

    await service.handleMessage({ ...REQUEST, persist: true });

    const [corregido] = await financeData.listTransactions({
      businessId: 'b1',
      from: '2026-10-28',
      to: '2026-10-28',
    });
    expect(corregido.amount).toBe(60_000);
  });

  it('el rango de busqueda: fecha exacta, luego periodo, luego 31 dias', () => {
    const hoy = enBogota('2026-11-04');

    expect(
      rangoParaCorregir(
        correccion({ referenceDate: '2026-10-28' }),
        'last_week',
        hoy,
      ),
    ).toEqual({ from: '2026-10-28', to: '2026-10-28' });
    expect(rangoParaCorregir(correccion({}), 'last_month', hoy)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(rangoParaCorregir(correccion({}), null, hoy)).toEqual({
      from: '2026-10-04',
      to: '2026-11-04',
    });
  });

  it('"borra todo lo de esta semana" usa la semana, no solo hoy', async () => {
    // El periodo de una correccion se descartaba al interpretar y el borrado
    // masivo caia siempre en "hoy".
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-04'));

    const { service } = await servicio(
      {
        type: 'correction',
        queryPeriod: 'week',
        correction: correccion({ action: 'delete', deleteAll: true }),
      },
      [fila('2026-11-02', 1_000), fila('2026-11-04', 2_000)],
    );

    const result = await service.handleMessage({ ...REQUEST, persist: true });

    expect(result.replyText).toContain(
      'Voy a borrar TODOS tus movimientos esta semana (2)',
    );
  });
});

describe('SCRUM-32 · zona horaria America/Bogota en el borde del mes', () => {
  // 31 de octubre a las 11:30 p.m. en Colombia. En UTC ya es 1 de noviembre.
  const ONCE_Y_MEDIA = enBogota('2026-10-31', '23:30');

  it('el instante pertenece al 31 de octubre, no al 1 de noviembre', () => {
    expect(ONCE_Y_MEDIA.toISOString()).toBe('2026-11-01T04:30:00.000Z');
    expect(fechaColombiana(ONCE_Y_MEDIA)).toBe('2026-10-31');

    // Y cae dentro de los limites que usa la consulta a la base.
    expect(ONCE_Y_MEDIA >= inicioDelDia('2026-10-31')).toBe(true);
    expect(ONCE_Y_MEDIA <= finDelDia('2026-10-31')).toBe(true);
    expect(ONCE_Y_MEDIA < inicioDelDia('2026-11-01')).toBe(true);
  });

  it('un gasto registrado a esa hora queda en octubre y cuenta en "el mes pasado"', async () => {
    jest.useFakeTimers().setSystemTime(ONCE_Y_MEDIA);

    const financeData = new InMemoryFinanceDataAdapter();
    const registrar = new WhatsAppMessageService(
      fakeLlm({
        type: 'expense',
        movements: [
          {
            type: 'expense',
            amount: 40_000,
            category: 'transporte',
            concept: 'Taxi',
            paymentMethod: null,
            isCredit: false,
            customerName: null,
            productName: 'Taxi',
            quantity: 1,
            supplierName: null,
            supplierCreditDays: null,
            isSupplierCredit: false,
            date: null,
          },
        ],
      }),
      financeData,
      new ConversationStateService(),
    );

    const registro = await registrar.handleMessage({
      ...REQUEST,
      persist: true,
    });
    expect(registro.transactions[0].date).toBe('2026-10-31');

    // Ya en noviembre: no esta en "este mes" y si en "el mes pasado".
    jest.setSystemTime(enBogota('2026-11-04'));

    const consultar = (queryPeriod: string) =>
      new WhatsAppMessageService(
        fakeLlm({ type: 'query', queryKind: 'summary', queryPeriod }),
        financeData,
        new ConversationStateService(),
      ).handleMessage(REQUEST);

    expect((await consultar('month')).summary?.expense).toBe(0);
    expect((await consultar('last_month')).summary?.expense).toBe(40_000);
  });
});

describe('SCRUM-32 · lo que devuelve el modelo', () => {
  it('un periodo desconocido en una consulta cae en "este mes", como antes', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-04'));

    for (const raro of ['constructor', 'last_0_days', 'last_9999_days', 7]) {
      const { service } = await servicio(
        {
          type: 'query',
          queryKind: 'summary',
          queryPeriod: raro as unknown as string,
        },
        [],
      );
      const result = await service.handleMessage(REQUEST);
      expect(result.summary?.period).toBe('month');
    }
  });

  it('acepta "ultimos N dias" con cualquier N razonable', async () => {
    jest.useFakeTimers().setSystemTime(enBogota('2026-11-04'));

    const { service } = await servicio(
      { type: 'query', queryKind: 'summary', queryPeriod: 'last_10_days' },
      [fila('2026-10-26', 5_000), fila('2026-10-25', 99_000)],
    );

    const result = await service.handleMessage(REQUEST);
    expect(result.summary).toMatchObject({
      from: '2026-10-26',
      to: '2026-11-04',
      income: 5_000,
    });
  });

  it('nombra bien cada periodo en el titulo del resumen', () => {
    const titulo = (period: string) =>
      renderSummary({
        period: period as never,
        from: '2026-10-01',
        to: '2026-10-31',
        currency: 'COP',
        income: 1_000,
        expense: 0,
        investment: 0,
        balance: 1_000,
        pendingCollection: 0,
        transactionCount: 1,
        byCategory: [],
      }).split('\n')[0];

    expect(titulo('day')).toBe('📊 Resumen de hoy:');
    expect(titulo('last_month')).toBe('📊 Resumen del mes pasado:');
    expect(titulo('last_30_days')).toBe('📊 Resumen de los últimos 30 días:');
  });
});
