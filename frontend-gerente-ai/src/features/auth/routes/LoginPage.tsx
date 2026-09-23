import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { LoginShowcase } from "@/features/auth/components/LoginShowcase";
import { LukaDynamicAtmosphere } from "@/features/landing-page/components/LukaDynamicAtmosphere";

import { ThemeToggle } from "@/shared/components/layout/ThemeToggle";

export function LoginPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden flex bg-slate-50 dark:bg-[#070B12] font-body">
      <div className="luka-home-gradient" aria-hidden="true" />
      {/* =========================
          LEFT SIDE: FORM
      ========================== */}
      <div
        className="
          w-full
          lg:w-1/2
          relative
          z-20
          flex
          flex-col
          animate-in
          fade-in
          slide-in-from-left-8
          duration-700
          bg-transparent
        "
      >
        <LukaDynamicAtmosphere contained />
        {/* =========================
            MOBILE NAVIGATION
        ========================== */}
        <Link
          to="/home"
          aria-label="Volver al inicio"
          title="Volver al inicio"
          className="
            absolute
            top-3
            left-6
            z-20
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            text-muted-foreground
            transition-all
            duration-200
            hover:bg-muted
            hover:text-foreground
            hover:scale-105
            lg:hidden
          "
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {/* =========================
            LOGO + THEME TOGGLE
        ========================== */}
        <div
          className="
            p-8
            pt-14
            sm:p-12
            sm:pt-12
            flex
            items-start
            justify-between
          "
        >
          <Link
            to="/home"
            className="inline-flex items-center gap-2 shrink-0 group cursor-pointer"
            aria-label="Luka AI - Inicio"
          >
            <img
              src="/Luka.png"
              alt="Luka AI"
              className="
                h-11
                w-auto
                max-w-[170px]
                object-contain
                object-left
                transition-transform
                duration-200
                group-hover:scale-[1.03]
              "
            />

            <span className="text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
              Luka AI
            </span>
          </Link>

          {/* THEME TOGGLE */}
          <div className="flex items-center">
            <ThemeToggle />
          </div>
        </div>

        {/* =========================
            CENTER FORM
        ========================== */}
        <div className="flex-1 flex items-center justify-center">
          <LoginForm />
        </div>

        {/* =========================
            FOOTER
        ========================== */}
        <div
          className="
            mt-auto
            p-8
            sm:p-12
            text-center
            lg:text-left
            text-sm
            font-medium
            text-muted-foreground
          "
        >
          &copy; {new Date().getFullYear()} Luka AI. Todos los derechos reservados.
        </div>
      </div>

      {/* =========================
          RIGHT SIDE: SHOWCASE
      ========================== */}
      <div
        className="
          hidden
          lg:block
          w-1/2
          animate-in
          fade-in
          slide-in-from-right-8
          duration-700
          relative
          z-20
        "
      >
        <LoginShowcase />
      </div>
    </div>
  );
}