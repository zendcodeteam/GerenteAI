import { randomUUID } from 'node:crypto';

import { PrismaFinanceDataAdapter } from '../src/modules/finance-ai/adapters/prisma-finance-data.adapter';
import type { Transaction } from '../src/modules/finance-ai/domain/finance.types';
import { PrismaService } from '../src/services/prisma.service';
import { limpiar, sembrar, type Semilla } from './helpers/contexto';

/**
 * El camino por el que ESCRIBE el bot: `saveTransactions` del adaptador de
 * Prisma.
 *
 * Esta suite existe porque ese camino no tenia ni una prueba. Las de `ventas`,
 * `compras` y `fiados` recorren `VentasService` y `ComprasService`, que es por
 * donde escribe el PANEL. El bot entra por aqui, que es otro codigo
 * completamente distinto, y es el flujo principal del producto: un tendero
 * dictando por WhatsApp.
 *
 * Va contra Postgres de verdad a proposito. Lo que hay que proteger son
 * efectos sobre la base —que el stock baje, que el fiado quede por cobrar, que
 * no se guarde nada a medias— y eso con mocks no se ve.
 */
describe('Lo que el bot escribe en la base (e2e)', () => {
  let prisma: PrismaService;
  let adaptador: PrismaFinanceDataAdapter;
  let s: Semilla;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    adaptador = new PrismaFinanceDataAdapter(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await limpiar(prisma);
    s = await sembrar(prisma);
  });

  /** Un movimiento tal como lo arma el bot tras interpretar un mensaje. */
  function movimiento(parcial: Partial<Transaction> = {}): Transaction {
    return {
      id: randomUUID(),
      businessId: s.sedeAId,
      date: '2026-11-07',
      description: 'Venta del dia',
      category: 'ventas',
      amount: 10_000,
      type: 'income',
      currency: 'COP',
      source: 'whatsapp',
      createdAt: new Date().toISOString(),
      ...parcial,
    };
  }

  const ventas = () => prisma.venta.findMany({ where: { sedeId: s.sedeAId } });
  const gastos = () => prisma.gasto.findMany({ where: { sedeId: s.sedeAId } });
  const compras = () =>
    prisma.compra.findMany({ where: { sedeId: s.sedeAId } });

  const stockDe = async (id: string) =>
    (await prisma.producto.findUniqueOrThrow({ where: { id } })).stock;

  // ------------------------------------------------------------------------
  // 1. Movimientos SIN producto: lo que el plan gratuito necesita que siga
  //    funcionando exactamente igual que antes del inventario.
  // ------------------------------------------------------------------------
  describe('movimientos que no mencionan ningun producto', () => {
    it('una venta suelta se registra', async () => {
      await adaptador.saveTransactions([
        movimiento({ description: 'Venta de audifonos', amount: 80_000 }),
      ]);

      const registradas = await ventas();
      expect(registradas).toHaveLength(1);
      expect(Number(registradas[0].total)).toBe(80_000);
      expect(registradas[0].tipo).toBe('CONTADO');
      expect(registradas[0].descripcion).toBe('Venta de audifonos');
    });

    it('y no toca el inventario de la sede', async () => {
      await adaptador.saveTransactions([movimiento({ amount: 80_000 })]);

      expect(await stockDe(s.gaseosaId)).toBe(10);
      expect(await stockDe(s.panId)).toBe(5);
      expect(await prisma.detalleVenta.count()).toBe(0);
    });

    it('un gasto suelto se registra con su categoria', async () => {
      await adaptador.saveTransactions([
        movimiento({
          type: 'expense',
          category: 'transporte',
          description: 'Gasolina de la moto',
          amount: 25_000,
        }),
      ]);

      const registrados = await gastos();
      expect(registrados).toHaveLength(1);
      expect(Number(registrados[0].monto)).toBe(25_000);
      expect(registrados[0].categoria).toBe('TRANSPORTE');
    });

    it('el metodo de pago se guarda cuando viene', async () => {
      await adaptador.saveTransactions([
        movimiento({ paymentMethod: 'transferencia' }),
      ]);

      expect((await ventas())[0].metodoPago).toBe('TRANSFERENCIA');
    });

    it('varios movimientos en un mismo mensaje se guardan todos', async () => {
      await adaptador.saveTransactions([
        movimiento({ amount: 10_000 }),
        movimiento({ type: 'expense', category: 'insumos', amount: 4_000 }),
      ]);

      expect(await ventas()).toHaveLength(1);
      expect(await gastos()).toHaveLength(1);
    });
  });

  // ------------------------------------------------------------------------
  // 2. Fiados: tienen su propia mecanica y no pueden romperse de rebote.
  // ------------------------------------------------------------------------
  describe('fiados', () => {
    const fiado = () =>
      movimiento({
        isCredit: true,
        customerName: 'Doña María',
        amount: 30_000,
        dueDate: '2026-11-30',
      });

    it('queda como venta FIADO y con saldo por cobrar', async () => {
      await adaptador.saveTransactions([fiado()]);

      const [venta] = await ventas();
      expect(venta.tipo).toBe('FIADO');
      expect(Number(venta.saldoPendiente)).toBe(30_000);
    });

    it('se engancha al cliente que ya existe, sin duplicarlo', async () => {
      await adaptador.saveTransactions([fiado()]);

      const [venta] = await ventas();
      expect(venta.clienteId).toBe(s.clienteAId);
      expect(await prisma.cliente.count({ where: { sedeId: s.sedeAId } })).toBe(
        1,
      );
    });

    it('guarda la fecha maxima de pago que acordo el tendero', async () => {
      await adaptador.saveTransactions([fiado()]);

      const [venta] = await ventas();
      expect(venta.fechaVencimiento).not.toBeNull();
      expect(venta.fechaVencimiento!.toISOString().slice(0, 10)).toBe(
        '2026-11-30',
      );
    });

    it('una venta de contado no deja saldo pendiente', async () => {
      await adaptador.saveTransactions([movimiento()]);

      expect(Number((await ventas())[0].saldoPendiente)).toBe(0);
    });
  });

  // ------------------------------------------------------------------------
  // 3. Movimientos CON un producto que SI existe: la integracion que funciona.
  // ------------------------------------------------------------------------
  describe('venta de un producto que esta en el inventario', () => {
    const venta = () =>
      movimiento({ productName: 'Gaseosa', quantity: 3, amount: 4_500 });

    it('descuenta el stock', async () => {
      await adaptador.saveTransactions([venta()]);

      expect(await stockDe(s.gaseosaId)).toBe(7);
    });

    it('deja el detalle enganchado a la venta', async () => {
      await adaptador.saveTransactions([venta()]);

      const detalles = await prisma.detalleVenta.findMany();
      expect(detalles).toHaveLength(1);
      expect(detalles[0].productoId).toBe(s.gaseosaId);
      expect(detalles[0].cantidad).toBe(3);
    });

    // El bot resuelve el producto como lo dicta el tendero, no como esta
    // escrito: sin mayusculas y sin acentos.
    it.each(['gaseosa', 'GASEOSA', 'Gaseósa'])(
      'lo encuentra aunque lo dicte "%s"',
      async (nombre) => {
        await adaptador.saveTransactions([
          movimiento({ productName: nombre, quantity: 1, amount: 1_500 }),
        ]);

        expect(await stockDe(s.gaseosaId)).toBe(9);
      },
    );

    it('tambien lo encuentra por un alias', async () => {
      await prisma.producto.update({
        where: { id: s.gaseosaId },
        data: { alias: ['gaseosita'] },
      });

      await adaptador.saveTransactions([
        movimiento({ productName: 'gaseosita', quantity: 2, amount: 3_000 }),
      ]);

      expect(await stockDe(s.gaseosaId)).toBe(8);
    });

    /*
     * Vender mas de lo anotado NO tumba la venta.
     *
     * La venta ocurrio en el mundo real, y negarse a anotarla no devuelve las
     * unidades: solo pierde el ingreso. Lo que estaba mal era el conteo. El
     * estante queda en 0 y el aviso se lo da el servicio en la respuesta.
     */
    it('vender mas de lo anotado registra la venta igual', async () => {
      await adaptador.saveTransactions([
        movimiento({ productName: 'Gaseosa', quantity: 99, amount: 99_000 }),
      ]);

      const registradas = await ventas();
      expect(registradas).toHaveLength(1);
      expect(Number(registradas[0].total)).toBe(99_000);
    });

    it('y deja el estante en 0, nunca en negativo', async () => {
      await adaptador.saveTransactions([
        movimiento({ productName: 'Gaseosa', quantity: 99, amount: 99_000 }),
      ]);

      expect(await stockDe(s.gaseosaId)).toBe(0);
    });
  });

  describe('compra de un producto que esta en el inventario', () => {
    const compra = () =>
      movimiento({
        type: 'expense',
        category: 'mercancia',
        productName: 'Gaseosa',
        quantity: 20,
        amount: 22_000,
      });

    it('sube el stock', async () => {
      await adaptador.saveTransactions([compra()]);

      expect(await stockDe(s.gaseosaId)).toBe(30);
    });

    it('entra como Compra, no como Gasto suelto', async () => {
      await adaptador.saveTransactions([compra()]);

      expect(await compras()).toHaveLength(1);
      expect(await gastos()).toHaveLength(0);
      expect(await prisma.detalleCompra.count()).toBe(1);
    });

    it('actualiza el costo de compra del producto', async () => {
      await adaptador.saveTransactions([compra()]);

      const producto = await prisma.producto.findUniqueOrThrow({
        where: { id: s.gaseosaId },
      });
      expect(Number(producto.precioCompra)).toBe(1_100); // 22.000 / 20
    });
  });

  // ------------------------------------------------------------------------
  // 4. Lo que NO esta en el catalogo.
  //
  //    Antes tumbaba el movimiento entero. Pero no todos los negocios venden
  //    mercancia: una peluqueria que cobra un corte, un restaurante que vende
  //    un almuerzo. Registrar el movimiento es LA funcion del producto; el
  //    inventario es un anadido y nunca puede ser un peaje.
  // ------------------------------------------------------------------------
  describe('un producto que no esta en el catalogo no bloquea nada', () => {
    const audifonos = () =>
      movimiento({ productName: 'Audifonos', quantity: 1, amount: 80_000 });

    it('la venta se registra igual', async () => {
      await adaptador.saveTransactions([audifonos()]);

      const registradas = await ventas();
      expect(registradas).toHaveLength(1);
      expect(Number(registradas[0].total)).toBe(80_000);
    });

    it('sin engancharla a ningun producto', async () => {
      await adaptador.saveTransactions([audifonos()]);

      expect(await prisma.detalleVenta.count()).toBe(0);
    });

    it('y sin tocar el inventario de los demas', async () => {
      await adaptador.saveTransactions([audifonos()]);

      expect(await stockDe(s.gaseosaId)).toBe(10);
      expect(await stockDe(s.panId)).toBe(5);
    });

    // El caso del taxi: el modelo rellena productName con mucha alegria.
    it('un gasto con un producto desconocido tambien se registra', async () => {
      await adaptador.saveTransactions([
        movimiento({
          type: 'expense',
          category: 'transporte',
          description: 'Taxi',
          productName: 'Taxi',
          quantity: 1,
          amount: 40_000,
        }),
      ]);

      expect(await gastos()).toHaveLength(1);
    });

    // El inventario es por sede: "Arroz" existe, pero en la B.
    it('un producto de OTRA sede no descuenta, pero la venta entra', async () => {
      await adaptador.saveTransactions([
        movimiento({ productName: 'Arroz', quantity: 1, amount: 3_000 }),
      ]);

      expect(await ventas()).toHaveLength(1);
      expect(await stockDe(s.arrozId)).toBe(10);
    });

    // Sin unidades no hay nada que descontar, pero el monto no se pierde.
    it('nombrar un producto sin decir cuantas unidades tampoco bloquea', async () => {
      await adaptador.saveTransactions([
        movimiento({ productName: 'Gaseosa', amount: 3_000 }),
      ]);

      expect(await ventas()).toHaveLength(1);
      expect(await stockDe(s.gaseosaId)).toBe(10);
    });
  });

  // ------------------------------------------------------------------------
  // 5. Atomicidad: lo que mas caro sale si se rompe.
  // ------------------------------------------------------------------------
  describe('o se guarda todo, o no se guarda nada', () => {
    /*
     * Ya no se puede provocar el fallo con un producto desconocido ni con
     * falta de stock —ninguno de los dos bloquea—, asi que se usa una sede
     * que no existe: la base lo rechaza por clave foranea dentro de la misma
     * transaccion.
     */
    it('si una parte del mensaje falla, las otras tampoco entran', async () => {
      await expect(
        adaptador.saveTransactions([
          movimiento({ amount: 10_000 }),
          movimiento({
            businessId: '00000000-0000-0000-0000-000000000000',
            amount: 20_000,
          }),
        ]),
      ).rejects.toThrow();

      expect(await ventas()).toHaveLength(0);
    });

    it('y el stock de lo que si existia no se mueve', async () => {
      await expect(
        adaptador.saveTransactions([
          movimiento({ productName: 'Pan', quantity: 2, amount: 1_000 }),
          movimiento({
            businessId: '00000000-0000-0000-0000-000000000000',
            amount: 20_000,
          }),
        ]),
      ).rejects.toThrow();

      expect(await stockDe(s.panId)).toBe(5);
      expect(await ventas()).toHaveLength(0);
    });
  });
});
