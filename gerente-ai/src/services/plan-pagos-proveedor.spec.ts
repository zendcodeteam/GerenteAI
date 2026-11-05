import { calcularPlanDePagos } from './plan-pagos-proveedor';

describe('calcularPlanDePagos', () => {
  const primeraFecha = new Date('2026-01-31T12:00:00.000Z');

  it('distribuye el capital en cuotas mensuales cuando no hay interés', () => {
    const plan = calcularPlanDePagos(1000, 3, 0, primeraFecha);

    expect(plan.map(({ monto }) => monto)).toEqual([333.33, 333.33, 333.34]);
    expect(plan.reduce((total, cuota) => total + cuota.interes, 0)).toBe(0);
    expect(plan.map(({ fechaVencimiento }) => fechaVencimiento.toISOString())).toEqual([
      '2026-01-31T12:00:00.000Z',
      '2026-02-28T12:00:00.000Z',
      '2026-03-31T12:00:00.000Z',
    ]);
  });

  it('calcula interés sobre saldo pendiente y conserva cuotas iguales', () => {
    const plan = calcularPlanDePagos(1000, 2, 10, primeraFecha);

    expect(plan.map(({ monto }) => monto)).toEqual([576.19, 576.19]);
    expect(plan.map(({ interes }) => interes)).toEqual([100, 52.38]);
    expect(plan.reduce((total, cuota) => total + cuota.capital, 0)).toBe(1000);
  });

  it('ajusta la última cuota para eliminar residuos de redondeo', () => {
    const plan = calcularPlanDePagos(10, 3, 0, primeraFecha);

    expect(plan.map(({ monto }) => monto)).toEqual([3.33, 3.33, 3.34]);
    expect(plan.reduce((total, cuota) => total + cuota.capital, 0)).toBe(10);
  });
});