import { useLukaChat } from "../context/LukaChatContext";

export function AssistantQuickPrompts() {
  const { quickPrompts, sendMessage, isTyping } = useLukaChat();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin-luka py-2 px-1">
      {quickPrompts.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          disabled={isTyping}
          onClick={() => sendMessage(prompt.query)}
          className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 border border-slate-200/80 dark:border-white/10 hover:border-emerald-300 dark:hover:border-emerald-500/30 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {prompt.label}
        </button>
      ))}
    </div>
  );
}
