import {
  Activity,
  Building2,
  MessageSquare,
  UserPlus,
} from "lucide-react";

import type { InvestorStatsResponse } from "../api/investorApi";

const icons = {
  negocio: Building2,
  usuario: UserPlus,
  pago: Activity,
};

function formatRelativeTime(iso: string): string {
  const fecha = new Date(iso);
  const segundos = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 1000));

  if (segundos < 60) return "Hace un momento";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} d`;
}

export function InvestorActivity({
  stats,
  isLoading,
}: {
  stats: InvestorStatsResponse | null;
  isLoading: boolean;
}) {
  const eventos = stats?.actividadReciente ?? [];
  const actividad = stats?.actividadPlataforma;

  return (
    <section
      id="activity"
      className="px-6 pb-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          {/* Recent activity */}
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 sm:p-8">
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-700 transition-colors duration-300 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />

                Live activity
              </div>

              <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 transition-colors duration-300 dark:text-white">
                Actividad reciente
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 transition-colors duration-300 dark:text-slate-400">
                Los últimos eventos reales que ocurrieron dentro del
                ecosistema de Luka.
              </p>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {eventos.length === 0 && (
                <p className={`py-6 text-sm text-slate-500 dark:text-slate-400 ${isLoading ? "animate-pulse" : ""}`}>
                  {isLoading ? "Cargando actividad..." : "Todavía no hay actividad registrada."}
                </p>
              )}

              {eventos.map((evento, index) => {
                const Icon = icons[evento.tipo] ?? Activity;

                return (
                  <div
                    key={`${evento.tipo}-${index}`}
                    className="group flex gap-4 py-5 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all duration-300 group-hover:bg-cyan-50 group-hover:text-cyan-600 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:bg-cyan-950/40 dark:group-hover:text-cyan-400">
                      <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col justify-between gap-1 sm:flex-row">
                        <p className="text-sm font-semibold text-slate-900 transition-colors duration-300 dark:text-slate-100">
                          {evento.titulo}
                        </p>

                        <span className="text-xs text-slate-400 transition-colors duration-300 dark:text-slate-500">
                          {formatRelativeTime(evento.fecha)}
                        </span>
                      </div>

                      <p className="mt-1 text-sm leading-6 text-slate-500 transition-colors duration-300 dark:text-slate-400">
                        {evento.descripcion}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform activity */}
          <div className="group relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 p-8 text-white shadow-sm transition-all duration-300 hover:border-slate-700 hover:shadow-xl dark:border-slate-800 dark:bg-black">
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />

            <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 transition-all duration-300 group-hover:border-emerald-400/20 group-hover:bg-emerald-400/10">
                <Activity className="h-5 w-5 text-emerald-400" />
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-400">
                    Live system
                  </span>
                </div>

                <h3 className="mt-3 text-2xl font-bold tracking-tight">
                  Luka está activo.
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-400">
                  Cada interacción representa datos reales de negocios usando
                  Luka a través de WhatsApp, todos los días.
                </p>
              </div>

              {/* Metrics */}
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07]">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                    Interacciones de IA
                  </p>

                  <p className={`mt-2 text-3xl font-bold tracking-tight ${isLoading ? "animate-pulse opacity-60" : ""}`}>
                    {actividad ? actividad.interaccionesIa.toLocaleString("es-CO") : "—"}
                  </p>

                  <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Actividad registrada
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.07]">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                    Mensajes de WhatsApp procesados
                  </p>

                  <p className={`mt-2 text-3xl font-bold tracking-tight ${isLoading ? "animate-pulse opacity-60" : ""}`}>
                    {actividad ? actividad.mensajesWhatsapp.toLocaleString("es-CO") : "—"}
                  </p>

                  <p className="mt-2 text-xs text-emerald-400">
                    Procesamiento activo
                  </p>
                </div>
              </div>

              {/* System status */}
              <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />

                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>

                  Sistema operativo
                </div>

                <span className="text-xs text-slate-500">
                  En tiempo real
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}