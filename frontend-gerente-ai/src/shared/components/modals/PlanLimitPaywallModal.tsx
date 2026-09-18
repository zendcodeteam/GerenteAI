import { useState } from "react";
import {
  X,
  Sparkles,
  Lock,
  Check,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  Crown,
  BarChart3,
} from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import {
  PlanBackend,
  PLANES_FALLBACK,
  MENSAJES_IA_POR_PLAN,
} from "@/shared/api/planesApi";
import { WompiCheckoutModal } from "@/features/client-subscription/components/WompiCheckoutModal";
import { lukaWhatsappUrl } from "@/lib/whatsapp";

interface PlanLimitPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  motivo?: string;
  planRecomendadoId?: number;
  catalogo?: PlanBackend[];
  negocioId?: string;
  negocioNombre?: string;
  onUpgradeSuccess?: () => void;
}

const PRECIO_FORMATTER = new Intl.NumberFormat("es-CO");

// ============================================================
// PLAN RECOMENDADO FIJO
// ============================================================

const PLAN_ADMINISTRADOR_ID = 3;

export function PlanLimitPaywallModal({
  isOpen,
  onClose,
  motivo,
  catalogo = PLANES_FALLBACK,
  negocioId = "",
  negocioNombre = "Tu Negocio",
  onUpgradeSuccess,
}: PlanLimitPaywallModalProps) {
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  if (!isOpen) return null;

  // ============================================================
  // PLANES
  // ============================================================

  const planesDisponibles =
    Array.isArray(catalogo) && catalogo.length > 0
      ? catalogo
      : PLANES_FALLBACK;

  /*
   * El modal siempre recomienda Plan Administrador.
   * No depende del plan recomendado que venga desde otro componente.
   */
  const planAdministrador =
    planesDisponibles.find(
      (plan) => plan.id === PLAN_ADMINISTRADOR_ID,
    ) ||
    PLANES_FALLBACK.find(
      (plan) => plan.id === PLAN_ADMINISTRADOR_ID,
    ) ||
    PLANES_FALLBACK[2];

  /*
   * Para el estado actual de Luka, el usuario que llega a este
   * bloqueo está en Plan Gerente.
   *
   * Más adelante este valor puede recibirse directamente desde
   * el hook de permisos, pero no alteramos la lógica comercial
   * del bloqueo en este componente.
   */
  const planActual =
    planesDisponibles.find((plan) => plan.id === 2) ||
    PLANES_FALLBACK.find((plan) => plan.id === 2) ||
    PLANES_FALLBACK[1];

  // ============================================================
  // PRECIO
  // ============================================================

  const precioAdministrador = PRECIO_FORMATTER.format(
    planAdministrador.precioMensual,
  );

  // ============================================================
  // CHECKOUT / ASESOR
  // ============================================================

  const handleOpenWhatsappSales = () => {
    const msg = `Hola Luka 👋, me gustaría ampliar mi cuenta al Plan Administrador para gestionar más sedes y negocios (${negocioNombre}).`;

    window.open(
      lukaWhatsappUrl(msg),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleOpenWompi = () => {
    setIsCheckoutOpen(true);
  };

  // ============================================================
  // FEATURES
  // ============================================================

  const featuresPlanActual = [
    "1 sede por negocio",
    "Múltiples negocios simultáneos",
    MENSAJES_IA_POR_PLAN[planActual.id] ||
      "Mensajes con IA incluidos",
    "Registro ágil de ventas y gastos por WhatsApp 24/7",
    "Reportes avanzados y control financiero",
  ];

  const featuresAdministrador = [
    "Hasta 3 sedes por negocio",
    "Múltiples negocios simultáneos",
    MENSAJES_IA_POR_PLAN[planAdministrador.id] ||
      "2.000 mensajes de IA / mes",
    "Exportar reportes en Excel",
    "Gestión avanzada de usuarios",
    "Soporte prioritario",
  ];

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-hidden">
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.96,
            y: 12,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.96,
            y: 12,
          }}
          className="
            relative
            w-full
            max-w-6xl
            max-h-[calc(100vh-2rem)]
            bg-card
            border
            border-emerald-500/30
            rounded-3xl
            shadow-2xl
            overflow-hidden
            p-5
            sm:p-7
            lg:p-8
          "
        >
          {/* ==================================================
              GLOW AMBIENTAL
              ================================================== */}

          <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* ==================================================
              BOTÓN CERRAR
              ================================================== */}

          <button
            type="button"
            onClick={onClose}
            className="
              absolute
              top-4
              right-4
              z-20
              w-10
              h-10
              rounded-full
              bg-muted/60
              hover:bg-muted
              text-muted-foreground
              hover:text-foreground
              transition-colors
              flex
              items-center
              justify-center
              cursor-pointer
            "
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ==================================================
              HEADER
              ================================================== */}

          <div className="relative text-center mb-6 sm:mb-7 pr-10 pl-10">
            <div
              className="
                inline-flex
                items-center
                gap-1.5
                px-3
                py-1.5
                bg-amber-500/10
                border
                border-amber-500/25
                rounded-full
                text-xs
                font-bold
                text-amber-700
                dark:text-amber-400
                mb-3
              "
            >
              <Lock className="w-3.5 h-3.5" />
              Capacidad del Plan Alcanzada
            </div>

            <h3
              className="
                text-2xl
                sm:text-3xl
                font-black
                text-foreground
                tracking-tight
              "
            >
              Lleva tu negocio al siguiente nivel
            </h3>

            <p
              className="
                text-sm
                sm:text-base
                text-muted-foreground
                leading-relaxed
                mt-2
                max-w-3xl
                mx-auto
              "
            >
              {motivo ||
                "Has alcanzado el límite de tu plan actual. Mejora tu suscripción para seguir creciendo sin restricciones."}
            </p>
          </div>

          {/* ==================================================
              COMPARACIÓN DE PLANES
              ================================================== */}

          <div
            className="
              relative
              grid
              grid-cols-1
              lg:grid-cols-[1fr_auto_1fr]
              gap-4
              lg:gap-5
              items-stretch
            "
          >
            {/* =================================================
                PLAN ACTUAL
                ================================================= */}

            <div
              className="
                rounded-2xl
                border
                border-border
                bg-muted/20
                p-5
                sm:p-6
                flex
                flex-col
              "
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <span
                  className="
                    inline-flex
                    items-center
                    px-3
                    py-1
                    rounded-lg
                    bg-muted
                    border
                    border-border
                    text-[11px]
                    font-black
                    uppercase
                    tracking-wider
                    text-muted-foreground
                  "
                >
                  Tu plan actual
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
                <div>
                  <h4 className="text-xl sm:text-2xl font-black text-foreground">
                    Plan {planActual.nombre}
                  </h4>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xl sm:text-2xl font-black text-emerald-500">
                    $
                    {PRECIO_FORMATTER.format(
                      planActual.precioMensual,
                    )}
                  </span>

                  <span className="block text-[10px] font-bold text-muted-foreground">
                    COP /mes
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {featuresPlanActual.map((feature, index) => (
                  <div
                    key={`${feature}-${index}`}
                    className="flex items-start gap-2.5"
                  >
                    <div
                      className="
                        w-5
                        h-5
                        rounded-full
                        bg-emerald-500/15
                        flex
                        items-center
                        justify-center
                        shrink-0
                        mt-0.5
                      "
                    >
                      <Check className="w-3 h-3 text-emerald-500" />
                    </div>

                    <span className="text-sm text-foreground font-medium leading-snug">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* =================================================
                FLECHA
                ================================================= */}

            <div className="hidden lg:flex items-center justify-center">
              <div
                className="
                  w-14
                  h-14
                  rounded-full
                  bg-muted
                  border
                  border-border
                  flex
                  items-center
                  justify-center
                  shadow-sm
                "
              >
                <ArrowRight className="w-7 h-7 text-emerald-500" />
              </div>
            </div>

            {/* =================================================
                PLAN ADMINISTRADOR
                ================================================= */}

            <div
              className="
                relative
                rounded-2xl
                border-2
                border-emerald-500
                bg-emerald-500/5
                p-5
                sm:p-6
                shadow-lg
                shadow-emerald-500/10
                overflow-hidden
              "
            >
              {/* Glow interno */}
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <span
                    className="
                      inline-flex
                      items-center
                      gap-1.5
                      px-3
                      py-1
                      rounded-lg
                      bg-emerald-500
                      text-white
                      text-[11px]
                      font-black
                      uppercase
                      tracking-wider
                    "
                  >
                    <Sparkles className="w-3 h-3" />
                    Plan recomendado
                  </span>

                  <Crown className="w-6 h-6 text-emerald-500" />
                </div>

                <div className="flex items-start justify-between gap-4 border-b border-emerald-500/20 pb-4">
                  <div>
                    <h4 className="text-xl sm:text-2xl font-black text-foreground">
                      Plan Administrador
                    </h4>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xl sm:text-2xl font-black text-emerald-500">
                      ${precioAdministrador}
                    </span>

                    <span className="block text-[10px] font-bold text-muted-foreground">
                      COP /mes
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {featuresAdministrador.map((feature, index) => (
                    <div
                      key={`${feature}-${index}`}
                      className="flex items-start gap-2.5"
                    >
                      <div
                        className="
                          w-5
                          h-5
                          rounded-full
                          bg-emerald-500
                          flex
                          items-center
                          justify-center
                          shrink-0
                          mt-0.5
                        "
                      >
                        <Check className="w-3 h-3 text-white" />
                      </div>

                      <span className="text-sm text-foreground font-semibold leading-snug">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Indicador visual de crecimiento */}
                <div
                  className="
                    hidden
                    xl:flex
                    absolute
                    right-0
                    bottom-0
                    w-36
                    h-24
                    items-end
                    justify-end
                    gap-1.5
                    opacity-30
                    pointer-events-none
                  "
                >
                  <div className="w-5 h-8 rounded-t-md bg-emerald-500" />
                  <div className="w-5 h-12 rounded-t-md bg-emerald-500" />
                  <div className="w-5 h-16 rounded-t-md bg-emerald-500" />
                  <BarChart3 className="absolute -top-3 right-0 w-7 h-7 text-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          {/* ==================================================
              CTA
              ================================================== */}

          <div className="relative mt-6 sm:mt-7">
            <button
              type="button"
              onClick={handleOpenWompi}
              className="
                w-full
                py-4
                bg-gradient-to-r
                from-emerald-600
                to-emerald-500
                hover:from-emerald-500
                hover:to-emerald-400
                text-white
                font-black
                text-sm
                sm:text-base
                rounded-2xl
                shadow-lg
                shadow-emerald-500/25
                transition-all
                flex
                items-center
                justify-center
                gap-2
                cursor-pointer
              "
            >
              <Sparkles className="w-5 h-5" />

              <span>
                Cambiar al Plan Administrador ($
                {precioAdministrador} COP/mes)
              </span>
            </button>
          </div>

          {/* ==================================================
              ACCIONES SECUNDARIAS
              ================================================== */}

          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleOpenWhatsappSales}
              className="
                flex-1
                py-2.5
                px-4
                rounded-xl
                border
                border-border
                bg-background
                hover:bg-muted
                text-xs
                font-bold
                text-muted-foreground
                hover:text-foreground
                transition-colors
                flex
                items-center
                justify-center
                gap-2
                cursor-pointer
              "
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
              Hablar con Asesor Comercial
            </button>

            <Link
              to="/subscription"
              onClick={onClose}
              className="
                flex-1
                py-2.5
                px-4
                rounded-xl
                border
                border-border
                bg-background
                hover:bg-muted
                text-xs
                font-bold
                text-muted-foreground
                hover:text-foreground
                transition-colors
                flex
                items-center
                justify-center
                text-center
              "
            >
              Ver comparativa completa de planes
            </Link>
          </div>

          {/* ==================================================
              SEGURIDAD
              ================================================== */}

          <div
            className="
              mt-4
              pt-4
              border-t
              border-border
              flex
              items-center
              justify-center
              gap-2
              text-[11px]
              font-medium
              text-muted-foreground
              text-center
            "
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />

            <span>
              Pasarela Wompi Bancolombia • Cancelación en cualquier momento
            </span>
          </div>
        </motion.div>
      </div>

      {/* ======================================================
          CHECKOUT WOMPI
          ====================================================== */}

      {isCheckoutOpen && (
        <WompiCheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          plan={planAdministrador}
          ciclo="mensual"
          negocioId={negocioId || ""}
          negocioNombre={negocioNombre}
          onPaymentSuccess={() => {
            setIsCheckoutOpen(false);
            onClose();

            if (onUpgradeSuccess) {
              onUpgradeSuccess();
            }
          }}
        />
      )}
    </>
  );
}