export type PeriodoTipo =
  | "diario"
  | "semanal"
  | "mensual"
  | "semestral"
  | "anual";

export interface ReportePeriodoInfo {
  tipo: PeriodoTipo;
  desde: string;
  hasta: string;
  zonaHoraria: string;
}

export interface CifrasIngresos {
  ventasContado: number;
  abonos: number;
  total: number;
}

export interface CifrasEgresos {
  compras: number;
  gastos: number;
  total: number;
}

export interface ConteosTransacciones {
  ventas: number;
  abonos: number;
  compras: number;
  gastos: number;
}

export interface CifrasInformativo {
  ventasFiado: number;
  ventasTotales: number;
  conteos: ConteosTransacciones;
}

export interface SedeReporteItem {
  sede: {
    id: string;
    nombre: string;
  };

  ingresos: CifrasIngresos;

  egresos: CifrasEgresos;

  balance: number;

  informativo: CifrasInformativo;
}

export interface ReporteFinanciero {
  periodo: ReportePeriodoInfo;

  negocio?: {
    id: string;
    nombre: string;
  };

  sede?: {
    id: string;
    nombre: string;
  };

  ingresos: CifrasIngresos;

  egresos: CifrasEgresos;

  balance: number;

  informativo: CifrasInformativo;

  sedes?: SedeReporteItem[];
}

/*
 * ============================================================
 * FIADOS
 * ============================================================
 */

export interface AbonoFiado {
  id: string;
  monto: number;
  fecha: string;
}

export interface VentaFiada {
  id: string;

  fecha: string;

  total: number;

  saldoPendiente: number;

  abonado: number;

  fechaVencimiento: string | null;

  vencida: boolean;

  diasDesdeLaVenta: number;

  diasDeAtraso: number;

  abonos: AbonoFiado[];
}

export interface ClienteFiado {
  id: string;

  nombre: string;

  telefono: string | null;

  saldoPendiente: number;

  vencido: number;

  diasDeLaDeudaMasAntigua: number;

  ventas: VentaFiada[];
}

export interface ReporteFiados {
  sede: {
    id: string;
    nombre: string;
  };

  generadoEl: string;

  totales: {
    porCobrar: number;
    vencido: number;
    clientesConDeuda: number;
    ventasPendientes: number;
  };

  clientes: ClienteFiado[];
}

/*
 * ============================================================
 * DASHBOARD TRANSACTIONS
 * ============================================================
 */

export interface DashboardTransactionItem {
  id: string;

  type:
    | "Venta"
    | "Gasto"
    | "Convertida"
    | "Abono"
    | "Compra";

  amount: number;

  amountFormatted: string;

  paymentMethod: string;

  pmDetails?: string;

  status: string;

  activity: string;

  personName: string;

  date: string;

  rawDate: string;

  productLines?: Array<{
    productId: string;
    quantity: number;
  }>;
  purchaseLines?: Array<{
    productId: string;
    quantity: number;
  }>;
}