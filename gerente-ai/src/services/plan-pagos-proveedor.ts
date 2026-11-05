export interface CuotaCalculada {
  numero: number;
  fechaVencimiento: Date;
  capital: number;
  interes: number;
  monto: number;
}

/** Genera cuotas mensuales iguales con interés mensual sobre el saldo insoluto. */
export function calcularPlanDePagos(
  capitalOriginal: number,
  numeroCuotas: number,
  interesMensualPorcentaje: number,
  fechaPrimeraCuota: Date,
): CuotaCalculada[] {
  const tasa = interesMensualPorcentaje / 100;
  const capitalCuota =
    tasa === 0
      ? redondear(capitalOriginal / numeroCuotas)
      : redondear(
          (capitalOriginal * tasa) /
            (1 - Math.pow(1 + tasa, -numeroCuotas)),
        );

  let saldo = capitalOriginal;
  return Array.from({ length: numeroCuotas }, (_, indice) => {
    const interes = redondear(saldo * tasa);
    const monto =
      indice === numeroCuotas - 1
        ? redondear(saldo + interes)
        : capitalCuota;
    const capital = redondear(monto - interes);
    saldo = Math.max(0, redondear(saldo - capital));

    return {
      numero: indice + 1,
      fechaVencimiento: sumarMeses(fechaPrimeraCuota, indice),
      capital,
      interes,
      monto,
    };
  });
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function sumarMeses(fecha: Date, meses: number): Date {
  const mesBase = fecha.getUTCMonth() + meses;
  const anio = fecha.getUTCFullYear() + Math.floor(mesBase / 12);
  const mes = ((mesBase % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(fecha.getUTCDate(), ultimoDia);

  return new Date(
    Date.UTC(
      anio,
      mes,
      dia,
      fecha.getUTCHours(),
      fecha.getUTCMinutes(),
      fecha.getUTCSeconds(),
      fecha.getUTCMilliseconds(),
    ),
  );
}