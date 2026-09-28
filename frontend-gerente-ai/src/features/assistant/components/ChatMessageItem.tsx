import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { ChatMessage } from "../types";

export function ChatMessageItem({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.sender === "user";

  if (isUser) {
    return (
      <div
        className="
          self-end
          max-w-[85%]
          rounded-2xl
          rounded-tr-sm
          bg-slate-900
          px-4
          py-3
          text-white
          shadow-sm
          animate-in
          fade-in
          slide-in-from-bottom-2
          duration-300
          dark:bg-white
          dark:text-slate-900
        "
      >
        <p className="text-[13px] leading-relaxed">
          {message.text}
        </p>

        <span
          className="
            mt-1
            block
            text-right
            text-[10px]
            font-medium
            text-slate-400
            dark:text-slate-500
          "
        >
          {message.timestamp}
        </span>
      </div>
    );
  }

  return (
    <div
      className="
        self-start
        flex
        max-w-[90%]
        gap-3
        rounded-2xl
        rounded-tl-sm
        border
        border-gray-100
        bg-white
        px-4
        py-3.5
        shadow-sm
        animate-in
        fade-in
        slide-in-from-bottom-2
        duration-300
        dark:border-slate-700/80
        dark:bg-slate-800
      "
    >
      <div
        className="
          mt-0.5
          flex
          h-6
          w-6
          shrink-0
          items-center
          justify-center
          rounded-full
          bg-emerald-500/10
          dark:bg-emerald-500/20
        "
      >
        <Sparkles
          className="
            h-3.5
            w-3.5
            text-emerald-600
            dark:text-emerald-400
          "
        />
      </div>

      <div className="flex-1 space-y-3">
        <p
          className="
            text-[13px]
            font-normal
            leading-[1.55]
            text-slate-700
            dark:text-slate-200
          "
        >
          {message.text}
        </p>

        {/* Optional Metric Widget */}
        {message.metricWidget && (
          <div
            className="
              space-y-2
              rounded-xl
              border
              border-emerald-100
              bg-emerald-50
              p-3
              dark:border-emerald-500/20
              dark:bg-emerald-500/10
            "
          >
            <div className="flex items-center justify-between">
              <span
                className="
                  text-xs
                  font-bold
                  text-emerald-900
                  dark:text-emerald-300
                "
              >
                {message.metricWidget.title}
              </span>

              <span
                className="
                  rounded-full
                  bg-emerald-500/10
                  px-2
                  py-0.5
                  text-xs
                  font-black
                  text-emerald-700
                  dark:bg-emerald-500/20
                  dark:text-emerald-400
                "
              >
                {message.metricWidget.percentage}
              </span>
            </div>

            <div
              className="
                h-2
                overflow-hidden
                rounded-full
                bg-emerald-200
                dark:bg-emerald-900/50
              "
            >
              <div
                className="
                  h-full
                  rounded-full
                  bg-emerald-500
                  transition-all
                  duration-500
                "
                style={{
                  width: `${message.metricWidget.progress}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Optional Action Buttons (registro, WhatsApp, etc.) */}
        {message.actionButtons && message.actionButtons.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {message.actionButtons.map((action) =>
              /^https?:\/\//.test(action.href) ? (
                <a
                  key={action.href}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex
                    items-center
                    gap-1.5
                    rounded-lg
                    bg-emerald-600
                    px-3
                    py-1.5
                    text-xs
                    font-bold
                    text-white
                    shadow-sm
                    transition-all
                    hover:scale-[1.02]
                    hover:bg-emerald-500
                    active:scale-[0.98]
                  "
                >
                  <span>{action.label}</span>

                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <Link
                  key={action.href}
                  to={action.href}
                  className="
                    inline-flex
                    items-center
                    gap-1.5
                    rounded-lg
                    bg-emerald-600
                    px-3
                    py-1.5
                    text-xs
                    font-bold
                    text-white
                    shadow-sm
                    transition-all
                    hover:scale-[1.02]
                    hover:bg-emerald-500
                    active:scale-[0.98]
                  "
                >
                  <span>{action.label}</span>

                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ),
            )}
          </div>
        )}

        <span
          className="
            block
            text-[10px]
            font-medium
            text-slate-400
            dark:text-slate-500
          "
        >
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}