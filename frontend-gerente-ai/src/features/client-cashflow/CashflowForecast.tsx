import { useMemo } from "react";
import { ArrowUpRight, CalendarClock, TrendingDown, TrendingUp } from "lucide-react";
import { DashboardTransactionItem, ReporteFinanciero } from "@/features/client-dashboard/types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export function CashflowForecast({
  metrics,
  transactions,
}: {
  metrics: ReporteFinanciero | null;
  transactions: DashboardTransactionItem[];
}) {
  const forecast = useMemo(() => {
    const now = Date.now();
    const last30Days = transactions.filter((transaction) => {
      const timestamp = new Date(transaction.rawDate).getTime();
      return Number.isFinite(timestamp) && timestamp >= now - 30 * DAY_IN_MS;
    });

    const recentNet = last30Days.reduce((total, transaction) => {
      const isIncome = transaction.type === "Venta" || transaction.type === "Abono";
      const isCashMovement = transaction.type !== "Convertida";

      if (!isCashMovement) return total;
      return total + (isIncome ? transaction.amount : -transaction.amount);
    }, 0);

    const averageDailyNet = recentNet / 30;
    const baseBalance = metrics?.balance ?? 0;

    return {
      averageDailyNet,
      projections: [7, 15, 30].map((days) => ({
        days,
        value: baseBalance + averageDailyNet * days,
      })),
    };
  }, [metrics?.balance, transactions]);

  const isPositive = forecast.averageDailyNet >= 0;

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground sm:text-lg">Proyección de flujo</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Estimación basada en el promedio neto diario de tus últimos 30 días.
            </p>
          </div>
        </div>

        <div className={`flex items-center gap-2 text-xs font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {isPositive ? "Tendencia positiva" : "Tendencia por revisar"}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
        {forecast.projections.map(({ days, value }) => (
          <div key={days} className="bg-card px-5 py-5 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              En {days} días
            </p>
            <p className={`mt-2 text-xl font-black tracking-tight ${value >= 0 ? "text-foreground" : "text-destructive"}`}>
              {formatCurrency(value)}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              Resultado acumulado estimado
              <ArrowUpRight className="h-3.5 w-3.5" />
            </p>
          </div>
        ))}
      </div>

      <p className="px-5 py-4 text-xs leading-relaxed text-muted-foreground sm:px-6">
        Es una referencia, no un saldo garantizado. Luka todavía no descuenta obligaciones futuras que no estén registradas como movimientos.
      </p>
    </section>
  );
}