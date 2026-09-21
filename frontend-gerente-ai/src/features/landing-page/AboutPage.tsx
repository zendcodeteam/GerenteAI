import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Compass,
  HeartHandshake,
  Lightbulb,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router";

import { CoworkingFooterSection } from "./components/CoworkingFooterSection";
import { CoworkingNavbar } from "./components/CoworkingNavbar";

const values = [
  {
    icon: Lightbulb,
    title: "Claridad antes que complejidad",
    description: "Convertimos datos y movimientos cotidianos en respuestas que cualquier persona puede entender y usar.",
  },
  {
    icon: HeartHandshake,
    title: "Cerca de quien emprende",
    description: "Diseñamos para la realidad de los micronegocios: poco tiempo, muchas decisiones y herramientas que deben ayudar de verdad.",
  },
  {
    icon: ShieldCheck,
    title: "Confianza en cada dato",
    description: "Tratamos la información de cada negocio con responsabilidad, privacidad y controles pensados para protegerla.",
  },
];

export function AboutPage() {
  return (
    <div className="min-h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-[#070B12] dark:text-slate-50">
      <CoworkingNavbar />

      <main>
        <section className="relative overflow-hidden px-6 pb-20 pt-36 sm:pt-44 md:px-12 md:pb-28">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-180px] h-[600px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[140px] dark:bg-emerald-500/[0.1]" />
            <div className="absolute bottom-[-170px] right-[-100px] h-[380px] w-[380px] rounded-full bg-cyan-400/[0.04] blur-[120px] dark:bg-cyan-400/[0.06]" />
          </div>

          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07] dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
              <span>Sobre Luka</span>
            </div>
            <h1 className="text-5xl font-extrabold leading-[0.98] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-6xl md:text-7xl">
              Tecnología que entiende
              <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">cómo trabajas.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
              Luka nace para que los negocios pequeños puedan tomar decisiones con la misma claridad que las empresas grandes, sin procesos complicados ni palabras difíciles.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }} className="relative mx-auto mt-14 grid max-w-7xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative overflow-hidden rounded-[34px] bg-[#063A35] p-8 text-white shadow-[0_35px_100px_-50px_rgba(6,58,53,0.8)] sm:p-12">
              <div className="pointer-events-none absolute right-[-100px] top-[-130px] h-[360px] w-[360px] rounded-full bg-emerald-300/[0.12] blur-[110px]" />
              <div className="relative max-w-2xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">Nuestra razón de ser</p>
                <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">Tu negocio ya tiene el contexto. Luka lo vuelve visible.</h2>
                <p className="mt-5 text-sm font-medium leading-7 text-white/65 sm:text-base">Creemos que administrar un negocio no debería sentirse como perseguir números en hojas sueltas. Luka conecta las conversaciones, los movimientos y las preguntas del día a día para ayudarte a avanzar con más seguridad.</p>
              </div>
            </div>
            <div className="flex flex-col justify-between rounded-[34px] border border-slate-200/80 bg-white/70 p-8 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><BrainCircuit className="h-6 w-6" /></div>
              <div className="mt-10"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Hecho en Cali</p><p className="mt-3 text-2xl font-extrabold leading-tight tracking-[-0.03em] text-slate-950 dark:text-white">Inteligencia útil para Latinoamérica.</p></div>
            </div>
          </motion.div>
        </section>

        <section className="px-6 pb-20 md:px-12 md:pb-28">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
            <article className="rounded-[30px] border border-slate-200/80 bg-white/70 p-8 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-10">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400"><Compass className="h-5 w-5" /><span className="text-xs font-extrabold uppercase tracking-[0.18em]">Misión</span></div>
              <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">Hacer más simple decidir bien.</h2>
              <p className="mt-5 text-base font-medium leading-7 text-slate-600 dark:text-slate-400">Nuestra misión es ayudar a los micronegocios a organizar su operación, entender sus números y tomar decisiones más claras mediante conversaciones simples e inteligencia artificial responsable.</p>
            </article>
            <article className="rounded-[30px] border border-slate-200/80 bg-white/70 p-8 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-10">
              <div className="flex items-center gap-3 text-cyan-600 dark:text-cyan-400"><ArrowUpRight className="h-5 w-5" /><span className="text-xs font-extrabold uppercase tracking-[0.18em]">Visión</span></div>
              <h2 className="mt-6 text-3xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">Que ningún negocio decida a ciegas.</h2>
              <p className="mt-5 text-base font-medium leading-7 text-slate-600 dark:text-slate-400">Imaginamos una Latinoamérica donde cada persona que emprende tenga acceso a herramientas cercanas, inteligentes y confiables para construir un negocio más sostenible.</p>
            </article>
          </div>
        </section>

        <section className="px-6 pb-24 md:px-12 md:pb-32">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Lo que nos guía</p><h2 className="mt-4 text-4xl font-extrabold tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl">Construimos con intención.</h2></div>
            <div className="grid gap-4 md:grid-cols-3">
              {values.map(({ icon: Icon, title, description }, index) => (
                <motion.article key={title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ delay: index * 0.08 }} className="rounded-[28px] border border-slate-200/80 bg-white/70 p-7 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-7 text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">{title}</h3>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 md:px-12 md:pb-32">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/70 p-8 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-10 lg:p-14">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Datos legales</p><h2 className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-slate-950 dark:text-white">Una empresa real detrás de Luka.</h2><p className="mt-4 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">Luka AI es un producto de Zendcode S.A.S., construido en Cali, Colombia.</p></div>
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Razón social", "Zendcode S.A.S."],
                  ["NIT", "902099074"],
                  ["Domicilio", "Cali, Valle del Cauca, Colombia"],
                  ["Dirección", "Carrera 17B No. 18-68"],
                  ["Correo", "zendcodeco@gmail.com"],
                  ["Producto", "Luka AI"],
                ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/50"><dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{label}</dt><dd className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200">{value}</dd></div>)}
              </dl>
            </div>
            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200/80 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"><p className="text-sm font-medium text-slate-500 dark:text-slate-400">¿Quieres conocer más sobre Luka?</p><Link to="/contacto" className="inline-flex items-center gap-2 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">Contáctanos <ArrowRight className="h-4 w-4" /></Link></div>
          </div>
        </section>
      </main>

      <CoworkingFooterSection />
    </div>
  );
}
