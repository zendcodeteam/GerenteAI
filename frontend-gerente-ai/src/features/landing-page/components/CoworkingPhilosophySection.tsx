import { motion, useReducedMotion } from "motion/react";
import {
  ArrowDownRight,
  BarChart3,
  BrainCircuit,
  Check,
  MessageCircle,
  Package,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Luka entiende",
    description:
      "La inteligencia artificial interpreta lo que le cuentas y entiende el contexto de tu negocio.",
    type: "understand",
  },
  {
    number: "02",
    title: "Luka organiza",
    description:
      "Ventas, gastos, inventario y clientes quedan organizados automáticamente.",
    type: "organize",
  },
  {
    number: "03",
    title: "Pregunta lo que quieras",
    description:
      "Consulta tus resultados, compara periodos y descubre qué está pasando en tu negocio.",
    type: "ask",
  },
  {
    number: "04",
    title: "Toma mejores decisiones",
    description:
      "Luka transforma tus datos en información útil para ayudarte a hacer crecer tu negocio.",
    type: "decide",
  },
];

function PhoneShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative h-[320px] w-[164px] rounded-[2rem] border-[4px] border-slate-200 bg-white p-[4px] shadow-[0_28px_65px_-22px_rgba(0,0,0,0.18)] dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_28px_65px_-22px_rgba(0,0,0,0.8)] ${className}`}
    >
      {/* Dynamic Island */}
      <div className="absolute left-1/2 top-[7px] z-40 h-[15px] w-[58px] -translate-x-1/2 rounded-full bg-black" />

      {/* Screen */}
      <div className="relative h-full w-full overflow-hidden rounded-[1.55rem] bg-[#f4f6f8]">
        {children}
      </div>
    </div>
  );
}

function WhatsAppHeader() {
  return (
    <div className="flex h-[52px] items-end gap-2 bg-[#075E54] px-2.5 pb-2 pt-5 text-white">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
        <MessageCircle className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 leading-tight">
        <p className="truncate text-[8px] font-bold">Luka AI</p>

        <p className="text-[6.5px] text-white/70">en línea</p>
      </div>
    </div>
  );
}

function MessageBubble({
  children,
  incoming = false,
}: {
  children: React.ReactNode;
  incoming?: boolean;
}) {
  return (
    <div
      className={`max-w-[122px] rounded-[13px] px-2.5 py-1.5 text-[7px] leading-[1.45] shadow-sm ${
        incoming
          ? "rounded-tl-[4px] bg-white text-slate-700"
          : "ml-auto rounded-tr-[4px] bg-[#d9ffc9] text-slate-700"
      }`}
    >
      {children}
    </div>
  );
}

function UnderstandPhone() {
  return (
    <PhoneShell className="rotate-[2deg]">
      <WhatsAppHeader />

      <div className="space-y-2 bg-[#e5ddd5] p-2.5 pt-3">
        <MessageBubble>
          Hoy vendí 8 almuerzos y gasté $120.000.
        </MessageBubble>

        <div className="rounded-[13px] rounded-tl-[4px] bg-white p-2.5 shadow-sm">
          <div className="mb-2 flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
              <BrainCircuit className="h-3 w-3 text-emerald-600" />
            </div>

            <div>
              <p className="text-[7px] font-bold text-slate-800">
                Luka entiende
              </p>

              <p className="text-[5.5px] text-slate-400">
                Analizando información
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="rounded-lg bg-slate-50 px-2 py-1 text-[6px] text-slate-500">
              ✓ Ventas detectadas
            </div>

            <div className="rounded-lg bg-slate-50 px-2 py-1 text-[6px] text-slate-500">
              ✓ Gasto detectado
            </div>

            <div className="rounded-lg bg-emerald-50 px-2 py-1 text-[6px] font-semibold text-emerald-700">
              ✓ Información comprendida
            </div>
          </div>
        </div>

        <MessageBubble incoming>
          Entendí. Registraré las ventas y el gasto en tu negocio.
        </MessageBubble>
      </div>
    </PhoneShell>
  );
}

function OrganizePhone() {
  return (
    <PhoneShell className="rotate-[-1deg]">
      <div className="bg-slate-950 px-3 pb-3 pt-9 text-white">
        <p className="text-[6px] text-white/50">Luka AI</p>

        <p className="mt-0.5 text-[11px] font-bold">Tu negocio</p>
      </div>

      <div className="space-y-2 bg-slate-50 p-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-xl bg-white p-2 shadow-sm">
            <Wallet className="h-3 w-3 text-emerald-500" />

            <p className="mt-2 text-[6px] text-slate-400">Ventas</p>

            <p className="text-[11px] font-extrabold text-slate-800">
              $428K
            </p>
          </div>

          <div className="rounded-xl bg-white p-2 shadow-sm">
            <Package className="h-3 w-3 text-blue-500" />

            <p className="mt-2 text-[6px] text-slate-400">Inventario</p>

            <p className="text-[11px] font-extrabold text-slate-800">
              128
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[7px] font-bold text-slate-700">
              Movimientos recientes
            </p>

            <BarChart3 className="h-3 w-3 text-emerald-500" />
          </div>

          <div className="mt-2.5 space-y-1.5">
            {[
              ["Venta", "+$85.000"],
              ["Compra", "-$40.000"],
              ["Venta", "+$62.000"],
              ["Gasto", "-$25.000"],
            ].map(([label, value]) => (
              <div
                key={`${label}-${value}`}
                className="flex items-center justify-between border-b border-slate-100 pb-1"
              >
                <span className="text-[6px] text-slate-400">
                  {label}
                </span>

                <span
                  className={`text-[6px] font-bold ${
                    value.startsWith("+")
                      ? "text-emerald-600"
                      : "text-slate-600"
                  }`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}

function AskPhone() {
  return (
    <PhoneShell className="rotate-[2deg]">
      <WhatsAppHeader />

      <div className="flex h-[calc(100%-52px)] flex-col justify-end gap-1.5 bg-[#e5ddd5] p-2.5 pb-3">
        <MessageBubble incoming>
          Puedes preguntarme cualquier cosa sobre tu negocio.
        </MessageBubble>

        <MessageBubble>¿Cuánto vendí esta semana?</MessageBubble>

        <MessageBubble incoming>
          Esta semana vendiste{" "}
          <span className="font-bold">$1.840.000</span>.
        </MessageBubble>

        <MessageBubble>
          ¿Cuál fue mi producto más vendido?
        </MessageBubble>

        <MessageBubble incoming>
          El arroz, con 47 unidades.
        </MessageBubble>

        <div className="mt-0.5 h-7 rounded-full bg-white px-3 py-1.5 text-[6.5px] text-slate-400 shadow-sm">
          Pregúntale a Luka...
        </div>
      </div>
    </PhoneShell>
  );
}

function DecisionPhone() {
  return (
    <PhoneShell className="rotate-[-2deg]">
      <div className="bg-gradient-to-br from-emerald-700 to-teal-500 px-3 pb-4 pt-9 text-white">
        <p className="text-[6px] text-white/70">Luka AI</p>

        <p className="mt-0.5 text-[11px] font-bold">
          Una oportunidad
        </p>
      </div>

      <div className="space-y-2 bg-slate-50 p-2.5">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-emerald-500" />

            <p className="text-[7px] font-bold text-slate-700">
              Insight de Luka
            </p>
          </div>

          <p className="mt-3 text-[16px] font-extrabold text-slate-900">
            +18.4%
          </p>

          <p className="mt-0.5 text-[6px] leading-relaxed text-slate-400">
            Tus ventas crecieron frente a la semana anterior.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-[6px] font-bold text-emerald-700">
            Recomendación
          </p>

          <p className="mt-1.5 text-[6.5px] leading-relaxed text-emerald-800">
            Considera aumentar el inventario de tus productos más
            vendidos.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg bg-white p-2 shadow-sm">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-3 w-3 text-emerald-600" />
          </div>

          <p className="text-[6px] font-semibold text-slate-600">
            Decisiones basadas en tus datos.
          </p>
        </div>
      </div>
    </PhoneShell>
  );
}

function StepPhone({ type }: { type: string }) {
  switch (type) {
    case "understand":
      return <UnderstandPhone />;

    case "organize":
      return <OrganizePhone />;

    case "ask":
      return <AskPhone />;

    case "decide":
      return <DecisionPhone />;

    default:
      return null;
  }
}

function Connector() {
  return (
    <motion.div
      className="pointer-events-none absolute right-[-42px] top-[58%] z-20 hidden w-[84px] xl:block"
      initial={{ opacity: 0, pathLength: 0 }}
      whileInView={{ opacity: 1, pathLength: 1 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{
        opacity: {
          duration: 0.35,
          delay: 0.55,
        },
        pathLength: {
          duration: 0.9,
          delay: 0.45,
          ease: "easeInOut",
        },
      }}
    >
      <svg
        viewBox="0 0 84 55"
        fill="none"
        className="h-auto w-full overflow-visible"
      >
        <motion.path
          d="M2 8 C27 8, 34 47, 68 47"
          stroke="#00C896"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="4 6"
          opacity="0.8"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.9,
            delay: 0.35,
            ease: "easeInOut",
          }}
        />

        <motion.path
          d="M61 40 L69 47 L61 54"
          stroke="#00C896"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.35,
            delay: 1.05,
            ease: "backOut",
          }}
        />
      </svg>
    </motion.div>
  );
}

function AnimatedPhone({
  type,
  index,
}: {
  type: string;
  index: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  const directions = [
    { x: -45, y: 30, rotate: -4 },
    { x: 45, y: 30, rotate: 4 },
    { x: -45, y: 30, rotate: -4 },
    { x: 45, y: 30, rotate: 4 },
  ];

  const direction = directions[index] ?? directions[0];

  return (
    <motion.div
      initial={
        shouldReduceMotion
          ? false
          : {
              opacity: 0,
              x: direction.x,
              y: direction.y,
              scale: 0.88,
              rotate: direction.rotate,
              filter: "blur(8px)",
            }
      }
      whileInView={
        shouldReduceMotion
          ? undefined
          : {
              opacity: 1,
              x: 0,
              y: 0,
              scale: 1,
              rotate: 0,
              filter: "blur(0px)",
            }
      }
      whileHover={
        shouldReduceMotion
          ? undefined
          : {
              y: -8,
              scale: 1.025,
              rotate: index % 2 === 0 ? 1.5 : -1.5,
            }
      }
      viewport={{
        once: true,
        amount: 0.3,
      }}
      transition={{
        duration: 0.9,
        delay: 0.15 + index * 0.16,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative will-change-transform"
    >
      <motion.div
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                scale: 0.92,
              }
        }
        whileInView={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 1,
                scale: 1,
              }
        }
        viewport={{
          once: true,
          amount: 0.35,
        }}
        transition={{
          duration: 0.55,
          delay: 0.35 + index * 0.16,
          ease: "easeOut",
        }}
      >
        <StepPhone type={type} />
      </motion.div>

      {!shouldReduceMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[15%] bottom-[-18px] h-6 rounded-full bg-emerald-500/10 blur-xl dark:bg-emerald-400/10"
          initial={{
            opacity: 0,
            scaleX: 0.5,
          }}
          whileInView={{
            opacity: 1,
            scaleX: 1,
          }}
          viewport={{
            once: true,
            amount: 0.35,
          }}
          transition={{
            duration: 0.65,
            delay: 0.55 + index * 0.16,
          }}
        />
      )}
    </motion.div>
  );
}

export function CoworkingPhilosophySection() {
  const shouldReduceMotion = useReducedMotion();

  const headerVariants = {
    hidden: {
      opacity: 0,
      y: 35,
      filter: "blur(7px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
    },
  };

  return (
    <section
      className="
        relative
        mt-6
        overflow-hidden
        px-6
        pb-24
        pt-0
        text-slate-950

        dark:text-white

        md:px-12
        md:pb-32
      "
    >
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-[15%] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-emerald-500/[0.045] blur-[140px] dark:bg-emerald-500/[0.06]"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  scale: [1, 1.08, 1],
                  opacity: [0.7, 1, 0.7],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : {
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        />

        <motion.div
          className="absolute left-[-160px] top-[45%] h-[340px] w-[340px] rounded-full bg-teal-500/[0.025] blur-[120px] dark:bg-teal-500/[0.035]"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [0, 35, 0],
                  y: [0, -20, 0],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : {
                  duration: 10,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        />

        <motion.div
          className="absolute right-[-140px] top-[30%] h-[380px] w-[380px] rounded-full bg-cyan-500/[0.025] blur-[140px] dark:bg-cyan-500/[0.03]"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  x: [0, -30, 0],
                  y: [0, 25, 0],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : {
                  duration: 11,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        />
      </div>

      {/* Same page margins as the rest of the landing page */}
      <div className="relative mx-auto w-full max-w-7xl">
        {/* =======================================================
            HEADER
            ======================================================= */}

        <motion.div
          className="
            w-full
            max-w-4xl
            text-left

            xl:mx-auto
            xl:text-center
          "
          initial={shouldReduceMotion ? false : "hidden"}
          whileInView={shouldReduceMotion ? undefined : "visible"}
          viewport={{
            once: true,
            amount: 0.35,
          }}
          variants={headerVariants}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <motion.div
            className="
              mb-6
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-emerald-600/15
              bg-emerald-500/[0.06]
              px-4
              py-2
              text-sm
              font-semibold
              text-emerald-600

              dark:border-emerald-400/15
              dark:bg-emerald-400/[0.07]
              dark:text-emerald-400
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    scale: 0.8,
                    y: 12,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }
            }
            viewport={{
              once: true,
              amount: 0.5,
            }}
            transition={{
              duration: 0.55,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Sparkles className="h-4 w-4" />

            <span>Así de simple</span>
          </motion.div>

          <motion.h2
            className="
              text-4xl
              font-extrabold
              leading-[1.02]
              tracking-[-0.04em]
              text-slate-950

              dark:text-white

              sm:text-5xl
              md:text-6xl
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 28,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    y: 0,
                  }
            }
            viewport={{
              once: true,
              amount: 0.5,
            }}
            transition={{
              duration: 0.75,
              delay: 0.08,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            De una conversación
            <br />
            a un negocio{" "}
            <span className="text-emerald-500 dark:text-emerald-400">
              bajo control.
            </span>
          </motion.h2>

          <motion.p
            className="
              mt-6
              max-w-2xl
              text-base
              leading-relaxed
              text-slate-600

              dark:text-slate-400

              md:text-lg

              xl:mx-auto
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 20,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    y: 0,
                  }
            }
            viewport={{
              once: true,
              amount: 0.5,
            }}
            transition={{
              duration: 0.65,
              delay: 0.18,
              ease: "easeOut",
            }}
          >
            Todo empieza con un mensaje de WhatsApp. Luka entiende lo que
            necesitas, organiza la información y te ayuda a tomar mejores
            decisiones.
          </motion.p>
        </motion.div>

        {/* =======================================================
            DESKTOP FLOW
            ======================================================= */}

        <div className="relative mt-24 hidden xl:block">
          <div className="grid grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                className="relative flex min-w-0 flex-col"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 25,
                      }
                }
                whileInView={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        y: 0,
                      }
                }
                viewport={{
                  once: true,
                  amount: 0.25,
                }}
                transition={{
                  duration: 0.7,
                  delay: 0.12 + index * 0.14,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* Step heading */}
                <motion.div
                  className="mb-9 text-center"
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 18,
                        }
                  }
                  whileInView={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 1,
                          y: 0,
                        }
                  }
                  viewport={{
                    once: true,
                    amount: 0.35,
                  }}
                  transition={{
                    duration: 0.6,
                    delay: 0.22 + index * 0.14,
                    ease: "easeOut",
                  }}
                >
                  <motion.span
                    className="inline-block text-[10px] font-bold tracking-[0.25em] text-emerald-500 dark:text-emerald-400"
                    initial={
                      shouldReduceMotion
                        ? false
                        : {
                            opacity: 0,
                            letterSpacing: "0.05em",
                          }
                    }
                    whileInView={
                      shouldReduceMotion
                        ? undefined
                        : {
                            opacity: 1,
                            letterSpacing: "0.25em",
                          }
                    }
                    viewport={{
                      once: true,
                    }}
                    transition={{
                      duration: 0.65,
                      delay: 0.3 + index * 0.14,
                    }}
                  >
                    PASO {step.number}
                  </motion.span>

                  <h3
                    className="
                      mx-auto
                      mt-2.5
                      max-w-[210px]
                      text-xl
                      font-extrabold
                      leading-tight
                      tracking-tight
                      text-slate-950

                      dark:text-white
                    "
                  >
                    {step.title}
                  </h3>

                  <p
                    className="
                      mx-auto
                      mt-2.5
                      max-w-[220px]
                      text-xs
                      leading-relaxed
                      text-slate-600

                      dark:text-slate-400
                    "
                  >
                    {step.description}
                  </p>
                </motion.div>

                {/* Animated mini-section / phone */}
                <div className="flex justify-center">
                  <AnimatedPhone
                    type={step.type}
                    index={index}
                  />
                </div>

                {/* Connector */}
                {index < steps.length - 1 && <Connector />}
              </motion.div>
            ))}
          </div>
        </div>

        {/* =======================================================
            TABLET / MOBILE
            ======================================================= */}

        <div className="mt-20 space-y-16 xl:hidden">
          {steps.map((step, index) => {
            const mobileDirection =
              index % 2 === 0
                ? {
                    x: -35,
                    rotate: -3,
                  }
                : {
                    x: 35,
                    rotate: 3,
                  };

            return (
              <motion.div
                key={step.number}
                className="relative grid items-center gap-10 md:grid-cols-2"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 40,
                      }
                }
                whileInView={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                        y: 0,
                      }
                }
                viewport={{
                  once: true,
                  amount: 0.2,
                }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* Text */}
                <motion.div
                  className={index % 2 === 1 ? "md:order-2" : ""}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          opacity: 0,
                          x: index % 2 === 0 ? -25 : 25,
                        }
                  }
                  whileInView={
                    shouldReduceMotion
                      ? undefined
                      : {
                          opacity: 1,
                          x: 0,
                        }
                  }
                  viewport={{
                    once: true,
                    amount: 0.25,
                  }}
                  transition={{
                    duration: 0.7,
                    delay: 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <motion.span
                    className="inline-block text-xs font-bold tracking-[0.25em] text-emerald-500 dark:text-emerald-400"
                    initial={
                      shouldReduceMotion
                        ? false
                        : {
                            opacity: 0,
                            y: 10,
                          }
                    }
                    whileInView={
                      shouldReduceMotion
                        ? undefined
                        : {
                            opacity: 1,
                            y: 0,
                          }
                    }
                    viewport={{
                      once: true,
                    }}
                    transition={{
                      duration: 0.4,
                      delay: 0.15,
                    }}
                  >
                    PASO {step.number}
                  </motion.span>

                  <h3
                    className="
                      mt-3
                      text-3xl
                      font-extrabold
                      tracking-tight
                      text-slate-950

                      dark:text-white
                    "
                  >
                    {step.title}
                  </h3>

                  <p
                    className="
                      mt-4
                      max-w-md
                      text-base
                      leading-relaxed
                      text-slate-600

                      dark:text-slate-400
                    "
                  >
                    {step.description}
                  </p>
                </motion.div>

                {/* Phone */}
                <div
                  className={`flex ${
                    index % 2 === 1
                      ? "justify-start md:order-1"
                      : "justify-end"
                  }`}
                >
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? false
                        : {
                            opacity: 0,
                            x: mobileDirection.x,
                            y: 35,
                            scale: 0.86,
                            rotate: mobileDirection.rotate,
                            filter: "blur(8px)",
                          }
                    }
                    whileInView={
                      shouldReduceMotion
                        ? undefined
                        : {
                            opacity: 1,
                            x: 0,
                            y: 0,
                            scale: 1,
                            rotate: 0,
                            filter: "blur(0px)",
                          }
                    }
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : {
                            y: -8,
                            scale: 1.025,
                          }
                    }
                    viewport={{
                      once: true,
                      amount: 0.25,
                    }}
                    transition={{
                      duration: 0.9,
                      delay: 0.18,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="relative"
                  >
                    <StepPhone type={step.type} />

                    {!shouldReduceMotion && (
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-[15%] bottom-[-18px] h-6 rounded-full bg-emerald-500/10 blur-xl dark:bg-emerald-400/10"
                        initial={{
                          opacity: 0,
                          scaleX: 0.5,
                        }}
                        whileInView={{
                          opacity: 1,
                          scaleX: 1,
                        }}
                        viewport={{
                          once: true,
                          amount: 0.3,
                        }}
                        transition={{
                          duration: 0.6,
                          delay: 0.5,
                        }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Mobile connector */}
                {index < steps.length - 1 && (
                  <motion.div
                    className="absolute -bottom-12 left-1/2 -translate-x-1/2 md:hidden"
                    initial={
                      shouldReduceMotion
                        ? false
                        : {
                            opacity: 0,
                            y: -6,
                            scale: 0.7,
                          }
                    }
                    whileInView={
                      shouldReduceMotion
                        ? undefined
                        : {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                          }
                    }
                    viewport={{
                      once: true,
                      amount: 0.4,
                    }}
                    transition={{
                      duration: 0.45,
                      delay: 0.5,
                      ease: "backOut",
                    }}
                  >
                    <ArrowDownRight className="h-6 w-6 rotate-45 text-emerald-500/60 dark:text-emerald-500/60" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}