import { useEffect, useState } from "react";
import {
  Menu,
  X,
} from "lucide-react";

import { ThemeToggle } from "@/shared/components/layout/ThemeToggle";
import { LiveStatusBadge } from "@/shared/components/ui/LiveStatusBadge";

// ============================================================
// Smooth Scroll
// ============================================================

function easeInOutQuart(t: number): number {
  return t < 0.5
    ? 8 * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function customSmoothScroll(
  targetY: number,
  duration: number = 1000
) {
  const startY = window.pageYOffset;
  const distance = targetY - startY;
  let startTime: number | null = null;

  function animation(currentTime: number) {
    if (startTime === null) {
      startTime = currentTime;
    }

    const timeElapsed = currentTime - startTime;
    const progress = Math.min(timeElapsed / duration, 1);

    const ease = easeInOutQuart(progress);

    window.scrollTo(
      0,
      startY + distance * ease
    );

    if (timeElapsed < duration) {
      requestAnimationFrame(animation);
    }
  }

  requestAnimationFrame(animation);
}

// ============================================================
// Component
// ============================================================

export function InvestorNavbar({
  isRefreshing = false,
  lastUpdated = null,
  onRefresh,
}: {
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
  onRefresh?: () => void;
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ----------------------------------------------------------
  // Scroll detection
  // ----------------------------------------------------------

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // ----------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------

  const navLinks = [
    {
      name: "Overview",
      href: "#overview",
    },
    {
      name: "Growth",
      href: "#growth",
    },
    {
      name: "Financials",
      href: "#financials",
    },
    {
      name: "Activity",
      href: "#activity",
    },
  ];

  // ----------------------------------------------------------
  // Smooth scroll handler
  // ----------------------------------------------------------

  const handleSmoothScroll = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    e.preventDefault();

    setMobileMenuOpen(false);

    const targetId = href.replace("#", "");
    const element = document.getElementById(targetId);

    if (!element) {
      return;
    }

    const yOffset = -90;

    const targetY =
      element.getBoundingClientRect().top +
      window.pageYOffset +
      yOffset;

    customSmoothScroll(targetY, 1000);
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <header
      className={`
        fixed
        inset-x-0
        top-0
        z-50
        transition-all
        duration-500
        ${
          isScrolled
            ? `
              bg-white/80
              dark:bg-slate-950/80
              backdrop-blur-xl
              border-b
              border-slate-200/70
              dark:border-white/10
              shadow-[0_10px_30px_rgba(15,23,42,0.08)]
              dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)]
              py-6
            `
            : `
              bg-white/55
              dark:bg-slate-950/55
              backdrop-blur-lg
              border-b
              border-slate-200/40
              dark:border-white/5
              py-6
            `
        }
      `}
    >
      <div className="relative mx-auto flex max-w-7xl items-center justify-between px-6">

        {/* ==================================================
            Left: Brand
            ================================================== */}

        <div
          className="
            group
            flex
            items-center
            gap-2.5
            transition-transform
            duration-300
          "
        >
          {/* Logo icon */}

          <img
            src="/Luka.png"
            alt="Luka AI"
            className="
              h-9
              w-9
              shrink-0
              object-contain
              transition-transform
              duration-300
              group-hover:scale-110
            "
          />

          {/* Brand */}

          <div className="flex flex-col">
            <span
              className="
                bg-gradient-to-r
                from-emerald-600
                via-emerald-500
                to-teal-500
                dark:from-emerald-400
                dark:via-emerald-200
                dark:to-white
                bg-clip-text
                text-transparent
                font-heading
                text-xl
                font-black
                leading-none
                tracking-tight
              "
            >
              Luka AI
            </span>

            <span
              className="
                mt-1
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.18em]
                text-slate-500
                dark:text-slate-400
              "
            >
              Investor Relations
            </span>
          </div>
        </div>

        {/* ==================================================
            Center: Navigation
            ================================================== */}

        <nav
          className="
            absolute
            left-1/2
            hidden
            -translate-x-1/2
            items-center
            gap-1
            rounded-full
            border
            border-slate-200/70
            bg-white/65
            px-3
            py-1.5
            shadow-inner
            backdrop-blur-md
            dark:border-white/10
            dark:bg-slate-900/60
            md:flex
          "
        >
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={(e) =>
                handleSmoothScroll(e, link.href)
              }
              className="
                group
                relative
                cursor-pointer
                px-4
                py-1.5
                text-sm
                font-medium
                text-slate-600
                transition-all
                duration-300
                hover:text-slate-950
                dark:text-slate-300
                dark:hover:text-white
              "
            >
              <span className="relative z-10">
                {link.name}
              </span>

              {/* Hover capsule */}

              <span
                className="
                  absolute
                  inset-0
                  scale-95
                  rounded-full
                  bg-slate-900/0
                  transition-all
                  duration-300
                  group-hover:scale-100
                  group-hover:bg-slate-900/5
                  dark:group-hover:bg-white/10
                "
              />

              {/* Bottom indicator */}

              <span
                className="
                  absolute
                  bottom-0
                  left-1/2
                  h-[2px]
                  w-0
                  -translate-x-1/2
                  rounded-full
                  bg-gradient-to-r
                  from-emerald-500
                  to-teal-400
                  shadow-[0_0_8px_rgba(52,211,153,0.8)]
                  transition-all
                  duration-300
                  group-hover:w-3/5
                "
              />
            </a>
          ))}
        </nav>

        {/* ==================================================
            Right: Actions
            ================================================== */}

        <div className="ml-auto hidden items-center gap-3 md:flex">

          {/* Theme */}

          <ThemeToggle />

          {/* Live indicator */}

          <LiveStatusBadge
            lastUpdated={lastUpdated}
            isRefreshing={isRefreshing}
            onManualRefresh={onRefresh}
          />
        </div>

        {/* ==================================================
            Mobile menu button
            ================================================== */}

        <button
          type="button"
          onClick={() =>
            setMobileMenuOpen(!mobileMenuOpen)
          }
          className="
            rounded-xl
            p-2
            text-slate-600
            transition-all
            duration-300
            hover:bg-slate-900/5
            hover:text-slate-950
            active:scale-90
            dark:text-slate-300
            dark:hover:bg-white/10
            dark:hover:text-white
            md:hidden
          "
          aria-label={
            mobileMenuOpen
              ? "Cerrar menú"
              : "Abrir menú"
          }
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* ====================================================
          Mobile menu
          ==================================================== */}

      {mobileMenuOpen && (
        <div
          className="
            border-t
            border-slate-200/70
            bg-white/95
            px-6
            py-6
            shadow-xl
            backdrop-blur-xl
            animate-in
            fade-in
            slide-in-from-top-4
            duration-300
            dark:border-white/10
            dark:bg-slate-950/95
            md:hidden
          "
        >
          {/* Mobile navigation */}

          <div className="space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) =>
                  handleSmoothScroll(
                    e,
                    link.href
                  )
                }
                className="
                  block
                  rounded-xl
                  px-4
                  py-3
                  text-base
                  font-medium
                  text-slate-600
                  transition-all
                  duration-300
                  hover:bg-emerald-500/5
                  hover:text-emerald-600
                  dark:text-slate-300
                  dark:hover:bg-emerald-500/10
                  dark:hover:text-emerald-400
                "
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Mobile actions */}

          <div
            className="
              mt-5
              space-y-3
              border-t
              border-slate-200
              pt-5
              dark:border-white/10
            "
          >
            {/* Theme */}

            <div
              className="
                flex
                items-center
                justify-between
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-4
                py-3
                dark:border-white/10
                dark:bg-white/5
              "
            >
              <span
                className="
                  text-sm
                  font-semibold
                  text-slate-700
                  dark:text-slate-200
                "
              >
                Apariencia
              </span>

              <ThemeToggle />
            </div>

            {/* Live */}

            <div
              className="
                flex
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-emerald-200
                bg-emerald-50
                py-3
                dark:border-emerald-500/20
                dark:bg-emerald-500/10
              "
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="
                    absolute
                    inline-flex
                    h-full
                    w-full
                    animate-ping
                    rounded-full
                    bg-emerald-400
                    opacity-75
                  "
                />

                <span
                  className="
                    relative
                    inline-flex
                    h-2
                    w-2
                    rounded-full
                    bg-emerald-500
                  "
                />
              </span>

              <span
                className="
                  text-sm
                  font-semibold
                  text-emerald-700
                  dark:text-emerald-400
                "
              >
                Investor Dashboard Live
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}