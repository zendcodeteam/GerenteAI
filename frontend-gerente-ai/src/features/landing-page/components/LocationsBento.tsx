"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  MessageSquare,
  BarChart3,
  Zap,
  Shield,
  Package,
  Wallet,
  Users,
  ShoppingCart,
  TrendingUp,
  Store,
  Receipt,
  BrainCircuit,
} from "lucide-react";

const features = [
  {
    title: "Registro desde WhatsApp",
    description:
      "Olvídate de las hojas de cálculo. Envía un mensaje a tu asistente y él registrará tus gastos o ingresos automáticamente.",
    image:
      "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1920&q=90",
    icon: MessageSquare,
  },
  {
    title: "Análisis en tiempo real",
    description:
      "Visualiza tus métricas clave, flujo de caja y rentabilidad en un dashboard intuitivo y siempre actualizado.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1920&q=90",
    icon: BarChart3,
  },
  {
    title: "Inteligencia Artificial",
    description:
      "Recibe consejos financieros personalizados y alertas tempranas sobre tu negocio.",
    image:
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1920&q=90",
    icon: Zap,
  },
  {
    title: "Seguro y privado",
    description:
      "Tus datos financieros están encriptados y seguros en la nube.",
    image:
      "https://images.unsplash.com/photo-1601597111158-2fceff292cdc?auto=format&fit=crop&w=1920&q=90",
    icon: Shield,
  },
  {
    title: "Control de inventario",
    description:
      "Consulta tus productos, existencias y movimientos sin perder tiempo haciendo cuentas.",
    image:
      "https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&w=1920&q=90",
    icon: Package,
  },
  {
    title: "Control de gastos",
    description:
      "Registra tus gastos fácilmente y descubre en qué estás utilizando el dinero de tu negocio.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1920&q=90",
    icon: Wallet,
  },
  {
    title: "Clientes organizados",
    description:
      "Mantén organizada la información de tus clientes y consulta su actividad cuando la necesites.",
    image:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=90",
    icon: Users,
  },
  {
    title: "Registra tus ventas",
    description:
      "Registra cada venta desde cualquier lugar y deja que Luka organice toda la información.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1920&q=90",
    icon: ShoppingCart,
  },
  {
    title: "Entiende tus resultados",
    description:
      "Descubre qué está funcionando en tu negocio y encuentra oportunidades para hacerlo crecer.",
    image:
      "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1920&q=90",
    icon: TrendingUp,
  },
  {
    title: "Tu negocio siempre contigo",
    description:
      "Consulta la información de tu negocio desde cualquier lugar utilizando simplemente WhatsApp.",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1920&q=90",
    icon: Store,
  },
  {
    title: "Reportes inteligentes",
    description:
      "Obtén información clara sobre ventas, gastos, inventario y utilidad sin hacer cálculos manuales.",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1920&q=90",
    icon: Receipt,
  },
  {
    title: "Luka entiende tu negocio",
    description:
      "La inteligencia artificial comprende el contexto de tu negocio para ayudarte a tomar mejores decisiones.",
    image:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1920&q=90",
    icon: BrainCircuit,
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

/* =========================================================
   HEADER
   ========================================================= */

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
    y: 30,
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

/* =========================================================
   CAROUSEL
   ========================================================= */

const carouselReveal = {
  hidden: {
    opacity: 0,
    y: 35,
    scale: 0.985,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.9,
      ease,
      delay: 0.15,
    },
  },
};

/* =========================================================
   CARD
   ========================================================= */

const cardReveal = {
  hidden: {
    opacity: 0,
    y: 35,
    scale: 0.94,
    filter: "blur(7px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.8,
      ease,
    },
  },
};

/* =========================================================
   CONTENT
   ========================================================= */

const cardContent = {
  hidden: {
    opacity: 0,
    y: 24,
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

const iconReveal = {
  hidden: {
    opacity: 0,
    scale: 0.55,
    rotate: -18,
  },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      duration: 0.65,
      ease,
    },
  },
};

export function LocationsBento() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);

  const reducedMotion = useReducedMotion();

  /* =========================================================
     MOVE CAROUSEL
     ========================================================= */

  const moveCarousel = (direction: "left" | "right") => {
    if (!carouselRef.current) return;

    const carousel = carouselRef.current;

    const cards = Array.from(
      carousel.querySelectorAll<HTMLElement>("[data-card]")
    );

    if (!cards.length) return;

    const visibleCards = cards.filter((card) => {
      const rect = card.getBoundingClientRect();
      const carouselRect = carousel.getBoundingClientRect();

      return (
        rect.right > carouselRect.left &&
        rect.left < carouselRect.right
      );
    });

    if (!visibleCards.length) return;

    if (direction === "right") {
      const rightMostCard = visibleCards[visibleCards.length - 1];

      const currentIndex = cards.indexOf(rightMostCard);
      const nextCard = cards[currentIndex + 1];

      if (nextCard) {
        nextCard.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    } else {
      const leftMostCard = visibleCards[0];

      const currentIndex = cards.indexOf(leftMostCard);
      const previousCard = cards[currentIndex - 1];

      if (previousCard) {
        previousCard.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }
    }
  };

  /* =========================================================
     CARD CLICK
     ========================================================= */

  const handleCardClick = (
    event: React.MouseEvent<HTMLElement>,
    index: number
  ) => {
    if (!carouselRef.current) return;

    if (isDragging.current) return;

    const carousel = carouselRef.current;

    const cards = Array.from(
      carousel.querySelectorAll<HTMLElement>("[data-card]")
    );

    const visibleCards = cards.filter((card) => {
      const rect = card.getBoundingClientRect();
      const carouselRect = carousel.getBoundingClientRect();

      return (
        rect.right > carouselRect.left + 10 &&
        rect.left < carouselRect.right - 10
      );
    });

    if (visibleCards.length < 2) return;

    const leftMostIndex = cards.indexOf(visibleCards[0]);

    const rightMostIndex = cards.indexOf(
      visibleCards[visibleCards.length - 1]
    );

    if (index === leftMostIndex) {
      moveCarousel("left");
      return;
    }

    if (index === rightMostIndex) {
      moveCarousel("right");
    }
  };

  /* =========================================================
     POINTER / SWIPE
     ========================================================= */

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    isDragging.current = false;
    dragStartX.current = event.clientX;
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const distance = Math.abs(
      event.clientX - dragStartX.current
    );

    if (distance > 8) {
      isDragging.current = true;
    }
  };

  const handlePointerUp = () => {
    setTimeout(() => {
      isDragging.current = false;
    }, 0);
  };

  return (
    <section
      id="features"
      className="
        relative
        w-full
        overflow-hidden
        bg-transparent
        pt-3
        pb-8
        dark:bg-transparent
      "
    >
      {/* =========================================================
          HEADER
          ========================================================= */}

      <motion.div
        variants={reducedMotion ? undefined : headerContainer}
        initial={reducedMotion ? false : "hidden"}
        whileInView={reducedMotion ? undefined : "visible"}
        viewport={{
          once: true,
          amount: 0.45,
        }}
        className="
          mx-auto
          mb-12
          w-full
          max-w-7xl
          px-6
          sm:px-8
          md:px-12
        "
      >
        <div className="max-w-2xl">
          <motion.h2
            variants={reducedMotion ? undefined : headerItem}
            className="
              text-3xl
              font-extrabold
              leading-[1.02]
              tracking-tight
              text-slate-900
              dark:text-white
              md:text-5xl
            "
          >
            Todo lo que necesitas en un solo lugar
          </motion.h2>

          <motion.p
            variants={reducedMotion ? undefined : headerItem}
            className="
              mt-6
              max-w-2xl
              text-lg
              leading-8
              text-slate-600
              dark:text-slate-400
            "
          >
            Diseñado para simplificar tu operativa diaria con
            tecnología de punta.
          </motion.p>
        </div>
      </motion.div>

      {/* =========================================================
          HORIZONTAL CAROUSEL
          
          IMPORTANTE:
          La animación ahora pertenece al carrusel completo.
          Todas las tarjetas reciben su estado "visible" al mismo
          tiempo. Esto evita que las tarjetas horizontales esperen
          a entrar en el viewport vertical.
          ========================================================= */}

      <motion.div
        variants={reducedMotion ? undefined : carouselReveal}
        initial={reducedMotion ? false : "hidden"}
        whileInView={reducedMotion ? undefined : "visible"}
        viewport={{
          once: true,
          amount: 0.18,
        }}
        ref={carouselRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="
          flex
          w-full
          cursor-grab
          gap-4
          overflow-x-auto
          px-4
          pb-6
          snap-x
          snap-mandatory
          scroll-smooth
          active:cursor-grabbing

          [scrollbar-width:none]
          [-ms-overflow-style:none]
          [&::-webkit-scrollbar]:hidden

          sm:gap-5
          sm:px-8

          lg:gap-6
          lg:px-[max(2rem,calc((100vw-1280px)/2))]
        "
      >
        {features.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <motion.article
              key={feature.title}
              data-card
              onClick={(event) =>
                handleCardClick(event, index)
              }
              variants={
                reducedMotion
                  ? undefined
                  : cardReveal
              }
              initial={
                reducedMotion
                  ? false
                  : "hidden"
              }
              animate={
                reducedMotion
                  ? undefined
                  : "visible"
              }
              transition={{
                duration: 0.8,
                ease,
                delay: reducedMotion
                  ? 0
                  : index * 0.04,
              }}
              whileHover={
                reducedMotion
                  ? undefined
                  : {
                      y: -8,
                      scale: 1.015,
                      transition: {
                        duration: 0.35,
                        ease,
                      },
                    }
              }
              className="
                group
                relative
                h-[500px]
                w-[82vw]
                max-w-[420px]
                shrink-0
                snap-start
                cursor-pointer
                overflow-hidden
                rounded-[2rem]
                bg-slate-900
                shadow-xl

                sm:h-[520px]
                sm:w-[400px]

                lg:w-[420px]
              "
            >
              {/* =================================================
                  BUSINESS IMAGE
                  ================================================= */}

              <motion.img
                src={feature.image}
                alt=""
                loading="lazy"
                draggable={false}
                initial={
                  reducedMotion
                    ? false
                    : {
                        scale: 1.08,
                      }
                }
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        scale: 1,
                      }
                }
                whileHover={
                  reducedMotion
                    ? undefined
                    : {
                        scale: 1.07,
                      }
                }
                transition={{
                  duration: 1.2,
                  ease,
                }}
                className="
                  absolute
                  inset-0
                  h-full
                  w-full
                  select-none
                  object-cover
                "
              />

              {/* =================================================
                  IMAGE GRADIENT
                  ================================================= */}

              <motion.div
                initial={
                  reducedMotion
                    ? false
                    : {
                        opacity: 0.25,
                      }
                }
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        opacity: 1,
                      }
                }
                transition={{
                  duration: 0.9,
                  ease,
                }}
                className="
                  absolute
                  inset-0
                  bg-gradient-to-b
                  from-black/5
                  via-black/10
                  to-black/90
                "
              />

              {/* =================================================
                  HOVER OVERLAY
                  ================================================= */}

              <motion.div
                className="
                  absolute
                  inset-0
                  bg-black/0
                  transition-colors
                  duration-500
                  group-hover:bg-black/10
                "
              />

              {/* =================================================
                  ICON
                  ================================================= */}

              <motion.div
                variants={
                  reducedMotion
                    ? undefined
                    : iconReveal
                }
                initial={
                  reducedMotion
                    ? false
                    : "hidden"
                }
                animate={
                  reducedMotion
                    ? undefined
                    : "visible"
                }
                transition={{
                  delay: reducedMotion
                    ? 0
                    : 0.15,
                }}
                whileHover={
                  reducedMotion
                    ? undefined
                    : {
                        scale: 1.08,
                        rotate: 4,
                        transition: {
                          duration: 0.3,
                          ease,
                        },
                      }
                }
                className="
                  absolute
                  left-7
                  top-7
                  z-10
                  flex
                  h-12
                  w-12
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-white/20
                  bg-black/30
                  text-white
                  shadow-xl
                  backdrop-blur-md
                "
              >
                <Icon size={22} />
              </motion.div>

              {/* =================================================
                  CARD NUMBER
                  ================================================= */}

              <motion.div
                initial={
                  reducedMotion
                    ? false
                    : {
                        opacity: 0,
                        x: 15,
                      }
                }
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        opacity: 1,
                        x: 0,
                      }
                }
                transition={{
                  duration: 0.55,
                  delay: reducedMotion
                    ? 0
                    : 0.18,
                  ease,
                }}
                className="
                  absolute
                  right-7
                  top-7
                  z-10
                  text-xs
                  font-bold
                  tracking-widest
                  text-white/60
                "
              >
                {String(index + 1).padStart(2, "0")}
              </motion.div>

              {/* =================================================
                  CONTENT
                  ================================================= */}

              <motion.div
                variants={
                  reducedMotion
                    ? undefined
                    : cardContent
                }
                initial={
                  reducedMotion
                    ? false
                    : "hidden"
                }
                animate={
                  reducedMotion
                    ? undefined
                    : "visible"
                }
                transition={{
                  delay: reducedMotion
                    ? 0
                    : 0.18,
                }}
                className="
                  absolute
                  inset-x-0
                  bottom-0
                  z-10
                  p-7
                  sm:p-8
                "
              >
                <motion.h3
                  initial={
                    reducedMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 16,
                        }
                  }
                  animate={
                    reducedMotion
                      ? undefined
                      : {
                          opacity: 1,
                          y: 0,
                        }
                  }
                  transition={{
                    duration: 0.55,
                    delay: reducedMotion
                      ? 0
                      : 0.25,
                    ease,
                  }}
                  className="
                    max-w-[350px]
                    text-2xl
                    font-extrabold
                    leading-[1.05]
                    tracking-tight
                    text-white

                    sm:text-3xl
                  "
                >
                  {feature.title}
                </motion.h3>

                <motion.p
                  initial={
                    reducedMotion
                      ? false
                      : {
                          opacity: 0,
                          y: 14,
                        }
                  }
                  animate={
                    reducedMotion
                      ? undefined
                      : {
                          opacity: 1,
                          y: 0,
                        }
                  }
                  transition={{
                    duration: 0.55,
                    delay: reducedMotion
                      ? 0
                      : 0.32,
                    ease,
                  }}
                  className="
                    mt-4
                    max-w-[350px]
                    text-base
                    leading-7
                    text-white/80
                  "
                >
                  {feature.description}
                </motion.p>
              </motion.div>

              {/* =================================================
                  SUBTLE TOP LIGHT
                  ================================================= */}

              <motion.div
                initial={
                  reducedMotion
                    ? false
                    : {
                        opacity: 0,
                        scaleX: 0.4,
                      }
                }
                animate={
                  reducedMotion
                    ? undefined
                    : {
                        opacity: 1,
                        scaleX: 1,
                      }
                }
                transition={{
                  duration: 0.8,
                  delay: reducedMotion
                    ? 0
                    : 0.12,
                  ease,
                }}
                className="
                  absolute
                  left-7
                  right-7
                  top-0
                  h-px
                  origin-center
                  bg-white/30
                "
              />
            </motion.article>
          );
        })}

        {/* =======================================================
            FINAL SPACING
            ======================================================= */}

        <div className="w-4 shrink-0 sm:w-8" />
      </motion.div>

      {/* =========================================================
          MOBILE HINT
          ========================================================= */}

      <motion.div
        initial={
          reducedMotion
            ? false
            : {
                opacity: 0,
                y: 12,
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
          amount: 0.8,
        }}
        transition={{
          duration: 0.6,
          delay: 0.15,
          ease,
        }}
        className="
          mx-auto
          mt-1
          w-full
          max-w-7xl
          px-6
          text-sm
          text-slate-400
          sm:px-8
          md:hidden
          md:px-12
        "
      >
        Desliza para descubrir más
      </motion.div>
    </section>
  );
}