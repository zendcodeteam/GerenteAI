import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const faqs = [
  {
    question: "¿Necesito saber de contabilidad para usar Luka AI?",
    answer:
      "No, en absoluto. Nuestra Inteligencia Artificial está diseñada para que cualquier persona pueda gestionar su negocio como un experto sin conocimientos previos.",
  },
  {
    question: "¿Cómo funciona el registro por WhatsApp?",
    answer:
      "Simplemente nos escribes como si hablaras con un amigo: 'Gasté 50.000 en insumos hoy'. Nuestro asistente lo clasifica y lo registra en tu dashboard automáticamente.",
  },
  {
    question: "¿Qué tan seguros están mis datos?",
    answer:
      "Utilizamos encriptación de nivel bancario. Nadie más tiene acceso a tu información financiera y nunca la compartiremos con terceros.",
  },
  {
    question: "¿Puedo cambiar de plan más adelante?",
    answer:
      "Sí, puedes mejorar o cancelar tu plan en cualquier momento desde la configuración de tu cuenta sin penalizaciones.",
  },
];

export function CoworkingFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative -mt-13 overflow-hidden px-6 pb-24 pt-0 md:-mt-19 md:px-12 md:pb-32 md:pt-0"
    >
      {/* =====================================================
          AMBIENT BACKGROUND
      ===================================================== */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[20%] h-[320px] w-[320px] rounded-full bg-emerald-500/[0.035] blur-[120px] dark:bg-emerald-500/[0.05]" />

        <div className="absolute right-[5%] top-[30%] h-[420px] w-[420px] rounded-full bg-cyan-500/[0.035] blur-[140px] dark:bg-cyan-500/[0.045]" />

        <div className="absolute bottom-[-180px] left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-emerald-500/[0.025] blur-[140px] dark:bg-emerald-500/[0.04]" />
      </div>

      {/* =====================================================
          GRAN CONTENEDOR
      ===================================================== */}
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[40px] border border-slate-200/80 bg-white/35 px-6 py-12 shadow-[0_30px_100px_-50px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#101827]/65 dark:shadow-[0_30px_100px_-50px_rgba(0,0,0,0.7)] sm:px-10 sm:py-16 md:px-14 md:py-20 lg:px-16 lg:py-24">

        {/* =====================================================
            GLOW INTERNO
        ===================================================== */}
        <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-emerald-500/[0.035] blur-[110px] dark:bg-emerald-500/[0.045]" />

        <div className="relative z-10">

          {/* =================================================
              HEADER CENTRADO
          ================================================= */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            {/* Badge */}
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-2 text-sm font-semibold text-emerald-600 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07] dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />

              <span>Estamos para ayudarte</span>
            </div>

            {/* Title */}
            <h2 className="text-4xl font-extrabold leading-[1.02] tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl md:text-6xl">
              ¿Tienes preguntas?
              <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                Luka tiene respuestas.
              </span>
            </h2>

            {/* Description */}
            <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
              Todo lo que necesitas saber antes de empezar a llevar tu negocio
              de una forma más inteligente.
            </p>
          </motion.div>

          {/* =================================================
              SEPARADOR DECORATIVO
          ================================================= */}
          <div className="mx-auto mt-14 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-emerald-500/30" />

            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/15 bg-emerald-500/[0.06]">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
            </div>

            <div className="h-px w-16 bg-gradient-to-l from-transparent to-emerald-500/30" />
          </div>

          {/* =================================================
              FAQ LIST
          ================================================= */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mx-auto mt-12 max-w-5xl"
          >
            <div className="grid gap-3">
              {faqs.map((faq, i) => {
                const isOpen = openIndex === i;

                return (
                  <motion.div
                    key={faq.question}
                    layout
                    className={`group relative overflow-hidden rounded-[24px] border transition-all duration-300 ${
                      isOpen
                        ? "border-emerald-500/25 bg-white shadow-[0_20px_60px_-35px_rgba(16,185,129,0.35)] dark:border-emerald-400/20 dark:bg-slate-900/95"
                        : "border-slate-200/80 bg-white/65 hover:border-slate-300 hover:bg-white dark:border-white/[0.08] dark:bg-slate-900/55 dark:hover:border-white/[0.14] dark:hover:bg-slate-900/75"
                    }`}
                  >
                    {/* Active glow */}
                    {isOpen && (
                      <div className="pointer-events-none absolute right-[-100px] top-[-100px] h-[220px] w-[220px] rounded-full bg-emerald-400/[0.07] blur-[70px]" />
                    )}

                    {/* Question */}
                    <button
                      type="button"
                      onClick={() =>
                        setOpenIndex(isOpen ? null : i)
                      }
                      className="relative z-10 flex w-full cursor-pointer items-center gap-5 px-5 py-5 text-left sm:px-7 sm:py-6"
                    >
                      {/* Number */}
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-extrabold tracking-[0.08em] transition-all duration-300 ${
                          isOpen
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                            : "bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 dark:bg-slate-800 dark:text-slate-500 dark:group-hover:bg-emerald-500/10 dark:group-hover:text-emerald-400"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </div>

                      {/* Question text */}
                      <span
                        className={`flex-1 pr-2 text-base font-extrabold tracking-tight transition-colors sm:text-lg md:text-xl ${
                          isOpen
                            ? "text-slate-950 dark:text-white"
                            : "text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        {faq.question}
                      </span>

                      {/* Chevron */}
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                          isOpen
                            ? "rotate-180 border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-emerald-300 group-hover:text-emerald-600 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:border-emerald-500/30 dark:group-hover:text-emerald-400"
                        }`}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </button>

                    {/* Answer */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{
                            height: 0,
                            opacity: 0,
                          }}
                          animate={{
                            height: "auto",
                            opacity: 1,
                          }}
                          exit={{
                            height: 0,
                            opacity: 0,
                          }}
                          transition={{
                            height: {
                              duration: 0.35,
                              ease: [0.22, 1, 0.36, 1],
                            },
                            opacity: {
                              duration: 0.2,
                            },
                          }}
                        >
                          <div className="relative z-10 px-5 pb-6 sm:px-7 sm:pb-7">
                            <div className="border-l-2 border-emerald-500/30 pl-5 sm:ml-[64px]">
                              <p className="max-w-4xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-400 sm:text-base">
                                {faq.answer}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* =================================================
              BOTTOM CTA
          ================================================= */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-[26px] border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-cyan-500/[0.08] p-6 dark:border-emerald-400/10 sm:p-7"
          >
            <div className="flex flex-col items-start justify-between gap-5 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-emerald-500" />

                  <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                    ¿Aún tienes dudas?
                  </span>
                </div>

                <h3 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  Pregúntale directamente a Luka.
                </h3>

                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Estamos a un mensaje de distancia.
                </p>
              </div>

              <a
                href="https://wa.me/573043904488"
                className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl dark:bg-white dark:text-slate-950"
              >
                Hablar con Luka

                <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}