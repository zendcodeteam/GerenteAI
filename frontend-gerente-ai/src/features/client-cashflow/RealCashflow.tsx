import { useMemo, useState, memo } from "react";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Search,
  Filter,
  FileSpreadsheet,
  Lock,
} from "lucide-react";

import {
  fmt,
  ChartTooltip,
} from "@/shared/components/ui/ChartTooltip";

import { DateDropdown } from "@/shared/components/ui/DateDropdown";

import type {
  DashboardTransactionItem,
  PeriodoTipo,
  ReporteFinanciero,
} from "@/features/client-dashboard/types";

import { ExportarContabilidadModal } from "./components/ExportarContabilidadModal";

import { usePlanNegocio } from "./hooks/usePlanNegocio";

const PERIODOS = [
  {
    value: "diario",
    label: "Hoy",
  },
  {
    value: "semanal",
    label: "Últimos 7 días",
  },
  {
    value: "mensual",
    label: "Este mes",
  },
  {
    value: "semestral",
    label: "Últimos 6 meses",
  },
  {
    value: "anual",
    label: "Este año",
  },
];

const ETIQUETA_DIA =
  new Intl.DateTimeFormat(
    "es-CO",
    {
      day: "2-digit",
      month: "short",
    },
  );

export interface RealCashflowProps {
  metrics: ReporteFinanciero | null;
  transactions: DashboardTransactionItem[];
  periodo: PeriodoTipo;
  setPeriodo: (periodo: PeriodoTipo) => void;
  isLoading: boolean;
  isChartLoading: boolean;
  planNombre?: string;
  esPagoPlan?: boolean;
}

function RealCashflowComponent({
  metrics,
  transactions,
  periodo,
  setPeriodo,
  isLoading,
  isChartLoading,
  planNombre,
  esPagoPlan,
}: RealCashflowProps) {
  const [busqueda, setBusqueda] =
    useState("");

  const [exportando, setExportando] =
    useState(false);

  const negocioId =
    localStorage.getItem(
      "active_business_id",
    ) || "";

  const negocioNombre =
    localStorage.getItem(
      "active_business_name",
    ) || "Mi negocio";

  // Reutilizamos el permiso ya calculado en CashflowView evitando llamada redundante a /negocios/:id
  const planFallback = usePlanNegocio(esPagoPlan !== undefined ? "" : negocioId);
  const plan = {
    cargando: esPagoPlan !== undefined ? false : planFallback.cargando,
    esPago: esPagoPlan !== undefined ? esPagoPlan : planFallback.esPago,
    nombre: planNombre || planFallback.nombre,
  };

  /*
   * Métricas financieras reales.
   */
  const totalIngresos =
    metrics?.ingresos?.total ?? 0;

  const totalGastos =
    metrics?.egresos?.total ?? 0;

  const saldo =
    metrics?.balance ?? 0;

  /*
   * Transformar transacciones.
   *
   * REGLA:
   *
   * Venta contado = ingreso
   * Abono = ingreso
   * Venta fiado = NO movimiento de caja
   * Compra = gasto
   * Gasto = gasto
   */
  const movimientos =
    useMemo(() => {
      return transactions
        .filter((tx) => {
          /*
           * Una venta FIADA no representa entrada
           * de dinero, por lo tanto no debe aparecer
           * como movimiento de caja.
           */
          return tx.type !== "Convertida";
        })
        .map((tx) => {
          const esIngreso =
            tx.type === "Venta" ||
            tx.type === "Abono";

          return {
            id: tx.id,

            fecha:
              ETIQUETA_DIA.format(
                new Date(
                  tx.rawDate,
                ),
              ),

            rawDate: tx.rawDate,

            concepto:
              tx.personName
                ? `${tx.activity} — ${tx.personName}`
                : tx.activity,

            categoria:
              tx.paymentMethod,

            monto:
              Number(tx.amount) || 0,

            tipo: esIngreso
              ? ("ingreso" as const)
              : ("gasto" as const),
          };
        });
    }, [transactions]);

  /*
   * Filtrado por búsqueda.
   */
  const visibles =
    useMemo(() => {
      const q =
        busqueda
          .trim()
          .toLowerCase();

      if (!q) {
        return movimientos;
      }

      return movimientos.filter(
        (movimiento) =>
          movimiento.concepto
            .toLowerCase()
            .includes(q) ||
          movimiento.categoria
            .toLowerCase()
            .includes(q),
      );
    }, [
      movimientos,
      busqueda,
    ]);

  /*
   * Serie del gráfico.
   *
   * Usa exactamente los mismos movimientos
   * que se muestran como movimientos de caja.
   */
  const serie =
    useMemo(() => {
      const porDia =
        new Map<
          string,
          {
            etiqueta: string;
            ventas: number;
            gastos: number;
            orden: number;
          }
        >();

      for (const movimiento of movimientos) {
        const fecha =
          new Date(
            movimiento.rawDate,
          );

        const dia =
          movimiento.rawDate.slice(
            0,
            10,
          );

        const acumulado =
          porDia.get(dia) ?? {
            etiqueta:
              movimiento.fecha,

            ventas: 0,

            gastos: 0,

            orden:
              fecha.getTime(),
          };

        if (
          movimiento.tipo ===
          "ingreso"
        ) {
          acumulado.ventas +=
            movimiento.monto;
        } else {
          acumulado.gastos +=
            movimiento.monto;
        }

        porDia.set(
          dia,
          acumulado,
        );
      }

      return [...porDia.values()]
        .sort(
          (a, b) =>
            a.orden - b.orden,
        );
    }, [movimientos]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* =========================
          CHART
      ========================== */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-6 max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground">
            Evolución de Caja
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                setExportando(true)
              }
              disabled={
                !negocioId ||
                plan.cargando
              }
              title={
                !negocioId
                  ? "Primero crea tu negocio"
                  : plan.esPago
                    ? "Descargar la contabilidad en Excel"
                    : "Disponible en los planes Gerente y Administrador"
              }
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                plan.esPago
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
                  : "text-muted-foreground bg-muted/60 border border-border hover:bg-muted hover:text-foreground"
              }`}
            >
              {plan.esPago ? (
                <FileSpreadsheet className="w-4 h-4" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              Exportar Excel
              {!plan.cargando &&
                !plan.esPago && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide bg-gradient-to-r from-emerald-600 to-emerald-500 text-white">
                    Pro
                  </span>
                )}
            </button>

            <DateDropdown
            value={periodo}
            options={PERIODOS}
              onChange={(value) =>
                setPeriodo(
                  value as PeriodoTipo,
                )
              }
            />
          </div>
        </div>

        <div className="h-64 w-full">
          {isLoading ||
          isChartLoading ? (
            <div className="h-full w-full rounded-xl bg-muted/40 animate-pulse" />
          ) : serie.length ===
            0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-sm font-bold text-foreground">
                Sin movimientos en este periodo
              </p>

              <p className="text-xs mt-1 text-muted-foreground">
                Registra ventas o gastos y aquí verás la evolución
              </p>
            </div>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={serie}
                margin={{
                  top: 10,
                  right: 0,
                  left: -20,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="colorVentas"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#059669"
                      stopOpacity={0.3}
                    />

                    <stop
                      offset="95%"
                      stopColor="#059669"
                      stopOpacity={0}
                    />
                  </linearGradient>

                  <linearGradient
                    id="colorGastos"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#e11d48"
                      stopOpacity={0.3}
                    />

                    <stop
                      offset="95%"
                      stopColor="#e11d48"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="etiqueta"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />

                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(
                    value,
                  ) =>
                    `$${value / 1000}k`
                  }
                />

                <Tooltip
                  content={
                    <ChartTooltip />
                  }
                  cursor={{
                    fill: "transparent",
                    stroke:
                      "currentColor",
                    strokeDasharray:
                      "4 4",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#059669"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVentas)"
                />

                <Area
                  type="monotone"
                  dataKey="gastos"
                  stroke="#e11d48"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorGastos)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* =========================
          SUMMARY
      ========================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl">
        {/* Ingresos */}
        <div className="bg-card border border-border rounded-2xl shadow-sm px-6 py-5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Ingresos
          </p>

          <p className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-500">
            {fmt(totalIngresos)}
          </p>
        </div>

        {/* Egresos */}
        <div className="bg-card border border-border rounded-2xl shadow-sm px-6 py-5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Egresos
          </p>

          <p className="text-3xl font-black tracking-tight text-rose-600 dark:text-rose-500">
            {fmt(totalGastos)}
          </p>
        </div>

        {/* Saldo */}
        <div className="bg-card border border-border rounded-2xl shadow-sm px-6 py-5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Saldo Neto
          </p>

          <p className="text-3xl font-black tracking-tight text-foreground">
            {fmt(saldo)}
          </p>
        </div>
      </div>

      {/* =========================
          TABLE
      ========================== */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden max-w-5xl">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 justify-between bg-muted/20">
          <div className="relative group min-w-0 w-full sm:w-auto sm:flex-1 sm:max-w-72">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />

            <input
              type="text"
              value={busqueda}
              onChange={(event) =>
                setBusqueda(
                  event.target.value,
                )
              }
              placeholder="Buscar transacción..."
              className="pl-9 pr-4 py-2 w-full bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            />
          </div>

          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted-foreground bg-card border border-border rounded-xl shadow-sm hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <Filter className="w-4 h-4" />

            Filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-4 w-24">
                  Fecha
                </th>

                <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-4">
                  Concepto
                </th>

                <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-4 w-36">
                  Categoría
                </th>

                <th className="text-right text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-6 py-4 w-32">
                  Monto
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {/* Loading */}
              {isLoading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    Cargando movimientos…
                  </td>
                </tr>
              )}

              {/* Empty */}
              {!isLoading &&
                visibles.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      {busqueda
                        ? "Ningún movimiento coincide con la búsqueda"
                        : "Todavía no hay movimientos en este periodo"}
                    </td>
                  </tr>
                )}

              {/* Transactions */}
              {!isLoading &&
                visibles.map(
                  (row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-muted-foreground font-medium whitespace-nowrap">
                        {row.fecha}
                      </td>

                      <td className="px-6 py-4 text-sm text-foreground font-bold">
                        {row.concepto}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                            row.tipo ===
                            "ingreso"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}
                        >
                          {
                            row.categoria
                          }
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right tabular-nums">
                        <span
                          className={`text-sm font-black ${
                            row.tipo ===
                            "ingreso"
                              ? "text-emerald-600 dark:text-emerald-500"
                              : "text-rose-600 dark:text-rose-500"
                          }`}
                        >
                          {row.tipo ===
                          "ingreso"
                            ? "+"
                            : "−"}

                          {fmt(
                            row.monto,
                          )}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
            </tbody>
          </table>
        </div>
      </div>
      {exportando && (
        <ExportarContabilidadModal
          negocioId={negocioId}
          negocioNombre={negocioNombre}
          esPago={plan.esPago}
          planNombre={plan.nombre}
          onClose={() =>
            setExportando(false)
          }
        />
      )}
    </div>
  );
}

export const RealCashflow = memo(RealCashflowComponent);