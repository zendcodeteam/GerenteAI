import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Bot,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import {
  insightsApi,
  tiempoRelativo,
  type Insight,
} from "./api/insightsApi";

import { usePlanPermissions } from "@/shared/hooks/usePlanPermissions";

import { FeaturePaywallState } from "@/shared/components/paywalls/FeaturePaywallState";
import { QuotaExceededCard } from "./components/QuotaExceededCard";

import { PlanLimitPaywallModal } from "@/shared/components/modals/PlanLimitPaywallModal";

import { NoBusinessRedirectState } from "@/shared/components/states/NoBusinessRedirectState";

export function InsightsView() {
  // ============================================================
  // PERMISOS DEL PLAN
  // ============================================================

  const {
    planUsuarioId,
    planNombre,
    cantidadNegocios,

    isPaywallOpen,
    paywallMotivo,
    paywallPlanRecomendadoId,

    abrirPaywall,
    cerrarPaywall,

    isLoading: isPlanLoading,
  } = usePlanPermissions();

  // ============================================================
  // ESTADO DE INSIGHTS
  // ============================================================

  const [items, setItems] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  // ============================================================
  // PLANES
  // ============================================================

  const tieneAccesoInsights = planUsuarioId >= 2;

  const estaEnPlanGratuito = planUsuarioId === 1;

  // ============================================================
  // GENERAR RECOMENDACIONES
  // ============================================================

  const cargar = useCallback(async (forceRefresh = false) => {
    /*
     * Plan Asistente:
     * no hacemos llamadas costosas al backend.
     */

    if (planUsuarioId === 1) {
      setItems([]);
      setIsQuotaExceeded(false);
      setError(null);
      setIsLoading(false);

      return;
    }

    /*
     * Cualquier plan 2+ tiene acceso.
     */

    setIsLoading(true);
    setError(null);
    setIsQuotaExceeded(false);

    try {
      const insights = await insightsApi.generate(5, forceRefresh);

      setItems(insights);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      const lowerMsg = msg.toLowerCase();

      /*
       * La API puede devolver 402/429
       * cuando se agotó la cuota.
       */

      if (
        msg.includes("402") ||
        msg.includes("429") ||
        lowerMsg.includes("cuota") ||
        lowerMsg.includes("quota")
      ) {
        setIsQuotaExceeded(true);
      } else {
        setError(
          msg ||
            "No pudimos generar tus recomendaciones en este momento.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [planUsuarioId]);

  // ============================================================
  // CARGA INICIAL
  // ============================================================

  useEffect(() => {
    if (isPlanLoading) {
      return;
    }

    void cargar();
  }, [cargar, isPlanLoading]);

  // ============================================================
  // APLICAR INSIGHT
  // ============================================================

  const apply = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              read: true,
            }
          : item,
      ),
    );
  };

  // ============================================================
  // DESCARTAR INSIGHT
  // ============================================================

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // ============================================================
  // CONFIGURACIÓN DE ICONOS
  // ============================================================

  const iconCfg = {
    warning: {
      Icon: AlertTriangle,
      bg: "bg-[#F59E0B]/10",
      iconColor: "text-foreground",
      border: "border-[#F59E0B]/20",
    },

    success: {
      Icon: CheckCircle,
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-500",
      border: "border-emerald-200 dark:border-emerald-800",
    },

    info: {
      Icon: Info,
      bg: "bg-cyan-100 dark:bg-cyan-900/30",
      iconColor: "text-cyan-600 dark:text-cyan-500",
      border: "border-cyan-200 dark:border-cyan-800",
    },
  };

  // ============================================================
  // CONTADORES
  // ============================================================

  const unread = items.filter((item) => !item.read).length;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="flex-1 min-w-0 overflow-auto pb-8 pr-0 sm:pr-4">
      {/* ======================================================
          CABECERA
      ======================================================= */}

      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Recomendaciones de IA
            </h1>

            {tieneAccesoInsights && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold shadow-xs">
                <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />

                Plan {planNombre}
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            {estaEnPlanGratuito
              ? "Recomendaciones prescriptivas generadas por IA a partir de tus ventas y gastos."
              : isLoading
                ? "Analizando tu negocio…"
                : `${unread} alertas sin leer · ${items.length} total`}
          </p>
        </div>

        {/* ====================================================
            BOTÓN ACTUALIZAR
        ===================================================== */}

        {tieneAccesoInsights && (
          <button
            type="button"
            onClick={() => void cargar(true)}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-all disabled:opacity-40 cursor-pointer shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                isLoading ? "animate-spin" : ""
              }`}
              strokeWidth={2}
            />

            Actualizar
          </button>
        )}
      </div>

      {/* ======================================================
          ESTADOS PRINCIPALES
      ======================================================= */}

      {!isPlanLoading && cantidadNegocios === 0 ? (
        <NoBusinessRedirectState
          title="Configura tu negocio para ver Recomendaciones de IA"
          description="Aún no tienes un comercio registrado. Registra tu negocio en la página de resumen para empezar a recibir análisis prescriptivos y alertas inteligentes."
        />
      ) : !isPlanLoading && estaEnPlanGratuito ? (
        /*
         * ======================================================
         * PLAN GRATUITO
         *
         * En móvil el contenedor padre ya no tiene padding-right.
         * Esto permite que el centro real coincida con el centro
         * visual del viewport.
         * ======================================================
         */

        <div className="w-full min-w-0 flex justify-center">
          <FeaturePaywallState
            onUpgrade={() =>
              abrirPaywall(
                "Las Recomendaciones de IA están disponibles a partir del Plan Gerente ($39.900/mes). Mejora tu plan para acceder a análisis predictivo y alertas en tiempo real.",
                2,
              )
            }
            badge="Disponible a partir del Plan Gerente ($39.900/mes)"
            title={
              <>
                Toma decisiones estratégicas con{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400">
                  Recomendaciones de IA
                </span>
              </>
            }
            description="Luka analiza continuamente tus ventas, gastos y movimientos para entregarte alertas inteligentes y oportunidades de ahorro en tiempo real."
            previewCards={[
              {
                label: "Alerta de Margen",
                title: "Producto líder con bajo margen",
                description:
                  "Tus ventas aumentaron 24%, pero el costo de adquisición redujo el margen neto al 8%.",
                icon: "warning",
                color: "amber",
              },
              {
                label: "Oportunidad de Flujo",
                title: "Proyección de liquidez positiva",
                description:
                  "El flujo estimado para los próximos 15 días permite liquidar compras con descuento.",
                icon: "success",
                color: "emerald",
              },
              {
                label: "Acción Sugerida",
                title: "Optimización de inventario",
                description:
                  "3 productos presentan rotación lenta. Activa una promoción para liberar capital.",
                icon: "info",
                color: "cyan",
              },
            ]}
            features={[
              {
                title: "Alertas Prescriptivas",
                description: "Sugerencias concretas con 1 clic.",
              },
              {
                title: "Márgenes y Costos",
                description: "Detección automática de fugas.",
              },
              {
                title: "Cuota 500+ Mensajes",
                description: "Auditorías financieras continuas.",
              },
              {
                title: "Múltiples Sedes",
                description: "Análisis individual o total.",
              },
            ]}
          />
        </div>
      ) : (
        <div className="w-full min-w-0 flex flex-col gap-3">
          {/* ==================================================
              LOADING
          =================================================== */}

          {isLoading &&
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl shadow-sm p-6 animate-pulse"
              >
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-muted shrink-0" />

                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-muted rounded w-2/3" />

                    <div className="h-3 bg-muted rounded w-full" />

                    <div className="h-3 bg-muted rounded w-4/5" />
                  </div>
                </div>
              </div>
            ))}

          {/* ==================================================
              CUOTA AGOTADA
          =================================================== */}

          {!isLoading && isQuotaExceeded && (
            <QuotaExceededCard
              onUpgrade={() =>
                abrirPaywall(
                  "Has alcanzado el límite mensual de mensajes de IA. Mejora al Plan Administrador para obtener 10.000 mensajes mensuales.",
                  3,
                )
              }
            />
          )}

          {/* ==================================================
              ERROR
          =================================================== */}

          {!isLoading && !isQuotaExceeded && error && (
            <div className="bg-card border border-border rounded-2xl shadow-sm p-6 text-center">
              <AlertTriangle
                className="w-10 h-10 mx-auto mb-3 text-amber-500"
                strokeWidth={1.5}
              />

              <p className="text-sm font-bold text-foreground">
                No pudimos generar tus recomendaciones
              </p>

              <p className="text-xs mt-1 text-muted-foreground">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void cargar()}
                className="mt-4 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-foreground border border-border hover:bg-muted transition-all cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* ==================================================
              LISTA DE INSIGHTS
          =================================================== */}

          {!isLoading &&
            !isQuotaExceeded &&
            !error &&
            items.map((item, index) => {
              const { Icon, bg, iconColor, border } =
                iconCfg[item.type] ?? iconCfg.info;

              return (
                <div
                  key={item.id}
                  className={`bg-card border border-border rounded-2xl shadow-sm p-5 sm:p-6 transition-all duration-300 animate-cascade ${
                    item.read
                      ? "opacity-65"
                      : "hover:bg-muted/30"
                  }`}
                  style={{
                    animationDelay: `${index * 75}ms`,
                  }}
                >
                  <div className="flex gap-4">
                    <div
                      className={`w-9 h-9 rounded-xl ${bg} border ${border} flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      <Icon
                        className={`w-4 h-4 ${iconColor}`}
                        strokeWidth={1.5}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2">
                        <p className="text-base font-bold text-foreground tracking-tight flex-1">
                          {item.title}
                        </p>

                        <div className="flex items-center gap-1.5 shrink-0 mt-1">
                          {!item.read && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                          )}

                          <span className="text-[11px] text-muted-foreground font-medium">
                            {tiempoRelativo(item.generatedAt)}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                        {item.body}
                      </p>

                      {item.action && (
                        <p className="text-sm text-foreground font-semibold leading-relaxed mb-5">
                          👉 {item.action}
                        </p>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => apply(item.id)}
                          disabled={item.read}
                          className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all disabled:opacity-40 cursor-pointer"
                        >
                          <CheckCircle
                            className="w-4 h-4"
                            strokeWidth={2}
                          />

                          Aplicar
                        </button>

                        <button
                          type="button"
                          onClick={() => dismiss(item.id)}
                          className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-muted-foreground border border-border hover:bg-muted hover:text-foreground transition-all cursor-pointer"
                        >
                          <X
                            className="w-4 h-4"
                            strokeWidth={2}
                          />

                          Descartar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

          {/* ==================================================
              SIN INSIGHTS
          =================================================== */}

          {!isLoading &&
            !isQuotaExceeded &&
            !error &&
            items.length === 0 && (
              <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-2xl p-8">
                <Bot
                  className="w-12 h-12 mx-auto mb-4 text-muted"
                  strokeWidth={1}
                />

                <p className="text-base font-bold text-foreground">
                  Sin insights pendientes
                </p>

                <p className="text-xs mt-1 text-muted-foreground max-w-sm mx-auto">
                  Registra algunos movimientos en tu negocio y Luka
                  generará recomendaciones para optimizar tus
                  finanzas.
                </p>
              </div>
            )}
        </div>
      )}

      {/* ======================================================
          MODAL GLOBAL DE PAYWALL
      ======================================================= */}

      <PlanLimitPaywallModal
        isOpen={isPaywallOpen}
        onClose={cerrarPaywall}
        motivo={paywallMotivo}
        planRecomendadoId={paywallPlanRecomendadoId}
      />
    </div>
  );
}