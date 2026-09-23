import {
  ArrowLeft,
  Check,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;

export function RegisterShowcase() {
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
      ============================================================ */}

      <motion.div
        initial={
          shouldReduceMotion
            ? {
                opacity: 1,
                x: 0,
              }
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
          right-6
          top-7
          z-30
          sm:right-10
          lg:right-14
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
                ? {
                    opacity: 1,
                    y: 0,
                  }
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
                  bg-emerald-500/10
                  ring-1
                  ring-emerald-500/10
                "
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
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
                Empieza gratis
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
              Tu negocio.
              <br />
              Entendido.
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
              Regístrate en menos de 2 minutos y comienza a gestionar tu
              negocio con Luka desde donde estés.
            </p>
          </motion.div>

          {/* ==========================================================
              PRODUCT COMPOSITION
          ========================================================== */}

          <div>
            {/* ========================================================
                WHATSAPP CARD
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
                sm:p-6
              "
            >
              {/* Top line */}

              <div
                className="
                  pointer-events-none
                  absolute
                  inset-x-7
                  top-0
                  h-px
                  bg-gradient-to-r
                  from-transparent
                  via-emerald-500/30
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
                      bg-emerald-500/10
                      ring-1
                      ring-emerald-500/10
                    "
                  >
                    <MessageSquare className="h-[18px] w-[18px] text-emerald-500" />
                  </motion.div>

                  <div>
                    <p className="text-[13px] font-bold text-card-foreground">
                      Todo desde WhatsApp
                    </p>

                    <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/55">
                      Habla con Luka naturalmente
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
                    delay: shouldReduceMotion ? 0 : 0.5,
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
                  Activo
                </motion.span>
              </div>

              {/* Example interaction */}

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
                  bg-emerald-500/[0.055]
                  px-3.5
                  py-3
                "
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />

                  <p className="text-[10px] leading-5 text-muted-foreground">
                    “Luka, registré $150.000 en insumos hoy.”
                  </p>
                </div>
              </motion.div>

              {/* Result */}

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
                  delay: shouldReduceMotion ? 0 : 0.68,
                  ease,
                }}
                className="mt-2.5 flex items-center gap-2 px-1"
              >
                <Check className="h-3.5 w-3.5 text-emerald-500" />

                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Registrado automáticamente
                </span>
              </motion.div>
            </motion.div>

            {/* ========================================================
                SMALL CARDS
            ======================================================== */}

            <div className="mt-3 grid grid-cols-2 gap-3">
              {/* Configuration */}

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
                  delay: shouldReduceMotion ? 0 : 0.42,
                  ease,
                }}
                className="
                  h-[128px]
                  rounded-[20px]
                  border
                  border-border/60
                  bg-card/50
                  p-4
                  shadow-[0_16px_45px_-32px_rgba(0,0,0,0.3)]
                  backdrop-blur-xl
                "
              >
                <div className="flex h-full flex-col justify-between">
                  <div
                    className="
                      flex
                      h-8
                      w-8
                      items-center
                      justify-center
                      rounded-[10px]
                      bg-amber-500/10
                    "
                  >
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>

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
                      Configuración
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[1.5rem]
                        font-bold
                        leading-none
                        tracking-[-0.04em]
                        text-card-foreground
                      "
                    >
                      Inmediata
                    </p>
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
                  delay: shouldReduceMotion ? 0 : 0.5,
                  ease,
                }}
                className="
                  relative
                  h-[128px]
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
                    -bottom-5
                    -right-5
                    opacity-[0.025]
                  "
                >
                  <ShieldCheck className="h-28 w-28" />
                </div>

                <div className="relative flex h-full flex-col justify-between">
                  <div
                    className="
                      flex
                      h-8
                      w-8
                      items-center
                      justify-center
                      rounded-[10px]
                      bg-blue-500/10
                    "
                  >
                    <ShieldCheck className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                  </div>

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
                      Tus datos
                    </p>

                    <p
                      className="
                        mt-0.5
                        text-[1.5rem]
                        font-bold
                        leading-none
                        tracking-[-0.04em]
                        text-card-foreground
                      "
                    >
                      Protegidos
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ========================================================
                FOOTNOTE
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
                delay: shouldReduceMotion ? 0 : 0.85,
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
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

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

              <span className="text-[9px] font-medium text-muted-foreground/35">
                Crece contigo.
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}