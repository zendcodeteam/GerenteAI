import { useState, useEffect, useRef } from "react";
import { Bot, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLukaChat } from "../context/LukaChatContext";
import { ChatMessageItem } from "./ChatMessageItem";
import { AssistantQuickPrompts } from "./AssistantQuickPrompts";
import { ChatInput } from "./ChatInput";
import { LimitReachedNotice } from "./LimitReachedNotice";

export function LukaFloatingChat() {
  const {
    messages,
    isFloatingOpen,
    setIsFloatingOpen,
    triggerHeroDockPulse,
    isLimitReached,
  } = useLukaChat();

  const [isVisible, setIsVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFloatingOpenRef = useRef(isFloatingOpen);

  useEffect(() => {
    isFloatingOpenRef.current = isFloatingOpen;
  }, [isFloatingOpen]);

  useEffect(() => {
    const handleScroll = () => {
      // Mostrar botón flotante después de 350px de scroll
      if (window.scrollY > 350) {
        setIsVisible(true);
      } else {
        if (isFloatingOpenRef.current) {
          // El chat estaba abierto y el usuario volvió al inicio:
          // disparar efecto de re-acoplamiento en Hero
          triggerHeroDockPulse();
        }

        setIsVisible(false);
        setIsFloatingOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [setIsFloatingOpen, triggerHeroDockPulse]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages, isFloatingOpen]);

  return (
    <>
      {/* =====================================================
          FLOATING ACTION BUTTON
          ===================================================== */}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.8,
              y: 20,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.8,
              y: 20,
            }}
            transition={{
              duration: 0.25,
              ease: "easeOut",
            }}
            className="fixed bottom-6 right-6 z-50"
          >
            <button
              onClick={() =>
                setIsFloatingOpen(!isFloatingOpen)
              }
              className="
                relative
                group
                flex
                items-center
                gap-3
                rounded-full
                bg-[#075E54]
                px-4
                py-3.5
                text-white
                shadow-2xl
                shadow-emerald-500/40
                transition-all
                duration-300
                hover:scale-105
                hover:bg-emerald-500
                hover:shadow-emerald-500/60
                active:scale-95
                cursor-pointer
              "
            >
              <div className="relative flex items-center justify-center">
                <img
                  src="/Luka.png"
                  alt="Luka"
                  className="
                    h-7
                    w-7
                    object-contain
                    transition-transform
                    duration-300
                    group-hover:scale-105
                  "
                />

                <span
                  className="
                    absolute
                    -right-1
                    -top-1
                    h-2.5
                    w-2.5
                    rounded-full
                    border-2
                    border-emerald-600
                    bg-emerald-300
                    animate-ping
                  "
                />
              </div>

              <span className="hidden pr-1 text-sm font-bold sm:inline-block">
                ¿Dudas? Habla con Luka
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================
          FLOATING MODAL WINDOW
          ===================================================== */}

      <AnimatePresence>
        {isFloatingOpen && isVisible && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.94,
              y: 18,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              scale: 0.94,
              y: -18,
            }}
            transition={{
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              fixed
              bottom-24
              right-6
              z-50
              flex
              h-[540px]
              w-[380px]
              max-w-[calc(100vw-2rem)]
              flex-col
              overflow-hidden
              rounded-[2rem]
              border
              border-slate-200/80
              bg-white/90
              shadow-2xl
              shadow-slate-950/30
              backdrop-blur-2xl
              dark:border-white/10
              dark:bg-slate-900/90
            "
          >
            {/* =================================================
                HEADER
                ================================================= */}

            <div
              className="
                flex
                items-center
                justify-between
                border-b
                border-gray-200/80
                bg-slate-50/70
                px-5
                py-4
                backdrop-blur-md
                dark:border-white/5
                dark:bg-slate-800/60
              "
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="
                      flex
                      h-9
                      w-9
                      items-center
                      justify-center
                      rounded-xl
                      border
                      border-emerald-500/30
                      bg-emerald-500/10
                      dark:bg-emerald-500/20
                    "
                  >
                    <img
                      src="/Luka redondo.png"
                      alt="Luka AI"
                      className="h-7 w-7 object-contain"
                    />
                  </div>

                  <span
                    className="
                      absolute
                      -bottom-0.5
                      -right-0.5
                      h-2.5
                      w-2.5
                      rounded-full
                      border-2
                      border-white
                      bg-emerald-500
                      dark:border-slate-900
                    "
                  />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Luka AI
                  </h3>

                  <p
                    className="
                      flex
                      items-center
                      gap-1
                      text-[11px]
                      font-medium
                      text-emerald-600
                      dark:text-emerald-400
                    "
                  >
                    <span
                      className="
                        h-1.5
                        w-1.5
                        rounded-full
                        bg-emerald-500
                        animate-pulse
                      "
                    />

                    Asistente en vivo
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsFloatingOpen(false)}
                className="
                  cursor-pointer
                  rounded-lg
                  p-1.5
                  text-slate-400
                  transition-colors
                  hover:bg-slate-100
                  hover:text-slate-700
                  dark:hover:bg-slate-800
                  dark:hover:text-white
                "
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* =================================================
                MESSAGES
                ================================================= */}

            <div
              ref={scrollRef}
              className="
                flex
                flex-1
                flex-col
                gap-3
                overflow-y-auto
                scrollbar-thin-luka
                p-4
              "
            >
              {messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                />
              ))}
            </div>

            {isLimitReached ? (
              <LimitReachedNotice />
            ) : (
              <>
                {/* =================================================
                    QUICK PROMPTS
                    ================================================= */}

                <div
                  className="
                    border-t
                    border-gray-100
                    bg-slate-50/30
                    px-3
                    dark:border-white/5
                    dark:bg-slate-900/30
                  "
                >
                  <AssistantQuickPrompts />
                </div>

                {/* =================================================
                    CHAT INPUT
                    ================================================= */}

                <ChatInput />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}