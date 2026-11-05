import { ModalidadDeudaProveedor, Prisma } from '@prisma/client';
import { DatosDeuda, planDeDeudaProveedor } from './plan-deuda-proveedor';

const fecha = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const dias = (plan: { cuotas: { fechaVencimiento: Date }[] }) =>
  plan.cuotas.map((c) => c.fechaVencimiento.toISOString().slice(0, 10));

const deuda = (parcial: Partial<DatosDeuda> = {}): DatosDeuda => ({
  montoTotal: 100000,
  fechaLimite: fecha('2026-12-31'),
  modalidad: ModalidadDeudaProveedor.UNICO,
  numeroCuotas: null,
  aplicaInteres: false,
  porcentajeInteres: null,
  ...parcial,
});

describe('planDeDeudaProveedor - plan de pagos de una deuda con proveedor', () => {
  describe('Criterio 1: pago único = una obligación en la fecha límite', () => {
    it('genera una sola cuota por el monto total, vencida en fechaLimite', () => {
      const plan = planDeDeudaProveedor(deuda());

      expect(plan.cuotas).toHaveLength(1);
      expect(plan.cuotas[0].monto).toBe(100000);
      expect(dias(plan)).toEqual(['2026-12-31']);
      expect(plan).toMatchObject({
        capital: 100000,
        interesTotal: 0,
        total: 100000,
      });
    });

    it('con interés lleva un período del porcentaje', () => {
      const plan = planDeDeudaProveedor(
        deuda({ aplicaInteres: true, porcentajeInteres: 5 }),
      );

      expect(plan.cuotas).toHaveLength(1);
      expect(plan.total).toBe(105000);
      expect(plan.interesTotal).toBe(5000);
    });

    it('ignora numeroCuotas cuando la modalidad es UNICO', () => {
      const plan = planDeDeudaProveedor(deuda({ numeroCuotas: 4 }));
      expect(plan.cuotas).toHaveLength(1);
    });
  });

  describe('Criterio 2: N cuotas con fecha y valor, y la suma cuadra con el total', () => {
    const enCuotas = (parcial: Partial<DatosDeuda>) =>
      deuda({ modalidad: ModalidadDeudaProveedor.CUOTAS, ...parcial });

    it('sin interés reparte el capital y la última cuota absorbe el redondeo', () => {
      const plan = planDeDeudaProveedor(enCuotas({ numeroCuotas: 3 }));

      expect(plan.cuotas.map((c) => c.monto)).toEqual([
        33333.33, 33333.33, 33333.34,
      ]);
      expect(plan.total).toBe(100000);
      expect(plan.interesTotal).toBe(0);
    });

    it('con interés sobre saldo: total = suma de cuotas y capital repartido completo', () => {
      const plan = planDeDeudaProveedor(
        enCuotas({
          montoTotal: 1000,
          numeroCuotas: 2,
          aplicaInteres: true,
          porcentajeInteres: 10,
        }),
      );

      expect(plan.cuotas.map((c) => c.monto)).toEqual([576.19, 576.19]);
      expect(plan.total).toBe(1152.38);
      expect(plan.interesTotal).toBe(152.38);
      const capitalRepartido = plan.cuotas.reduce((s, c) => s + c.capital, 0);
      expect(Math.round(capitalRepartido * 100) / 100).toBe(1000);
    });

    it('la suma de las cuotas coincide con el total en 12 cuotas con interés', () => {
      const plan = planDeDeudaProveedor(
        enCuotas({
          montoTotal: 2500000,
          numeroCuotas: 12,
          aplicaInteres: true,
          porcentajeInteres: 2.5,
        }),
      );

      const suma = plan.cuotas.reduce((s, c) => s + c.monto, 0);
      expect(plan.cuotas).toHaveLength(12);
      expect(Math.round(suma * 100) / 100).toBe(plan.total);
    });

    it('aplicaInteres con 0% equivale a no aplicar interés', () => {
      const conCero = planDeDeudaProveedor(
        enCuotas({
          numeroCuotas: 4,
          aplicaInteres: true,
          porcentajeInteres: 0,
        }),
      );
      const sin = planDeDeudaProveedor(enCuotas({ numeroCuotas: 4 }));
      expect(conCero.cuotas.map((c) => c.monto)).toEqual(
        sin.cuotas.map((c) => c.monto),
      );
    });

    it('ignora el porcentaje guardado si aplicaInteres es false', () => {
      const plan = planDeDeudaProveedor(
        enCuotas({
          numeroCuotas: 2,
          aplicaInteres: false,
          porcentajeInteres: 9,
        }),
      );
      expect(plan.interesTotal).toBe(0);
    });

    it('acepta montos y porcentajes como Prisma.Decimal', () => {
      const plan = planDeDeudaProveedor(
        enCuotas({
          montoTotal: new Prisma.Decimal('1000'),
          numeroCuotas: 2,
          aplicaInteres: true,
          porcentajeInteres: new Prisma.Decimal('10'),
        }),
      );
      expect(plan.total).toBe(1152.38);
    });
  });

  describe('Fechas: la última cuota vence en fechaLimite y las demás van hacia atrás', () => {
    const enCuotas = (fechaLimite: string, numeroCuotas: number) =>
      planDeDeudaProveedor(
        deuda({
          modalidad: ModalidadDeudaProveedor.CUOTAS,
          numeroCuotas,
          fechaLimite: fecha(fechaLimite),
        }),
      );

    it('mínimo de 2 cuotas', () => {
      expect(dias(enCuotas('2026-12-15', 2))).toEqual([
        '2026-11-15',
        '2026-12-15',
      ]);
    });

    it('cruza el cambio de año', () => {
      expect(dias(enCuotas('2027-01-15', 3))).toEqual([
        '2026-11-15',
        '2026-12-15',
        '2027-01-15',
      ]);
    });

    it('recorta al fin de mes sin arrastrar el recorte', () => {
      expect(dias(enCuotas('2026-04-30', 3))).toEqual([
        '2026-02-28',
        '2026-03-30',
        '2026-04-30',
      ]);
    });

    it('respeta el 29 de febrero en año bisiesto', () => {
      expect(dias(enCuotas('2028-03-31', 2))).toEqual([
        '2028-02-29',
        '2028-03-31',
      ]);
    });

    it('la última cuota coincide siempre con fechaLimite', () => {
      const plan = enCuotas('2026-08-31', 6);
      expect(plan.cuotas.at(-1)!.fechaVencimiento).toEqual(fecha('2026-08-31'));
    });
  });
});
