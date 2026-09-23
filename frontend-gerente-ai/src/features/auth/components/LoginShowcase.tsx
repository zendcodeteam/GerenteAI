import {
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  LockKeyhole,
  Rocket,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

export function LoginShowcase() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="
        relative
        flex
        h-full
        min-h-0
        w-full
        items-center
        justify-center
        overflow-hidden
        bg-slate-50
        dark:bg-[#070B12]
      "
    >
      {/* ============================================================
          BACKGROUND
      ============================================================ */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
      </div>

      {/* ============================================================
          BACK HOME
          Same height position as the theme toggle
      ============================================================ */}

      <motion.div
        initial={
          shouldReduceMotion
            ? { opacity: 1, x: 0 }
            : {
                opacity: 0,
                x: 6,
              }
        }
        animate={{
          opacity: 1,
          x: 0,
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.45,
          delay: shouldReduceMotion ? 0 : 0.15,
          ease,
        }}
        className="
          absolute
          right-8
          top-8
          z-30
          sm:right-12
          sm:top-12
        "
      >
        <Link
          to="/home"
          aria-label="Volver al inicio"
          title="Volver al inicio"
          className="
            group
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-full
            text-muted-foreground/55
            transition-all
            duration-300
            hover:bg-muted/70
            hover:text-foreground
          "
        >
          <ArrowLeft
            className="
              h-[18px]
              w-[18px]
              transition-transform
              duration-300
              group-hover:-translate-x-0.5
            "
          />
        </Link>
      </motion.div>

      {/* ============================================================
          MAIN CONTENT
          SAME HORIZONTAL SYSTEM AS LOGIN
      ============================================================ */}

      <div
        className="
          flex
          h-full
          min-h-0
          w-full
          max-w-[560px]
          flex-col
          justify-center
          px-7
          py-7
          sm:px-10
          lg:px-12
        "
      >
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          {/* ==========================================================
              INTRO
          ========================================================== */}

          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : {
                    opacity: 0,
                    y: 16,
                  }
            }
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.7,
              delay: shouldReduceMotion ? 0 : 0.1,
              ease,
            }}
            className="mb-7"
          >
            <div className="mb-5 flex items-center gap-2.5">
              <div
                className="
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center
                  rounded-full
                  bg-primary/10
                  ring-1
                  ring-primary/10
                "
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>

              <span
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.18em]
                  text-muted-foreground/60
                "
              >
                Inteligencia para tu negocio
              </span>
            </div>

            <h2
              className="
                bg-gradient-to-r
                from-cyan-400
                via-blue-500
                to-violet-500
                bg-clip-text
                text-[2.45rem]
                font-bold
                leading-[1.02]
                tracking-[-0.045em]
                text-transparent
              "
            >
              El control total
              <br />
              de tu negocio.
            </h2>

            <p
              className="
                mt-4
                max-w-[450px]
                text-[14px]
                leading-6
                text-muted-foreground
              "
            >
              Recomendaciones potenciadas por IA, proyecciones financieras
              precisas y control de cartera en un solo lugar.
            </p>
          </motion.div>

          {/* ==========================================================
              PRODUCT COMPOSITION
          ========================================================== */}

          <div className="relative">
            {/* ========================================================
                MAIN AI CARD
            ======================================================== */}

            <motion.div
              initial={
                shouldReduceMotion
                  ? {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    }
                  : {
                      opacity: 0,
                      y: 22,
                      scale: 0.985,
                    }
              }
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.7,
                delay: shouldReduceMotion ? 0 : 0.25,
                ease,
              }}
              whileHover={
                shouldReduceMotion
                  ? undefined
                  : {
                      y: -2,
                    }
              }
              className="
                group
                relative
                overflow-hidden
                rounded-[20px]
                border
                border-border/65
                bg-card/55
                p-5
                shadow-[0_18px_55px_-35px_rgba(0,0,0,0.35)]
                backdrop-blur-xl
                transition-shadow
                duration-500
                hover:shadow-[0_24px_65px_-35px_rgba(0,0,0,0.42)]
                sm:p-6
              "
            >
              <div
                className="
                  pointer-events-none
                  absolute
                  inset-x-7
                  top-0
                  h-px
                  bg-gradient-to-r
                  from-transparent
                  via-primary/25
                  to-transparent
                "
              />

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? {
                            opacity: 1,
                            scale: 1,
                          }
                        : {
                            opacity: 0,
                            scale: 0.75,
                          }
                    }
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.5,
                      delay: shouldReduceMotion ? 0 : 0.4,
                      ease,
                    }}
                    className="
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-[12px]
                      bg-primary/10
                      ring-1
                      ring-primary/10
                    "
                  >
                    <BrainCircuit className="h-[18px] w-[18px] text-primary" />
                  </motion.div>

                  <div>
                    <p className="text-[13px] font-bold text-card-foreground">
                      Recomendaciones IA
                    </p>

                    <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/55">
                      Análisis inteligente
                    </p>
                  </div>
                </div>

                <motion.span
                  initial={
                    shouldReduceMotion
                      ? {
                          opacity: 1,
                          scale: 1,
                        }
                      : {
                          opacity: 0,
                          scale: 0.9,
                        }
                  }
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.45,
                    delay: shouldReduceMotion ? 0 : 0.48,
                    ease,
                  }}
                  className="
                    rounded-full
                    border
                    border-emerald-500/20
                    bg-emerald-500/[0.06]
                    px-2.5
                    py-1
                    text-[9px]
                    font-bold
                    text-emerald-600
                    dark:text-emerald-400
                  "
                >
                  +32%
                </motion.span>
              </div>

              {/* Minimal insight */}

              <motion.div
                initial={
                  shouldReduceMotion
                    ? {
                        opacity: 1,
                        y: 0,
                      }
                    : {
                        opacity: 0,
                        y: 7,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.5,
                  delay: shouldReduceMotion ? 0 : 0.55,
                  ease,
                }}
                className="
                  mt-5
                  rounded-xl
                  bg-muted/40
                  px-3.5
                  py-2.5
                "
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />

                  <p className="text-[10px] font-medium text-muted-foreground">
                    Luka detectó oportunidades de optimización.
                  </p>
                </div>
              </motion.div>

              {/* Bars */}

              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={
                        shouldReduceMotion
                          ? {
                              width: "67%",
                            }
                          : {
                              width: "0%",
                            }
                      }
                      animate={{
                        width: "67%",
                      }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.9,
                        delay: shouldReduceMotion ? 0 : 0.65,
                        ease,
                      }}
                      className="
                        h-full
                        rounded-full
                        bg-gradient-to-r
                        from-primary
                        to-primary/60
                      "
                    />
                  </div>

                  <span className="w-7 text-right text-[9px] font-bold text-muted-foreground/45">
                    67%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={
                        shouldReduceMotion
                          ? {
                              width: "34%",
                            }
                          : {
                              width: "0%",
                            }
                      }
                      animate={{
                        width: "34%",
                      }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.8,
                        delay: shouldReduceMotion ? 0 : 0.75,
                        ease,
                      }}
                      className="h-full rounded-full bg-primary/35"
                    />
                  </div>

                  <span className="w-7 text-right text-[9px] font-bold text-muted-foreground/45">
                    34%
                  </span>
                </div>
              </div>
            </motion.div>

            {/* ========================================================
                SECONDARY CARDS
            ======================================================== */}

            <div className="mt-3 grid grid-cols-2 gap-3">
              {/* Growth */}

              <motion.div
                initial={
                  shouldReduceMotion
                    ? {
                        opacity: 1,
                        y: 0,
                      }
                    : {
                        opacity: 0,
                        y: 18,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.6,
                  delay: shouldReduceMotion ? 0 : 0.38,
                  ease,
                }}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : {
                        y: -2,
                      }
                }
                className="
                  relative
                  h-[138px]
                  overflow-hidden
                  rounded-[20px]
                  border
                  border-border/60
                  bg-card/50
                  p-4
                  shadow-[0_16px_45px_-32px_rgba(0,0,0,0.3)]
                  backdrop-blur-xl
                "
              >
                <div
                  className="
                    pointer-events-none
                    absolute
                    bottom-0
                    right-0
                    h-16
                    w-24
                    opacity-20
                  "
                >
                  <svg
                    viewBox="0 0 96 64"
                    fill="none"
                    className="h-full w-full"
                    aria-hidden="true"
                  >
                    <motion.path
                      d="M2 55C14 48 18 50 28 40C39 29 43 37 52 28C61 18 68 26 77 16C84 9 88 11 94 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-indigo-500"
                      initial={
                        shouldReduceMotion
                          ? {
                              pathLength: 1,
                              opacity: 0.8,
                            }
                          : {
                              pathLength: 0,
                              opacity: 0,
                            }
                      }
                      animate={{
                        pathLength: 1,
                        opacity: 0.8,
                      }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 1,
                        delay: shouldReduceMotion ? 0 : 0.75,
                        ease,
                      }}
                    />
                  </svg>
                </div>

                <div className="relative flex h-full flex-col justify-between">
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? {
                            opacity: 1,
                            scale: 1,
                          }
                        : {
                            opacity: 0,
                            scale: 0.8,
                          }
                    }
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.45,
                      delay: shouldReduceMotion ? 0 : 0.55,
                      ease,
                    }}
                    className="
                      flex
                      h-8
                      w-8
                      items-center
                      justify-center
                      rounded-[10px]
                      bg-indigo-500/10
                    "
                  >
                    <Rocket className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                  </motion.div>

                  <div>
                    <p
                      className="
                        text-[9px]
                        font-bold
                        uppercase
                        tracking-[0.14em]
                        text-muted-foreground/50
                      "
                    >
                      Crecimiento
                    </p>

                    <motion.p
                      initial={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : {
                              opacity: 0,
                              y: 6,
                            }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.45,
                        delay: shouldReduceMotion ? 0 : 0.72,
                        ease,
                      }}
                      className="
                        mt-0.5
                        text-[1.65rem]
                        font-bold
                        tracking-[-0.04em]
                        text-card-foreground
                      "
                    >
                      +45.2%
                    </motion.p>

                    <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-emerald-500">
                      <TrendingUp className="h-3 w-3" />
                      Tendencia positiva
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Security */}

              <motion.div
                initial={
                  shouldReduceMotion
                    ? {
                        opacity: 1,
                        y: 0,
                      }
                    : {
                        opacity: 0,
                        y: 18,
                      }
                }
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.6,
                  delay: shouldReduceMotion ? 0 : 0.48,
                  ease,
                }}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : {
                        y: -2,
                      }
                }
                className="
                  relative
                  h-[138px]
                  overflow-hidden
                  rounded-[20px]
                  border
                  border-border/60
                  bg-card/50
                  p-4
                  shadow-[0_16px_45px_-32px_rgba(0,0,0,0.3)]
                  backdrop-blur-xl
                "
              >
                <div
                  className="
                    pointer-events-none
                    absolute
                    -bottom-6
                    -right-6
                    opacity-[0.025]
                  "
                >
                  <LockKeyhole className="h-28 w-28" />
                </div>

                <div className="relative flex h-full flex-col justify-between">
                  <motion.div
                    initial={
                      shouldReduceMotion
                        ? {
                            opacity: 1,
                            scale: 1,
                          }
                        : {
                            opacity: 0,
                            scale: 0.8,
                          }
                    }
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.45,
                      delay: shouldReduceMotion ? 0 : 0.65,
                      ease,
                    }}
                    className="
                      flex
                      h-8
                      w-8
                      items-center
                      justify-center
                      rounded-[10px]
                      bg-emerald-500/10
                    "
                  >
                    <LockKeyhole className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                  </motion.div>

                  <div>
                    <p
                      className="
                        text-[9px]
                        font-bold
                        uppercase
                        tracking-[0.14em]
                        text-muted-foreground/50
                      "
                    >
                      Seguridad
                    </p>

                    <motion.p
                      initial={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : {
                              opacity: 0,
                              y: 6,
                            }
                      }
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        duration: shouldReduceMotion ? 0 : 0.45,
                        delay: shouldReduceMotion ? 0 : 0.8,
                        ease,
                      }}
                      className="
                        mt-0.5
                        text-[1.65rem]
                        font-bold
                        tracking-[-0.04em]
                        text-card-foreground
                      "
                    >
                      Garantizada
                    </motion.p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ========================================================
                BOTTOM MICRO COPY
            ======================================================== */}

            <motion.div
              initial={
                shouldReduceMotion
                  ? {
                      opacity: 1,
                    }
                  : {
                      opacity: 0,
                      y: 6,
                    }
              }
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: shouldReduceMotion ? 0 : 0.5,
                delay: shouldReduceMotion ? 0 : 0.9,
                ease,
              }}
              className="
                mt-5
                flex
                items-center
                justify-between
                px-1
              "
            >
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />

                <span
                  className="
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-[0.14em]
                    text-muted-foreground/40
                  "
                >
                  Luka AI
                </span>
              </div>

              <div
                className="
                  flex
                  items-center
                  gap-1
                  text-[9px]
                  font-medium
                  text-muted-foreground/35
                "
              >
                <span>Una nueva forma de administrar</span>

                <ArrowUpRight className="h-3 w-3" />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}