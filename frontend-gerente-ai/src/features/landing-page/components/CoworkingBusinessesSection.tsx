"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import {
  BookOpen,
  CarFront,
  Coffee,
  Scissors,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Business = {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBackground: string;
};

const businesses: Business[] = [
  {
    title: "Cafeterías",
    description: "Ventas, insumos y clientes frecuentes.",
    icon: Coffee,
    iconColor: "text-amber-700",
    iconBackground: "bg-amber-100",
  },
  {
    title: "Restaurantes",
    description: "Pedidos, inventario y gastos diarios.",
    icon: UtensilsCrossed,
    iconColor: "text-rose-700",
    iconBackground: "bg-rose-100",
  },
  {
    title: "Tiendas",
    description: "Control de productos y ventas.",
    icon: Store,
    iconColor: "text-sky-700",
    iconBackground: "bg-sky-100",
  },
  {
    title: "Minimercados",
    description: "Inventario y proveedores.",
    icon: ShoppingBasket,
    iconColor: "text-emerald-700",
    iconBackground: "bg-emerald-100",
  },
  {
    title: "Peluquerías",
    description: "Citas, clientes e ingresos.",
    icon: Scissors,
    iconColor: "text-fuchsia-700",
    iconBackground: "bg-fuchsia-100",
  },
  {
    title: "Ferreterías",
    description: "Stock y compras.",
    icon: Wrench,
    iconColor: "text-orange-700",
    iconBackground: "bg-orange-100",
  },
  {
    title: "Talleres",
    description: "Servicios, repuestos y clientes.",
    icon: CarFront,
    iconColor: "text-indigo-700",
    iconBackground: "bg-indigo-100",
  },
  {
    title: "Papelerías",
    description: "Productos escolares y ventas.",
    icon: BookOpen,
    iconColor: "text-violet-700",
    iconBackground: "bg-violet-100",
  },
];

/* =========================================================
   EASING
========================================================= */

const ease = [0.22, 1, 0.36, 1] as const;

/* =========================================================
   ANIMACIÓN DEL CONTENEDOR PRINCIPAL
========================================================= */

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.8,
      ease,
    },
  },
};

/* =========================================================
   HEADER
========================================================= */

const headerContainerVariants: Variants = {
  hidden: {},

  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const headerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 18,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.65,
      ease,
    },
  },
};

/* =========================================================
   TARJETAS DE NEGOCIOS
========================================================= */

const businessCardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 42,
    scale: 0.92,
  },

  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      type: "spring",
      stiffness: 110,
      damping: 16,
      mass: 0.8,
      delay: index * 0.075,
    },
  }),
};

/* =========================================================
   LOGOS
========================================================= */

const logoVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.72,
  },

  visible: (index: number) => ({
    opacity: 1,
    scale: 1,

    transition: {
      type: "spring",
      stiffness: 180,
      damping: 14,
      mass: 0.6,
      delay: 0.12 + index * 0.075,
    },
  }),
};

/* =========================================================
   COMPONENT
========================================================= */

export function CoworkingBusinessesSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      className="
        relative
        px-6
        pt-10
        pb-6
        md:pt-14
        md:pb-2
      "
    >
      <motion.div
        variants={containerVariants}
        initial={
          shouldReduceMotion
            ? false
            : "hidden"
        }
        whileInView={
          shouldReduceMotion
            ? undefined
            : "visible"
        }
        viewport={{
          once: true,
          amount: 0.15,
        }}
        className="
          mx-auto
          max-w-7xl
          overflow-hidden
          rounded-[2.5rem]
          border
          border-slate-200/90
          bg-white/45
          px-6
          py-16
          shadow-[0_25px_70px_rgba(15,23,42,0.08)]
          backdrop-blur-xl

          dark:border-white/[0.08]
          dark:bg-[#111925]/65
          dark:shadow-black/20

          md:px-10
          md:py-20
          lg:px-14
        "
      >
        {/* =====================================================
            ENCABEZADO
        ===================================================== */}

        <motion.div
          variants={headerContainerVariants}
          initial={
            shouldReduceMotion
              ? false
              : "hidden"
          }
          whileInView={
            shouldReduceMotion
              ? undefined
              : "visible"
          }
          viewport={{
            once: true,
            amount: 0.25,
          }}
          className="
            mx-auto
            max-w-3xl
            text-center
          "
        >
          {/* BADGE */}

          <motion.div
            variants={headerItemVariants}
            className="
              inline-flex
              items-center
              rounded-full
              border
              border-emerald-600/15
              bg-emerald-950/[0.06]
              px-5
              py-2
              text-sm
              font-semibold
              text-emerald-800

              dark:border-emerald-400/20
              dark:bg-emerald-400/[0.08]
              dark:text-emerald-300
            "
          >
            Un solo asistente para miles de negocios
          </motion.div>

          {/* TÍTULO */}

          <motion.h2
            variants={headerItemVariants}
            className="
              mt-8
              text-5xl
              font-bold
              tracking-tight
              text-slate-950
              md:text-6xl

              dark:text-white
            "
          >
            Luka se adapta

            <span
              className="
                block
                bg-gradient-to-r
                from-teal-700
                via-cyan-600
                to-emerald-600
                bg-clip-text
                text-transparent

                dark:from-emerald-400
                dark:via-cyan-400
                dark:to-teal-400
              "
            >
             a la forma en que ya trabajas.
            </span>
          </motion.h2>

          {/* DESCRIPCIÓN */}

          <motion.p
            variants={headerItemVariants}
            className="
              mt-8
              text-xl
              leading-9
              text-slate-700

              dark:text-slate-300
            "
          >
            No importa si administras una cafetería, una tienda
            o un taller. Luka entiende tu negocio y te ayuda desde
            el primer día.
          </motion.p>
        </motion.div>

        {/* =====================================================
            CATEGORÍAS
        ===================================================== */}

        <div
          className="
            mx-auto
            mt-16
            grid
            max-w-6xl
            gap-5
            sm:grid-cols-2
            xl:grid-cols-4
          "
        >
          {businesses.map((business, index) => {
            return (
              <motion.div
                key={business.title}
                custom={index}
                variants={businessCardVariants}
                initial={
                  shouldReduceMotion
                    ? false
                    : "hidden"
                }
                whileInView={
                  shouldReduceMotion
                    ? undefined
                    : "visible"
                }
                viewport={{
                  once: true,
                  amount: 0.2,
                }}
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : {
                        y: -8,
                        scale: 1.025,
                        transition: {
                          type: "spring",
                          stiffness: 350,
                          damping: 22,
                        },
                      }
                }
                className="
                  group
                  relative
                  rounded-[1.75rem]
                  border
                  border-slate-200
                  bg-white
                  p-6
                  shadow-[0_10px_30px_rgba(15,23,42,0.06)]
                  transition-[border-color,box-shadow]
                  duration-300

                  hover:border-emerald-500/30
                  hover:shadow-[0_22px_50px_rgba(15,23,42,0.12)]

                  dark:border-white/[0.08]
                  dark:bg-[#17202D]
                  dark:shadow-black/10
                  dark:hover:border-emerald-400/25
                  dark:hover:bg-[#192432]

                  sm:p-7
                "
              >
                {/* =================================================
                    PEQUEÑO GLOW AL HACER HOVER
                ================================================= */}

                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    rounded-[1.75rem]
                    bg-gradient-to-br
                    from-emerald-400/[0.04]
                    via-transparent
                    to-cyan-400/[0.04]
                    opacity-0
                    transition-opacity
                    duration-500
                    group-hover:opacity-100
                  "
                />

                {/* =================================================
                    CONTENIDO
                ================================================= */}

                <div className="relative z-10">
                  {/* =================================================
                      ICONO
                  ================================================= */}

                  <motion.div
                    custom={index}
                    variants={logoVariants}
                    initial={
                      shouldReduceMotion
                        ? false
                        : "hidden"
                    }
                    whileInView={
                      shouldReduceMotion
                        ? undefined
                        : "visible"
                    }
                    viewport={{
                      once: true,
                      amount: 0.2,
                    }}
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : {
                            scale: 1.08,
                            rotate: 2,
                            transition: {
                              type: "spring",
                              stiffness: 300,
                              damping: 18,
                            },
                          }
                    }
                    className={`
                      flex
                      h-14
                      w-14
                      shrink-0
                      items-center
                      justify-center
                      overflow-hidden
                      rounded-full
                      border
                      border-transparent
                      shadow-sm
                      ring-1
                      ring-slate-200/60

                      dark:border-white/10
                      dark:ring-white/10
                      ${business.iconBackground}
                    `}
                  >
                    <business.icon
                      aria-hidden="true"
                      className={`h-7 w-7 ${business.iconColor}`}
                      strokeWidth={2.2}
                    />
                  </motion.div>

                  {/* =================================================
                      NOMBRE
                  ================================================= */}

                  <motion.h3
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
                      amount: 0.2,
                    }}
                    transition={{
                      duration: 0.45,
                      delay: 0.18 + index * 0.075,
                      ease,
                    }}
                    className="
                      mt-7
                      text-[1.25rem]
                      font-bold
                      tracking-tight
                      text-slate-950

                      dark:text-white
                    "
                  >
                    {business.title}
                  </motion.h3>

                  {/* =================================================
                      DESCRIPCIÓN
                  ================================================= */}

                  <motion.p
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
                      amount: 0.2,
                    }}
                    transition={{
                      duration: 0.45,
                      delay: 0.24 + index * 0.075,
                      ease,
                    }}
                    className="
                      mt-3
                      text-[0.95rem]
                      leading-7
                      text-slate-600

                      dark:text-slate-400
                    "
                  >
                    {business.description}
                  </motion.p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}