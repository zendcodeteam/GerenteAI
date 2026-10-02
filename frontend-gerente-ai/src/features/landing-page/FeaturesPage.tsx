import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Check,
  CircleDollarSign,
  FileText,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Package,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router";

import { CoworkingFooterSection } from "./components/CoworkingFooterSection";
import { CoworkingNavbar } from "./components/CoworkingNavbar";
import { LukaDynamicAtmosphere } from "./components/LukaDynamicAtmosphere";
import {
  LukaChatProvider,
  LukaFloatingChat,
} from "@/features/assistant";

const featureCards = [
  {
    icon: CircleDollarSign,
    eyebrow: "01",
    title: "Ventas",
    description:
      "Registra tus ventas y consulta cómo se mueve tu negocio sin depender de hojas de cálculo.",
  },
  {
    icon: ReceiptText,
    eyebrow: "02",
    title: "Gastos",
    description:
      "Mantén tus gastos organizados y entiende cuánto dinero está saliendo de tu negocio.",
  },
  {
    icon: Package,
    eyebrow: "03",
    title: "Inventario",
    description:
      "Ten una visión clara de tus productos, existencias y movimientos para actuar a tiempo.",
  },
  {
    icon: Users,
    eyebrow: "04",
    title: "Clientes",
    description:
      "Consulta la información de tus clientes y el historial que necesitas para conocer mejor tu negocio.",
  },
  {
    icon: BarChart3,
    eyebrow: "05",
    title: "Reportes",
    description:
      "Convierte tus movimientos diarios en indicadores que puedes consultar cuando los necesites.",
  },
  {
    icon: BrainCircuit,
    eyebrow: "06",
    title: "Inteligencia artificial",
    description:
      "Luka entiende el contexto de tu negocio y te ayuda a pasar de los datos a decisiones más claras.",
  },
];

const channels = [
  {
    icon: MessageCircle,
    title: "Texto",
    description: "Escribe a Luka como escribirías cualquier mensaje.",
  },
  {
    icon: Mic,
    title: "Audio",
    description: "Envía una nota de voz cuando escribir no sea lo más práctico.",
  },
  {
    icon: ImageIcon,
    title: "Imágenes",
    description: "Comparte imágenes de facturas y otra información relevante.",
  },
];

function SectionLabel({
  children,
  icon: Icon = Sparkles,
}: {
  children: React.ReactNode;
  icon?: typeof Sparkles;
}) {
  return (
    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07] dark:text-emerald-400">
      <Icon className="h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

function ChatMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] -mt-5 md:-mt-0">
      <div className="absolute -left-10 top-10 h-44 w-44 rounded-full bg-emerald-400/15 blur-3xl" />
      <div className="absolute -bottom-10 right-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_35px_100px_-45px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#111925] dark:shadow-[0_35px_100px_-45px_rgba(0,0,0,0.85)]">
        <div className="flex items-center gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-white/10">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <MessageCircle className="h-5 w-5" />
          </div>

          <div>
            <p className="text-sm font-extrabold text-slate-950 dark:text-white">
              Luka AI
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-400">
                Tu gerente virtual
              </span>
            </div>
          </div>

          <div className="ml-auto rounded-full border border-emerald-500/10 bg-emerald-500/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
            WhatsApp
          </div>
        </div>

        <div className="space-y-4 bg-slate-50/80 p-5 dark:bg-[#0c131d] sm:p-7">
          <div className="ml-auto max-w-[78%] rounded-[20px] rounded-br-md bg-emerald-500 px-4 py-3 text-sm font-medium leading-relaxed text-white shadow-lg shadow-emerald-500/10">
            Hoy vendí 428.000 y gasté 96.000 en insumos.
          </div>

          <div className="max-w-[84%] rounded-[20px] rounded-bl-md border border-slate-200/80 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
            <p className="font-semibold text-slate-950 dark:text-white">
              ¡Listo! Ya tengo la información.
            </p>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Tus ventas superaron tus gastos de hoy. También puedo ayudarte a
              revisar el comportamiento de tu negocio.
            </p>
          </div>

          <div className="ml-auto flex max-w-[82%] items-center gap-3 rounded-[20px] rounded-br-md bg-emerald-500 px-4 py-3 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Mic className="h-4 w-4" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-1">
                {[10, 18, 13, 23, 15, 20, 11, 18, 14, 22, 12, 17].map(
                  (height, index) => (
                    <span
                      key={index}
                      className="w-1 rounded-full bg-white/75"
                      style={{ height }}
                    />
                  ),
                )}
              </div>

              <p className="mt-1 text-[10px] font-medium text-white/70">
                Nota de voz · 0:18
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ReceiptText className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                Factura de compra
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Imagen recibida
              </p>
            </div>

            <Check className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] -mt-4 md:-mt-0">
      <div className="absolute -right-16 top-8 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-4 shadow-[0_35px_100px_-45px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#111925] dark:shadow-[0_35px_100px_-45px_rgba(0,0,0,0.85)] sm:p-5">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-white/10">
          <div>
            <p className="text-xs font-semibold text-slate-400">
              Resumen del negocio
            </p>
            <h3 className="mt-1 text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
              Hoy
            </h3>
          </div>

          <div className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Actualizado
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            {
              icon: CircleDollarSign,
              label: "Ventas",
              value: "$428.000",
            },
            {
              icon: WalletCards,
              label: "Gastos",
              value: "$96.000",
            },
            {
              icon: TrendingUp,
              label: "Balance",
              value: "$332.000",
            },
            {
              icon: Package,
              label: "Inventario",
              value: "84 productos",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Icon className="h-4 w-4" />
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    {item.label}
                  </span>
                </div>

                <p className="mt-4 text-base font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-lg">
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Movimiento de ventas
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Últimos días
              </p>
            </div>

            <BarChart3 className="h-4 w-4 text-emerald-500" />
          </div>

          <div className="mt-5 flex h-28 items-end gap-2">
            {[35, 54, 42, 72, 61, 84, 68, 94, 76, 100, 82, 91].map(
              (height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-lg bg-emerald-500/20"
                  style={{ height: `${height}%` }}
                >
                  <div
                    className="h-full w-full rounded-t-lg bg-gradient-to-t from-emerald-500/40 to-cyan-400/30"
                    style={{
                      transform: `scaleY(${0.55 + (index % 3) * 0.12})`,
                      transformOrigin: "bottom",
                    }}
                  />
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] -mt-5 md:-mt-0">
      <div className="absolute -left-10 bottom-0 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-5 shadow-[0_35px_100px_-45px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#111925] dark:shadow-[0_35px_100px_-45px_rgba(0,0,0,0.85)] sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <BrainCircuit className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
              Luka Insights
            </p>
            <p className="mt-1 text-sm font-extrabold text-slate-950 dark:text-white">
              Una lectura más clara de tus datos
            </p>
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.05] p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            Oportunidad detectada
          </div>

          <p className="mt-3 text-base font-extrabold leading-snug tracking-tight text-slate-950 dark:text-white sm:text-lg">
            Tus ventas están creciendo, pero tus gastos en insumos también
            aumentaron.
          </p>

          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Luka analiza el contexto disponible para ayudarte a entender qué
            está ocurriendo y qué deberías revisar.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
            <p className="text-[11px] font-semibold text-slate-400">
              Ventas
            </p>
            <p className="mt-2 text-xl font-extrabold text-slate-950 dark:text-white">
              +18%
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-white/10">
            <p className="text-[11px] font-semibold text-slate-400">
              Gastos
            </p>
            <p className="mt-2 text-xl font-extrabold text-slate-950 dark:text-white">
              +9%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesPage() {
  const reducedMotion = useReducedMotion();

  return (
    <LukaChatProvider>
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 transition-colors duration-500 selection:bg-emerald-500/30 dark:bg-[#070B12] dark:text-slate-50 luka-surface-pattern">
        <LukaDynamicAtmosphere />
        <div className="luka-home-gradient" aria-hidden="true" />

        <div className="relative z-30">
        <CoworkingNavbar />

        <main>
          {/* HERO */}
          <section className="relative overflow-hidden mt-6 px-6 pb-2 pt-36 -mb-14 sm:pt-40 md:px-12 md:pb-3 md:pt-39 md:-mb-14">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-[-170px] h-[560px] w-[760px] -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-[130px] dark:bg-emerald-500/[0.08]" />
              <div className="absolute left-[-180px] top-[35%] h-[380px] w-[380px] rounded-full bg-cyan-400/[0.035] blur-[120px] dark:bg-cyan-400/[0.05]" />
              <div className="absolute right-[-180px] top-[20%] h-[420px] w-[420px] rounded-full bg-blue-500/[0.025] blur-[130px] dark:bg-blue-500/[0.035]" />
            </div>

            <div className="relative mx-auto max-w-7xl">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 24 }}
                animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto max-w-4xl text-center"
              >
                <SectionLabel icon={Sparkles}>
                  Todo lo que necesitas, conectado
                </SectionLabel>

                <h1 className="text-5xl font-extrabold leading-[0.98] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-6xl md:text-7xl lg:text-[88px]">
                  Tu negocio.
                  <br />
                  <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                    En un solo lugar.
                  </span>
                </h1>

                <p className="mx-auto mt-7 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg md:text-xl">
                  Luka reúne la información de tu negocio y la convierte en
                  algo que puedes entender, consultar y usar para tomar
                  decisiones.
                </p>

                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    to="/register"
                    className="group inline-flex items-center gap-3 rounded-full bg-slate-950 px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_18px_50px_-18px_rgba(15,23,42,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_65px_-18px_rgba(15,23,42,0.6)] dark:bg-white dark:text-slate-950"
                  >
                    Comenzar gratis
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 dark:bg-slate-950/10">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>

                  <Link
                    to="/home"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-6 py-3.5 text-sm font-bold text-slate-700 backdrop-blur-xl transition-all duration-300 hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
                  >
                    Volver al inicio
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 35, scale: 0.98 }}
                animate={
                  reducedMotion
                    ? undefined
                    : { opacity: 1, y: 0, scale: 1 }
                }
                transition={{
                  duration: 0.85,
                  delay: 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mx-auto mt-9 max-w-5xl sm:mt-17"
              >
                <div className="grid overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/70 shadow-[0_40px_120px_-55px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_40px_120px_-55px_rgba(0,0,0,0.9)] sm:grid-cols-3">
                  {channels.map((channel, index) => {
                    const Icon = channel.icon;

                    return (
                      <div
                        key={channel.title}
                        className={`flex items-center gap-4 px-5 py-5 sm:px-6 ${
                          index > 0
                            ? "border-t border-slate-200/80 sm:border-l sm:border-t-0 dark:border-white/10"
                            : ""
                        }`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-sm font-extrabold text-slate-950 dark:text-white">
                            {channel.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            {channel.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          </section>

          {/* WHATSAPP */}
          <section className="relative px-6 py-24 -mb-14 md:px-12 md:py-28 md:-mb-14">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-[5%] top-[20%] h-[360px] w-[360px] rounded-full bg-emerald-500/[0.035] blur-[130px] dark:bg-emerald-500/[0.05]" />
              <div className="absolute right-[5%] bottom-[10%] h-[300px] w-[300px] rounded-full bg-cyan-500/[0.025] blur-[120px] dark:bg-cyan-500/[0.04]" />
            </div>

            <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, x: -30 }}
                whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.7 }}
              >
                <SectionLabel icon={MessageCircle}>
                  Habla con Luka
                </SectionLabel>

                <h2 className="max-w-xl text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl md:text-6xl">
                  La gestión de tu negocio empieza con una conversación.
                </h2>

                <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
                  No necesitas aprender una herramienta complicada para
                  empezar. Puedes hablar con Luka por WhatsApp y contarle lo
                  que está pasando en tu negocio.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    "Registra información mientras trabajas.",
                    "Combina texto, audios e imágenes.",
                    "Mantén el contexto de tu negocio disponible para consultar.",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={reducedMotion ? false : { opacity: 0, x: 30, scale: 0.98 }}
                whileInView={
                  reducedMotion
                    ? undefined
                    : { opacity: 1, x: 0, scale: 1 }
                }
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.8, delay: 0.08 }}
              >
                <ChatMockup />
              </motion.div>
            </div>
          </section>

          {/* DASHBOARD */}
          <section className="relative z-10 overflow-hidden px-6 py-4 -mt-16 -mb-14 md:px-12 md:py-0 md:mt-0 md:-mb-24">
            <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, x: -30, scale: 0.98 }}
                whileInView={
                  reducedMotion
                    ? undefined
                    : { opacity: 1, x: 0, scale: 1 }
                }
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.8 }}
                className="order-2 lg:order-1"
              >
                <DashboardMockup />
              </motion.div>

              <motion.div
                initial={reducedMotion ? false : { opacity: 0, x: 30 }}
                whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.7 }}
                className="order-1 lg:order-2"
              >
                <SectionLabel icon={BarChart3}>
                  Todo en contexto
                </SectionLabel>

                <h2 className="max-w-xl text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl md:text-6xl">
                  De movimientos diarios a una visión completa.
                </h2>

                <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
                  Luka centraliza la información que generas todos los días
                  para que puedas consultar el estado de tu negocio desde un
                  mismo lugar.
                </p>

                <div className="mt-8 rounded-[24px] border border-slate-200/80 bg-white/70 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      <FileText className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-extrabold text-slate-950 dark:text-white">
                        Información organizada
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Consulta lo importante sin perderte entre datos.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* INSIGHTS */}
          <section className="relative px-6 py-22 -mb-24 md:px-12 md:py-34 md:-mb-24">
            <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, x: -30 }}
                whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.7 }}
              >
                <SectionLabel icon={BrainCircuit}>
                  Inteligencia para decidir
                </SectionLabel>

                <h2 className="max-w-xl text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl md:text-6xl">
                  No solo te muestra los datos.
                  <br />
                  <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
                    Te ayuda a entenderlos.
                  </span>
                </h2>

                <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
                  La propuesta de Luka no termina en registrar información.
                  Su inteligencia artificial está pensada para ayudarte a
                  encontrar patrones, oportunidades y puntos que merecen tu
                  atención.
                </p>

                <Link
                  to="/register"
                  className="group mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400"
                >
                  Empieza a usar Luka
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </motion.div>

              <motion.div
                initial={reducedMotion ? false : { opacity: 0, x: 30, scale: 0.98 }}
                whileInView={
                  reducedMotion
                    ? undefined
                    : { opacity: 1, x: 0, scale: 1 }
                }
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.8 }}
              >
                <InsightMockup />
              </motion.div>
            </div>
          </section>

          {/* FEATURE GRID */}
          <section className="relative px-6 pb-24 mb-14 pt-14 md:px-12 md:pb-32 md:pt-4 -mb-24">
            <div className="pointer-events-none absolute left-1/2 top-[10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-500/[0.025] blur-[130px] dark:bg-emerald-500/[0.04]" />

            <div className="relative mx-auto max-w-7xl">
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 24 }}
                whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.7 }}
                className="mx-auto max-w-3xl text-center"
              >
                <SectionLabel icon={Sparkles}>
                  Una plataforma pensada para el día a día
                </SectionLabel>

                <h2 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl md:text-6xl">
                  Todo lo que Luka puede hacer por tu negocio.
                </h2>

                <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
                  Desde el movimiento de caja hasta la lectura de tus datos,
                  cada parte está pensada para trabajar junta.
                </p>
              </motion.div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featureCards.map((feature, index) => {
                  const Icon = feature.icon;

                  return (
                    <motion.article
                      key={feature.title}
                      initial={
                        reducedMotion
                          ? false
                          : { opacity: 0, y: 24 }
                      }
                      whileInView={
                        reducedMotion
                          ? undefined
                          : { opacity: 1, y: 0 }
                      }
                      viewport={{ once: true, amount: 0.15 }}
                      transition={{
                        duration: 0.6,
                        delay: index * 0.06,
                      }}
                      className="group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/70 p-7 shadow-[0_25px_70px_-55px_rgba(15,23,42,0.3)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/20 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-emerald-400/20 dark:hover:bg-white/[0.045] sm:p-8"
                    >
                      <div className="absolute right-[-70px] top-[-70px] h-40 w-40 rounded-full bg-emerald-500/[0.035] blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

                      <div className="relative">
                        <div className="flex items-center justify-between">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Icon className="h-5 w-5" />
                          </div>

                          <span className="text-xs font-extrabold tracking-[0.12em] text-slate-300 dark:text-slate-600">
                            {feature.eyebrow}
                          </span>
                        </div>

                        <h3 className="mt-8 text-xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                          {feature.title}
                        </h3>

                        <p className="mt-4 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                          {feature.description}
                        </p>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="relative overflow-hidden mb-0 px-6 pb-19 pt-10 -mt-36 md:px-12 md:pb-20 md:mb-10">
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-[#063A35] px-7 py-14 text-center shadow-[0_35px_100px_-50px_rgba(6,58,53,0.8)] sm:px-10 sm:py-18 md:px-16 md:py-24">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-[-180px] h-[440px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-300/[0.12] blur-[120px]" />
                <div className="absolute bottom-[-180px] left-[-80px] h-[320px] w-[320px] rounded-full bg-cyan-300/[0.08] blur-[110px]" />
                <div className="absolute bottom-[-150px] right-[-70px] h-[300px] w-[300px] rounded-full bg-emerald-300/[0.08] blur-[100px]" />
              </div>

              <div className="relative z-10 mx-auto max-w-3xl">
                <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08]">
                  <img
                    src="/Luka.png"
                    alt="Luka"
                    className="h-7 w-7 object-contain"
                  />
                </div>

                <h2 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">
                  Tu negocio ya tiene mucho que hacer.
                  <br />
                  <span className="text-emerald-300">
                    Déjale la gestión a Luka.
                  </span>
                </h2>

                <p className="mx-auto mt-6 max-w-2xl text-sm font-medium leading-relaxed text-white/60 sm:text-base">
                  Empieza gratis y descubre una forma más sencilla de entender
                  lo que pasa en tu negocio.
                </p>

                <Link
                  to="/register"
                  className="group mt-8 inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-extrabold text-slate-950 shadow-[0_20px_60px_-20px_rgba(255,255,255,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_70px_-20px_rgba(255,255,255,0.4)]"
                >
                  Comenzar gratis
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-white transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </div>
            </div>
          </section>
        </main>

        <CoworkingFooterSection />
        <LukaFloatingChat />
        </div>
      </div>
    </LukaChatProvider>
  );
}
