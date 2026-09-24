import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { InvestorStatsResponse } from "../api/investorApi";

export function InvestorUsersChart({
  stats,
  isLoading,
}: {
  stats: InvestorStatsResponse | null;
  isLoading: boolean;
}) {
  const data = stats?.crecimiento.negocios ?? [];

  return (
    <section className="px-6 pb-20 scroll-mt-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Business Growth Chart */}
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm transition-colors duration-500 dark:shadow-none sm:p-8">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-400">
                Platform
              </p>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                Negocios registrados
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Evolución acumulada del número de negocios registrados en Luka.
              </p>
            </div>

            <div className={`h-[300px] w-full ${isLoading ? "animate-pulse opacity-60" : ""}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 0,
                  }}
                >
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
                      fill: "currentColor",
                      opacity: 0.04,
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
                      `${Number(value).toLocaleString("es-CO")} negocios`,
                      "Negocios",
                    ]}
                  />

                  <Bar
                    dataKey="total"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                    activeBar={{
                      fill: "#34d399",
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Momentum Card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 p-6 text-white shadow-sm transition-colors duration-500 dark:border-white/10 sm:p-8">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

            <div className="relative">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-400">
                Momentum
              </p>

              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                Luka está creciendo.
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-400">
                Cada nuevo negocio representa una oportunidad de aumentar la
                adopción de Luka, generar actividad dentro de la plataforma y
                convertir usuarios en clientes recurrentes.
              </p>

              <div className="mt-10">
                <p className="text-sm text-slate-400">
                  Negocios registrados
                </p>

                <p className="mt-2 text-5xl font-bold tracking-tight">
                  {stats ? stats.negocios.total.toLocaleString("es-CO") : "—"}
                </p>

                <div className="mt-4 inline-flex items-center rounded-full bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-400">
                  {stats ? stats.negocios.activosUltimos30Dias.toLocaleString("es-CO") : "—"}{" "}
                  activos en los últimos 30 días
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}