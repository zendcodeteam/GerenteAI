import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useLukaChat } from "../context/LukaChatContext";
import { ChatMessageItem } from "./ChatMessageItem";
import { AssistantQuickPrompts } from "./AssistantQuickPrompts";
import { ChatInput } from "./ChatInput";
import { LimitReachedNotice } from "./LimitReachedNotice";

export function LukaHeroChat() {
  const { messages, heroDockPulse, isLimitReached } = useLukaChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDocking, setIsDocking] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (heroDockPulse > 0) {
      setIsDocking(true);

      const timer = setTimeout(() => {
        setIsDocking(false);
      }, 900);

      return () => clearTimeout(timer);
    }
  }, [heroDockPulse]);

  return (
    <div className="relative z-10 w-full max-w-lg">
      {/* Ambient Glow */}
      <motion.div
        animate={
          isDocking
            ? {
                scale: [1, 1.28, 1],
                opacity: [0.25, 0.8, 0.25],
              }
            : {
                scale: 1,
                opacity: 0.25,
              }
        }
        transition={{
          duration: 0.85,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="
          pointer-events-none
          absolute
          inset-0
          -z-10
          rounded-[2.5rem]
          bg-gradient-to-tr
          from-emerald-500/25
          to-teal-400/25
          blur-3xl
        "
      />

      {/* Main Chat Card */}
      <motion.div
        animate={
          isDocking
            ? {
                scale: [0.975, 1.018, 1],
                y: [8, -2, 0],
                boxShadow: [
                  "0 20px 25px -5px rgba(0, 0, 0, 0.08)",
                  "0 0 35px 2px rgba(16, 185, 129, 0.35)",
                  "0 20px 25px -5px rgba(0, 0, 0, 0.08)",
                ],
              }
            : {
                scale: 1,
                y: 0,
                boxShadow:
                  "0 20px 25px -5px rgba(0, 0, 0, 0.08)",
              }
        }
        transition={{
          duration: 0.75,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="
          relative
          flex
          h-[520px]
          flex-col
          overflow-hidden
          rounded-[2rem]
          border
          border-slate-200/80
          bg-white/85
          shadow-2xl
          shadow-slate-900/10
          backdrop-blur-xl
          transition-colors
          duration-300
          dark:border-white/10
          dark:bg-slate-900/85
          dark:shadow-slate-950/50
        "
      >
        {/* Shimmer */}
        {isDocking && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{
              duration: 0.8,
              ease: "easeInOut",
            }}
            className="
              pointer-events-none
              absolute
              left-0
              right-0
              top-0
              z-30
              h-[2px]
              bg-gradient-to-r
              from-transparent
              via-emerald-400
              to-transparent
            "
          />
        )}

        {/* =====================================================
            CHAT HEADER
            ===================================================== */}

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-gray-200/80
            bg-slate-50/60
            px-6
            py-3.5
            backdrop-blur-md
            dark:border-white/5
            dark:bg-slate-800/50
          "
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  overflow-hidden
                  rounded-full
                  border
                  border-emerald-500/30
                  bg-emerald-500/10
                  dark:bg-emerald-500/20
                "
              >
                <img
                  src="/Luka redondo.png"
                  alt="Luka AI"
                  className="
                    h-full
                    w-full
                    object-cover
                  "
                />
              </div>

              <span
                className="
                  absolute
                  -bottom-0.5
                  -right-0.5
                  h-3
                  w-3
                  rounded-full
                  border-2
                  border-white
                  bg-emerald-500
                  dark:border-slate-900
                "
              />
            </div>

            <div>
              <h3
                className="
                  text-sm
                  font-bold
                  text-slate-900
                  dark:text-white
                "
              >
                Luka AI
              </h3>

              <p
                className="
                  flex
                  items-center
                  gap-1.5
                  text-xs
                  font-medium
                  text-emerald-600
                  dark:text-emerald-400
                "
              >
                <span
                  className="
                    h-1.5
                    w-1.5
                    shrink-0
                    rounded-full
                    bg-emerald-500
                    animate-pulse
                  "
                />

                <span>+57 304 390 4488</span>

                <span>•</span>

                <span>En línea</span>
              </p>
            </div>
          </div>
        </div>

        {/* =====================================================
            CHAT BODY
            ===================================================== */}

        <div
          ref={scrollRef}
          className="
            flex
            flex-1
            flex-col
            gap-3.5
            overflow-y-auto
            scrollbar-thin-luka
            p-5
          "
        >
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
            />
          ))}
        </div>

        {/* =====================================================
            QUICK PROMPTS
            ===================================================== */}

        {isLimitReached ? (
          <LimitReachedNotice />
        ) : (
          <>
            <div
              className="
                border-t
                border-gray-100/60
                bg-slate-50/30
                px-4
                dark:border-white/5
                dark:bg-slate-900/30
              "
            >
              <AssistantQuickPrompts />
            </div>

            {/* =====================================================
                INPUT
                ===================================================== */}

            <ChatInput />
          </>
        )}
      </motion.div>
    </div>
  );
}