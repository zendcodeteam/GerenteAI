import {
  ArrowUpRight,
  Instagram,
  Twitter,
} from "lucide-react";

import { SiTiktok } from "react-icons/si";

const founders = [
  {
    name: "Angelica",
    image: "/Angelica.jpg",
  },
  {
    name: "Alejandro",
    image: "/Alejandro.jpg",
  },
  {
    name: "Nicolas",
    image: "/Nicolas.jpg",
  },
  {
    name: "Samuel",
    image: "/Samuel.jpg",
  },
  {
    name: "Jhoan",
    image: "/Jhoan.jpg",
  },
  {
    name: "Jose",
    image: "/Jose.jpg",
  },
];

function FounderPhoto({
  founder,
}: {
  founder: {
    name: string;
    image: string;
  };
}) {
  return (
    <div className="relative mx-3 inline-flex shrink-0 items-center align-middle sm:mx-5 md:mx-6">
      {/* Bubble */}
      <div className="absolute -right-2 -top-4 z-20 flex h-8 min-w-[48px] items-center justify-center rounded-full bg-[#D8FF00] px-3 shadow-[0_8px_25px_-8px_rgba(216,255,0,0.5)] sm:-right-3 sm:-top-5 sm:h-9 sm:min-w-[52px]">
        <div className="flex items-center gap-[3px]">
          <span className="h-[4px] w-[4px] rounded-full bg-[#073B35]" />
          <span className="h-[4px] w-[4px] rounded-full bg-[#073B35]" />
          <span className="h-[4px] w-[4px] rounded-full bg-[#073B35]" />
        </div>
      </div>

      {/* Founder */}
      <div className="h-[72px] w-[72px] overflow-hidden rounded-full border-[3px] border-white/10 bg-slate-800 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.7)] sm:h-[88px] sm:w-[88px] md:h-[104px] md:w-[104px] lg:h-[112px] lg:w-[112px]">
        <img
          src={founder.image}
          alt={founder.name}
          className="h-full w-full object-cover"
          draggable={false}
          loading="lazy"
          decoding="async"
        />
      </div>
    </div>
  );
}

function MarqueeRow({
  reverse = false,
}: {
  reverse?: boolean;
}) {
  const content = [
    { type: "text", value: "Construimos" },
    { type: "photo", founder: founders[0] },
    { type: "text", value: "Luka" },
    { type: "photo", founder: founders[1] },
    { type: "text", value: "Juntos" },
    { type: "photo", founder: founders[2] },
    { type: "text", value: "Construimos" },
    { type: "photo", founder: founders[3] },
    { type: "text", value: "Luka" },
    { type: "photo", founder: founders[4] },
    { type: "text", value: "Juntos" },
    { type: "photo", founder: founders[5] },
    { type: "text", value: "Juntos" },
  ];

  const repeatedContent = [...content, ...content];

  return (
    <div className="relative">
      <div
        className={`flex w-max items-center whitespace-nowrap ${
          reverse
            ? "animate-footer-marquee-reverse"
            : "animate-footer-marquee"
        }`}
      >
        {repeatedContent.map((item, index) => {
          if (item.type === "photo" && item.founder) {
            return (
              <FounderPhoto
                key={`${item.founder.name}-${index}`}
                founder={item.founder}
              />
            );
          }

          return (
            <span
              key={`${item.value}-${index}`}
              className="mx-3 inline-block shrink-0 text-[54px] font-extrabold leading-none tracking-[-0.065em] text-white sm:mx-5 sm:text-[70px] md:mx-6 md:text-[88px] lg:text-[104px]"
            >
              {item.value}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function CoworkingFooterSection({
  showGreenSection = true,
}: {
  showGreenSection?: boolean;
}) {
  return (
    <footer
      className={`relative w-full overflow-hidden bg-transparent pb-3 pt-0 text-white sm:pb-4 ${
        showGreenSection ? "-mt-7 md:-mt-15" : ""
      }`}
    >
      <style>{`
        @keyframes footerMarquee {
          0% {
            transform: translate3d(0, 0, 0);
          }

          100% {
            transform: translate3d(-50%, 0, 0);
          }
        }

        @keyframes footerMarqueeReverse {
          0% {
            transform: translate3d(-50%, 0, 0);
          }

          100% {
            transform: translate3d(0, 0, 0);
          }
        }

        .animate-footer-marquee {
          animation: footerMarquee 34s linear infinite;
          will-change: transform;
        }

        .animate-footer-marquee-reverse {
          animation: footerMarqueeReverse 38s linear infinite;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-footer-marquee,
          .animate-footer-marquee-reverse {
            animation-play-state: paused;
          }
        }
      `}</style>

      {showGreenSection && (
        <div className="relative w-full overflow-hidden rounded-t-[34px] bg-[#063A35]">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[-220px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-400/[0.10] blur-[150px]" />

          <div className="absolute bottom-[-250px] left-[10%] h-[500px] w-[500px] rounded-full bg-teal-400/[0.08] blur-[150px]" />

          <div className="absolute right-[-150px] top-[30%] h-[420px] w-[420px] rounded-full bg-cyan-400/[0.07] blur-[150px]" />
        </div>

        <div className="relative z-10 overflow-hidden pb-16 pt-16 sm:pb-20 sm:pt-20 md:pb-24 md:pt-24">
          {/* Label */}
          <div className="mb-10 flex justify-center px-6 sm:mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300 backdrop-blur-xl">
              <img
                src="/Luka.png"
                alt="Luka"
                className="h-5 w-5 object-contain"
              />

              <span>Hecho en Cali, Colombia</span>
            </div>
          </div>

          {/* Moving row 1 */}
          <MarqueeRow />

          {/* Moving row 2 */}
          <div className="mt-5 sm:mt-7">
            <MarqueeRow reverse />
          </div>

          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-30 w-12 bg-gradient-to-r from-[#063A35] to-transparent sm:w-20 md:w-32" />

          <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-12 bg-gradient-to-l from-[#063A35] to-transparent sm:w-20 md:w-32" />

          {/* CTA */}
          <div className="relative z-40 mt-14 flex justify-center px-6 sm:mt-16 md:mt-20">
            <a
              href="/register"
              className="group inline-flex items-center gap-3 rounded-full bg-white px-7 py-4 text-sm font-extrabold text-slate-950 shadow-[0_20px_60px_-20px_rgba(255,255,255,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_70px_-20px_rgba(255,255,255,0.45)]"
            >
              Comenzar gratis

              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 text-white transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </a>
          </div>
        </div>
        </div>
      )}

      {/* =====================================================
          FOOTER TRADICIONAL
      ===================================================== */}
      <div className="relative w-full bg-[#050A10]">
        <div className="border-t border-white/[0.08] py-12 sm:py-16 md:py-16">
          {/* Contenedor alineado con los márgenes generales de la landing */}
          <div className="mx-auto w-[calc(100%-2rem)] max-w-7xl">
            {/* =================================================
                MAIN FOOTER COLUMNS
            ================================================= */}
            <div className="grid grid-cols-1 gap-12 md:min-h-[235px] md:grid-cols-[1.35fr_1fr_1fr_1fr] md:items-center md:gap-x-20 lg:gap-x-28">
              {/* Brand */}
              <div className="md:col-span-1">
                <div className="mb-5 flex items-center gap-2">
                  <img
                    src="/Luka.png"
                    alt="Luka"
                    className="h-7 w-7 object-contain"
                  />

                  {/* Luka AI — mismo degradado que la navbar */}
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                    Luka AI
                  </span>
                </div>

                <p className="max-w-xs text-sm font-medium leading-relaxed text-white/55">
                  Toma decisiones con datos, no con intuición. El futuro de la
                  gestión para micronegocios en Latinoamérica.
                </p>

                <p className="mt-6 text-sm font-medium text-white/45">
                  Hecho en Cali, Colombia con mucho ❤️
                </p>
              </div>

              {/* Producto */}
              <div>
                <h4 className="mb-5 font-bold text-white">
                  Producto
                </h4>

                <ul className="space-y-3 text-sm font-medium text-white/50">
                  <li>
                    <a
                      href="/caracteristicas"
                      className="transition-colors hover:text-emerald-300"
                    >
                      Características
                    </a>
                  </li>

                  <li>
                    <a
                      href="/ayuda"
                      className="transition-colors hover:text-emerald-300"
                    >
                      Centro de ayuda
                    </a>
                  </li>

                  <li>
                    <a
                      href="/usos"
                      className="transition-colors hover:text-emerald-300"
                    >
                      Casos de uso
                    </a>
                  </li>
                </ul>
              </div>

              {/* Compañía */}
              <div>
                <h4 className="mb-5 font-bold text-white">
                  Compañía
                </h4>

                <ul className="space-y-3 text-sm font-medium text-white/50">
                  <li>
                    <a
                      href="/nosotros"
                      className="transition-colors hover:text-emerald-300"
                    >
                      Sobre nosotros
                    </a>
                  </li>

                  <li>
                    <a
                      href="/contacto"
                      className="transition-colors hover:text-emerald-300"
                    >
                      Contacto
                    </a>
                  </li>

                  <li>
                    <a
                      href="https://wa.me/573043904488"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-emerald-300"
                    >
                      WhatsApp
                    </a>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="mb-5 font-bold text-white">
                  Legal
                </h4>

                <ul className="space-y-3 text-sm font-medium text-white/50">
                  <li>
                    <a
                      href="/terminos"
                      className="transition-colors hover:text-emerald-300"
                    >
                      Términos de servicio
                    </a>
                  </li>

                  <li>
                    <a
                      href="/privacidad"
                      className="transition-colors hover:text-emerald-300"
                    >
                      Política de privacidad
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* =================================================
                BOTTOM
            ================================================= */}
            <div className="mx-auto mt-12 flex flex-col items-center justify-between gap-5 border-t border-white/[0.08] pt-6 sm:flex-row">
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium text-white/40">
                  © {new Date().getFullYear()} Luka AI. Todos los derechos
                  reservados.
                </p>

                <p className="mt-3 max-w-3xl text-xs font-medium leading-relaxed text-white/30">
                  Luka AI es un producto de Zendcode S.A.S. con NIT 902099074
                  en la Cámara de Comercio de Cali. Luka AI hace uso de
                  Inteligencia Artificial. Se pueden encontrar divulgaciones
                  adicionales en la página de Política de privacidad.
                </p>
              </div>

              <div className="flex items-center gap-5 text-white/45">
                <a
                  href="https://twitter.com/asistenteluka"
                  aria-label="Twitter"
                  className="transition-colors hover:text-emerald-300"
                >
                  <Twitter className="h-5 w-5" />
                </a>

                <a
                  href="https://www.tiktok.com/@asistenteluka"
                  aria-label="TikTok"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-emerald-300"
                >
                  <SiTiktok className="h-5 w-5" />
                </a>

                <a
                  href="https://www.instagram.com/asistenteluka"
                  aria-label="Instagram"
                  className="transition-colors hover:text-emerald-300"
                >
                  <Instagram className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}