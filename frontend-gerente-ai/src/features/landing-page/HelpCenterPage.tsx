import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  MessageCircle,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { Link } from "react-router";

import { CoworkingFooterSection } from "./components/CoworkingFooterSection";
import { CoworkingNavbar } from "./components/CoworkingNavbar";

const categories = [
  { name: "Todos", icon: BookOpen },
  { name: "Primeros pasos", icon: Sparkles },
  { name: "Ventas y gastos", icon: ReceiptText },
  { name: "Reportes", icon: BarChart3 },
  { name: "Cuenta y seguridad", icon: ShieldCheck },
];

const articles = [
  {
    category: "Primeros pasos",
    question: "¿Qué es Luka y cómo puede ayudarme?",
    answer:
      "Luka es un gerente financiero para micronegocios. Puedes contarle por WhatsApp lo que ocurre en tu negocio y Luka organiza ventas, gastos, clientes y reportes para que entiendas mejor tus números.",
  },
  {
    category: "Primeros pasos",
    question: "¿Cómo empiezo a usar Luka?",
    answer:
      "Crea tu cuenta, registra tu negocio y configura tu primera sede. Desde ese momento puedes registrar movimientos, consultar indicadores y conversar con Luka sobre la operación diaria.",
  },
  {
    category: "Primeros pasos",
    question: "¿Necesito saber de contabilidad?",
    answer:
      "No. Luka está pensado para hablar en lenguaje cotidiano. Puedes escribir algo como 'vendí 80.000 hoy' o 'gasté 35.000 en insumos' y el sistema te ayuda a convertirlo en información organizada.",
  },
  {
    category: "Ventas y gastos",
    question: "¿Cómo registro una venta o un gasto?",
    answer:
      "Puedes registrarlo desde el dashboard o escribirle a Luka por WhatsApp. Indica qué ocurrió, el valor y, cuando sea necesario, el cliente, producto o categoría. Revisa el resumen antes de confirmar el movimiento.",
  },
  {
    category: "Ventas y gastos",
    question: "¿Puedo registrar ventas fiadas y abonos?",
    answer:
      "Sí. Luka permite registrar ventas fiadas, consultar el saldo pendiente por cliente y guardar los abonos para mantener tu cartera actualizada.",
  },
  {
    category: "Ventas y gastos",
    question: "¿Cómo consulto mis mayores gastos?",
    answer:
      "Pregúntale a Luka por tus gastos del periodo que quieras o revisa el flujo de caja. Puedes comparar categorías, compras y egresos para detectar dónde se concentra la salida de dinero.",
  },
  {
    category: "Reportes",
    question: "¿Qué reportes puedo consultar?",
    answer:
      "Puedes consultar ventas, gastos, flujo de caja, balance, rentabilidad y cuentas por cobrar. La disponibilidad depende del plan y de la información registrada en tu negocio.",
  },
  {
    category: "Reportes",
    question: "¿Luka me dice si estoy ganando dinero?",
    answer:
      "Luka puede calcular un balance y ayudarte a interpretar el margen de rentabilidad a partir de tus ingresos, compras y gastos registrados. La calidad del análisis depende de que tus movimientos estén completos.",
  },
  {
    category: "Cuenta y seguridad",
    question: "¿Cómo protege Luka la información de mi negocio?",
    answer:
      "Luka aplica controles de autenticación, permisos y aislamiento por negocio. Tu información financiera se mantiene vinculada a tu cuenta y a los negocios a los que tienes acceso.",
  },
  {
    category: "Cuenta y seguridad",
    question: "¿Puedo gestionar más de un negocio o sede?",
    answer:
      "Sí. Según tu acceso y plan, puedes cambiar entre negocios y sedes desde la navegación. Cada sede mantiene sus movimientos para que los reportes no mezclen operaciones.",
  },
];

function CategoryIcon({ category }: { category: string }) {
  const item = categories.find(({ name }) => name === category);
  const Icon = item?.icon ?? CircleHelp;
  return <Icon className="h-4 w-4" />;
}

export function HelpCenterPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [openQuestion, setOpenQuestion] = useState<string | null>(articles[0].question);

  const filteredArticles = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return articles.filter((article) => {
      const matchesCategory = activeCategory === "Todos" || article.category === activeCategory;
      const matchesSearch =
        !normalizedSearch ||
        `${article.question} ${article.answer} ${article.category}`.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("Todos");
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-[#070B12] dark:text-slate-50">
      <CoworkingNavbar />

      <main>
        <section className="relative overflow-hidden px-6 pb-14 pt-36 sm:pt-44 md:px-12 md:pb-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-[-190px] h-[600px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/[0.07] blur-[140px] dark:bg-emerald-500/[0.1]" />
            <div className="absolute right-[-160px] top-[28%] h-[420px] w-[420px] rounded-full bg-cyan-400/[0.04] blur-[130px] dark:bg-cyan-400/[0.06]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative mx-auto max-w-4xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07] dark:text-emerald-400">
              <CircleHelp className="h-4 w-4" />
              <span>Estamos para ayudarte</span>
            </div>

            <h1 className="text-5xl font-extrabold leading-[0.98] tracking-[-0.055em] text-slate-950 dark:text-white sm:text-6xl md:text-7xl">
              Respuestas claras.
              <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">Negocios más tranquilos.</span>
            </h1>

            <p className="mx-auto mt-7 max-w-2xl text-base font-medium leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
              Encuentra respuestas sobre Luka, tus movimientos y la forma de entender mejor lo que pasa en tu negocio.
            </p>

            <label className="relative mx-auto mt-9 block max-w-2xl text-left">
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Busca una pregunta, tema o palabra clave"
                aria-label="Buscar en el centro de ayuda"
                className="h-16 w-full rounded-[22px] border border-slate-200 bg-white/80 pl-14 pr-14 text-sm font-medium text-slate-900 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.4)] outline-none backdrop-blur-xl transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-slate-500"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda" className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>
          </motion.div>
        </section>

        <section className="px-6 pb-20 md:px-12 md:pb-28">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[250px_1fr] lg:gap-14">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">
                <ClipboardList className="h-4 w-4" />
                Explora por tema
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible">
                {categories.map(({ name, icon: Icon }) => {
                  const active = activeCategory === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setActiveCategory(name)}
                      className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition ${active ? "bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950" : "text-slate-500 hover:bg-white hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"}`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-emerald-400 dark:text-emerald-600" : "text-slate-400"}`} />
                      {name}
                    </button>
                  );
                })}
              </div>
            </aside>

            <div>
              <div className="mb-5 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {filteredArticles.length} {filteredArticles.length === 1 ? "respuesta" : "respuestas"}
                </p>
                {(search || activeCategory !== "Todos") && (
                  <button type="button" onClick={clearFilters} className="text-xs font-extrabold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400">
                    Limpiar filtros
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filteredArticles.map((article, index) => {
                    const isOpen = openQuestion === article.question;
                    return (
                      <motion.article
                        layout
                        key={article.question}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.25, delay: index * 0.025 }}
                        className={`group overflow-hidden rounded-[24px] border transition-all ${isOpen ? "border-emerald-500/25 bg-white shadow-[0_20px_60px_-40px_rgba(16,185,129,0.45)] dark:border-emerald-400/20 dark:bg-[#101827]" : "border-slate-200/80 bg-white/60 hover:border-slate-300 dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-white/[0.14]"}`}
                      >
                        <button type="button" onClick={() => setOpenQuestion(isOpen ? null : article.question)} aria-expanded={isOpen} className="flex w-full items-center gap-4 px-5 py-5 text-left sm:px-6">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isOpen ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 dark:bg-white/[0.06]"}`}>
                            <CategoryIcon category={article.category} />
                          </span>
                          <span className={`flex-1 text-base font-extrabold tracking-tight ${isOpen ? "text-slate-950 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
                            {article.question}
                          </span>
                          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180 text-emerald-500" : ""}`} />
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                              <div className="border-t border-slate-200/70 px-5 pb-6 pt-5 sm:px-20 dark:border-white/10">
                                <div className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-4 w-4" />
                                  {article.category}
                                </div>
                                <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-400 sm:text-base">{article.answer}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>

              {filteredArticles.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-slate-300 px-6 py-16 text-center dark:border-white/15">
                  <CircleHelp className="mx-auto h-8 w-8 text-slate-400" />
                  <h2 className="mt-4 text-xl font-extrabold text-slate-950 dark:text-white">No encontramos esa respuesta</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">Prueba con otra palabra o escríbenos por WhatsApp y te ayudamos a encontrar el camino.</p>
                  <button type="button" onClick={clearFilters} className="mt-5 rounded-full bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950">Ver todas las respuestas</button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 md:px-12 md:pb-32">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[34px] bg-[#063A35] px-7 py-14 text-center shadow-[0_35px_100px_-50px_rgba(6,58,53,0.8)] sm:px-10 md:px-16 md:py-20">
            <div className="pointer-events-none absolute inset-0"><div className="absolute left-1/2 top-[-180px] h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-300/[0.12] blur-[120px]" /><div className="absolute bottom-[-160px] right-[-80px] h-[320px] w-[320px] rounded-full bg-cyan-300/[0.08] blur-[110px]" /></div>
            <div className="relative z-10 mx-auto max-w-2xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08]"><MessageCircle className="h-5 w-5 text-emerald-300" /></div>
              <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-4xl">¿No encuentras lo que buscas?</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-relaxed text-white/60 sm:text-base">Luka está a un mensaje de distancia. Escríbenos y te ayudamos a resolverlo.</p>
              <a href="https://wa.me/573043904488" target="_blank" rel="noopener noreferrer" className="group mt-7 inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-extrabold text-slate-950 transition hover:-translate-y-0.5">Hablar con Luka <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></a>
            </div>
          </div>
        </section>
      </main>

      <CoworkingFooterSection />
    </div>
  );
}
