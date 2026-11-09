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
 * Dar de alta un producto hablando con Luka por WhatsApp, de punta a punta.
 *
 * Esto entra por `POST /ai/interpret`, que es la unica puerta del canal, y
 * recorre todo lo que recorre un mensaje de verdad: la API key de n8n, el
 * ValidationPipe, el enrutamiento del telefono a la sede, el estado de la
 * conversacion entre turnos y la escritura en Postgres. Lo unico que se
 * sustituye es el modelo.
 *
 * Por que se sustituye el modelo: un LLM no da la misma respuesta dos veces, y
 * una prueba que dependa de eso no sirve para proteger nada. Lo que aqui se
 * prueba es NUESTRO lado: que con tal interpretacion, el sistema pregunte,
 * resuma, guarde o cancele lo que debe. Que el modelo interprete bien el
 * castellano de un tendero no es algo que una prueba automatica pueda afirmar.
 *
 * Los casos son los del issue SCRUM-30: registro completo, campos faltantes,
 * valores invalidos, precio menor que costo y cancelacion del flujo.
 */

// La guarda de n8n lee esto del entorno. Se fija antes de construir el modulo
// para que la ruta quede CERRADA tambien en la prueba: sin clave, en
// desarrollo la guarda deja pasar, y entonces no se estaria probando.
process.env.N8N_API_KEY = 'clave-de-pruebas-de-inventario';
const API_KEY = process.env.N8N_API_KEY;

/** El telefono de la Sede Centro en la semilla, como lo manda Meta. */
const LINEA_SEDE_A = '573001110001';

type Intencion = Partial<WhatsAppIntentOutput>;

/**
 * El modelo, sustituido por un guion.
 *
 * Cada turno consume la siguiente intencion de la cola. Si se acaba, se
 * revienta a proposito: significa que el sistema llamo al modelo mas veces de
 * las que la prueba esperaba, y eso hay que verlo, no taparlo.
 */
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
        'El guion se quedo corto: el sistema llamo al modelo mas veces de las previstas.',
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

/** Una intencion de alta de producto con lo que el mensaje haya dicho. */
const producto = (parcial: Record<string, unknown>): Intencion => ({
  type: 'product',
  movements: [],
  product: {
    name: null,
    salePrice: null,
    costPrice: null,
    category: null,
    stock: null,
    ...parcial,
  },
});

const si = (): Intencion => ({ type: 'confirmation', confirmed: true });
const no = (): Intencion => ({ type: 'confirmation', confirmed: false });

describe('Alta de producto por WhatsApp (e2e)', () => {
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
      // El tope por remitente son 20 mensajes en 5 minutos y es en memoria.
      // Esta suite manda mas que eso, asi que lo haria fallar por algo que no
      // tiene nada que ver con el inventario. Tiene su propia prueba en
      // limite-por-remitente.spec.ts.
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
    // El estado de la conversacion vive en memoria del proceso: sin esto, una
    // confirmacion pendiente se arrastraria a la prueba siguiente.
    estado.olvidar(s.sedeAId);
  });

  /** Un mensaje de WhatsApp, tal como lo manda n8n. */
  function escribir(mensaje: string, telefono = LINEA_SEDE_A) {
    return request(app.getHttpServer())
      .post('/ai/interpret')
      .set('x-api-key', API_KEY)
      .send({ message: mensaje, phone: telefono });
  }

  const respuesta = (res: { body: unknown }) =>
    (res.body as { reply: string }).reply;

  const productosDeLaSedeA = () =>
    prisma.producto.findMany({ where: { sedeId: s.sedeAId } });

  describe('la puerta esta cerrada', () => {
    it('sin API key no se interpreta nada', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/interpret')
        .send({ message: 'agrega arroz', phone: LINEA_SEDE_A });

      expect(res.status).toBe(401);
    });

    it('con una API key equivocada tampoco', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/interpret')
        .set('x-api-key', 'otra-cosa')
        .send({ message: 'agrega arroz', phone: LINEA_SEDE_A });

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------- 1. registro completo
  describe('registro completo en un solo mensaje', () => {
    beforeEach(() => {
      llm.guion(
        producto({
          name: 'Arroz Diana 1kg',
          salePrice: 5000,
          costPrice: 3500,
          category: 'Abarrotes',
          stock: 20,
        }),
        si(),
      );
    });

    it('primero resume y pide confirmacion, sin guardar nada', async () => {
      const res = await escribir(
        'agrega arroz diana de 1kg, lo vendo en 5000 y me cuesta 3500',
      );

      expect(res.status).toBe(200);
      expect(respuesta(res)).toContain('Voy a agregar este producto');
      expect(respuesta(res)).toContain('Arroz Diana 1kg');
      expect(await productosDeLaSedeA()).toHaveLength(2); // los de la semilla
    });

    it('el resumen dice cuanto le deja por unidad', async () => {
      const res = await escribir('agrega arroz');

      expect(respuesta(res)).toContain('Te deja');
    });

    it('al decir que si, queda guardado en la sede correcta', async () => {
      await escribir('agrega arroz');
      const res = await escribir('si');

      expect(respuesta(res)).toContain('Agregué Arroz Diana 1kg a tu catálogo');

      const guardado = await prisma.producto.findFirst({
        where: { nombre: 'Arroz Diana 1kg' },
      });
      expect(guardado).toMatchObject({
        sedeId: s.sedeAId,
        categoria: 'Abarrotes',
        stock: 20,
      });
      expect(Number(guardado!.precioVenta)).toBe(5000);
      expect(Number(guardado!.precioCompra)).toBe(3500);
    });

    it('y aparece en el catalogo del panel', async () => {
      await escribir('agrega arroz');
      await escribir('si');

      const nombres = (await productosDeLaSedeA()).map((p) => p.nombre);
      expect(nombres).toContain('Arroz Diana 1kg');
    });
  });

  // --------------------------------------------------- 2. campos faltantes
  describe('campos faltantes: Luka pregunta lo que falta', () => {
    it('sin nombre, pregunta por el nombre', async () => {
      llm.guion(producto({}));

      const res = await escribir('quiero agregar un producto');

      expect(respuesta(res)).toContain('¿Qué producto quieres agregar?');
      expect(await productosDeLaSedeA()).toHaveLength(2);
    });

    it('con el nombre, pregunta en cuanto lo vende', async () => {
      llm.guion(producto({ name: 'Panela' }));

      const res = await escribir('agrega panela');

      expect(respuesta(res)).toContain('¿En cuánto vendes Panela?');
    });

    it('con el precio de venta, pregunta cuanto le cuesta', async () => {
      llm.guion(producto({ name: 'Panela' }), producto({ salePrice: 2000 }));

      await escribir('agrega panela');
      const res = await escribir('en 2000');

      expect(respuesta(res)).toContain('¿En cuánto te cuesta Panela?');
    });

    /*
     * Lo que de verdad importa de este caso: el dato de cada turno se SUMA al
     * borrador, no lo reemplaza. El modelo devuelve en null lo que el mensaje
     * no menciona, y si eso borrara lo anterior la conversacion no avanzaria
     * nunca.
     */
    it('los tres turnos se acumulan y acaban en el resumen', async () => {
      llm.guion(
        producto({ name: 'Panela' }),
        producto({ salePrice: 2000 }),
        producto({ costPrice: 1200 }),
      );

      await escribir('agrega panela');
      await escribir('en 2000');
      const res = await escribir('me cuesta 1200');

      expect(respuesta(res)).toContain('Voy a agregar este producto');
      expect(respuesta(res)).toContain('Panela');
    });

    it('y al confirmar se guarda con todo lo que se fue diciendo', async () => {
      llm.guion(
        producto({ name: 'Panela' }),
        producto({ salePrice: 2000 }),
        producto({ costPrice: 1200 }),
        si(),
      );

      await escribir('agrega panela');
      await escribir('en 2000');
      await escribir('me cuesta 1200');
      await escribir('si');

      const guardado = await prisma.producto.findFirst({
        where: { nombre: 'Panela' },
      });
      expect(Number(guardado!.precioVenta)).toBe(2000);
      expect(Number(guardado!.precioCompra)).toBe(1200);
    });

    /*
     * Lo que el usuario dijo en un turno tiene que sobrevivir a los
     * siguientes. `normalizeStock` convertia el `stock: null` que el modelo
     * manda cuando no habla de unidades en un 0 bien formado, y ese 0 pisaba
     * las unidades que el tendero ya habia dicho: decia "tengo 20" y el
     * producto acababa entrando con 0.
     */
    it('las unidades dichas al principio sobreviven a los turnos siguientes', async () => {
      llm.guion(
        producto({ name: 'Panela', salePrice: 2000, stock: 20 }),
        producto({ costPrice: 1200 }),
        si(),
      );

      await escribir('agrega panela, tengo 20 y la vendo en 2000');
      const resumen = await escribir('me cuesta 1200');
      expect(respuesta(resumen)).toContain('Stock inicial: 20');

      await escribir('si');

      expect(
        await prisma.producto.findFirst({ where: { nombre: 'Panela' } }),
      ).toMatchObject({ stock: 20 });
    });

    // La categoria y el stock son opcionales a proposito: pedirlos alargaria
    // la conversacion sin cambiar lo que el producto hace.
    it('sin categoria entra como "Sin categoría", no se pregunta', async () => {
      llm.guion(
        producto({ name: 'Panela', salePrice: 2000, costPrice: 1200 }),
        si(),
      );

      await escribir('agrega panela, la vendo en 2000 y me cuesta 1200');
      await escribir('si');

      expect(
        await prisma.producto.findFirst({ where: { nombre: 'Panela' } }),
      ).toMatchObject({ categoria: 'Sin categoría', stock: 0 });
    });
  });

  // -------------------------------------------------- 3. valores invalidos
  describe('valores invalidos', () => {
    it('un precio de venta en cero se trata como dato que falta', async () => {
      llm.guion(producto({ name: 'Panela', salePrice: 0, costPrice: 1200 }));

      const res = await escribir('agrega panela, la vendo en nada');

      // No se guarda un producto con precio 0: se vuelve a preguntar.
      expect(respuesta(res)).toContain('¿En cuánto vendes Panela?');
      expect(await productosDeLaSedeA()).toHaveLength(2);
    });

    it('un costo en cero tampoco pasa de largo', async () => {
      llm.guion(producto({ name: 'Panela', salePrice: 2000, costPrice: 0 }));

      const res = await escribir('agrega panela');

      expect(respuesta(res)).toContain('¿En cuánto te cuesta Panela?');
    });

    it('un nombre vacio se trata como nombre que falta', async () => {
      llm.guion(producto({ name: '   ', salePrice: 2000, costPrice: 1200 }));

      const res = await escribir('agrega eso');

      expect(respuesta(res)).toContain('¿Qué producto quieres agregar?');
    });

    // El DTO corta antes de llegar al modelo: un mensaje vacio no gasta cuota.
    it('un mensaje vacio lo corta el ValidationPipe', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/interpret')
        .set('x-api-key', API_KEY)
        .send({ message: '', phone: LINEA_SEDE_A });

      expect(res.status).toBe(400);
    });

    it('un telefono que no es un telefono tampoco llega al modelo', async () => {
      const res = await request(app.getHttpServer())
        .post('/ai/interpret')
        .set('x-api-key', API_KEY)
        .send({ message: 'agrega arroz', phone: 'no-soy-un-numero' });

      expect(res.status).toBe(400);
    });
  });

  // --------------------------------------------- 4. precio menor que costo
  describe('precio de venta por debajo del costo', () => {
    beforeEach(() => {
      llm.guion(
        producto({ name: 'Panela', salePrice: 1000, costPrice: 1500 }),
        si(),
      );
    });

    it('el resumen avisa de que no gana nada', async () => {
      const res = await escribir(
        'agrega panela, la vendo en 1000 y cuesta 1500',
      );

      expect(respuesta(res)).toContain('no ganas nada');
    });

    /*
     * No se bloquea, y eso es una decision de producto, no un descuido: hay
     * quien vende a perdida a proposito, para sacar lo que esta por vencerse o
     * como gancho. Lo que no puede es pasar inadvertido.
     */
    it('pero si lo confirma, se guarda', async () => {
      await escribir('agrega panela a perdida');
      const res = await escribir('si');

      expect(respuesta(res)).toContain('Agregué Panela');
      expect(
        await prisma.producto.findFirst({ where: { nombre: 'Panela' } }),
      ).not.toBeNull();
    });

    it('vender justo al costo tambien avisa', async () => {
      llm.guion(producto({ name: 'Panela', salePrice: 1500, costPrice: 1500 }));

      const res = await escribir('agrega panela');

      expect(respuesta(res)).toContain('no ganas nada');
    });
  });

  // ------------------------------------------------ 5. cancelacion del flujo
  describe('cancelacion del flujo', () => {
    it('el "no" no guarda nada', async () => {
      llm.guion(
        producto({ name: 'Panela', salePrice: 2000, costPrice: 1200 }),
        no(),
      );

      await escribir('agrega panela');
      const res = await escribir('no');

      expect(respuesta(res)).toContain('no lo agregué al catálogo');
      expect(
        await prisma.producto.findFirst({ where: { nombre: 'Panela' } }),
      ).toBeNull();
    });

    it('y el catalogo queda como estaba', async () => {
      llm.guion(
        producto({ name: 'Panela', salePrice: 2000, costPrice: 1200 }),
        no(),
      );

      await escribir('agrega panela');
      await escribir('no');

      expect(await productosDeLaSedeA()).toHaveLength(2);
    });

    /*
     * Cancelar tiene que OLVIDAR el borrador. Si quedara pendiente, el
     * siguiente "si" —dicho para cualquier otra cosa— agregaria el producto
     * que el tendero acababa de rechazar.
     */
    it('despues de cancelar, un "si" ya no agrega nada', async () => {
      llm.guion(
        producto({ name: 'Panela', salePrice: 2000, costPrice: 1200 }),
        no(),
        si(),
      );

      await escribir('agrega panela');
      await escribir('no');
      await escribir('si');

      expect(
        await prisma.producto.findFirst({ where: { nombre: 'Panela' } }),
      ).toBeNull();
    });
  });

  // ----------------------------------------------------------- duplicados
  describe('un producto que ya existe no entra dos veces', () => {
    it('avisa de que ya lo tiene y no crea un segundo', async () => {
      // "Gaseosa" ya esta en la sede A por la semilla.
      llm.guion(
        producto({ name: 'Gaseosa', salePrice: 2000, costPrice: 1200 }),
        si(),
      );

      await escribir('agrega gaseosa');
      const res = await escribir('si');

      expect(respuesta(res)).toContain('Ya tienes un producto llamado');
      expect(
        await prisma.producto.count({
          where: { sedeId: s.sedeAId, nombre: 'Gaseosa' },
        }),
      ).toBe(1);
    });

    it('compara sin mayusculas, como lo dicta el tendero', async () => {
      llm.guion(
        producto({ name: 'gaseosa', salePrice: 2000, costPrice: 1200 }),
        si(),
      );

      await escribir('agrega gaseosa');
      await escribir('si');

      expect(
        await prisma.producto.count({ where: { sedeId: s.sedeAId } }),
      ).toBe(2);
    });

    // El limite es la sede: dos locales del mismo duenno venden gaseosa cada
    // uno, con su propio stock.
    it('el mismo nombre en otra sede si entra', async () => {
      // "Pan" existe en la sede A (semilla) y no en la B.
      llm.guion(
        producto({ name: 'Pan', salePrice: 600, costPrice: 250 }),
        si(),
      );

      // Por la linea de la Sede Norte, que es otra sede del mismo negocio.
      await escribir('agrega pan', '573001110002');
      const res = await escribir('si', '573001110002');

      expect(respuesta(res)).toContain('Agregué Pan');
      expect(
        await prisma.producto.count({ where: { sedeId: s.sedeBId } }),
      ).toBe(2);
      // Y el de la sede A sigue siendo uno solo.
      expect(
        await prisma.producto.count({
          where: { sedeId: s.sedeAId, nombre: 'Pan' },
        }),
      ).toBe(1);
    });
  });

  // ------------------------------------------------- el numero desconocido
  it('un numero que no es de ningun negocio no gasta cuota de IA', async () => {
    // Si llamara al modelo, el guion vacio reventaria la peticion.
    const res = await escribir('agrega arroz', '573009999999');

    expect(res.status).toBe(200);
    expect(respuesta(res)).toContain('Regístrate');
    expect(await prisma.producto.count()).toBe(3);
  });

  /**
   * Dar de alta un producto por WhatsApp tambien es premium. El corte tiene
   * que estar en el backend: por este canal no hay pantalla que esconder.
   */
  describe('el catalogo por WhatsApp es de planes pagos', () => {
    beforeEach(async () => {
      await prisma.negocio.update({
        where: { id: s.negocioId },
        data: { plan: 1, planVenceEl: null },
      });
    });

    it('no da de alta el producto y ofrece mejorar el plan', async () => {
      llm.guion(producto({ name: 'Panela', salePrice: 2000, costPrice: 1200 }));

      const res = await escribir('agrega panela, la vendo en 2000');

      expect(respuesta(res)).toMatch(/no está incluida en tu plan/i);
      expect(await productosDeLaSedeA()).toHaveLength(2);
    });

    // El mensaje comercial lo arma el backend en un solo sitio: asi los
    // precios y el enlace no se improvisan ni se contradicen entre canales.
    it('el mensaje es el comercial de siempre, con el enlace a los planes', async () => {
      llm.guion(producto({ name: 'Panela', salePrice: 2000, costPrice: 1200 }));

      const res = await escribir('agrega panela');

      expect(respuesta(res)).toMatch(/sigo registrando tus gastos/i);
    });

    it('ni siquiera llega a preguntar por los datos que faltan', async () => {
      llm.guion(producto({ name: 'Panela' }));

      const res = await escribir('agrega panela');

      expect(respuesta(res)).not.toMatch(/En cuánto vendes/i);
    });
  });

  /**
   * Ajustar las existencias desde WhatsApp.
   *
   * Antes no existia: quien contaba su bodega y queria corregir el stock no
   * tenia por donde, y Luka no sabia ni orientarle.
   *
   * El riesgo de esta funcion es confundir un conteo con una venta: si "me
   * quedan 3 gaseosas" se registrara como ingreso, aparecerian pesos que nunca
   * entraron. Por eso el ajuste NO crea ningun movimiento y el resumen se lo
   * dice al usuario con todas las letras antes de aplicarlo.
   */
  describe('ajustar las existencias de un producto', () => {
    const ajuste = (parcial: Record<string, unknown>): Intencion => ({
      type: 'stock',
      movements: [],
      stock: { productName: null, units: null, ...parcial },
    });

    const stockDe = async (id: string) =>
      (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock;

    it('ensena de cuanto a cuanto va, y pide confirmacion', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa', units: 3 }));

      const res = await escribir('me quedan 3 gaseosas');

      expect(respuesta(res)).toContain('Antes: 10 unidades');
      expect(respuesta(res)).toContain('Después: 3 unidades');
      expect(respuesta(res)).toContain('Bajan 7 unidades');
    });

    // La duda razonable de quien corrige un conteo: "¿esto me descuadra la
    // plata?". Dejarla sin responder hace que no se use la funcion.
    it('avisa de que no registra ninguna venta ni gasto', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa', units: 3 }));

      const res = await escribir('me quedan 3 gaseosas');

      expect(respuesta(res)).toMatch(
        /no registra ninguna venta ni ningún gasto/i,
      );
    });

    it('no toca nada hasta que el usuario dice que si', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa', units: 3 }));

      await escribir('me quedan 3 gaseosas');

      expect(await stockDe(s.gaseosaId)).toBe(10);
    });

    it('al confirmar, deja el stock en lo que dijo', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa', units: 3 }), si());

      await escribir('me quedan 3 gaseosas');
      const res = await escribir('sí');

      expect(await stockDe(s.gaseosaId)).toBe(3);
      expect(respuesta(res)).toContain('queda con 3 unidades');
    });

    // Lo mas importante de todo: el ajuste NO es dinero.
    it('y no crea ninguna venta ni ningun gasto', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa', units: 3 }), si());

      await escribir('me quedan 3 gaseosas');
      await escribir('sí');

      expect(await prisma.venta.count()).toBe(0);
      expect(await prisma.gasto.count()).toBe(0);
      expect(await prisma.detalleVenta.count()).toBe(0);
    });

    it('si dice que no, el stock se queda como estaba', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa', units: 3 }), no());

      await escribir('me quedan 3 gaseosas');
      const res = await escribir('no');

      expect(await stockDe(s.gaseosaId)).toBe(10);
      expect(respuesta(res)).toMatch(/dejé el inventario como estaba/i);
    });

    it('el 0 es un valor valido: se acabaron', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa', units: 0 }), si());

      await escribir('se acabaron las gaseosas');
      await escribir('sí');

      expect(await stockDe(s.gaseosaId)).toBe(0);
    });

    it('subir el stock tambien funciona', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa', units: 40 }), si());

      await escribir('conté la bodega: 40 gaseosas');
      const res = await escribir('sí');

      expect(await stockDe(s.gaseosaId)).toBe(40);
      expect(res.status).toBe(200);
    });

    /*
     * "Se me rompieron 2" dice cuantas se fueron, no cuantas quedan. Restar
     * por cuenta propia exige saber de cuantas se partia, y ese numero puede
     * estar mal: es justo lo que el usuario esta corrigiendo.
     */
    it('si no dice cuantas quedan, lo pregunta y dice cuantas tiene anotadas', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa' }));

      const res = await escribir('se me rompieron 2 gaseosas');

      expect(respuesta(res)).toMatch(/cuántas unidades de Gaseosa te quedan/i);
      expect(respuesta(res)).toContain('10');
      expect(await stockDe(s.gaseosaId)).toBe(10);
    });

    it('y con la respuesta del usuario completa el ajuste', async () => {
      llm.guion(ajuste({ productName: 'Gaseosa' }), ajuste({ units: 8 }), si());

      await escribir('se me rompieron 2 gaseosas');
      await escribir('me quedan 8');
      await escribir('sí');

      expect(await stockDe(s.gaseosaId)).toBe(8);
    });

    it('si no dice el producto, lo pregunta', async () => {
      llm.guion(ajuste({}));

      const res = await escribir('corrige el inventario');

      expect(respuesta(res)).toMatch(/de qué producto/i);
    });

    /*
     * Lo que pedia el issue: que Luka no se limite a decir que no puede, sino
     * que indique como continuar.
     */
    it('si el producto no esta en el catalogo, dice como agregarlo', async () => {
      llm.guion(ajuste({ productName: 'Audifonos', units: 5 }));

      const res = await escribir('me quedan 5 audífonos');

      expect(respuesta(res)).toMatch(/no encontré "Audifonos"/i);
      expect(respuesta(res)).toMatch(/agrega Audifonos/i);
      expect(respuesta(res)).not.toMatch(/no puedo/i);
    });

    it('ajustar inventario tambien es de planes pagos', async () => {
      await prisma.negocio.update({
        where: { id: s.negocioId },
        data: { plan: 1, planVenceEl: null },
      });
      llm.guion(ajuste({ productName: 'Gaseosa', units: 3 }));

      const res = await escribir('me quedan 3 gaseosas');

      expect(respuesta(res)).toMatch(/no está incluida en tu plan/i);
      expect(await stockDe(s.gaseosaId)).toBe(10);
    });
  });
});
