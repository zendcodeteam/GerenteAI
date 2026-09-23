import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";

/**
 * Anuncio emergente de la sincronización bancaria automática.
 * Aparece en /home después de que la pantalla de carga inicial termina.
 */
export function BankSyncAnnouncementModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(true);
    }, 2300);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="
              relative
              aspect-[2/3]
              w-full
              max-h-[calc(100vh-2rem)]
              max-w-[28rem]
              overflow-hidden
              rounded-[1.5rem]
              border
              border-white/45
              bg-slate-950
              shadow-2xl

              sm:aspect-video
              sm:max-h-none
              sm:max-w-5xl
            "
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <picture>
              <source media="(max-width: 639px)" srcSet="/Juan.jpg" />
              <img
                src="/Javier.jpg"
                alt="Comerciante pagando una compra con su celular"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>

            <div
              className="absolute inset-y-0 right-0 hidden w-[62%] sm:block"
              style={{
                background:
                  "linear-gradient(to left, rgba(2, 6, 23, 0.97) 0%, rgba(2, 6, 23, 0.92) 46%, rgba(2, 6, 23, 0.58) 76%, rgba(2, 6, 23, 0) 100%)",
              }}
              aria-hidden="true"
            />

            <div
              className="absolute inset-y-0 right-0 hidden w-[52%] bg-slate-950/10 sm:block"
              aria-hidden="true"
            />

            <div
              className="absolute inset-0 sm:hidden"
              style={{
                background:
                  "linear-gradient(to top, rgba(2, 6, 23, 0.98) 0%, rgba(2, 6, 23, 0.92) 38%, rgba(2, 6, 23, 0.22) 67%, rgba(2, 6, 23, 0) 100%)",
              }}
              aria-hidden="true"
            />

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="
                absolute
                right-3
                top-3
                z-10
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-full
                bg-white/15
                text-white
                backdrop-blur-sm
                transition-colors
                hover:bg-white/25
                sm:right-5
                sm:top-5
              "
            >
              <X size={20} />
            </button>

            <div
              className="
                relative
                z-[1]
                flex
                h-full
                max-w-full
                flex-col
                justify-end
                px-5
                pb-5
                pt-24

                sm:ml-auto
                sm:max-w-[54%]
                sm:justify-center
                sm:px-10
                sm:py-8

                lg:max-w-[48%]
                lg:px-16
              "
            >
              <div
                className="
                  inline-flex
                  w-fit
                  items-center
                  gap-2
                  rounded-full
                  bg-[#62D56B]
                  px-3
                  py-1
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-slate-950

                  sm:px-4
                  sm:py-1.5
                  sm:text-xs
                "
              >
                <Sparkles size={12} />
                Próximamente
              </div>

              <h3
                className="
                  mt-3
                  text-2xl
                  font-black
                  leading-[1.05]
                  tracking-tight
                  text-white

                  sm:mt-5
                  sm:text-4xl

                  lg:text-5xl
                "
              >
                Tus compras se registran solas
              </h3>

              <p
                className="
                  mt-2
                  max-w-lg
                  text-xs
                  leading-5
                  text-white/90

                  sm:mt-4
                  sm:text-base
                  sm:leading-6
                "
              >
                Muy pronto Luka podrá conectarse a tu banco y detectar
                automáticamente las compras que hagas con tu tarjeta débito o
                crédito.
              </p>

              <p
                className="
                  mt-2
                  max-w-lg
                  text-xs
                  font-semibold
                  leading-5
                  text-white/75

                  sm:mt-3
                  sm:text-sm
                "
              >
                Sin escribirle nada por WhatsApp. Tú mantienes el control
                total de lo que se registra.
              </p>

              <div className="mt-3 flex sm:mt-6">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="
                    inline-flex
                    items-center
                    justify-center
                    rounded-full
                    bg-white
                    px-5
                    py-2.5
                    text-xs
                    font-bold
                    text-slate-950
                    transition-all
                    duration-300
                    hover:scale-[1.03]
                    hover:bg-slate-100

                    sm:px-7
                    sm:py-3
                    sm:text-sm
                  "
                >
                  Genial, lo espero
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
