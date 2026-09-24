import {
  BarChart3,
  Crown,
  Gem,
  Rocket,
  Sparkles,
} from "lucide-react";

import type { InvestorStatsResponse } from "../api/investorApi";

const icons: Record<string, typeof BarChart3> = {
  Asistente: Sparkles,
  Gerente: Rocket,
  Administrador: Gem,
  Socio: Crown,
  Corporativo: Crown,
};

export function InvestorBusinessMetrics({
  stats,
  isLoading,
}: {
  stats: InvestorStatsResponse | null;
  isLoading: boolean;
}) {
  const distribucion = stats?.monetizacion.distribucionPorPlan ?? [];
  const total = distribucion.reduce((sum, item) => sum + item.total, 0);

  return (
    <section className="px-6 pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          {/* Decorative background */}
          <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl dark:bg-amber-500/5" />

          <div className="pointer-events-none absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-500/5" />

          <div className="relative grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            {/* Intro */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-amber-700 transition-colors duration-300 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                Monetization
              </div>

              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 transition-colors duration-300 dark:text-white sm:text-3xl">
                Distribución por plan
              </h2>

              <p className="mt-4 max-w-lg text-sm leading-7 text-slate-500 transition-colors duration-300 dark:text-slate-400">
                Cómo se reparten los negocios registrados en Luka entre el
                plan gratuito y los planes de pago.
              </p>

              {/* Total */}
              <div className="mt-8">
                <p className="text-sm font-medium text-slate-500 transition-colors duration-300 dark:text-slate-400">
                  Negocios registrados
                </p>

                <div className="mt-2 flex items-end gap-3">
                  <p
                    className={`text-4xl font-bold tracking-tight text-slate-950 transition-colors duration-300 dark:text-white ${isLoading ? "animate-pulse opacity-60" : ""}`}
                  >
                    {total.toLocaleString("es-CO")}
                  </p>

                  <span className="mb-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors duration-300 dark:bg-emerald-950/40 dark:text-emerald-400">
                    Total
                  </span>
                </div>
              </div>
            </div>

            {/* Business distribution */}
            <div className="space-y-5">
              {distribucion.map((plan) => {
                const Icon = icons[plan.plan] ?? BarChart3;

                const percentage =
                  total > 0 ? Math.round((plan.total / total) * 100) : 0;

                return (
                  <div key={plan.plan} className="group">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all duration-300 group-hover:bg-amber-50 group-hover:text-amber-600 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:bg-amber-950/40 dark:group-hover:text-amber-400">
                          <Icon className="h-4 w-4" />
                        </div>

                        <span className="text-sm font-semibold text-slate-700 transition-colors duration-300 dark:text-slate-300">
                          {plan.plan}
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-950 transition-colors duration-300 dark:text-white">
                        {plan.total.toLocaleString("es-CO")}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 transition-colors duration-300 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all duration-700 ease-out group-hover:bg-emerald-500 dark:bg-slate-300 dark:group-hover:bg-emerald-400"
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>

                    <p className="mt-1 text-right text-xs text-slate-400 transition-colors duration-300 dark:text-slate-500">
                      {percentage}% del total
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}