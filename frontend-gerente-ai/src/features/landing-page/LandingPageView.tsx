import { CoworkingNavbar } from "./components/CoworkingNavbar";
import { CoworkingHeroSection } from "./components/CoworkingHeroSection";
import { CoworkingHighlightsSection } from "./components/CoworkingHighlightsSection";
import { CoworkingBusinessesSection } from "./components/CoworkingBusinessesSection";
import { CoworkingHowItWorksSection } from "./components/CoworkingHowItWorksSection";
import { LocationsBento } from "./components/LocationsBento";
/* import { CoworkingBenefitsSection } from "./components/CoworkingBenefitsSection";*/
import { CoworkingPhilosophySection } from "./components/CoworkingPhilosophySection";
/* import { CoworkingTestimonialsSection } from "./components/CoworkingTestimonialsSection"; */
import { CoworkingPricingSection } from "./components/CoworkingPricingSection";
import { CoworkingFaqSection } from "./components/CoworkingFaqSection";
import { CoworkingFooterSection } from "./components/CoworkingFooterSection";
import { LukaDynamicAtmosphere } from "./components/LukaDynamicAtmosphere";

import { LukaChatProvider, LukaFloatingChat } from "@/features/assistant";

export function LandingPageView() {
  return (
    <LukaChatProvider>
      <div
        className="
          relative
          min-h-screen
          w-full
          overflow-hidden
          bg-slate-50
          font-sans
          text-slate-900
          transition-colors
          duration-500
          selection:bg-emerald-500/30
          dark:bg-[#070B12]
          dark:text-slate-50
          luka-surface-pattern
        "
      >
        {/* =====================================================
            GLOBAL PAGE BACKGROUND
            =====================================================

            ESTE ES EL ÚNICO FONDO BASE DE TODA LA LANDING.

            Light:
              bg-slate-50

            Dark:
              #070B12

            Todas las secciones deben dejar este fondo visible.
        ===================================================== */}

        <LukaDynamicAtmosphere />
        <div className="luka-home-gradient" aria-hidden="true" />

        <div className="relative z-30">
          {/* ===================================================
              NAVBAR
          =================================================== */}

          <CoworkingNavbar />

          <main>
            {/* =================================================
                HERO
            ================================================= */}

            <section
              id="inicio"
              className="scroll-mt-28"
            >
              <CoworkingHeroSection />
            </section>

            {/* =================================================
                BENEFICIOS / COMENTARIOS
            ================================================= */}

            <section
              id="beneficios"
              className="scroll-mt-28"
            >
              <CoworkingHighlightsSection />
            </section>

            {/* =================================================
                NEGOCIOS
            ================================================= */}

            <section
              id="negocios"
              className="scroll-mt-28"
            >
              <CoworkingBusinessesSection />
            </section>

            {/* =================================================
                CÓMO FUNCIONA
            ================================================= */}

            <section
              id="como-funciona"
              className="scroll-mt-28"
            >
              <CoworkingHowItWorksSection />
            </section>

            {/* =================================================
                UBICACIONES / TIPOS DE NEGOCIO
            ================================================= */}

            <section
              id="ubicaciones"
              className="scroll-mt-28"
            >
              <LocationsBento />
            </section>

            {/* =================================================
                BENEFICIOS ADICIONALES
            ================================================= */}

            {/* <section
              id="ventajas"
              className="scroll-mt-28"
            >
              <CoworkingBenefitsSection />
            </section>

            {/* =================================================
                CARACTERÍSTICAS
            ================================================= */}

            {/* <section
              id="caracteristicas"
              className="scroll-mt-28"
            >
              <CoworkingFeaturesSection />
            </section>

            {/* =================================================
                FILOSOFÍA
            ================================================= */}

            <section
              id="filosofia"
              className="scroll-mt-28"
            >
              <CoworkingPhilosophySection />
            </section>

            {/* =================================================
                TESTIMONIOS
            ================================================= */}

            {/* <section
              id="testimonios"
              className="scroll-mt-28"
            >
              <CoworkingTestimonialsSection />
            </section>

            {/* =================================================
                PLANES
            ================================================= */}

            <section
              id="planes"
              className="scroll-mt-28"
            >
              <CoworkingPricingSection />
            </section>

            {/* =================================================
                PREGUNTAS FRECUENTES
            ================================================= */}

            <section
              id="faq"
              className="scroll-mt-28"
            >
              <CoworkingFaqSection />
            </section>
          </main>

          {/* ===================================================
              FOOTER
          =================================================== */}

          <CoworkingFooterSection />
        </div>

        {/* =====================================================
            GLOBAL FLOATING CHAT
        ===================================================== */}

        <LukaFloatingChat />
      </div>
    </LukaChatProvider>
  );
}