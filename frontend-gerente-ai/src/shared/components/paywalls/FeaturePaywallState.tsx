import {
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Wallet,
  Receipt,
  CreditCard,
} from "lucide-react";

interface PreviewCard {
  label: string;
  title: string;
  description: string;
  icon:
    | "warning"
    | "success"
    | "info"
    | "wallet"
    | "receipt"
    | "credit";
  color: "amber" | "emerald" | "cyan";
}

interface FeatureItem {
  title: string;
  description: string;
}

interface FeaturePaywallStateProps {
  onUpgrade: () => void;

  badge: string;
  title: React.ReactNode;
  description: string;

  previewCards: PreviewCard[];

  features: FeatureItem[];

  planDescription?: string;

  /**
   * Si el plan contratado caduco, y como se llamaba.
   *
   * Con esto la tarjeta deja de decirle "mejora tu plan" a quien ya pago uno
   * mas alto: lo que necesita es renovar, y le hace falta saber que no ha
   * perdido sus datos. Mismo criterio que el backend, que ya distingue los
   * dos casos en sus mensajes de 403.
   */
  planVencido?: boolean;
  planContratadoNombre?: string | null;
}

const iconConfig = {
  warning: AlertTriangle,
  success: TrendingUp,
  info: Lightbulb,
  wallet: Wallet,
  receipt: Receipt,
  credit: CreditCard,
};

const colorConfig = {
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    icon: "text-amber-500",
    label: "text-amber-600 dark:text-amber-400",
  },

  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    icon: "text-emerald-500",
    label: "text-emerald-600 dark:text-emerald-400",
  },

  cyan: {
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/10",
    icon: "text-cyan-500",
    label: "text-cyan-600 dark:text-cyan-400",
  },
};

export function FeaturePaywallState({
  onUpgrade,
  planVencido = false,
  planContratadoNombre = null,
  badge,
  title,
  description,
  previewCards,
  features,
  planDescription = "Disponible a partir del Plan Gerente ($39.900/mes) o planes superiores.",
}: FeaturePaywallStateProps) {
  return (
    <div className="relative w-full min-w-0 max-w-4xl mx-auto py-2 sm:py-8 animate-in fade-in zoom-in-95 duration-300">
      {/* ======================================================
          BACKGROUND AMBIENT GLOW
      ======================================================= */}

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/15 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ======================================================
          MAIN BANNER HEADER
      ======================================================= */}

      <div className="text-center mb-4 sm:mb-8 px-3">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] sm:text-xs font-bold mb-2.5 sm:mb-4 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />

          <span>
            {planVencido
              ? planContratadoNombre
                ? `Tu plan ${planContratadoNombre} está vencido`
                : "Tu plan está vencido"
              : badge}
          </span>
        </div>

        <h2 className="text-xl sm:text-3xl font-black text-foreground tracking-tight max-w-2xl mx-auto leading-tight">
          {title}
        </h2>

        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-3 max-w-xl mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {/* ======================================================
          INTERACTIVE PAYWALL TEASER
      ======================================================= */}

      <div className="relative w-full min-w-0 bg-gradient-to-b from-emerald-500/5 via-card/70 to-card dark:from-emerald-500/10 dark:via-slate-900/60 dark:to-slate-950 backdrop-blur-xl border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-8 shadow-xl overflow-hidden min-h-[300px] sm:min-h-[260px] flex items-center justify-center">
        {/* ====================================================
            BLURRED PREVIEW CARDS
        ===================================================== */}

        <div className="hidden sm:grid sm:grid-cols-3 gap-4 opacity-50 blur-[2px] pointer-events-none select-none w-full">
          {previewCards.slice(0, 3).map((card, index) => {
            const Icon = iconConfig[card.icon];
            const colors = colorConfig[card.color];

            return (
              <div
                key={`${card.label}-${index}`}
                className={`bg-card border ${colors.border} rounded-2xl p-4 shadow-sm`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className={`p-1.5 rounded-lg ${colors.bg} ${colors.icon}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <span
                    className={`text-[11px] font-bold ${colors.label}`}
                  >
                    {card.label}
                  </span>
                </div>

                <p className="text-xs font-bold text-foreground line-clamp-1">
                  {card.title}
                </p>

                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* ====================================================
            CENTER FLOATING LOCK + CTA
        ===================================================== */}

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 sm:p-6 bg-gradient-to-b from-transparent via-card/80 to-card dark:via-slate-950/80 dark:to-slate-950 backdrop-blur-xs">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5 sm:mb-3.5 shadow-md shadow-emerald-500/10 shrink-0">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>

          <h3 className="text-base sm:text-xl font-bold text-foreground max-w-sm sm:max-w-md leading-snug">
            Desbloquea esta funcionalidad para tu negocio
          </h3>

          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 max-w-xs sm:max-w-md leading-relaxed">
            {planVencido
              ? "Tus datos siguen guardados: no has perdido nada. Al renovar vuelve a estar disponible tal como lo dejaste."
              : planDescription}
          </p>

          <button
            type="button"
            onClick={onUpgrade}
            className="mt-3.5 sm:mt-5 inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />

            <span>{planVencido ? "Renovar mi Plan" : "Mejorar mi Plan"}</span>

            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950" />
          </button>
        </div>
      </div>

      {/* ======================================================
          FEATURE LIST
      ======================================================= */}

      <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 px-1 sm:px-2">
        {features.slice(0, 4).map((feature, index) => (
          <div
            key={`${feature.title}-${index}`}
            className="flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-muted/30 border border-border"
          >
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0 mt-0.5" />

            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-bold text-foreground">
                {feature.title}
              </p>

              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}