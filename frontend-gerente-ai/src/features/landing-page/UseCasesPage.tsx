import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CircleDollarSign,
  ClipboardCheck,
  MessageCircle,
  Package,
  ReceiptText,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router";

import { LukaChatProvider, LukaFloatingChat } from "@/features/assistant";
import { CoworkingFooterSection } from "./components/CoworkingFooterSection";
import { CoworkingNavbar } from "./components/CoworkingNavbar";

const useCases = [
  {
    number: "01",
    icon: CircleDollarSign,
    label: "Cuando termina el día",
    title: "Saber qué pasó con tu dinero.",
    description:
      "Luka convierte una nota rápida en una lectura clara de tus ventas, gastos y balance. Sin esperar al cierre del mes ni reconstruirlo todo desde la memoria.",
    message: "Hoy vendí 428.000 y gasté 96.000 en insumos.",
    answer:
      "Tus ventas superaron tus gastos de hoy. El balance del día es de 332.000.",
    accent: "emerald",
  },
  {
    number: "02",
    icon: ReceiptText,
    label: "Cuando suben los costos",
    title: "Encontrar dónde se está yendo la ganancia.",
    description:
      "Pregunta por tus gastos y Luka organiza el contexto: categorías, compras y cambios que merecen una mirada antes de que se vuelvan un problema.",
    message: "¿Qué gastos están pesando más este mes?",
    answer:
      "Las compras de insumos concentran la mayor parte de tus egresos y crecieron frente al periodo anterior.",
    accent: "amber",
  },
  {
    number: "03",
    icon: WalletCards,
    label: "Cuando vendes fiado",
    title: "No perder de vista lo que aún te deben.",
    description:
      "Luka mantiene la cartera en contexto para que sepas cuánto falta por cobrar, qué cuentas llevan más tiempo y dónde conviene hacer seguimiento.",
    message: "¿Cuánto tengo pendiente por cobrar?",
    answer:
      "Tienes 1.240.000 pendientes. Puedo mostrarte los clientes con mayor saldo y los abonos recientes.",
    accent: "cyan",
  },
  {
    number: "04",
    icon: Package,
    label: "Cuando el inventario aprieta",
    title: "Actuar antes de quedarte sin producto.",
    description:
      "Consulta existencias, identifica productos con poco stock y usa el historial de movimientos para comprar con más criterio.",
    message: "¿Qué productos debería reponer primero?",
    answer:
      "Hay 6 productos por debajo del mínimo. Los de mayor movimiento son arroz, aceite y gaseosa.",
    accent: "violet",
  },
];

const accentStyles = {
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    bubble: "bg-emerald-500 text-white",
    glow: "bg-emerald-500/[0.08]",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    bubble: "bg-amber-500 text-white",
    glow: "bg-amber-500/[0.08]",
  },
  cyan: {
    icon: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    bubble: "bg-cyan-500 text-white",
    glow: "bg-cyan-500/[0.08]",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    bubble: "bg-violet-500 text-white",
    glow: "bg-violet-500/[0.08]",
  },
} as const;

type AccentName = keyof typeof accentStyles;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07] dark:text-emerald-400">
      <Sparkles className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

function ConversationPreview({
  message,
  answer,
  accent,
  reversed,
}: {
  message: string;
  answer: string;
  accent: AccentName;
  reversed: boolean;
}) {
  const styles = accentStyles[accent];

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className={`absolute -right-12 top-12 h-52 w-52 rounded-full blur-3xl ${styles.glow}`} />
      <div className={`relative overflow-hidden border border-slate-200/80 bg-white/80 shadow-[0_35px_100px_-50px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111925]/90 dark:shadow-[0_35px_100px_-50px_rgba(0,0,0,0.9)] ${reversed ? "rounded-[42px] rounded-bl-[96px]" : "rounded-[42px] rounded-tr-[96px]"}`}>
        <div className="flex items-center gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-emerald-500/20 bg-emerald-500/10">
            <img src="/Luka redondo.png" alt="Luka AI" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-950 dark:text-white">Luka AI</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Tu gerente virtual · WhatsApp
            </div>
          </div>
          <MessageCircle className="ml-auto h-5 w-5 text-slate-300 dark:text-slate-600" />
        </div>

        <div className="space-y-4 bg-slate-50/80 p-5 dark:bg-[#0c131d] sm:p-7">
          <div className="ml-auto max-w-[82%] rounded-[20px] rounded-br-md bg-slate-950 px-4 py-3 text-sm font-medium leading-relaxed text-white dark:bg-white dark:text-slate-950">
            {message}
          </div>
          <div className="max-w-[88%] rounded-[20px] rounded-bl-md border border-slate-200/80 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
            <div className="mb-3 flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles.icon}`}>
                <BrainCircuit className="h-3.5 w-3.5" />
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Lectura de Luka</span>
            </div>
            <p className="font-semibold text-slate-950 dark:text-white">{answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UseCasesPage() {
  const reducedMotion = useReducedMotion();

  return (
    <LukaChatProvider>
      <div className="min-h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 transition-colors duration-500 dark:bg-[#070B12] dark:text-slate-50">
        <CoworkingNavbar />

        <main>
          <section className="relative overflow-hidden px-6 pb-12 pt-36 sm:pt-44 md:px-12 md:pb-16">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-[-180px] h-[600px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[140px] dark:bg-emerald-500/[0.1]" />
              <div className="absolute right-[-160px] top-[28%] h-[420px] w-[420px] rounded-full bg-cyan-400/[0.04] blur-[130px] dark:bg-cyan-400/[0.06]" />
            </div>

            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 24 }}
              animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="relative mx-auto max-w-5xl text-center"
            >
              <SectionLabel>Casos de uso</SectionLabel>
              <h1 className="text-5xl font-extrabold leading-[0.96] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-6xl md:text-7xl">
                Menos vueltas.
                <br />
                <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">Más claridad.</span>
              </h1>
              <p className="mx-auto mt-7 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg md:text-xl">
                Luka aparece justo cuando necesitas entender lo que está pasando en tu negocio: en una conversación, con el contexto que ya tienes.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/register" className="group inline-flex items-center gap-3 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_18px_50px_-18px_rgba(15,23,42,0.5)] transition-all hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">
                  Empieza gratis
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 dark:bg-slate-950/10"><ArrowRight className="h-3.5 w-3.5" /></span>
                </Link>
                <a href="#situaciones" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-6 py-3.5 text-sm font-bold text-slate-700 backdrop-blur-xl transition-all hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white">
                  Ver situaciones
                </a>
              </div>
            </motion.div>

            <div className="relative mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-3">
              {[
                { icon: MessageCircle, label: "Hablas como siempre" },
                { icon: ClipboardCheck, label: "Luka ordena el contexto" },
                { icon: BarChart3, label: "Decides con más claridad" },
              ].map(({ icon: Icon, label }, index) => (
                <motion.div key={label} initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={reducedMotion ? undefined : { opacity: 1, y: 0 }} transition={{ delay: 0.12 + index * 0.08 }} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/65 px-5 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Icon className="h-4 w-4" /></div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
                </motion.div>
              ))}
            </div>
          </section>

          <section id="situaciones" className="relative px-6 pb-6 pt-16 md:px-12 md:pb-10 md:pt-20">
            <div className="mx-auto max-w-7xl space-y-4 md:space-y-8">
              {useCases.map((useCase, index) => {
                const Icon = useCase.icon;
                const reversed = index % 2 === 1;

                return (
                  <motion.article key={useCase.number} initial={reducedMotion ? false : { opacity: 0, x: reversed ? 28 : -28 }} whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: 0.75, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }} className="relative grid items-center gap-8 overflow-hidden border-t border-slate-200/80 py-6 first:border-t-0 first:pt-0 dark:border-white/10 lg:grid-cols-2 lg:gap-12 lg:py-8">
                    <div className={`pointer-events-none absolute top-[-34px] text-[170px] font-black leading-none tracking-[-0.08em] text-slate-200/60 dark:text-white/[0.035] ${reversed ? "right-0" : "left-0"}`}>{useCase.number}</div>
                    <div className={`relative z-10 ${reversed ? "lg:order-2" : ""}`}>
                      <div className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400"><span className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400">{useCase.number}</span><span>{useCase.label}</span></div>
                      <div className={`mt-6 flex h-14 w-14 items-center justify-center rounded-2xl ${accentStyles[useCase.accent as AccentName].icon}`}><Icon className="h-6 w-6" /></div>
                      <h2 className="mt-7 max-w-xl text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl">{useCase.title}</h2>
                      <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">{useCase.description}</p>
                      <Link to="/register" className="group mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400">Quiero probarlo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
                    </div>
                    <motion.div initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 12 }} whileInView={reducedMotion ? undefined : { opacity: 1, scale: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8, delay: 0.1 + index * 0.04 }} className={`relative z-10 ${reversed ? "lg:order-1" : ""}`}>
                      <ConversationPreview message={useCase.message} answer={useCase.answer} accent={useCase.accent as AccentName} reversed={reversed} />
                    </motion.div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <section className="relative overflow-hidden px-6 pb-24 pt-10 md:px-12 md:pb-32 md:pt-14">
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-[#063A35] px-7 py-16 text-center shadow-[0_35px_100px_-50px_rgba(6,58,53,0.8)] sm:px-10 md:px-16 md:py-24">
              <div className="pointer-events-none absolute inset-0"><div className="absolute left-1/2 top-[-180px] h-[440px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-300/[0.12] blur-[120px]" /><div className="absolute bottom-[-160px] right-[-80px] h-[320px] w-[320px] rounded-full bg-cyan-300/[0.08] blur-[110px]" /></div>
              <div className="relative z-10 mx-auto max-w-3xl">
                <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08]"><img src="/Luka.png" alt="Luka" className="h-7 w-7 object-contain" /></div>
                <h2 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">Tu negocio ya está pasando cosas.<br /><span className="text-emerald-300">Luka te ayuda a verlas.</span></h2>
                <p className="mx-auto mt-6 max-w-2xl text-sm font-medium leading-relaxed text-white/60 sm:text-base">Empieza gratis y convierte las conversaciones de cada día en decisiones más claras.</p>
                <Link to="/register" className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-extrabold text-slate-950 shadow-[0_20px_60px_-20px_rgba(255,255,255,0.3)] transition-all hover:-translate-y-1">Comenzar gratis <ArrowRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </section>
        </main>

        <CoworkingFooterSection />
        <LukaFloatingChat />
      </div>
    </LukaChatProvider>
  );
}
