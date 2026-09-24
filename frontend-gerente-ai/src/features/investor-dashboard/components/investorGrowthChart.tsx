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

export function InvestorGrowthChart({
  stats,
  isLoading,
}: {
  stats: InvestorStatsResponse | null;
  isLoading: boolean;
}) {
  const data = stats?.crecimiento.usuarios ?? [];

  return (
    <section
      id="growth"
      className="px-6 pb-20 scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm transition-colors duration-500 sm:p-8 dark:shadow-none">
          {/* Header */}
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">
                Growth
              </p>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Crecimiento de usuarios
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Evolución acumulada de usuarios registrados en Luka.
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
                    id="usersGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#10b981"
                      stopOpacity={0.3}
                    />

                    <stop
                      offset="100%"
                      stopColor="#10b981"
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
                />

                <Tooltip
                  cursor={{
                    stroke: "#10b981",
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
                    color: "#10b981",
                  }}
                  formatter={(value) => [
                    `${Number(value).toLocaleString("es-CO")} usuarios`,
                    "Usuarios",
                  ]}
                />

                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#usersGradient)"
                  activeDot={{
                    r: 6,
                    strokeWidth: 3,
                    stroke: "#10b981",
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