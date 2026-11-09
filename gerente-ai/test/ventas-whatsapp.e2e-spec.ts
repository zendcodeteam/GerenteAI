import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { LlmService } from '../src/ai/services/llm.service';
import type { LlmResponse } from '../src/ai/core/llm.types';
import { ConversationStateService } from '../src/modules/finance-ai/services/conversation-state.service';
import type { WhatsAppIntentOutput } from '../src/modules/finance-ai/prompts/whatsapp-assistant.prompt';
import { LimitePorRemitenteService } from '../src/modules/whatsapp/services/limite-por-remitente.service';
import { PrismaService } from '../src/services/prisma.service';
import { limpiar, sembrar, type Semilla } from './helpers/contexto';

/**
 * Registrar ventas y gastos por WhatsApp, que es LA funcion del producto.
 *
 * Esta suite nace de una regresion real: al incorporar el inventario
 * (commit 992ca86), registrar un movimiento paso a exigir nombre de producto y
 * cantidad SIEMPRE, y a exigir ademas que ese producto estuviera dado de alta
 * en el catalogo. Resultado: "pague 50.000 de arriendo" respondia "¿que
 * producto fue y cuantas unidades?" y no registraba nada, y "vendi unos
 * audifonos por 80.000" acababa en "No pude procesar tu mensaje 😔".
 *
 * La regla que se protege aqui:
 *
 *   - Plan gratuito  -> registra como siempre lo hizo. El inventario no
 *                       existe para el, ni para bien ni para mal.
 *   - Plan de pago   -> se engancha con el inventario, pero solo cuando el
 *                       mensaje NOMBRA un producto.
 *
 * Del modelo se pone un doble con un guion: lo que se verifica es nuestro lado.
 */

process.env.N8N_API_KEY = 'clave-de-pruebas-de-ventas';
const API_KEY = process.env.N8N_API_KEY;

const LINEA_SEDE_A = '573001110001';

type Intencion = Partial<WhatsAppIntentOutput>;

class LlmDeGuion {
  private readonly cola: Intencion[] = [];

  guion(...intenciones: Intencion[]) {
    this.cola.length = 0;
    this.cola.push(...intenciones);
  }

  completeJson() {
    const siguiente = this.cola.shift();
    if (!siguiente) {
      throw new Error(
        'El guion se quedo corto: se llamo al modelo mas veces de las previstas.',
      );
    }

    const response: LlmResponse = {
      text: '',
      toolCalls: [],
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      providerId: 'guion',
      model: 'guion-1',
      latencyMs: 1,
      costUsd: 0,
    };

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
        ...siguiente,
      },
      response,
    });
  }
}

/** Un movimiento tal como lo devuelve el modelo. */
const mov = (parcial: Record<string, unknown>) => ({
  type: 'expense',
  amount: 1000,
  category: 'otros_gastos',
  concept: null,
  paymentMethod: null,
  isCredit: false,
  customerName: null,
  productName: null,
  quantity: null,
  supplierName: null,
  supplierCreditDays: null,
  isSupplierCredit: false,
  ...parcial,
});

const intencion = (
  tipo: string,
  movimientos: Record<string, unknown>[],
): Intencion => ({ type: tipo, movements: movimientos });

describe('Registro de ventas y gastos por WhatsApp (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let estado: ConversationStateService;
  let s: Semilla;
  const llm = new LlmDeGuion();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmService)
      .useValue(llm)
      .overrideProvider(LimitePorRemitenteService)
      .useValue({ permitir: () => true })
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    estado = moduleRef.get(ConversationStateService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await limpiar(prisma);
    s = await sembrar(prisma);
    estado.olvidar(s.sedeAId);
  });

  /** La semilla trae plan 5 (de pago). Esto lo baja al gratuito. */
  async function conPlanGratuito() {
    await prisma.negocio.update({
      where: { id: s.negocioId },
      data: { plan: 1, planVenceEl: null },
    });
  }

  function escribir(mensaje: string) {
    return request(app.getHttpServer())
      .post('/ai/interpret')
      .set('x-api-key', API_KEY)
      .send({ message: mensaje, phone: LINEA_SEDE_A });
  }

  const respuesta = (res: { body: unknown }) =>
    (res.body as { reply: string }).reply;

  const ventas = () => prisma.venta.findMany({ where: { sedeId: s.sedeAId } });
  const gastos = () => prisma.gasto.findMany({ where: { sedeId: s.sedeAId } });
  const stockDe = async (id: string) =>
    (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock;

  // ======================================================================
  // PLAN GRATUITO: tiene que funcionar como antes del inventario.
  // ======================================================================
  describe('plan gratuito', () => {
    beforeEach(() => conPlanGratuito());

    /*
     * El caso exacto del reporte: el modelo saca el nombre del producto pero
     * no las unidades, y el producto no esta en ningun catalogo. Antes esto
     * acababa en "No pude procesar tu mensaje".
     */
    it('"vendi unos audifonos por 80.000" se registra', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 80_000,
            category: 'ventas',
            concept: 'audifonos',
            productName: 'audifonos',
          }),
        ]),
      );

      const res = await escribir('vendí unos audífonos por 80.000');

      expect(res.status).toBe(200);
      const registradas = await ventas();
      expect(registradas).toHaveLength(1);
      expect(Number(registradas[0].total)).toBe(80_000);
    });

    it('y no se le pregunta por unidades ni por inventario', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 80_000,
            category: 'ventas',
            productName: 'audifonos',
          }),
        ]),
      );

      const res = await escribir('vendí unos audífonos por 80.000');

      expect(respuesta(res)).not.toMatch(/cuántas unidades/i);
      expect(respuesta(res)).not.toMatch(/inventario/i);
    });

    it('un gasto sin producto tampoco pregunta nada', async () => {
      llm.guion(
        intencion('expense', [
          mov({ amount: 50_000, category: 'renta', concept: 'arriendo' }),
        ]),
      );

      const res = await escribir('pagué 50.000 de arriendo');

      expect(await gastos()).toHaveLength(1);
      expect(respuesta(res)).not.toMatch(/qué producto/i);
    });

    // Aunque nombre algo que SI existe en el catalogo, para el gratuito el
    // inventario no existe: se registra la venta y el estante no se mueve.
    it('nombrar un producto del catalogo no descuenta stock', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 3_000,
            category: 'ventas',
            productName: 'Gaseosa',
            quantity: 2,
          }),
        ]),
      );

      await escribir('vendí 2 gaseosas en 3.000');

      expect(await ventas()).toHaveLength(1);
      expect(await stockDe(s.gaseosaId)).toBe(10);
      expect(await prisma.detalleVenta.count()).toBe(0);
    });

    it('un fiado sigue quedando por cobrar', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 30_000,
            category: 'ventas',
            isCredit: true,
            customerName: 'Doña María',
            dueDate: '2026-12-01',
          }),
        ]),
      );

      await escribir('le fié 30.000 a doña María, me paga el primero');

      const [venta] = await ventas();
      expect(venta.tipo).toBe('FIADO');
      expect(Number(venta.saldoPendiente)).toBe(30_000);
    });
  });

  // ======================================================================
  // PLAN DE PAGO: inventario integrado, pero solo cuando hay producto.
  // ======================================================================
  describe('plan de pago', () => {
    it('un gasto sin producto se registra sin preguntar por inventario', async () => {
      llm.guion(
        intencion('expense', [
          mov({ amount: 50_000, category: 'renta', concept: 'arriendo' }),
        ]),
      );

      const res = await escribir('pagué 50.000 de arriendo');

      expect(await gastos()).toHaveLength(1);
      expect(respuesta(res)).not.toMatch(/qué producto/i);
    });

    it('vender un producto del catalogo descuenta el stock', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 3_000,
            category: 'ventas',
            productName: 'Gaseosa',
            quantity: 2,
          }),
        ]),
      );

      await escribir('vendí 2 gaseosas en 3.000');

      expect(await stockDe(s.gaseosaId)).toBe(8);
      expect(await prisma.detalleVenta.count()).toBe(1);
    });

    // Nombro un producto pero no dijo cuantos: ahi SI tiene sentido preguntar.
    it('si nombra un producto sin cantidad, se le pregunta por las unidades', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 3_000,
            category: 'ventas',
            productName: 'Gaseosa',
          }),
        ]),
      );

      const res = await escribir('vendí gaseosas por 3.000');

      expect(respuesta(res)).toMatch(/cuántas unidades de Gaseosa/i);
      expect(await ventas()).toHaveLength(0);
    });

    /*
     * El producto no esta en el catalogo: la venta SE REGISTRA igual.
     *
     * Y como este negocio si lleva catalogo, se le avisa de que eso no
     * descuenta existencias. A una peluqueria —catalogo vacio— no se le dice
     * nada, y eso se prueba en su propio caso mas abajo.
     */
    it('un producto que no esta en el catalogo no bloquea la venta', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 80_000,
            category: 'ventas',
            productName: 'Audifonos',
            quantity: 1,
          }),
        ]),
      );

      const res = await escribir('vendí unos audífonos por 80.000');

      expect(respuesta(res)).not.toMatch(/No pude procesar tu mensaje/i);
      expect(await ventas()).toHaveLength(1);
      expect(Number((await ventas())[0].total)).toBe(80_000);
    });

    it('pero avisa de que no descontó existencias, y dice cómo agregarlo', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 80_000,
            category: 'ventas',
            productName: 'Audifonos',
            quantity: 1,
          }),
        ]),
      );

      const res = await escribir('vendí unos audífonos por 80.000');

      expect(respuesta(res)).toMatch(/no está en tu catálogo/i);
      expect(respuesta(res)).toMatch(/agrega Audifonos/i);
    });

    /*
     * Vender mas de lo anotado tampoco bloquea: la venta ocurrio. Lo que
     * estaba mal era el conteo, y de eso se avisa.
     */
    it('vender mas de lo que hay registra la venta y avisa del descuadre', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 99_000,
            category: 'ventas',
            productName: 'Gaseosa',
            quantity: 99,
          }),
        ]),
      );

      const res = await escribir('vendí 99 gaseosas');

      expect(await ventas()).toHaveLength(1);
      expect(respuesta(res)).toMatch(/tenías 10 Gaseosa anotadas/i);
      expect(respuesta(res)).toMatch(/revisa el conteo/i);
    });

    it('y el estante queda en 0, nunca en negativo', async () => {
      llm.guion(
        intencion('income', [
          mov({
            type: 'income',
            amount: 99_000,
            category: 'ventas',
            productName: 'Gaseosa',
            quantity: 99,
          }),
        ]),
      );

      await escribir('vendí 99 gaseosas');

      expect(await stockDe(s.gaseosaId)).toBe(0);
    });

    // La compra SUMA unidades: exigir stock para poder comprar stock no tiene
    // sentido, y era lo que pasaba.
    it('comprar mas unidades de las que hay en el estante funciona', async () => {
      llm.guion(
        intencion('expense', [
          mov({
            amount: 22_000,
            category: 'mercancia',
            productName: 'Gaseosa',
            quantity: 20,
          }),
        ]),
      );

      const res = await escribir('compré 20 gaseosas en 22.000');

      expect(respuesta(res)).not.toMatch(/No hay stock suficiente/i);
      expect(await stockDe(s.gaseosaId)).toBe(30);
    });
  });

  // ======================================================================
  // El negocio que NO vende mercancia.
  //
  // Una peluqueria, un restaurante. El modelo saca productName de "un corte"
  // o "un almuerzo" —lo hace hasta con un taxi— y antes eso arrancaba un alta
  // de producto y pedia un costo que nadie sabe calcular.
  // ======================================================================
  describe('un negocio sin catalogo nunca oye hablar de inventario', () => {
    beforeEach(async () => {
      // Se vacia el catalogo de la sede: es una peluqueria.
      await prisma.detalleVenta.deleteMany();
      await prisma.producto.deleteMany({ where: { sedeId: s.sedeAId } });
    });

    const corte = () =>
      intencion('income', [
        mov({
          type: 'income',
          amount: 25_000,
          category: 'servicios_prestados',
          concept: 'corte de cabello',
          productName: 'corte de cabello',
        }),
      ]);

    it('registra el ingreso del corte sin preguntar nada', async () => {
      llm.guion(corte());

      const res = await escribir('me pagaron 25.000 por un corte');

      expect(res.status).toBe(200);
      const registradas = await ventas();
      expect(registradas).toHaveLength(1);
      expect(Number(registradas[0].total)).toBe(25_000);
    });

    it('y no le menciona el catálogo ni el inventario', async () => {
      llm.guion(corte());

      const res = await escribir('me pagaron 25.000 por un corte');

      expect(respuesta(res)).not.toMatch(/catálogo/i);
      expect(respuesta(res)).not.toMatch(/inventario/i);
      expect(respuesta(res)).not.toMatch(/unidades/i);
    });

    it('tampoco le pregunta cuánto le cuesta prepararlo', async () => {
      llm.guion(corte());

      const res = await escribir('me pagaron 25.000 por un corte');

      expect(respuesta(res)).not.toMatch(/cuánto te cuesta/i);
    });
  });
});
