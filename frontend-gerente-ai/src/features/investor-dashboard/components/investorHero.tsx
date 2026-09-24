import { LiveStatusBadge } from "@/shared/components/ui/LiveStatusBadge";

const PERIODO_ACTUAL = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
}).format(new Date());

export function InvestorHero({
  isRefreshing = false,
  lastUpdated = null,
}: {
  isRefreshing?: boolean;
  lastUpdated?: Date | null;
}) {
  return (
    <section
      id="overview"
      className="
        relative
        isolate
        overflow-hidden
        px-6
        pb-20
        pt-36
        sm:pb-24
        sm:pt-40
        lg:pb-28
        lg:pt-44
      "
    >
      {/* =====================================================
          Ambient Background
          ===================================================== */}

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Main emerald glow */}

        <div
          className="
            absolute
            -top-40
            left-1/2
            h-[600px]
            w-[1000px]
            -translate-x-1/2
            rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18),transparent_70%)]
            blur-3xl
            dark:bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.22),transparent_70%)]
          "
        />

        {/* Cyan glow */}

        <div
          className="
            absolute
            right-[-150px]
            top-24
            h-[500px]
            w-[500px]
            rounded-full
            bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.10),transparent_70%)]
            blur-3xl
            dark:bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15),transparent_70%)]
          "
        />

        {/* Teal glow */}

        <div
          className="
            absolute
            -left-48
            top-1/3
            h-[600px]
            w-[600px]
            rounded-full
            bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.10),transparent_70%)]
            blur-3xl
            dark:bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.14),transparent_70%)]
          "
        />

        {/* Soft top fade */}

        <div
          className="
            absolute
            inset-x-0
            top-0
            h-48
            bg-gradient-to-b
            from-white/60
            to-transparent
            dark:from-[#090D16]/60
            dark:to-transparent
          "
        />
      </div>

      {/* =====================================================
          Main Content
          ===================================================== */}

      <div className="mx-auto max-w-7xl">
        <div className="max-w-5xl">
          {/* =================================================
              Eyebrow
              ================================================= */}

          <div
            className="
              mb-7
              inline-flex
              animate-cascade
              items-center
              gap-2.5
              rounded-full
              border
              border-emerald-500/20
              bg-emerald-500/5
              px-4
              py-2
              text-sm
              font-semibold
              text-emerald-700
              shadow-[0_0_20px_rgba(16,185,129,0.08)]
              backdrop-blur-md
              dark:border-emerald-500/20
              dark:bg-emerald-500/10
              dark:text-emerald-400
            "
            style={{
              animationDelay: "100ms",
            }}
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

            Luka Investor Relations
          </div>

          {/* =================================================
              Main Heading
              ================================================= */}

          <h1
            className="
              animate-cascade
              font-heading
              text-4xl
              font-black
              leading-[1.05]
              tracking-[-0.04em]
              text-slate-950
              sm:text-5xl
              lg:text-6xl
              xl:text-[4.25rem]
              dark:text-white
            "
            style={{
              animationDelay: "200ms",
            }}
          >
            El crecimiento de Luka,
            <span
              className="
                block
                bg-gradient-to-r
                from-emerald-600
                via-teal-500
                to-cyan-500
                bg-clip-text
                text-transparent
                dark:from-emerald-400
                dark:via-emerald-300
                dark:to-cyan-400
              "
            >
              en tiempo real.
            </span>
          </h1>

          {/* =================================================
              Description
              ================================================= */}

          <p
            className="
              mt-8
              max-w-3xl
              animate-cascade
              text-lg
              leading-8
              text-slate-600
              sm:text-xl
              dark:text-slate-400
            "
            style={{
              animationDelay: "300ms",
            }}
          >
            Una visión transparente de la evolución de{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Luka AI
            </span>
            : usuarios, negocios, crecimiento, ingresos,
            retención y actividad de nuestra plataforma.
          </p>

          {/* =================================================
              Live Data Indicators
              ================================================= */}

          <div
            className="
              mt-9
              flex
              animate-cascade
              flex-wrap
              items-center
              gap-3
              sm:gap-4
            "
            style={{
              animationDelay: "400ms",
            }}
          >
            {/* Real-time status */}

            <LiveStatusBadge
              lastUpdated={lastUpdated}
              isRefreshing={isRefreshing}
              className="px-4 py-2.5 text-sm"
            />

            {/* Current period */}

            <div
              className="
                rounded-full
                border
                border-slate-200/80
                bg-white/65
                px-4
                py-2.5
                text-sm
                font-medium
                text-slate-600
                shadow-sm
                backdrop-blur-md
                transition-all
                duration-300
                hover:border-slate-300
                hover:bg-white
                dark:border-white/10
                dark:bg-white/5
                dark:text-slate-400
                dark:hover:bg-white/10
              "
            >
              {PERIODO_ACTUAL.charAt(0).toUpperCase() + PERIODO_ACTUAL.slice(1)}
            </div>
          </div>

          {/* =================================================
              Investor Trust Signal
              ================================================= */}

          <div
            className="
              mt-10
              flex
              animate-cascade
              items-center
              gap-3
              text-sm
              text-slate-500
              dark:text-slate-500
            "
            style={{
              animationDelay: "500ms",
            }}
          >
            <div
              className="
                h-px
                w-10
                bg-gradient-to-r
                from-transparent
                to-emerald-500/50
              "
            />

            <span>
              Información diseñada para ofrecer una visión
              clara del desempeño de Luka.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}