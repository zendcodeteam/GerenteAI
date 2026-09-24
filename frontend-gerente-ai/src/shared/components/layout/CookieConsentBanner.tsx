import { useEffect, useState } from "react";
import { ArrowRight, Check, Cookie, ShieldCheck, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLocation } from "react-router";
import { useAuth } from "@/features/auth";

const COOKIE_NAME = "luka_cookie_consent";
const MAX_AGE = 60 * 60 * 24 * 365;

type CookieConsent = {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
};

const getStoredConsent = (): CookieConsent | null => {
  const entry = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${COOKIE_NAME}=`));

  if (!entry) return null;

  try {
    const value = decodeURIComponent(entry.slice(COOKIE_NAME.length + 1));
    const parsed = JSON.parse(value) as Partial<CookieConsent>;

    if (parsed.necessary !== true) return null;

    return {
      necessary: true,
      preferences: parsed.preferences === true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
    };
  } catch {
    return null;
  }
};

const saveConsent = (consent: CookieConsent) => {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(consent),
  )}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax; Secure`;
};

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const isConsentRoute = ["/home", "/login", "/register"].includes(
    location.pathname,
  );

  useEffect(() => {
    setVisible(
      isConsentRoute && !isAuthenticated && getStoredConsent() === null,
    );
  }, [isAuthenticated, isConsentRoute, location.pathname]);

  const choose = (consent: CookieConsent) => {
    saveConsent(consent);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          role="dialog"
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-description"
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.985 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 24,
            mass: 0.8,
          }}
          className="fixed bottom-4 right-4 z-[9998] w-[calc(100%-2rem)] max-w-md sm:bottom-6 sm:right-6"
        >
          <div className="relative overflow-hidden rounded-[1.35rem] border border-emerald-500/25 bg-card/95 p-5 shadow-2xl shadow-emerald-950/15 backdrop-blur-xl sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full border border-emerald-400/15" />
            <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full border border-cyan-400/15" />

            <div className="relative flex items-start gap-4">
              <motion.div
                initial={{ rotate: -10, scale: 0.85 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
              >
                <Cookie className="h-6 w-6" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-cyan-400 text-slate-950">
                  <Sparkles className="h-2.5 w-2.5" />
                </span>
              </motion.div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Tu privacidad, bajo tu control
                </div>
                <h2 id="cookie-consent-title" className="text-lg font-black tracking-tight text-foreground">
                  Usamos cookies en Luka
                </h2>
                <p id="cookie-consent-description" className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  Usamos cookies para proteger tu sesión y mantener la plataforma funcionando. Las opcionales solo se activarían con tu autorización.
                </p>
              </div>
            </div>

            <p className="relative mt-5 rounded-xl border border-border/70 bg-muted/35 px-3.5 py-3 text-[11px] leading-4 text-muted-foreground">
              <Check className="mr-2 inline-block h-3.5 w-3.5 align-[-2px] text-emerald-500" />
              No activaremos publicidad personalizada sin consentimiento.
            </p>

            <div className="relative mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <motion.button
                type="button"
                onClick={() =>
                  choose({
                    necessary: true,
                    preferences: false,
                    analytics: false,
                    marketing: false,
                  })
                }
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-xl border border-border px-3.5 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Solo cookies esenciales
              </motion.button>
              <motion.button
                type="button"
                onClick={() =>
                  choose({
                    necessary: true,
                    preferences: true,
                    analytics: true,
                    marketing: true,
                  })
                }
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
              >
                Acepto todas las cookies
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </motion.button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
