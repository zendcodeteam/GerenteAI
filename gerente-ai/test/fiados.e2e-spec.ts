import { BadRequestException } from '@nestjs/common';
import {
  cerrarContexto,
  crearContexto,
  limpiar,
  saldoDe,
  sembrar,
  type Contexto,
  type Semilla,
} from './helpers/contexto';

describe('Fiados detallados (contra Postgres real)', () => {
  let ctx: Contexto;
  let s: Semilla;

  beforeAll(async () => {
    ctx = await crearContexto();
  });

  afterAll(async () => {
    await limpiar(ctx.prisma);
    await cerrarContexto(ctx);
  });

  beforeEach(async () => {
    await limpiar(ctx.prisma);
    s = await sembrar(ctx.prisma);
  });

  const fiar = (cantidad: number, diasCredito?: number) =>
    ctx.ventas.create(s.duenoId, 'CLIENTE', {
      sedeId: s.sedeAId,
      tipo: 'FIADO',
      clienteId: s.clienteAId,
      diasCredito,
      detalles: [{ productoId: s.gaseosaId, cantidad }],
    });

  const saldoDeLaVenta = async (ventaId: string) => {
    const venta = await ctx.prisma.venta.findUnique({ where: { id: ventaId } });
    return venta!.saldoPendiente.toNumber();
  };

  describe('la venta fiada nace con deuda y plazo', () => {
    it('el saldo pendiente arranca igual al total', async () => {
      const venta = await fiar(2); // 2 x 1500.50

      expect(venta.total.toNumber()).toBe(3001);
      expect(await saldoDeLaVenta(venta.id)).toBe(3001);
    });

    it('sin plazo explícito se dan 30 días', async () => {
      const venta = await fiar(1);
      const guardada = await ctx.prisma.venta.findUnique({
        where: { id: venta.id },
      });

      const dias = Math.round(
        (guardada!.fechaVencimiento!.getTime() - Date.now()) / 86_400_000,
      );
      expect(dias).toBe(30);
    });

    it('se puede pedir otro plazo', async () => {
      const venta = await fiar(1, 15);
      const guardada = await ctx.prisma.venta.findUnique({
        where: { id: venta.id },
      });

      const dias = Math.round(
        (guardada!.fechaVencimiento!.getTime() - Date.now()) / 86_400_000,
      );
      expect(dias).toBe(15);
    });

    it('mantiene el saldo pendiente del cliente alineado con el fiado registrado', async () => {
      await fiar(2);

      expect(await saldoDe(ctx.prisma, s.clienteAId)).toBe(3001);
    });

    it('una venta de contado no lleva deuda ni vencimiento', async () => {
      const venta = await ctx.ventas.create(s.duenoId, 'CLIENTE', {
        sedeId: s.sedeAId,
        detalles: [{ productoId: s.gaseosaId, cantidad: 1 }],
      });
      const guardada = await ctx.prisma.venta.findUnique({
        where: { id: venta.id },
      });

      expect(guardada!.saldoPendiente.toNumber()).toBe(0);
      expect(guardada!.fechaVencimiento).toBeNull();
    });

    // Aceptar el plazo en una venta de contado haría creer que quedó registrado.
    it('rechaza un plazo de crédito en una venta de contado', async () => {
      await expect(
        ctx.ventas.create(s.duenoId, 'CLIENTE', {
          sedeId: s.sedeAId,
          diasCredito: 30,
          detalles: [{ productoId: s.gaseosaId, cantidad: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('backfill de datos históricos', () => {
    it('recalcula el saldo del cliente con la suma de sus fiados aún abiertos', async () => {
      const ventaAntigua = await fiar(1);
      const ventaNueva = await fiar(1);
      await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        ventaId: ventaAntigua.id,
        monto: 1000,
      });
      await ctx.prisma.cliente.update({
        where: { id: s.clienteAId },
        data: { saldoPendiente: 0 },
      });

      await ctx.prisma.$executeRaw`
        UPDATE "Cliente" c
        SET "saldoPendiente" = COALESCE(
          (
            SELECT SUM(v."saldoPendiente")
            FROM "Venta" v
            WHERE v."clienteId" = c.id
              AND v."saldoPendiente" > 0
          ),
          0
        )
      `;

      expect(await saldoDe(ctx.prisma, s.clienteAId)).toBe(2001);
      expect(await saldoDeLaVenta(ventaAntigua.id)).toBe(500.5);
      expect(await saldoDeLaVenta(ventaNueva.id)).toBe(1500.5);
    });

    it('asigna 30 días a los fiados sin vencimiento y conserva avisos ya enviados', async () => {
      const venta = await fiar(1);
      const fechaVenta = venta.fecha;
      await ctx.prisma.venta.update({
        where: { id: venta.id },
        data: { fechaVencimiento: null },
      });
      await ctx.prisma.recordatorioFiado.create({
        data: { ventaId: venta.id, saldo: venta.saldoPendiente },
      });

      await ctx.prisma.$executeRaw`
        UPDATE "Venta"
        SET "fechaVencimiento" = "fecha" + INTERVAL '30 days'
        WHERE "tipo" = 'FIADO'
          AND "fechaVencimiento" IS NULL
      `;

      const actualizada = await ctx.prisma.venta.findUnique({
        where: { id: venta.id },
        include: { recordatorios: true },
      });
      expect(actualizada!.fechaVencimiento!.getTime()).toBe(
        fechaVenta.getTime() + 30 * 86_400_000,
      );
      expect(actualizada!.recordatorios).not.toBeNull();
    });
  });

  describe('los abonos se aplican a ventas concretas', () => {
    it('el abono baja el saldo de la venta, no solo el del cliente', async () => {
      const venta = await fiar(2); // debe 3001

      await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        monto: 1000,
      });

      expect(await saldoDeLaVenta(venta.id)).toBe(2001);
      expect(await saldoDe(ctx.prisma, s.clienteAId)).toBe(2001);
    });

    it('queda registrado a qué venta correspondió el pago', async () => {
      const venta = await fiar(1);

      const [abono] = await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        monto: 500,
      });

      expect(abono.ventaId).toBe(venta.id);
    });

    it('sin indicar venta, se paga primero la deuda más antigua', async () => {
      const vieja = await fiar(1); // 1500.50
      const nueva = await fiar(1); // 1500.50
      // La semilla las crea con el mismo instante; se separa para fijar el orden.
      await ctx.prisma.venta.update({
        where: { id: vieja.id },
        data: { fecha: new Date(Date.now() - 5 * 86_400_000) },
      });

      await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        monto: 1000,
      });

      expect(await saldoDeLaVenta(vieja.id)).toBe(500.5);
      expect(await saldoDeLaVenta(nueva.id)).toBe(1500.5);
    });

    it('un pago que cubre dos ventas genera un abono por cada una', async () => {
      const vieja = await fiar(1);
      const nueva = await fiar(1);
      await ctx.prisma.venta.update({
        where: { id: vieja.id },
        data: { fecha: new Date(Date.now() - 5 * 86_400_000) },
      });

      // 2000 alcanza para saldar la vieja (1500.50) y abonar 499.50 a la nueva.
      const abonos = await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        monto: 2000,
      });

      expect(abonos).toHaveLength(2);
      expect(await saldoDeLaVenta(vieja.id)).toBe(0);
      expect(await saldoDeLaVenta(nueva.id)).toBe(1500.5 - 499.5);
    });

    it('se puede señalar exactamente qué venta se está pagando', async () => {
      const vieja = await fiar(1);
      const nueva = await fiar(1);
      await ctx.prisma.venta.update({
        where: { id: vieja.id },
        data: { fecha: new Date(Date.now() - 5 * 86_400_000) },
      });

      await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        ventaId: nueva.id,
        monto: 500,
      });

      expect(await saldoDeLaVenta(vieja.id)).toBe(1500.5);
      expect(await saldoDeLaVenta(nueva.id)).toBe(1000.5);
    });

    it('rechaza pagar una venta que no es de ese cliente', async () => {
      const ajena = await ctx.ventas.create(s.duenoId, 'CLIENTE', {
        sedeId: s.sedeAId,
        detalles: [{ productoId: s.gaseosaId, cantidad: 1 }],
      });
      await fiar(1);

      await expect(
        ctx.abonos.create(s.duenoId, 'CLIENTE', {
          clienteId: s.clienteAId,
          ventaId: ajena.id,
          monto: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('anular el abono devuelve la deuda a su venta', async () => {
      const venta = await fiar(2);
      const [abono] = await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        monto: 1000,
      });
      expect(await saldoDeLaVenta(venta.id)).toBe(2001);

      await ctx.abonos.remove(abono.id, s.duenoId, 'CLIENTE');

      expect(await saldoDeLaVenta(venta.id)).toBe(3001);
      expect(await saldoDe(ctx.prisma, s.clienteAId)).toBe(3001);
    });
  });

  describe('reporte de fiados', () => {
    it('agrupa por cliente con su saldo y sus ventas', async () => {
      await fiar(2);
      await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        monto: 1000,
      });

      const reporte = await ctx.reportes.fiados(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
      );

      expect(reporte.totales.porCobrar).toBe(2001);
      expect(reporte.totales.clientesConDeuda).toBe(1);
      expect(reporte.clientes[0].nombre).toBe('Doña María');
      expect(reporte.clientes[0].ventas[0].abonado).toBe(1000);
      expect(reporte.clientes[0].ventas[0].abonos).toHaveLength(1);
    });

    it('marca lo vencido y calcula los días de atraso', async () => {
      const venta = await fiar(1);
      await ctx.prisma.venta.update({
        where: { id: venta.id },
        data: { fechaVencimiento: new Date(Date.now() - 10 * 86_400_000) },
      });

      const reporte = await ctx.reportes.fiados(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
      );

      expect(reporte.totales.vencido).toBe(1500.5);
      expect(reporte.clientes[0].ventas[0].vencida).toBe(true);
      expect(reporte.clientes[0].ventas[0].diasDeAtraso).toBe(10);
    });

    it('lo que aún no vence no cuenta como vencido', async () => {
      await fiar(1);

      const reporte = await ctx.reportes.fiados(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
      );

      expect(reporte.totales.porCobrar).toBe(1500.5);
      expect(reporte.totales.vencido).toBe(0);
      expect(reporte.clientes[0].ventas[0].vencida).toBe(false);
    });

    it('una venta saldada desaparece del reporte', async () => {
      await fiar(1);
      await ctx.abonos.create(s.duenoId, 'CLIENTE', {
        clienteId: s.clienteAId,
        monto: 1500.5,
      });

      const reporte = await ctx.reportes.fiados(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
      );

      expect(reporte.totales.porCobrar).toBe(0);
      expect(reporte.clientes).toHaveLength(0);
    });
  });

  describe('reporte por producto', () => {
    it('agrupa unidades e ingresos por producto', async () => {
      await ctx.ventas.create(s.duenoId, 'CLIENTE', {
        sedeId: s.sedeAId,
        detalles: [
          { productoId: s.gaseosaId, cantidad: 3 },
          { productoId: s.panId, cantidad: 2 },
        ],
      });

      const reporte = await ctx.reportes.porProducto(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
        'mensual',
      );

      const gaseosa = reporte.productos.find((p) => p.id === s.gaseosaId)!;
      expect(gaseosa.unidades).toBe(3);
      expect(gaseosa.ingresos).toBe(4501.5);
      // Margen: (1500.50 - 1000) x 3
      expect(gaseosa.margenEstimado).toBe(1501.5);
      expect(reporte.totalIngresos).toBe(4501.5 + 1000);
    });

    it('ordena de mayor a menor ingreso y calcula la participación', async () => {
      await ctx.ventas.create(s.duenoId, 'CLIENTE', {
        sedeId: s.sedeAId,
        detalles: [
          { productoId: s.gaseosaId, cantidad: 3 },
          { productoId: s.panId, cantidad: 2 },
        ],
      });

      const reporte = await ctx.reportes.porProducto(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
        'mensual',
      );

      expect(reporte.productos[0].id).toBe(s.gaseosaId);
      const suma = reporte.productos.reduce((t, p) => t + p.participacion, 0);
      expect(Math.round(suma)).toBe(100);
    });
  });
});
