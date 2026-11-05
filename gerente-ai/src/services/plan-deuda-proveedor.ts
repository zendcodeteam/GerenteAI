import { ModalidadDeudaProveedor } from '@prisma/client';
import {
  calcularPlanDePagos,
  CuotaCalculada,
  sumarMeses,
} from './plan-pagos-proveedor';

/** Campos de `DeudaProveedor` que intervienen en el plan de pagos. */
export interface DatosDeuda {
  montoTotal: { toString(): string } | number;
  fechaLimite: Date;
  modalidad: ModalidadDeudaProveedor;
  numeroCuotas: number | null;
  aplicaInteres: boolean;
  porcentajeInteres: { toString(): string } | number | null;
}

export interface PlanDeDeuda {
  capital: number;
  interesTotal: number;
  total: number;
  cuotas: CuotaCalculada[];
}

/**
 * Plan de pagos de una deuda con proveedor, calculado al vuelo (no se guarda).
 *
 * Reusa `calcularPlanDePagos`: cuotas iguales con interés mensual sobre saldo.
 * Lo propio de la deuda es la fecha: `fechaLimite` es la de la ÚLTIMA cuota y
 * las anteriores se cuentan hacia atrás de mes en mes. El día se toma siempre
 * de `fechaLimite` (no se arrastra el recorte de febrero a los meses siguientes).
 *
 * Pago único = una sola obligación en `fechaLimite`; con interés lleva un
 * período del porcentaje.
 */
export function planDeDeudaProveedor(deuda: DatosDeuda): PlanDeDeuda {
  const capital = Number(deuda.montoTotal);
  const cuotasTotales =
    deuda.modalidad === ModalidadDeudaProveedor.CUOTAS
      ? (deuda.numeroCuotas ?? 1)
      : 1;
  const porcentaje =
    deuda.aplicaInteres && deuda.porcentajeInteres !== null
      ? Number(deuda.porcentajeInteres)
      : 0;

  const cuotas = calcularPlanDePagos(
    capital,
    cuotasTotales,
    porcentaje,
    deuda.fechaLimite,
  ).map((cuota) => ({
    ...cuota,
    fechaVencimiento: sumarMeses(
      deuda.fechaLimite,
      cuota.numero - cuotasTotales,
    ),
  }));

  const total = redondear(cuotas.reduce((suma, c) => suma + c.monto, 0));
  return { capital, interesTotal: redondear(total - capital), total, cuotas };
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
