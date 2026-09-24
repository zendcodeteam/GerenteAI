import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { InvestorStatsResponse } from "../api/investorApi";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function InvestorRevenueChart({
  stats,
  isLoading,
}: {
  stats: InvestorStatsResponse | null;
  isLoading: boolean;
}) {
  const data = stats?.crecimiento.ingresosMensuales ?? [];

  return (
    <section
      id="financials"
      className="px-6 pb-20 scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm transition-colors duration-500 dark:shadow-none sm:p-8">
          {/* Header */}
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-600 dark:text-cyan-400">
                Financials
              </p>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Evolución de ingresos
              </h2>

              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Pagos aprobados y cobrados realmente por Luka, mes a mes.
              </p>
            </div>

            <div className="rounded-full border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground">
              Últimos 6 meses
            </div>
          </div>

          {/* Chart */}
          <div className={`h-[340px] w-full ${isLoading ? "animate-pulse opacity-60" : ""}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{
                  top: 10,
                  right: 10,
                  left: 0,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="revenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#06b6d4"
                      stopOpacity={0.25}
                    />

                    <stop
                      offset="100%"
                      stopColor="#06b6d4"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  strokeOpacity={0.08}
                  vertical={false}
                />

                <XAxis
                  dataKey="mes"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "currentColor",
                    fontSize: 12,
                    opacity: 0.55,
                  }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "currentColor",
                    fontSize: 12,
                    opacity: 0.55,
                  }}
                  tickFormatter={(value) =>
                    formatCurrency(Number(value))
                  }
                />

                <Tooltip
                  cursor={{
                    stroke: "#06b6d4",
                    strokeOpacity: 0.25,
                  }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    backgroundColor: "var(--card)",
                    color: "var(--foreground)",
                    boxShadow:
                      "0 10px 30px rgba(15, 23, 42, 0.12)",
                  }}
                  labelStyle={{
                    color: "var(--foreground)",
                    fontWeight: 600,
                    marginBottom: "4px",
                  }}
                  itemStyle={{
                    color: "#06b6d4",
                  }}
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    "Ingresos",
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                  activeDot={{
                    r: 6,
                    strokeWidth: 3,
                    stroke: "#06b6d4",
                    fill: "var(--card)",
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}