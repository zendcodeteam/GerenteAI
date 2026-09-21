import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Mail,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";

import { CoworkingFooterSection } from "./components/CoworkingFooterSection";
import { CoworkingNavbar } from "./components/CoworkingNavbar";

const contactOptions = [
  {
    icon: MessageCircle,
    eyebrow: "Respuesta rápida",
    title: "Habla con Luka por WhatsApp",
    description:
      "Cuéntanos qué necesitas y nuestro equipo te orienta directamente desde el canal que ya usas todos los días.",
    action: "Abrir WhatsApp",
    href: "https://wa.me/573043904488",
    external: true,
    accent: "emerald",
  },
  {
    icon: Mail,
    eyebrow: "Escríbenos",
    title: "Envíanos un correo",
    description:
      "Para solicitudes, comentarios o información general, puedes escribirnos y responderemos tan pronto como sea posible.",
    action: "Enviar correo",
    href: "mailto:zendcodeco@gmail.com",
    external: false,
    accent: "cyan",
  },
  {
    icon: BriefcaseBusiness,
    eyebrow: "Construyamos juntos",
    title: "Alianzas y oportunidades",
    description:
      "¿Tienes una propuesta para llevar mejores herramientas a más negocios? Queremos conocerla.",
    action: "Proponer una alianza",
    href: "mailto:zendcodeco@gmail.com?subject=Propuesta%20de%20alianza%20con%20Luka",
    external: false,
    accent: "violet",
  },
];

const accentStyles = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
} as const;

export function ContactPage() {
  return (
    <div className="min-h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-[#070B12] dark:text-slate-50">
      <CoworkingNavbar />

      <main>
        <section className="relative overflow-hidden px-6 pb-16 pt-36 sm:pt-44 md:px-12 md:pb-24">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-190px] h-[600px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[140px] dark:bg-emerald-500/[0.1]" />
            <div className="absolute bottom-[-180px] left-[-80px] h-[380px] w-[380px] rounded-full bg-cyan-400/[0.04] blur-[120px] dark:bg-cyan-400/[0.06]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative mx-auto max-w-4xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07] dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
              <span>Estamos a un mensaje de distancia</span>
            </div>

            <h1 className="text-5xl font-extrabold leading-[0.98] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-6xl md:text-7xl">
              Hablemos de tu negocio.
              <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">Estamos para ayudarte.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
              Ya sea que tengas una pregunta, una idea o quieras empezar a usar Luka, encuentra aquí el canal que mejor se adapta a ti.
            </p>
          </motion.div>

          <div className="relative mx-auto mt-14 grid max-w-7xl gap-4 lg:grid-cols-3">
            {contactOptions.map((option, index) => {
              const Icon = option.icon;

              return (
                <motion.article
                  key={option.title}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 + index * 0.08 }}
                  className="group relative flex min-h-[310px] flex-col overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/70 p-7 shadow-[0_30px_80px_-55px_rgba(15,23,42,0.35)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/25 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.055]"
                >
                  <div className="pointer-events-none absolute right-[-65px] top-[-65px] h-44 w-44 rounded-full bg-emerald-500/[0.05] blur-3xl transition-transform duration-700 group-hover:scale-125" />
                  <div className="relative flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accentStyles[option.accent as keyof typeof accentStyles]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-extrabold tracking-[0.16em] text-slate-300 dark:text-slate-600">0{index + 1}</span>
                  </div>

                  <div className="relative mt-8">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">{option.eyebrow}</p>
                    <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-[-0.03em] text-slate-950 dark:text-white">{option.title}</h2>
                    <p className="mt-4 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{option.description}</p>
                  </div>

                  <a
                    href={option.href}
                    target={option.external ? "_blank" : undefined}
                    rel={option.external ? "noopener noreferrer" : undefined}
                    className="group/link relative mt-auto inline-flex items-center gap-2 pt-8 text-sm font-extrabold text-slate-900 transition-colors hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400"
                  >
                    {option.action}
                    <ArrowUpRight className="h-4 w-4 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
                  </a>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="px-6 pb-24 md:px-12 md:pb-32">
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/70 p-7 shadow-[0_30px_100px_-60px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:p-14">
            <div className="pointer-events-none absolute right-[-120px] top-[-120px] h-[360px] w-[360px] rounded-full bg-emerald-500/[0.06] blur-[110px]" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Luka para negocios reales</p>
              </div>
              <h2 className="mt-6 max-w-xl text-3xl font-extrabold leading-tight tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl">Tu operación merece una conversación sencilla.</h2>
              <p className="mt-4 max-w-xl text-base font-medium leading-7 text-slate-600 dark:text-slate-400">Explora cómo Luka puede ayudarte a registrar lo que ocurre, entender tus números y tomar mejores decisiones cada día.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/usos" className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">Ver casos de uso <ArrowRight className="h-4 w-4" /></Link>
                <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-700 transition hover:border-emerald-400 hover:text-emerald-600 dark:border-white/10 dark:text-slate-300 dark:hover:text-emerald-400">Comenzar gratis</Link>
              </div>
            </div>

            <div className="relative rounded-[26px] border border-slate-200/80 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-slate-900/60">
              <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-emerald-500/10"><img src="/Luka redondo.png" alt="Luka AI" className="h-full w-full object-cover" /></div>
                <div><p className="text-sm font-extrabold text-slate-950 dark:text-white">Luka AI</p><p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Siempre lista para ayudarte</p></div>
              </div>
              <div className="space-y-3 pt-4">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-slate-950 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-slate-950">Necesito ayuda con mi negocio.</div>
                <div className="flex gap-3 rounded-2xl rounded-bl-sm border border-emerald-500/15 bg-emerald-500/[0.06] px-4 py-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Claro. Cuéntame qué está pasando y lo revisamos juntos.</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <CoworkingFooterSection />
    </div>
  );
}
