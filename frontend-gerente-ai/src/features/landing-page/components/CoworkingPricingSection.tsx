"use client";

import { Check, Star, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import {
  planesApi,
  PlanBackend,
  PLANES_FALLBACK,
} from "@/shared/api/planesApi";
import { lukaWhatsappUrl } from "@/lib/whatsapp";

type BillingPeriod = "monthly" | "annual";

const PRECIO_FORMATTER = new Intl.NumberFormat("es-CO");

const ease = [0.22, 1, 0.36, 1] as const;

const headerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const headerItem = {
  hidden: {
    opacity: 0,
    y: 28,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.75,
      ease,
    },
  },
};

const billingReveal = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.94,
    filter: "blur(5px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease,
    },
  },
};

const plansContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.13,
      delayChildren: 0.1,
    },
  },
};

const bottomMessage = {
  hidden: {
    opacity: 0,
    y: 18,
    filter: "blur(5px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.7,
      ease,
    },
  },
};

export function CoworkingPricingSection() {
  const [billingPeriod, setBillingPeriod] =
    useState<BillingPeriod>("monthly");

  const [catalogo, setCatalogo] =
    useState<PlanBackend[]>(PLANES_FALLBACK);

  const reducedMotion = useReducedMotion();

  useEffect(() => {
    planesApi.getPlanesCatalogo().then((planes) => {
      if (planes && planes.length > 0) {
        setCatalogo(planes);
      }
    });
  }, []);

  const planAsistente =
    catalogo.find((p) => p.id === 1) || PLANES_FALLBACK[0];

  const planGerente =
    catalogo.find((p) => p.id === 2) || PLANES_FALLBACK[1];

  const planAdmin =
    catalogo.find((p) => p.id === 3) || PLANES_FALLBACK[2];

  const planSocio =
    catalogo.find((p) => p.id === 4) || PLANES_FALLBACK[3];

  const planCorp =
    catalogo.find((p) => p.id === 5) || PLANES_FALLBACK[4];

  const plans = [
    {
      name: "Asistente",
      eyebrow: "PARA EMPEZAR",
      description:
        "Empieza a organizar tu negocio con Luka.",
      monthlyPrice: "Gratis",
      annualPrice: "Gratis",
      annualBilling: "",
      features: [
        "Registro de ventas y gastos",
        "Consultas por WhatsApp",
        "Reportes básicos",
        "100 mensajes de IA / mes",
        "1 sede comercial",
      ],
      button: "Comenzar gratis",
      link: "/register",
      featured: false,
      dark: false,
    },
    {
      name: "Gerente",
      eyebrow: "PARA CRECER",
      description:
        "Control total y copiloto con IA para 1 sede.",
      monthlyPrice: `$${PRECIO_FORMATTER.format(
        planGerente.precioMensual,
      )}`,
      annualPrice: `$${PRECIO_FORMATTER.format(
        planGerente.precioMensual,
      )}`,
      annualBilling: "Solo disponible mensual",
      features: [
        "Todo lo del plan Asistente",
        "Cuentas por Cobrar (Fiados)",
        "Reportes avanzados",
        "500 mensajes de IA / mes",
        "1 sede premium",
      ],
      button: "Elegir plan",
      link: "/subscription",
      featured: false,
      dark: false,
    },
    {
      name: "Administrador",
      eyebrow: "MÁS ELEGIDO",
      description:
        "La mejor opción para pymes con varias sucursales.",
      monthlyPrice: `$${PRECIO_FORMATTER.format(
        planAdmin.precioMensual,
      )}`,
      annualPrice: `$${PRECIO_FORMATTER.format(
        Math.round(planAdmin.precioAnual / 12),
      )}`,
      annualBilling: `Facturado $${PRECIO_FORMATTER.format(
        planAdmin.precioAnual,
      )}/año`,
      features: [
        "Todo lo del plan Gerente",
        "Multi-sede comparativa",
        "Exportación a Excel",
        "1.500 mensajes de IA / mes",
        `Hasta ${planAdmin.maxSedes} sedes`,
      ],
      button: "Elegir plan",
      link: "/subscription",
      featured: true,
      dark: false,
    },
    {
      name: "Socio",
      eyebrow: "PARA ESCALAR",
      description:
        "Para cadenas que requieren máxima escala.",
      monthlyPrice: `$${PRECIO_FORMATTER.format(
        planSocio.precioMensual,
      )}`,
      annualPrice: `$${PRECIO_FORMATTER.format(
        Math.round(planSocio.precioAnual / 12),
      )}`,
      annualBilling: `Facturado $${PRECIO_FORMATTER.format(
        planSocio.precioAnual,
      )}/año`,
      features: [
        "Todo lo del plan Administrador",
        `Hasta ${planSocio.maxSedes} sedes`,
        "Auditoría continua de negocio",
        "3.000 mensajes de IA / mes",
        "Soporte prioritario",
      ],
      button: "Elegir plan",
      link: "/subscription",
      featured: false,
      dark: false,
    },
    {
      name: "Corporativo",
      eyebrow: "A MEDIDA",
      description:
        "Una solución diseñada para empresas a la medida.",
      monthlyPrice: "Cotizar",
      annualPrice: "Cotizar",
      annualBilling: "",
      features: [
        "Sedes por definir",
        "Mensajes de IA por definir",
        "Reportes avanzados",
        "Integraciones API y ERP personalizadas",
        "Soporte 24/7 y VIP",
      ],
      button: "Hablar con ventas",
      link: lukaWhatsappUrl(
        "Hola Luka 👋, quisiera información sobre el Plan Corporativo de Luka AI",
      ),
      featured: false,
      dark: true,
    },
  ];

  return (
    <section
      id="planes"
      className="
        relative
        -mt-7
        overflow-hidden
        bg-transparent
        px-6
        pb-24
        pt-0
        transition-colors
        duration-500

        dark:bg-transparent

        md:-mt-18
        md:px-12
        md:pb-32
        md:pt-0
      "
    >
      {/* =========================================================
          AMBIENT BACKGROUND
          ========================================================= */}

      <div className="pointer-events-none absolute inset-0">
        <motion.div
          initial={
            reducedMotion
              ? false
              : {
                  opacity: 0,
                  scale: 0.7,
                }
          }
          whileInView={
            reducedMotion
              ? undefined
              : {
                  opacity: 1,
                  scale: 1,
                }
          }
          viewport={{
            once: true,
            amount: 0.2,
          }}
          transition={{
            duration: 1.8,
            ease,
          }}
          className="
            absolute
            left-1/2
            top-[12%]
            h-[500px]
            w-[500px]
            -translate-x-1/2
            rounded-full
            bg-emerald-500/[0.035]
            blur-[140px]

            dark:bg-emerald-500/[0.045]
          "
        />

        <motion.div
          initial={
            reducedMotion
              ? false
              : {
                  opacity: 0,
                  x: 100,
                }
          }
          whileInView={
            reducedMotion
              ? undefined
              : {
                  opacity: 1,
                  x: 0,
                }
          }
          viewport={{
            once: true,
            amount: 0.15,
          }}
          transition={{
            duration: 1.4,
            ease,
          }}
          className="
            absolute
            right-[-180px]
            top-[42%]
            h-[420px]
            w-[420px]
            rounded-full
            bg-cyan-500/[0.02]
            blur-[130px]

            dark:bg-cyan-500/[0.025]
          "
        />

        <motion.div
          initial={
            reducedMotion
              ? false
              : {
                  opacity: 0,
                  x: -100,
                }
          }
          whileInView={
            reducedMotion
              ? undefined
              : {
                  opacity: 1,
                  x: 0,
                }
          }
          viewport={{
            once: true,
            amount: 0.1,
          }}
          transition={{
            duration: 1.4,
            ease,
          }}
          className="
            absolute
            bottom-[5%]
            left-[-180px]
            h-[380px]
            w-[380px]
            rounded-full
            bg-teal-500/[0.02]
            blur-[130px]

            dark:bg-teal-500/[0.025]
          "
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl">
        {/* =========================================================
            HEADER
            ========================================================= */}

        <motion.div
          variants={
            reducedMotion
              ? undefined
              : headerContainer
          }
          initial={
            reducedMotion
              ? false
              : "hidden"
          }
          whileInView={
            reducedMotion
              ? undefined
              : "visible"
          }
          viewport={{
            once: true,
            amount: 0.45,
          }}
          className="mx-auto max-w-4xl text-center"
        >
          <motion.div
            variants={
              reducedMotion
                ? undefined
                : headerItem
            }
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
              text-emerald-700

              dark:border-emerald-400/15
              dark:bg-emerald-400/[0.07]
              dark:text-emerald-400
            "
          >
            <Sparkles className="h-4 w-4" />

            <span>Planes para cada etapa</span>
          </motion.div>

          <motion.h2
            variants={
              reducedMotion
                ? undefined
                : headerItem
            }
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
          >
            Luka crece
            <br />

            <span
              className="
                bg-gradient-to-r
                from-teal-700
                via-cyan-600
                to-emerald-600
                bg-clip-text
                text-transparent

                dark:from-emerald-400
                dark:via-teal-400
                dark:to-cyan-400
              "
            >
              contigo.
            </span>
          </motion.h2>

          <motion.p
            variants={
              reducedMotion
                ? undefined
                : headerItem
            }
            className="
              mx-auto
              mt-6
              max-w-2xl
              text-base
              leading-relaxed
              text-slate-600

              dark:text-slate-400

              md:text-lg
            "
          >
            Empieza gratis y escala cuando tu negocio lo necesite.
            Elige las herramientas que tienen sentido para tu etapa.
          </motion.p>
        </motion.div>

        {/* =========================================================
            BILLING TOGGLE
            ========================================================= */}

        <motion.div
          variants={
            reducedMotion
              ? undefined
              : billingReveal
          }
          initial={
            reducedMotion
              ? false
              : "hidden"
          }
          whileInView={
            reducedMotion
              ? undefined
              : "visible"
          }
          viewport={{
            once: true,
            amount: 0.6,
          }}
          className="mt-10 flex justify-center"
        >
          <div
            className="
              inline-flex
              items-center
              rounded-full
              border
              border-slate-200
              bg-white
              p-1.5
              shadow-[0_15px_40px_-20px_rgba(15,23,42,0.18)]

              dark:border-slate-700/80
              dark:bg-slate-900/80
              dark:shadow-[0_15px_40px_-20px_rgba(0,0,0,0.8)]
            "
          >
            <button
              type="button"
              onClick={() =>
                setBillingPeriod("monthly")
              }
              className={`relative z-10 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
                billingPeriod === "monthly"
                  ? "text-slate-950"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {billingPeriod === "monthly" && (
                <motion.div
                  layoutId="active-landing-billing-pill"
                  className="
                    absolute
                    inset-0
                    -z-10
                    rounded-full
                    bg-slate-100
                    shadow-sm

                    dark:bg-white
                  "
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}

              Mensual
            </button>

            <button
              type="button"
              onClick={() =>
                setBillingPeriod("annual")
              }
              className={`relative z-10 flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
                billingPeriod === "annual"
                  ? "text-slate-950"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {billingPeriod === "annual" && (
                <motion.div
                  layoutId="active-landing-billing-pill"
                  className="
                    absolute
                    inset-0
                    -z-10
                    rounded-full
                    bg-slate-100
                    shadow-sm

                    dark:bg-white
                  "
                  transition={{
                    type: "spring",
                    stiffness: 450,
                    damping: 35,
                  }}
                />
              )}

              <span>Anual</span>

              <motion.span
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        scale: [1, 1.05, 1],
                      }
                }
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="
                  rounded-full
                  bg-emerald-500/10
                  px-2
                  py-0.5
                  text-[10px]
                  font-bold
                  text-emerald-700

                  dark:bg-emerald-400/15
                  dark:text-emerald-400
                "
              >
                Ahorra 16%
              </motion.span>
            </button>
          </div>
        </motion.div>

        {/* =========================================================
            PLANS
            ========================================================= */}

        <motion.div
          variants={
            reducedMotion
              ? undefined
              : plansContainer
          }
          initial={
            reducedMotion
              ? false
              : "hidden"
          }
          whileInView={
            reducedMotion
              ? undefined
              : "visible"
          }
          viewport={{
            once: true,
            amount: 0.14,
          }}
          className="
            mt-16
            grid
            grid-cols-1
            items-stretch
            gap-4
            md:grid-cols-2
            lg:grid-cols-3
            xl:grid-cols-5
          "
        >
          {plans.map((plan, index) => {
            const price =
              billingPeriod === "monthly"
                ? plan.monthlyPrice
                : plan.annualPrice;

            const isFeatured = plan.featured;
            const isCorporate = plan.dark;

            const direction =
              index % 2 === 0 ? -1 : 1;

            return (
              <motion.div
                key={plan.name}
                initial={
                  reducedMotion
                    ? false
                    : {
                        opacity: 0,
                        x: direction * 45,
                        y: 45,
                        scale: 0.94,
                        rotate: direction * 1.5,
                        filter: "blur(7px)",
                      }
                }
                whileInView={
                  reducedMotion
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
                viewport={{
                  once: true,
                  amount: 0.18,
                }}
                transition={{
                  duration: 0.8,
                  delay: reducedMotion
                    ? 0
                    : index * 0.13,
                  ease,
                }}
                whileHover={
                  reducedMotion
                    ? undefined
                    : {
                        y: -7,
                        scale: 1.01,
                        transition: {
                          duration: 0.35,
                          ease,
                        },
                      }
                }
                className={`group relative flex h-full min-h-[570px] flex-col overflow-visible rounded-[1.75rem] border ${
                  isFeatured
                    ? "border-emerald-400/30 bg-gradient-to-b from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_30px_80px_-35px_rgba(16,185,129,0.55)]"
                    : isCorporate
                      ? "border-slate-200 bg-white text-slate-950 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700/70 dark:bg-slate-900 dark:text-white"
                      : "border-slate-200 bg-white text-slate-950 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/75 dark:text-white"
                }`}
              >
                {/* =================================================
                    FEATURED DECORATIVE GLOW
                    ================================================= */}

                {isFeatured && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]">
                    <motion.div
                      animate={
                        reducedMotion
                          ? undefined
                          : {
                              x: [0, 18, 0],
                              y: [0, -12, 0],
                              scale: [1, 1.08, 1],
                            }
                      }
                      transition={{
                        duration: 7,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="
                        absolute
                        right-[-70px]
                        top-[-70px]
                        h-48
                        w-48
                        rounded-full
                        bg-white/10
                        blur-3xl
                      "
                    />

                    <motion.div
                      animate={
                        reducedMotion
                          ? undefined
                          : {
                              x: [0, -15, 0],
                              y: [0, 10, 0],
                              scale: [1, 1.06, 1],
                            }
                      }
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="
                        absolute
                        bottom-[-80px]
                        left-[-60px]
                        h-48
                        w-48
                        rounded-full
                        bg-cyan-300/10
                        blur-3xl
                      "
                    />
                  </div>
                )}

                {/* =================================================
                    POPULAR BADGE
                    ================================================= */}

                {isFeatured && (
                  <motion.div
                    initial={
                      reducedMotion
                        ? false
                        : {
                            opacity: 0,
                            y: 10,
                            scale: 0.7,
                          }
                    }
                    whileInView={
                      reducedMotion
                        ? undefined
                        : {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                          }
                    }
                    viewport={{
                      once: true,
                      amount: 0.25,
                    }}
                    transition={{
                      duration: 0.7,
                      delay: reducedMotion
                        ? 0
                        : 0.55,
                      ease,
                    }}
                    className="
                      absolute
                      -top-4
                      left-1/2
                      z-20
                      -translate-x-1/2
                    "
                  >
                    <motion.div
                      animate={
                        reducedMotion
                          ? undefined
                          : {
                              y: [0, -2, 0],
                            }
                      }
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="
                        flex
                        items-center
                        gap-1.5
                        rounded-full
                        bg-amber-400
                        px-5
                        py-2
                        text-xs
                        font-extrabold
                        text-slate-950
                        shadow-lg
                      "
                    >
                      <Star className="h-3.5 w-3.5 fill-current" />

                      MÁS POPULAR
                    </motion.div>
                  </motion.div>
                )}

                <div className="relative flex h-full flex-col p-6 md:p-7">
                  {/* =================================================
                      EYEBROW
                      ================================================= */}

                  <motion.div
                    initial={
                      reducedMotion
                        ? false
                        : {
                            opacity: 0,
                            x: -12,
                          }
                    }
                    whileInView={
                      reducedMotion
                        ? undefined
                        : {
                            opacity: 1,
                            x: 0,
                          }
                    }
                    viewport={{
                      once: true,
                      amount: 0.2,
                    }}
                    transition={{
                      duration: 0.5,
                      delay: reducedMotion
                        ? 0
                        : 0.32 + index * 0.13,
                      ease,
                    }}
                    className="mb-5"
                  >
                    <span
                      className={`text-[10px] font-extrabold tracking-[0.2em] ${
                        isFeatured
                          ? "text-white/75"
                          : isCorporate
                            ? "text-cyan-600 dark:text-cyan-400"
                            : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {plan.eyebrow}
                    </span>
                  </motion.div>

                  {/* =================================================
                      PLAN NAME + DESCRIPTION
                      ================================================= */}

                  <motion.div
                    initial={
                      reducedMotion
                        ? false
                        : {
                            opacity: 0,
                            y: 18,
                          }
                    }
                    whileInView={
                      reducedMotion
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
                      duration: 0.6,
                      delay: reducedMotion
                        ? 0
                        : 0.4 + index * 0.13,
                      ease,
                    }}
                  >
                    <h3 className="text-2xl font-extrabold tracking-tight">
                      {plan.name}
                    </h3>

                    <p
                      className={`mt-3 min-h-[48px] text-sm leading-relaxed ${
                        isFeatured
                          ? "text-white/80"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {plan.description}
                    </p>
                  </motion.div>

                  {/* =================================================
                      PRICE
                      ================================================= */}

                  <div className="mt-7">
                    <AnimatePresence
                      mode="wait"
                      initial={false}
                    >
                      <motion.div
                        key={billingPeriod}
                        initial={{
                          opacity: 0,
                          y: -10,
                          scale: 0.97,
                          filter: "blur(4px)",
                        }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          scale: 1,
                          filter: "blur(0px)",
                        }}
                        exit={{
                          opacity: 0,
                          y: 10,
                          scale: 0.97,
                          filter: "blur(4px)",
                        }}
                        transition={{
                          duration: 0.28,
                          ease,
                        }}
                      >
                        {/* Precio */}

                        <div
                          className={`text-[2.65rem] font-black leading-none tracking-[-0.045em] ${
                            isFeatured
                              ? "text-white"
                              : "text-slate-950 dark:text-white"
                          }`}
                        >
                          {price}
                        </div>

                        {/* Periodo */}

                        {plan.name !== "Asistente" &&
                          plan.name !== "Corporativo" && (
                            <span
                              className={`mt-2 block text-sm font-medium ${
                                isFeatured
                                  ? "text-white/75"
                                  : "text-slate-500 dark:text-slate-500"
                              }`}
                            >
                              /mes
                            </span>
                          )}

                        {/* Facturación anual */}

                        {billingPeriod === "annual" &&
                          plan.annualBilling && (
                            <p
                              className={`mt-2 text-[11px] font-medium ${
                                isFeatured
                                  ? "text-white/70"
                                  : "text-slate-500 dark:text-slate-500"
                              }`}
                            >
                              {plan.annualBilling}
                            </p>
                          )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* =================================================
                      DIVIDER
                      ================================================= */}

                  <motion.div
                    initial={
                      reducedMotion
                        ? false
                        : {
                            opacity: 0,
                            scaleX: 0,
                          }
                    }
                    whileInView={
                      reducedMotion
                        ? undefined
                        : {
                            opacity: 1,
                            scaleX: 1,
                          }
                    }
                    viewport={{
                      once: true,
                      amount: 0.2,
                    }}
                    transition={{
                      duration: 0.6,
                      delay: reducedMotion
                        ? 0
                        : 0.5 + index * 0.13,
                      ease,
                    }}
                    className={`my-7 h-px origin-left ${
                      isFeatured
                        ? "bg-white/15"
                        : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />

                  {/* =================================================
                      FEATURES
                      ================================================= */}

                  <div className="flex-1">
                    <ul className="space-y-3.5">
                      {plan.features.map(
                        (feature, featureIndex) => (
                          <motion.li
                            key={feature}
                            initial={
                              reducedMotion
                                ? false
                                : {
                                    opacity: 0,
                                    x: -12,
                                    y: 5,
                                  }
                            }
                            whileInView={
                              reducedMotion
                                ? undefined
                                : {
                                    opacity: 1,
                                    x: 0,
                                    y: 0,
                                  }
                            }
                            viewport={{
                              once: true,
                              amount: 0.2,
                            }}
                            transition={{
                              duration: 0.45,
                              delay: reducedMotion
                                ? 0
                                : 0.56 +
                                  index * 0.13 +
                                  featureIndex * 0.055,
                              ease,
                            }}
                            className="flex items-start gap-2.5 text-sm"
                          >
                            <motion.span
                              initial={
                                reducedMotion
                                  ? false
                                  : {
                                      scale: 0,
                                      rotate: -45,
                                    }
                              }
                              whileInView={
                                reducedMotion
                                  ? undefined
                                  : {
                                      scale: 1,
                                      rotate: 0,
                                    }
                              }
                              viewport={{
                                once: true,
                                amount: 0.2,
                              }}
                              transition={{
                                duration: 0.4,
                                delay: reducedMotion
                                  ? 0
                                  : 0.62 +
                                    index * 0.13 +
                                    featureIndex * 0.055,
                                ease,
                              }}
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                                isFeatured
                                  ? "bg-white/15"
                                  : "bg-emerald-500/10"
                              }`}
                            >
                              <Check
                                className={`h-2.5 w-2.5 ${
                                  isFeatured
                                    ? "text-white"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              />
                            </motion.span>

                            <span
                              className={
                                isFeatured
                                  ? "text-white/90"
                                  : "text-slate-700 dark:text-slate-300"
                              }
                            >
                              {feature}
                            </span>
                          </motion.li>
                        ),
                      )}
                    </ul>
                  </div>

                  {/* =================================================
                      CTA
                      ================================================= */}

                  {plan.link.startsWith("http") ? (
                    <motion.a
                      href={plan.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={
                        reducedMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 15,
                            }
                      }
                      whileInView={
                        reducedMotion
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
                        duration: 0.55,
                        delay: reducedMotion
                          ? 0
                          : 0.78 + index * 0.13,
                        ease,
                      }}
                      whileHover={
                        reducedMotion
                          ? undefined
                          : {
                              scale: 1.025,
                            }
                      }
                      whileTap={
                        reducedMotion
                          ? undefined
                          : {
                              scale: 0.98,
                            }
                      }
                      className={`mt-8 flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-extrabold transition-colors duration-300 ${
                        isFeatured
                          ? "bg-white text-slate-900 hover:bg-slate-50"
                          : isCorporate
                            ? "bg-cyan-500 text-white hover:bg-cyan-400 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                            : "bg-emerald-500 text-white hover:bg-emerald-400"
                      }`}
                    >
                      {plan.button}
                    </motion.a>
                  ) : (
                    <motion.div
                      initial={
                        reducedMotion
                          ? false
                          : {
                              opacity: 0,
                              y: 15,
                            }
                      }
                      whileInView={
                        reducedMotion
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
                        duration: 0.55,
                        delay: reducedMotion
                          ? 0
                          : 0.78 + index * 0.13,
                        ease,
                      }}
                    >
                      <Link
                        to={plan.link}
                        className={`flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-extrabold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                          isFeatured
                            ? "bg-white text-slate-900 hover:bg-slate-50"
                            : isCorporate
                              ? "bg-cyan-500 text-white hover:bg-cyan-400 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                              : "bg-emerald-500 text-white hover:bg-emerald-400"
                        }`}
                      >
                        {plan.button}
                      </Link>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* =========================================================
            BOTTOM MESSAGE
            ========================================================= */}

        <motion.div
          variants={
            reducedMotion
              ? undefined
              : bottomMessage
          }
          initial={
            reducedMotion
              ? false
              : "hidden"
          }
          whileInView={
            reducedMotion
              ? undefined
              : "visible"
          }
          viewport={{
            once: true,
            amount: 0.8,
          }}
          className="mx-auto mt-14 max-w-3xl text-center"
        >
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-500">
            No necesitas empezar con todo.
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {" "}
              Empieza con lo que necesitas hoy y crece con Luka.
            </span>
          </p>
        </motion.div>
      </div>
    </section>
  );
}