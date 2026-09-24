import { apiClient } from "@/lib/apiClient";

import {
  PeriodoTipo,
  ReporteFinanciero,
  DashboardTransactionItem,
  ReporteFiados,
} from "../types";

import { formatNumber } from "../utils/formatters";

interface BackendReporteFinanciero extends ReporteFinanciero {
  periodo: {
    tipo: PeriodoTipo;
    desde: string;
    hasta: string;
    zonaHoraria: string;
  };

  ingresos: {
    ventasContado: number;
    abonos: number;
    total: number;
  };

  egresos: {
    compras: number;
    gastos: number;
    total: number;
  };

  balance: number;

  informativo: {
    ventasFiado: number;
    ventasTotales: number;
    conteos: {
      ventas: number;
      abonos: number;
      compras: number;
      gastos: number;
    };
  };
}

interface BackendVenta {
  id: string;
  total: number;
  tipo: "CONTADO" | "FIADO";
  fecha: string;
  detalles?: Array<{
    productoId: string;
    cantidad: number;
  }>;

  cliente?: {
    id: string;
    nombre: string;
  } | null;
}

interface BackendGasto {
  id: string;
  monto: number;
  categoria: string;
  descripcion?: string;
  fecha: string;
}

interface BackendCompra {
  id: string;
  total: number;
  fecha: string;
  detalles?: Array<{
    productoId: string;
    cantidad: number;
  }>;

  proveedor?: {
    id: string;
    nombre: string;
  } | null;
}

interface BackendAbono {
  id: string;
  monto: number;
  fecha: string;

  cliente?: {
    id: string;
    nombre: string;
  } | null;
}

export interface CreateAbonoPayload {
  clienteId: string;
  ventaId?: string;
  monto: number;
}

const formatearFecha = (fecha: string) =>
  new Date(fecha).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const dashboardApi = {
  /**
   * Obtiene el reporte financiero consolidado de un negocio.
   */
  getReporteNegocio: async (
    negocioId: string,
    periodo: PeriodoTipo = "diario",
    fecha?: string,
  ): Promise<ReporteFinanciero> => {
    const params = new URLSearchParams({
      periodo,
    });

    if (fecha) {
      params.append("fecha", fecha);
    }

    return apiClient<ReporteFinanciero>(
      `/reportes/negocio/${negocioId}?${params.toString()}`,
    );
  },

  /**
   * Obtiene el reporte financiero de una sede.
   */
  getReporteSede: async (
    sedeId: string,
    periodo: PeriodoTipo = "diario",
    fecha?: string,
  ): Promise<ReporteFinanciero> => {
    const params = new URLSearchParams({
      periodo,
    });

    if (fecha) {
      params.append("fecha", fecha);
    }

    return apiClient<ReporteFinanciero>(
      `/reportes/sede/${sedeId}?${params.toString()}`,
    );
  },

  /**
   * Obtiene el reporte de cartera/fiados de una sede.
   *
   * Este endpoint devuelve:
   *
   * sede
   * totales
   * clientes[]
   *   └── ventas[]
   */
  getFiados: async (
    sedeId: string,
  ): Promise<ReporteFiados | null> => {
    try {
      return await apiClient<ReporteFiados>(
        `/reportes/fiados/${encodeURIComponent(sedeId)}`,
      );
    } catch (err: any) {
      if (err?.statusCode === 403) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Registra un abono.
   *
   * El backend decide cómo distribuirlo:
   *
   * - Si llega ventaId -> se aplica a esa venta.
   * - Si no llega ventaId -> se distribuye desde la deuda más antigua.
   */
  crearAbono: async (
    payload: CreateAbonoPayload,
  ) => {
    return apiClient(
      "/abonos",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  /**
   * Obtiene los movimientos reales del negocio.
   *
   * CONTADO:
   * Sí entra al flujo de caja.
   *
   * FIADO:
   * NO entra al flujo de caja.
   *
   * ABONO:
   * Sí entra al flujo de caja.
   *
   * COMPRA:
   * Sale de caja.
   *
   * GASTO:
   * Sale de caja.
   */
  getTransacciones: async (
    sedeIds?: string | string[],
  ): Promise<DashboardTransactionItem[]> => {
    if (
      !sedeIds ||
      (Array.isArray(sedeIds) &&
        sedeIds.length === 0)
    ) {
      return [];
    }

    const ids = Array.isArray(sedeIds)
      ? sedeIds
      : [sedeIds];

    const resultados = await Promise.all(
      ids.map(async (sedeId) => {
        const [
          ventasRes,
          gastosRes,
          comprasRes,
          abonosRes,
        ] = await Promise.allSettled([
          apiClient<BackendVenta[]>(
            `/ventas?sedeId=${encodeURIComponent(
              sedeId,
            )}`,
          ),

          apiClient<BackendGasto[]>(
            `/gastos?sedeId=${encodeURIComponent(
              sedeId,
            )}`,
          ),

          apiClient<BackendCompra[]>(
            `/compras?sedeId=${encodeURIComponent(
              sedeId,
            )}`,
          ),

          apiClient<BackendAbono[]>(
            `/abonos?sedeId=${encodeURIComponent(
              sedeId,
            )}`,
          ),
        ]);

        const items: DashboardTransactionItem[] =
          [];

        /*
         * VENTAS
         */
        if (
          ventasRes.status === "fulfilled" &&
          Array.isArray(ventasRes.value)
        ) {
          for (const venta of ventasRes.value) {
            const esFiado =
              venta.tipo === "FIADO";

            items.push({
              id: `venta-${venta.id}`,

              type: esFiado
                ? "Convertida"
                : "Venta",

              amount:
                Number(venta.total) || 0,

              amountFormatted: `${
                esFiado ? "" : "+ "
              }${formatNumber(
                Number(venta.total) || 0,
              )} COP`,

              paymentMethod:
                esFiado
                  ? "Fiado"
                  : "Contado",

              pmDetails: esFiado
                ? "Cuenta por cobrar"
                : "Ingreso recibido",

              status: "Exitoso",

              activity: esFiado
                ? "Venta a crédito registrada"
                : "Venta registrada",

              personName:
                venta.cliente?.nombre ||
                "Cliente general",

              date: formatearFecha(
                venta.fecha,
              ),

              rawDate: venta.fecha,
              productLines: venta.detalles?.map((detalle) => ({
                productId: detalle.productoId,
                quantity: detalle.cantidad,
              })),
            });
          }
        }

        /*
         * ABONOS
         */
        if (
          abonosRes.status === "fulfilled" &&
          Array.isArray(abonosRes.value)
        ) {
          for (const abono of abonosRes.value) {
            items.push({
              id: `abono-${abono.id}`,

              type: "Abono",

              amount:
                Number(abono.monto) || 0,

              amountFormatted: `+ ${formatNumber(
                Number(abono.monto) || 0,
              )} COP`,

              paymentMethod: "Abono",

              pmDetails:
                "Pago de cuenta por cobrar",

              status: "Exitoso",

              activity: "Abono recibido",

              personName:
                abono.cliente?.nombre ||
                "Cliente",

              date: formatearFecha(
                abono.fecha,
              ),

              rawDate: abono.fecha,
            });
          }
        }

        /*
         * GASTOS
         */
        if (
          gastosRes.status === "fulfilled" &&
          Array.isArray(gastosRes.value)
        ) {
          for (const gasto of gastosRes.value) {
            items.push({
              id: `gasto-${gasto.id}`,

              type: "Gasto",

              amount:
                Number(gasto.monto) || 0,

              amountFormatted: `- ${formatNumber(
                Number(gasto.monto) || 0,
              )} COP`,

              paymentMethod:
                gasto.categoria || "Gasto",

              pmDetails: "Egreso",

              status: "Exitoso",

              activity:
                gasto.descripcion ||
                "Gasto registrado",

              personName:
                "Gasto operativo",

              date: formatearFecha(
                gasto.fecha,
              ),

              rawDate: gasto.fecha,
            });
          }
        }

        /*
         * COMPRAS
         */
        if (
          comprasRes.status === "fulfilled" &&
          Array.isArray(comprasRes.value)
        ) {
          for (const compra of comprasRes.value) {
            items.push({
              id: `compra-${compra.id}`,

              type: "Compra",

              amount:
                Number(compra.total) || 0,

              amountFormatted: `- ${formatNumber(
                Number(compra.total) || 0,
              )} COP`,

              paymentMethod: "Compra",

              pmDetails:
                "Egreso por compra",

              status: "Exitoso",

              activity:
                "Compra registrada",

              personName:
                compra.proveedor?.nombre ||
                "Proveedor",

              date: formatearFecha(
                compra.fecha,
              ),

              rawDate: compra.fecha,
              purchaseLines: compra.detalles?.map((detalle) => ({
                productId: detalle.productoId,
                quantity: detalle.cantidad,
              })),
            });
          }
        }

        return items;
      }),
    );

    return resultados
      .flat()
      .sort(
        (a, b) =>
          new Date(
            b.rawDate,
          ).getTime() -
          new Date(
            a.rawDate,
          ).getTime(),
      );
  },

  /**
   * Obtiene los reportes financieros de
   * las sedes seleccionadas.
   */
  getCashflow: async (
    sedeIds: string | string[],
    periodo: PeriodoTipo = "diario",
    fecha?: string,
  ): Promise<
    BackendReporteFinanciero[]
  > => {
    const ids = Array.isArray(sedeIds)
      ? sedeIds
      : [sedeIds];

    if (ids.length === 0) {
      return [];
    }

    return Promise.all(
      ids.map((sedeId) =>
        dashboardApi
          .getReporteSede(
            sedeId,
            periodo,
            fecha,
          )
          .then(
            (reporte) =>
              reporte as BackendReporteFinanciero,
          ),
      ),
    );
  },
};