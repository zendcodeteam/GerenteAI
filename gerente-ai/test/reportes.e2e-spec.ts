import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NegociosService } from '../src/services/negocios.service';
import { UserContextCacheService } from '../src/services/user-context-cache.service';
import { PlanesService } from '../src/services/planes.service';
import { PrismaService } from '../src/services/prisma.service';
import { ReportesService } from '../src/services/reportes.service';
import { limpiar, sembrar, type Semilla } from './helpers/contexto';

// Fechas fijas, en UTC. Colombia es UTC-5, así que el día local 2026-03-10 va desde
// 2026-03-10T05:00Z hasta 2026-03-11T05:00Z.
const DIA = '2026-03-10';
const DENTRO = new Date('2026-03-10T15:00:00Z'); // 10:00 en Colombia
const CASI_MEDIANOCHE = new Date('2026-03-11T04:30:00Z'); // 23:30 del día 10 en Colombia
const YA_ES_MANANA = new Date('2026-03-11T05:30:00Z'); // 00:30 del día 11 en Colombia
const ANTES = new Date('2026-03-10T04:30:00Z'); // 23:30 del día 9 en Colombia

describe('ReportesService (contra Postgres real)', () => {
  let prisma: PrismaService;
  let reportes: ReportesService;
  let cerrar: () => Promise<void>;
  let s: Semilla;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportesService,
        NegociosService,
        UserContextCacheService,
        PlanesService,
        PrismaService,
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    reportes = moduleRef.get(ReportesService);
    await prisma.$connect();
    cerrar = async () => {
      await prisma.$disconnect();
      await moduleRef.close();
    };
  });

  afterAll(async () => {
    await limpiar(prisma);
    await cerrar();
  });

  beforeEach(async () => {
    await limpiar(prisma);
    s = await sembrar(prisma);
  });

  const venta = (
    sedeId: string,
    total: number,
    tipo: 'CONTADO' | 'FIADO',
    fecha: Date,
  ) => prisma.venta.create({ data: { sedeId, total, tipo, fecha } });

  const abono = (
    sedeId: string,
    clienteId: string,
    monto: number,
    fecha: Date,
  ) => prisma.abono.create({ data: { sedeId, clienteId, monto, fecha } });

  const compra = (sedeId: string, total: number, fecha: Date) =>
    prisma.compra.create({ data: { sedeId, total, fecha } });

  const gasto = (sedeId: string, monto: number, fecha: Date) =>
    prisma.gasto.create({
      data: {
        sedeId,
        monto,
        descripcion: 'Arriendo',
        categoria: 'ARRIENDO',
        fecha,
      },
    });

  const reporteDelDia = () =>
    reportes.deSede(s.sedeAId, s.duenoId, 'CLIENTE', 'diario', DIA);

  describe('cálculo de ingresos y egresos', () => {
    it('suma ventas de contado y abonos como ingresos, compras y gastos como egresos', async () => {
      await venta(s.sedeAId, 100000, 'CONTADO', DENTRO);
      await abono(s.sedeAId, s.clienteAId, 25000, DENTRO);
      await compra(s.sedeAId, 40000, DENTRO);
      await gasto(s.sedeAId, 10000, DENTRO);

      const r = await reporteDelDia();

      expect(r.ingresos).toEqual({
        ventasContado: 100000,
        abonos: 25000,
        total: 125000,
      });
      expect(r.egresos).toEqual({
        compras: 40000,
        gastos: 10000,
        total: 50000,
      });
      expect(r.balance).toBe(75000);
    });

    // Lo central: fiar no es recibir plata.
    it('una venta FIADO no cuenta como ingreso, pero sí queda registrada aparte', async () => {
      await venta(s.sedeAId, 100000, 'CONTADO', DENTRO);
      await venta(s.sedeAId, 80000, 'FIADO', DENTRO);

      const r = await reporteDelDia();

      expect(r.ingresos.total).toBe(100000);
      expect(r.balance).toBe(100000);
      expect(r.informativo.ventasFiado).toBe(80000);
      expect(r.informativo.ventasTotales).toBe(180000);
      expect(r.informativo.conteos.ventas).toBe(2);
    });

    it('el abono de una deuda vieja sí es ingreso del día en que se paga', async () => {
      await venta(s.sedeAId, 80000, 'FIADO', ANTES); // deuda de ayer
      await abono(s.sedeAId, s.clienteAId, 80000, DENTRO); // paga hoy

      const r = await reporteDelDia();

      expect(r.ingresos.total).toBe(80000);
      expect(r.informativo.ventasFiado).toBe(0);
    });

    it('devuelve todo en cero cuando no hubo movimiento', async () => {
      const r = await reporteDelDia();

      expect(r.ingresos.total).toBe(0);
      expect(r.egresos.total).toBe(0);
      expect(r.balance).toBe(0);
      expect(r.informativo.conteos).toEqual({
        ventas: 0,
        abonos: 0,
        compras: 0,
        gastos: 0,
      });
    });

    it('el balance puede quedar negativo si se gastó más de lo que entró', async () => {
      await venta(s.sedeAId, 10000, 'CONTADO', DENTRO);
      await compra(s.sedeAId, 90000, DENTRO);

      expect((await reporteDelDia()).balance).toBe(-80000);
    });
  });

  describe('límites del período en hora de Colombia', () => {
    // Sin la conversión de zona horaria, esta venta caería en el reporte del día siguiente.
    it('incluye una venta de las 23:30 hora local', async () => {
      await venta(s.sedeAId, 50000, 'CONTADO', CASI_MEDIANOCHE);

      expect((await reporteDelDia()).ingresos.total).toBe(50000);
    });

    it('excluye una venta de las 00:30 del día siguiente', async () => {
      await venta(s.sedeAId, 50000, 'CONTADO', YA_ES_MANANA);

      expect((await reporteDelDia()).ingresos.total).toBe(0);
    });

    it('excluye una venta de las 23:30 del día anterior', async () => {
      await venta(s.sedeAId, 50000, 'CONTADO', ANTES);

      expect((await reporteDelDia()).ingresos.total).toBe(0);
    });

    it('la semana va de lunes a domingo y dura exactamente 7 días', async () => {
      const r = await reportes.deSede(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
        'semanal',
        DIA,
      );
      const desde = new Date(r.periodo.desde);
      const hasta = new Date(r.periodo.hasta);

      // desde es lunes 00:00 en Colombia, o sea lunes 05:00 UTC.
      expect(desde.getUTCDay()).toBe(1);
      expect(desde.getUTCHours()).toBe(5);
      expect((hasta.getTime() - desde.getTime()) / 86_400_000).toBe(7);
    });

    it('el mes arranca el día 1 y termina el 1 del mes siguiente', async () => {
      const r = await reportes.deSede(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
        'mensual',
        DIA,
      );

      expect(r.periodo.desde).toBe('2026-03-01T05:00:00.000Z');
      expect(r.periodo.hasta).toBe('2026-04-01T05:00:00.000Z');
    });

    it('el reporte semanal recoge movimientos de días distintos de esa semana', async () => {
      await venta(s.sedeAId, 10000, 'CONTADO', DENTRO);
      await venta(s.sedeAId, 20000, 'CONTADO', ANTES); // día anterior, misma semana

      const r = await reportes.deSede(
        s.sedeAId,
        s.duenoId,
        'CLIENTE',
        'semanal',
        DIA,
      );
      expect(r.ingresos.total).toBe(30000);
    });
  });

  describe('aislamiento entre sedes', () => {
    it('el reporte de una sede no incluye movimientos de la otra', async () => {
      await venta(s.sedeAId, 10000, 'CONTADO', DENTRO);
      await venta(s.sedeBId, 99999, 'CONTADO', DENTRO);

      expect((await reporteDelDia()).ingresos.total).toBe(10000);
    });
  });

  describe('consolidado del negocio', () => {
    it('suma todas las sedes y entrega el desglose de cada una', async () => {
      await venta(s.sedeAId, 10000, 'CONTADO', DENTRO);
      await venta(s.sedeBId, 25000, 'CONTADO', DENTRO);
      await gasto(s.sedeBId, 5000, DENTRO);

      const r = await reportes.deNegocio(
        s.negocioId,
        s.duenoId,
        'CLIENTE',
        'diario',
        DIA,
      );

      expect(r.ingresos.total).toBe(35000);
      expect(r.egresos.total).toBe(5000);
      expect(r.balance).toBe(30000);

      expect(r.sedes).toHaveLength(2);
      const centro = r.sedes.find((x) => x.sede.id === s.sedeAId)!;
      const norte = r.sedes.find((x) => x.sede.id === s.sedeBId)!;
      expect(centro.ingresos.total).toBe(10000);
      expect(norte.balance).toBe(20000);
    });

    it('falla con 404 si el negocio no existe', async () => {
      await expect(
        reportes.deNegocio(
          '00000000-0000-0000-0000-000000000000',
          s.duenoId,
          'CLIENTE',
          'diario',
          DIA,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('permisos', () => {
    it('el admin de la sede A ve el reporte de su sede', async () => {
      await expect(
        reportes.deSede(s.sedeAId, s.adminSedeAId, 'CLIENTE', 'diario', DIA),
      ).resolves.toBeDefined();
    });

    it('el admin de la sede A no ve el reporte de la sede B', async () => {
      await expect(
        reportes.deSede(s.sedeBId, s.adminSedeAId, 'CLIENTE', 'diario', DIA),
      ).rejects.toThrow(ForbiddenException);
    });

    // El consolidado mezcla números de todas las sedes: es solo del dueño.
    it('el admin de sede no ve el consolidado del negocio', async () => {
      await expect(
        reportes.deNegocio(
          s.negocioId,
          s.adminSedeAId,
          'CLIENTE',
          'diario',
          DIA,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un usuario ajeno no ve ningún reporte', async () => {
      await expect(
        reportes.deSede(s.sedeAId, s.ajenoId, 'CLIENTE', 'diario', DIA),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        reportes.deNegocio(s.negocioId, s.ajenoId, 'CLIENTE', 'diario', DIA),
      ).rejects.toThrow(ForbiddenException);
    });

    it('MASTER ve cualquier reporte', async () => {
      await expect(
        reportes.deSede(s.sedeBId, s.masterId, 'MASTER', 'diario', DIA),
      ).resolves.toBeDefined();
      await expect(
        reportes.deNegocio(s.negocioId, s.masterId, 'MASTER', 'diario', DIA),
      ).resolves.toBeDefined();
    });
  });
});
