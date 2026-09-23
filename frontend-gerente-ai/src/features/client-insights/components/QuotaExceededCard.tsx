import { ArrowRight, BarChart3, Check, MessageSquare, Sparkles, Zap } from "lucide-react";

interface QuotaExceededCardProps {
  onUpgrade: () => void;
}

export function QuotaExceededCard({ onUpgrade }: QuotaExceededCardProps) {
  return (
    <div className="relative isolate flex min-h-[min(500px,calc(100vh-210px))] w-full items-center justify-center overflow-hidden rounded-[2rem] border border-amber-500/20 bg-card px-4 py-8 shadow-sm sm:px-10 sm:py-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.08] blur-[110px] dark:bg-emerald-400/[0.06]" />
        <div className="absolute -right-20 top-12 h-56 w-56 rounded-full bg-amber-400/[0.12] blur-[90px] dark:bg-amber-400/[0.08]" />
        <div className="absolute -left-20 bottom-10 h-64 w-64 rounded-full bg-cyan-400/[0.1] blur-[100px] dark:bg-cyan-400/[0.06]" />
      </div>

      <div className="w-full max-w-5xl text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-amber-400/30 bg-gradient-to-br from-amber-400/20 via-orange-400/10 to-emerald-400/10 text-amber-500 shadow-[0_20px_50px_-24px_rgba(245,158,11,0.65)]">
          <div className="relative">
            <Zap className="h-9 w-9" strokeWidth={2.2} />
            <span className="absolute -bottom-2 -right-3 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-emerald-500 text-white">
              <Sparkles className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
          Cuota de IA agotada
        </span>

        <h3 className="mx-auto mt-5 max-w-3xl text-2xl font-black tracking-tight text-foreground sm:text-4xl">
          Luka necesita un poco más de espacio para seguir analizando tu negocio.
        </h3>

        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Ya utilizaste los mensajes de IA incluidos en tu ciclo actual. Aumenta tu cuota para continuar recibiendo recomendaciones, alertas y análisis basados en tus datos.
        </p>

        <div className="mx-auto mt-7 grid max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
          <Benefit icon={BarChart3} text="Análisis más frecuentes" />
          <Benefit icon={MessageSquare} text="Más consultas a Luka" />
          <Benefit icon={Check} text="Decisiones basadas en datos" />
        </div>

        <button
          type="button"
          onClick={onUpgrade}
          className="group mt-9 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-4 text-sm font-black text-slate-950 shadow-[0_18px_45px_-18px_rgba(20,184,166,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_55px_-18px_rgba(20,184,166,0.8)] sm:w-auto sm:min-w-[270px]"
        >
          <Sparkles className="h-4 w-4" />
          Aumentar cuota de IA
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>

        <p className="mt-5 text-xs text-muted-foreground">
          También puedes esperar al siguiente ciclo de renovación.
        </p>
      </div>
    </div>
  );
}

function Benefit({
  icon: Icon,
  text,
}: {
  icon: typeof Check;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border/80 bg-background/55 px-3 py-3 backdrop-blur-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-xs font-bold leading-snug text-foreground">{text}</span>
    </div>
  );
}
