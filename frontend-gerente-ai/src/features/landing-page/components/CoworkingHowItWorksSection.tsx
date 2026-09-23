import { motion, useReducedMotion } from "motion/react";
import {
  MessageCircle,
  BrainCircuit,
  BarChart3,
  ArrowUpRight,
  Sparkles,
  Mic,
  Package,
  TrendingUp,
} from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    title: "3. Habla con Luka",
    description:
      "Escribe o envía audios por WhatsApp como lo haces todos los días.",
  },
  {
    icon: BrainCircuit,
    title: "1. Luka organiza todo",
    description:
      "La IA registra ventas, gastos, inventario, clientes y comprende el contexto de tu negocio.",
  },
  {
    icon: BarChart3,
    title: "2. Toma mejores decisiones",
    description:
      "Consulta reportes y recibe recomendaciones inteligentes.",
  },
];

/* =========================================================
   TELÉFONO — WHATSAPP
   ========================================================= */

function WhatsAppGraphic() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[245px] overflow-hidden sm:h-[270px] md:h-full"
      initial={false}
    >
      {/* Glow */}
      <motion.div
        className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [1, 1.08, 1],
                opacity: [0.65, 1, 0.65],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      {/* Decorative circle */}
      <motion.div
        className="absolute right-8 top-8 h-5 w-5 rounded-full border-2 border-emerald-900/20"
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                scale: 0,
              }
        }
        animate={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 1,
                scale: 1,
              }
        }
        transition={{
          duration: 0.45,
          delay: 0.25,
          ease: "backOut",
        }}
      />

      {/* Decorative dot */}
      <motion.div
        className="absolute bottom-12 left-10 h-3 w-3 rounded-full bg-emerald-900/20"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                y: [0, -8, 0],
                opacity: [0.45, 0.8, 0.45],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      {/* PHONE */}
      <motion.div
        className="
          absolute
          bottom-[-82px]
          right-[-12px]
          z-10
          h-[300px]
          w-[160px]
          rotate-[6deg]
          rounded-[2.2rem]
          border-[7px]
          border-slate-950
          bg-white
          shadow-2xl

          sm:right-4
          sm:bottom-[-72px]
          sm:h-[330px]
          sm:w-[175px]

          md:bottom-[-60px]
          md:right-3
          md:h-[330px]
          md:w-[175px]
        "
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                x: 80,
                y: 45,
                rotate: 13,
                scale: 0.82,
              }
        }
        animate={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 1,
                x: 0,
                y: 0,
                rotate: 6,
                scale: 1,
              }
        }
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                y: -8,
                rotate: 4,
              }
        }
        transition={{
          duration: 1.05,
          delay: 0.18,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        {/* Dynamic Island */}
        <motion.div
          className="absolute left-1/2 top-2 h-5 w-16 -translate-x-1/2 rounded-full bg-slate-950"
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  scaleX: 0.5,
                }
          }
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  opacity: 1,
                  scaleX: 1,
                }
          }
          transition={{
            duration: 0.35,
            delay: 0.65,
          }}
        />

        <div className="mt-10 px-3">
          {/* Header */}
          <motion.div
            className="flex items-center gap-2 border-b border-slate-100 pb-3"
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    y: -10,
                  }
            }
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    y: 0,
                  }
            }
            transition={{
              duration: 0.45,
              delay: 0.75,
            }}
          >
            <motion.div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      scale: 0,
                      rotate: -45,
                    }
              }
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      scale: 1,
                      rotate: 0,
                    }
              }
              transition={{
                duration: 0.45,
                delay: 0.82,
                ease: "backOut",
              }}
            >
              <MessageCircle size={14} />
            </motion.div>

            <div>
              <div className="text-[9px] font-bold text-slate-900">Luka AI</div>
              <div className="text-[7px] text-slate-400">En línea</div>
            </div>
          </motion.div>

          {/* Messages */}
          <div className="mt-5 space-y-3">
            <motion.div
              className="ml-auto w-[78%] rounded-2xl rounded-br-sm bg-emerald-500 px-3 py-2 text-[8px] text-white"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      x: 25,
                      scale: 0.92,
                    }
              }
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      x: 0,
                      scale: 1,
                    }
              }
              transition={{
                duration: 0.45,
                delay: 1,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              ¿Cómo fueron las ventas hoy?
            </motion.div>

            <motion.div
              className="w-[84%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-[8px] leading-3 text-slate-700"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      x: -25,
                      scale: 0.92,
                    }
              }
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      x: 0,
                      scale: 1,
                    }
              }
              transition={{
                duration: 0.45,
                delay: 1.22,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              Hoy vendiste $428.000.
              <br />
              Tus ventas aumentaron 18%.
            </motion.div>

            <motion.div
              className="ml-auto w-[65%] rounded-2xl rounded-br-sm bg-emerald-500 px-3 py-2 text-[8px] text-white"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      x: 25,
                      scale: 0.92,
                    }
              }
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      x: 0,
                      scale: 1,
                    }
              }
              transition={{
                duration: 0.45,
                delay: 1.44,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              ¿Y cuáles fueron los productos más vendidos?
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* AUDIO */}
      <motion.div
        className="
          absolute
          bottom-4
          left-4
          z-20
          flex
          max-w-[245px]
          items-center
          gap-3
          rounded-2xl
          bg-white
          px-4
          py-3
          shadow-xl

          sm:left-8
          sm:max-w-[275px]

          md:bottom-8
          md:left-10
        "
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                x: -45,
                y: 25,
                scale: 0.9,
              }
        }
        animate={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
              }
        }
        transition={{
          duration: 0.75,
          delay: 0.55,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <motion.div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  scale: [1, 1.06, 1],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : {
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        >
          <Mic size={18} />
        </motion.div>

        <div>
          <p className="text-[10px] font-semibold text-slate-900">
            También puedes enviar audios
          </p>

          <div className="mt-1 flex items-center gap-1">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : {
                      duration: 1.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />

            <span className="text-[8px] text-slate-400">
              Luka entiende tu mensaje
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* =========================================================
   BRAIN GRAPHIC
   ========================================================= */

function BrainGraphic() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="
        absolute
        inset-x-0
        bottom-0
        h-[220px]
        overflow-hidden

        sm:h-[235px]

        md:inset-0
        md:h-full
      "
      initial={
        shouldReduceMotion
          ? false
          : {
              opacity: 0,
            }
      }
      whileInView={
        shouldReduceMotion
          ? undefined
          : {
              opacity: 1,
            }
      }
      viewport={{
        once: true,
        amount: 0.25,
      }}
      transition={{
        duration: 0.7,
      }}
    >
      <motion.div
        className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [1, 1.1, 1],
                opacity: [0.65, 1, 0.65],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      <motion.div
        className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [1, 0.92, 1],
                opacity: [0.7, 0.95, 0.7],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      {/* INVENTARIO */}
      <motion.div
        className="
          absolute
          bottom-7
          left-5
          z-20
          rotate-[-6deg]
          rounded-2xl
          bg-white/90
          px-4
          py-3
          shadow-xl
          backdrop-blur-md

          sm:left-10

          md:bottom-auto
          md:left-[48%]
          md:top-12
        "
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                x: -45,
                y: 25,
                rotate: -14,
                scale: 0.88,
              }
        }
        whileInView={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 1,
                x: 0,
                y: 0,
                rotate: -6,
                scale: 1,
              }
        }
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                y: -5,
                rotate: -4,
                scale: 1.03,
              }
        }
        viewport={{
          once: true,
          amount: 0.3,
        }}
        transition={{
          duration: 0.75,
          delay: 0.2,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="flex items-center gap-2">
          <Package size={16} className="text-cyan-600" />

          <span className="text-[10px] font-bold text-slate-900">
            Inventario
          </span>
        </div>

        <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
          <motion.div
            className="h-full rounded-full bg-cyan-500"
            initial={
              shouldReduceMotion
                ? false
                : {
                    width: "0%",
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    width: "72%",
                  }
            }
            viewport={{
              once: true,
            }}
            transition={{
              duration: 0.9,
              delay: 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        </div>
      </motion.div>

      {/* IA */}
      <motion.div
        className="
          absolute
          bottom-9
          right-5
          z-20
          rotate-[5deg]
          rounded-2xl
          bg-slate-950
          px-4
          py-3
          shadow-2xl

          sm:right-10

          md:bottom-auto
          md:right-8
          md:top-20
        "
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                x: 45,
                y: 25,
                rotate: 14,
                scale: 0.88,
              }
        }
        whileInView={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 1,
                x: 0,
                y: 0,
                rotate: 5,
                scale: 1,
              }
        }
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                y: -5,
                rotate: 3,
                scale: 1.03,
              }
        }
        viewport={{
          once: true,
          amount: 0.3,
        }}
        transition={{
          duration: 0.75,
          delay: 0.35,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    rotate: [0, 12, -8, 0],
                    scale: [1, 1.1, 1],
                  }
            }
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          >
            <Sparkles size={15} className="text-emerald-400" />
          </motion.div>

          <span className="text-[10px] font-bold text-white">
            IA procesando
          </span>
        </div>

        <div className="mt-2 flex gap-1">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      y: [0, -4, 0],
                      opacity: [0.35, 1, 0.35],
                    }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : {
                      duration: 1.1,
                      repeat: Infinity,
                      delay: dot * 0.16,
                      ease: "easeInOut",
                    }
              }
            />
          ))}
        </div>
      </motion.div>

      {/* BRAIN */}
      <motion.div
        className="
          absolute
          bottom-[-5px]
          left-1/2
          flex
          -translate-x-1/2
          items-center
          justify-center

          md:bottom-auto
          md:left-[72%]
          md:top-1/2
          md:-translate-y-1/2
        "
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                scale: 0.55,
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
          amount: 0.3,
        }}
        transition={{
          duration: 0.85,
          delay: 0.35,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <motion.div
          className="absolute h-36 w-36 rounded-full border border-cyan-400/20 md:h-44 md:w-44"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  scale: [1, 1.08, 1],
                  opacity: [0.35, 0.7, 0.35],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : {
                  duration: 3.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        />

        <motion.div
          className="absolute h-28 w-28 rounded-full border border-emerald-400/30 md:h-32 md:w-32"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  scale: [1.05, 0.92, 1.05],
                  rotate: [0, 180, 360],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : {
                  duration: 10,
                  repeat: Infinity,
                  ease: "linear",
                }
          }
        />

        <motion.div
          className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-gradient-to-br from-cyan-500 to-emerald-500 text-white shadow-2xl shadow-emerald-500/30 md:h-24 md:w-24 md:rounded-[2rem]"
          animate={
            shouldReduceMotion
              ? undefined
              : {
                  y: [0, -6, 0],
                  boxShadow: [
                    "0 20px 45px rgba(16,185,129,0.22)",
                    "0 25px 60px rgba(16,185,129,0.38)",
                    "0 20px 45px rgba(16,185,129,0.22)",
                  ],
                }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : {
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        >
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    rotate: [0, 4, -4, 0],
                  }
            }
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          >
            <BrainCircuit size={38} strokeWidth={1.8} />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* BOTTOM LABEL */}
      <motion.div
        className="
          absolute
          bottom-2
          left-1/2
          z-30
          hidden
          -translate-x-1/2
          rounded-full
          bg-white
          px-5
          py-2
          text-[10px]
          font-bold
          text-slate-900
          shadow-xl

          md:bottom-10
          md:left-[72%]
          md:block
        "
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                y: 15,
                scale: 0.9,
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
        }}
        transition={{
          duration: 0.5,
          delay: 0.95,
          ease: "backOut",
        }}
      >
        Todo organizado automáticamente
      </motion.div>
    </motion.div>
  );
}

/* =========================================================
   ANALYTICS GRAPHIC
   ========================================================= */

function AnalyticsGraphic() {
  const shouldReduceMotion = useReducedMotion();

  const bars = [
    "35%",
    "48%",
    "42%",
    "65%",
    "58%",
    "78%",
    "92%",
  ];

  return (
    <motion.div
      className="
        absolute
        inset-x-0
        bottom-0
        h-[225px]
        overflow-hidden

        sm:h-[245px]

        md:inset-0
        md:h-full
      "
      initial={
        shouldReduceMotion
          ? false
          : {
              opacity: 0,
            }
      }
      whileInView={
        shouldReduceMotion
          ? undefined
          : {
              opacity: 1,
            }
      }
      viewport={{
        once: true,
        amount: 0.25,
      }}
      transition={{
        duration: 0.7,
      }}
    >
      <motion.div
        className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                scale: [1, 1.1, 1],
                opacity: [0.55, 0.85, 0.55],
              }
        }
        transition={
          shouldReduceMotion
            ? undefined
            : {
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      {/* RECOMMENDATION */}
      <motion.div
        className="
          absolute
          left-5
          top-[105px]
          z-20
          max-w-[185px]
          rotate-[-4deg]
          rounded-2xl
          bg-slate-950
          px-4
          py-3
          shadow-xl

          sm:left-8
          sm:top-[115px]

          md:left-[45%]
          md:top-[120px]
          md:max-w-[190px]
        "
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                x: -40,
                y: 25,
                rotate: -10,
                scale: 0.88,
              }
        }
        whileInView={
          shouldReduceMotion
            ? undefined
            : {
                opacity: 1,
                x: 0,
                y: 0,
                rotate: -4,
                scale: 1,
              }
        }
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                y: -5,
                rotate: -2,
                scale: 1.03,
              }
        }
        viewport={{
          once: true,
          amount: 0.3,
        }}
        transition={{
          duration: 0.75,
          delay: 0.25,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    rotate: [0, 12, -8, 0],
                    scale: [1, 1.1, 1],
                  }
            }
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          >
            <Sparkles size={14} className="text-emerald-400" />
          </motion.div>

          <span className="text-[9px] font-bold text-white">
            Recomendación de Luka
          </span>
        </div>

        <p className="mt-2 text-[9px] leading-3 text-slate-300">
          Tu producto más vendido está aumentando esta semana.
        </p>
      </motion.div>

      {/* SALES CARD */}
      <motion.div
        className="
          absolute
          bottom-[-70px]
          right-3
          z-20
          w-[245px]
          rounded-[1.8rem]
          bg-white
          p-4
          shadow-2xl

          sm:right-8
          sm:bottom-[-65px]
          sm:w-[280px]
          sm:p-5

          md:bottom-[-45px]
          md:right-8
          md:w-[270px]

          lg:right-14
          lg:bottom-[-40px]
          lg:w-[320px]
        "
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                x: 55,
                y: 45,
                scale: 0.88,
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
              }
        }
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                y: -7,
                scale: 1.015,
              }
        }
        viewport={{
          once: true,
          amount: 0.25,
        }}
        transition={{
          duration: 0.9,
          delay: 0.38,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[9px] font-medium text-slate-400">
              Ventas del mes
            </p>

            <motion.p
              className="mt-1 text-2xl font-bold tracking-tight text-slate-950"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 8,
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
                duration: 0.45,
                delay: 0.85,
              }}
            >
              $8.420.000
            </motion.p>
          </div>

          <motion.div
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    y: [0, -4, 0],
                  }
            }
            transition={
              shouldReduceMotion
                ? undefined
                : {
                    duration: 2.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          >
            <TrendingUp size={17} />
          </motion.div>
        </div>

        <div className="mt-5 flex h-24 items-end gap-2 sm:mt-7 sm:h-28">
          {bars.map((height, index) => (
            <motion.div
              key={`${height}-${index}`}
              className={`flex-1 rounded-t-md ${
                index === 0
                  ? "bg-emerald-100"
                  : index === 1 || index === 2
                    ? "bg-emerald-200"
                    : index === 3 || index === 4
                      ? "bg-emerald-300"
                      : index === 5
                        ? "bg-emerald-400"
                        : "bg-emerald-500"
              }`}
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      height: "0%",
                    }
              }
              whileInView={
                shouldReduceMotion
                  ? undefined
                  : {
                      height,
                    }
              }
              viewport={{
                once: true,
                amount: 0.3,
              }}
              transition={{
                duration: 0.75,
                delay: 0.7 + index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
        </div>

        <motion.div
          className="mt-3 flex items-center justify-between sm:mt-4"
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 8,
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
            duration: 0.45,
            delay: 1.35,
          }}
        >
          <span className="text-[8px] text-slate-400">
            Últimos 7 días
          </span>

          <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-600">
            <TrendingUp size={11} />
            +18.4%
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/* =========================================================
   MAIN SECTION
   ========================================================= */

export function CoworkingHowItWorksSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id="usos"
      className="
        relative
        w-full
        overflow-hidden
        bg-transparent
        px-6
        pt-4
        pb-6
        dark:bg-[#070B12]

        md:px-12
        md:pt-14
        md:pb-16
      "
    >
      <div className="mx-auto w-full max-w-7xl">
        {/* =========================================================
            PRIMER PISO
            ========================================================= */}

        <motion.div
          className="grid gap-2 md:grid-cols-[1.35fr_0.85fr]"
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 30,
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
            amount: 0.15,
          }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* =======================================================
              ADMINISTRAR TU NEGOCIO
              ======================================================= */}

          <motion.div
            className="
              relative
              min-h-[440px]
              overflow-hidden
              rounded-[2rem]
              bg-white/60
              px-7
              py-10
              shadow-sm

              sm:px-10
              sm:py-12

              lg:px-14
              lg:py-14

              dark:border
              dark:border-white/[0.06]
              dark:bg-[#101722]/70
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    x: -45,
                    scale: 0.97,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }
            }
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.8,
              delay: 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      scale: [1, 1.08, 1],
                      opacity: [0.6, 1, 0.6],
                    }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : {
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />

            <div className="relative z-10 max-w-3xl">
              <motion.div
                className="
                  inline-flex
                  items-center
                  rounded-full
                  bg-emerald-50
                  px-5
                  py-2
                  text-sm
                  font-semibold
                  text-emerald-700

                  dark:bg-emerald-400/10
                  dark:text-emerald-300
                "
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        scale: 0.8,
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
                }}
                transition={{
                  duration: 0.45,
                  delay: 0.3,
                  ease: "backOut",
                }}
              >
                Así de simple
              </motion.div>

              <motion.h2
                className="
                  mt-7
                  max-w-3xl
                  text-5xl
                  font-black
                  leading-[1.02]
                  tracking-tight
                  text-slate-950

                  dark:text-white
                "
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 22,
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
                  duration: 0.65,
                  delay: 0.38,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                Administrar tu negocio nunca fue tan fácil.
              </motion.h2>

              <motion.p
                className="
                  mt-7
                  max-w-2xl
                  text-lg
                  leading-8
                  text-slate-600

                  dark:text-slate-400
                "
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
                }}
                transition={{
                  duration: 0.6,
                  delay: 0.5,
                }}
              >
                No necesitas aprender un software nuevo. Solo conversa con
                Luka y deja que la inteligencia artificial haga el resto.
              </motion.p>

              <motion.div
                className="mt-10 flex flex-wrap gap-2"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        y: 15,
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
                  duration: 0.55,
                  delay: 0.62,
                }}
              >
                {[
                  "Ventas",
                  "Gastos",
                  "Inventario",
                  "Inteligencia Artificial",
                ].map((label, index) => (
                  <motion.span
                    key={label}
                    className={
                      index === 3
                        ? "rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                        : "rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-300"
                    }
                    initial={
                      shouldReduceMotion
                        ? false
                        : {
                            opacity: 0,
                            scale: 0.8,
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
                    }}
                    transition={{
                      duration: 0.35,
                      delay: 0.68 + index * 0.07,
                      ease: "backOut",
                    }}
                  >
                    {label}
                  </motion.span>
                ))}
              </motion.div>
            </div>

            <motion.div
              className="absolute -bottom-24 -right-20 hidden h-72 w-72 rounded-full bg-gradient-to-br from-emerald-300/30 to-cyan-300/20 blur-2xl sm:block"
              animate={
                shouldReduceMotion
                  ? undefined
                  : {
                      x: [0, -15, 0],
                      y: [0, -10, 0],
                    }
              }
              transition={
                shouldReduceMotion
                  ? undefined
                  : {
                      duration: 7,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
            />

            <motion.div
              className="absolute bottom-10 right-10 hidden items-center justify-center sm:flex"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      scale: 0.65,
                      rotate: -12,
                    }
              }
              whileInView={
                shouldReduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      scale: 1,
                      rotate: 6,
                    }
              }
              viewport={{
                once: true,
              }}
              transition={{
                duration: 0.7,
                delay: 0.75,
                ease: "backOut",
              }}
            >
              <motion.div
                className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-2xl shadow-emerald-500/20"
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        y: [0, -6, 0],
                        rotate: [6, 9, 6],
                      }
                }
                transition={
                  shouldReduceMotion
                    ? undefined
                    : {
                        duration: 3.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }
                }
              >
                <Sparkles size={40} />
              </motion.div>
            </motion.div>

            <motion.div
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      scale: 0,
                      rotate: -45,
                    }
              }
              whileInView={
                shouldReduceMotion
                  ? undefined
                  : {
                      opacity: 1,
                      scale: 1,
                      rotate: 0,
                    }
              }
              viewport={{
                once: true,
              }}
              transition={{
                duration: 0.5,
                delay: 0.9,
                ease: "backOut",
              }}
            >
              <ArrowUpRight
                className="absolute right-8 top-8 text-slate-200 dark:text-white/10"
                size={34}
              />
            </motion.div>
          </motion.div>

          {/* =======================================================
              TODO DESDE WHATSAPP
              ======================================================= */}

          <motion.div
            className="
              relative
              min-h-[500px]
              overflow-hidden
              rounded-[2rem]
              bg-[#62D56B]
              dark:bg-[#42B95B]

              md:min-h-[440px]
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    x: 45,
                    scale: 0.97,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }
            }
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.8,
              delay: 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              className="
                relative
                z-30
                px-8
                pt-8

                sm:px-10
                sm:pt-10
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
              }}
              transition={{
                duration: 0.65,
                delay: 0.35,
              }}
            >
              <h3
                className="
                  max-w-[240px]
                  text-5xl
                  font-black
                  leading-[1.02]
                  tracking-tight
                  text-slate-950

                  md:max-w-[235px]
                "
              >
                Todo desde WhatsApp
              </h3>

              <p
                className="
                  mt-5
                  max-w-[225px]
                  text-base
                  leading-6
                  text-slate-950/75
                "
              >
                Pregunta por tus ventas, gastos, inventario y mucho más.
              </p>

              <motion.a
                href="https://wa.me/573043904488"
                target="_blank"
                rel="noopener noreferrer"
                className="
                  pointer-events-auto
                  mt-6
                  inline-flex
                  items-center
                  justify-center
                  rounded-full
                  bg-slate-950
                  px-6
                  py-3
                  text-sm
                  font-bold
                  text-white
                  transition-all
                  duration-300
                  hover:scale-[1.03]
                  hover:bg-slate-900
                "
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: 1.05,
                      }
                }
                whileTap={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: 0.97,
                      }
                }
              >
                Hablar con Luka
              </motion.a>
            </motion.div>

            <WhatsAppGraphic />
          </motion.div>
        </motion.div>

        {/* =========================================================
            SEGUNDO PISO
            ========================================================= */}

        <motion.div
          className="mt-2 grid gap-2 md:grid-cols-[0.82fr_1.38fr]"
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 35,
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
            amount: 0.15,
          }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* =======================================================
              2. LUKA ORGANIZA TODO
              ======================================================= */}

          <motion.div
            className="
              relative
              min-h-[500px]
              overflow-hidden
              rounded-[2rem]
              bg-gradient-to-br
              from-cyan-400
              via-cyan-500
              to-emerald-400
              p-8

              sm:p-10

              md:min-h-[410px]
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    x: -40,
                    scale: 0.96,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }
            }
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.8,
              delay: 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              className="relative z-30 max-w-[250px]"
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
              }}
              transition={{
                duration: 0.65,
                delay: 0.32,
              }}
            >
              <motion.div
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        scale: 0,
                        rotate: -35,
                      }
                }
                whileInView={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: 1,
                        rotate: 0,
                      }
                }
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.35,
                  ease: "backOut",
                }}
              >
                <BrainCircuit size={24} />
              </motion.div>

              <h3
                className="
                  mt-7
                  text-5xl
                  font-black
                  leading-[1.02]
                  tracking-tight
                  text-slate-950
                "
              >
                {steps[1].title}
              </h3>

              <p
                className="
                  mt-5
                  max-w-[245px]
                  text-base
                  leading-7
                  text-slate-950/75
                "
              >
                {steps[1].description}
              </p>
            </motion.div>

            <BrainGraphic />
          </motion.div>

          {/* =======================================================
              3. TOMA MEJORES DECISIONES
              ======================================================= */}

          <motion.div
            className="
              relative
              min-h-[500px]
              overflow-hidden
              rounded-[2rem]
              border
              border-slate-200
              bg-white
              p-8

              sm:p-10

              md:min-h-[410px]

              dark:border-white/[0.06]
              dark:bg-[#111A25]
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    x: 40,
                    scale: 0.96,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }
            }
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.8,
              delay: 0.14,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              className="relative z-30 max-w-[245px]"
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
              }}
              transition={{
                duration: 0.65,
                delay: 0.32,
              }}
            >
              <motion.div
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        scale: 0,
                        rotate: 35,
                      }
                }
                whileInView={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: 1,
                        rotate: 0,
                      }
                }
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.38,
                  ease: "backOut",
                }}
              >
                <BarChart3 size={24} />
              </motion.div>

              <h3
                className="
                  mt-7
                  text-5xl
                  font-black
                  leading-[1.02]
                  tracking-tight
                  text-slate-950

                  dark:text-white
                "
              >
                {steps[2].title}
              </h3>

              <p
                className="
                  mt-5
                  max-w-[240px]
                  text-base
                  leading-7
                  text-slate-600

                  dark:text-slate-400
                "
              >
                {steps[2].description}
              </p>
            </motion.div>

            <AnalyticsGraphic />
          </motion.div>
        </motion.div>

        {/* =========================================================
            TERCER PISO
            ========================================================= */}

        <motion.div
          className="mt-2 grid gap-2 md:grid-cols-[1.38fr_0.82fr]"
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 35,
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
            amount: 0.15,
          }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {/* =======================================================
              1. HABLA CON LUKA
              ======================================================= */}

          <motion.div
            className="
              relative
              min-h-[440px]
              overflow-hidden
              rounded-[2rem]
              bg-[#063B32]
              p-8

              sm:p-10

              md:min-h-[350px]
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    x: -45,
                    scale: 0.96,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }
            }
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.85,
              delay: 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              className="relative z-30 max-w-[300px]"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      x: -20,
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
              }}
              transition={{
                duration: 0.65,
                delay: 0.32,
              }}
            >
              <motion.div
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-lg"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        scale: 0,
                        rotate: -45,
                      }
                }
                whileInView={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: 1,
                        rotate: 0,
                      }
                }
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.4,
                  ease: "backOut",
                }}
              >
                <Mic size={23} />
              </motion.div>

              <h3
                className="
                  mt-7
                  text-5xl
                  font-black
                  leading-[1.02]
                  tracking-tight
                  text-white
                "
              >
                {steps[0].title}
              </h3>

              <p
                className="
                  mt-5
                  max-w-[290px]
                  text-base
                  leading-7
                  text-emerald-50/75
                "
              >
                {steps[0].description}
              </p>
            </motion.div>

            {/* CHAT BUBBLES */}
            <div
              className="
                absolute
                bottom-7
                right-5
                z-20
                flex
                flex-col
                gap-2

                sm:right-10

                md:right-14
              "
            >
              <motion.div
                className="rounded-2xl rounded-br-sm bg-emerald-400 px-5 py-3 text-xs font-semibold text-slate-950 shadow-xl"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        x: 45,
                        y: 15,
                        scale: 0.85,
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
                      }
                }
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.55,
                  delay: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                Hola Luka 👋
              </motion.div>

              <motion.div
                className="ml-8 rounded-2xl rounded-bl-sm bg-white px-5 py-3 text-xs font-semibold text-slate-900 shadow-xl"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        x: 45,
                        y: 15,
                        scale: 0.85,
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
                      }
                }
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.55,
                  delay: 0.9,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                ¿Cómo va mi negocio?
              </motion.div>
            </div>
          </motion.div>

          {/* =======================================================
              TU NEGOCIO, ENTENDIDO EN SEGUNDOS
              ======================================================= */}

          <motion.div
            className="
              relative
              min-h-[440px]
              overflow-hidden
              rounded-[2rem]
              bg-[#DDE6E0]
              p-8

              sm:p-10

              md:min-h-[350px]
            "
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    x: 45,
                    scale: 0.96,
                  }
            }
            whileInView={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }
            }
            viewport={{
              once: true,
              amount: 0.2,
            }}
            transition={{
              duration: 0.85,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              className="relative z-30 max-w-[280px]"
              initial={
                shouldReduceMotion
                  ? false
                  : {
                      opacity: 0,
                      x: 20,
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
              }}
              transition={{
                duration: 0.65,
                delay: 0.35,
              }}
            >
              <motion.div
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        scale: 0,
                        rotate: 45,
                      }
                }
                whileInView={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: 1,
                        rotate: 0,
                      }
                }
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.5,
                  delay: 0.42,
                  ease: "backOut",
                }}
              >
                <TrendingUp size={23} />
              </motion.div>

              <motion.p
                className="mt-7 text-sm font-semibold uppercase tracking-widest text-slate-600"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                      }
                }
                whileInView={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: 1,
                      }
                }
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.4,
                  delay: 0.55,
                }}
              >
                LUKA AI
              </motion.p>

              <h3
                className="
                  mt-3
                  max-w-[280px]
                  text-5xl
                  font-black
                  leading-[1.02]
                  tracking-tight
                  text-slate-950
                "
              >
                Tu negocio, entendido en segundos.
              </h3>

              <p className="mt-5 max-w-[260px] text-base leading-6 text-slate-600">
                Convierte la información de tu negocio inteligentemente.
              </p>
            </motion.div>

            {/* CHART */}
            <div
              className="
                absolute
                bottom-[-75px]
                right-[-5px]
                z-10
                flex
                h-40
                items-end
                gap-2
                opacity-70
              "
            >
              {[
                "h-16 bg-emerald-300",
                "h-24 bg-emerald-400",
                "h-20 bg-emerald-500",
                "h-32 bg-emerald-600",
                "h-40 bg-slate-950",
              ].map((bar, index) => (
                <motion.div
                  key={`${bar}-${index}`}
                  className={`w-7 rounded-t-lg ${bar}`}
                  initial={
                    shouldReduceMotion
                      ? false
                      : {
                          scaleY: 0,
                          transformOrigin: "bottom",
                        }
                  }
                  whileInView={
                    shouldReduceMotion
                      ? undefined
                      : {
                          scaleY: 1,
                        }
                  }
                  viewport={{
                    once: true,
                    amount: 0.3,
                  }}
                  transition={{
                    duration: 0.65,
                    delay: 0.55 + index * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}