import { ArrowRight, MessageCircleHeart } from "lucide-react";
import { Link } from "react-router";
import { useLukaChat } from "../context/LukaChatContext";

/**
 * Reemplaza las preguntas rápidas y el campo de texto cuando se llega al
 * tope diario del chat (o la IA del landing está apagada por el interruptor
 * de emergencia). Los botones vienen del backend (`limitActions`), no están
 * hardcodeados aquí, para no duplicar hrefs/labels entre frontend y backend.
 */
export function LimitReachedNotice() {
  const { limitActions } = useLukaChat();

  return (
    <div className="p-4 bg-white/60 dark:bg-slate-900/60 border-t border-gray-100 dark:border-white/5 backdrop-blur-md">
      <div className="flex items-start gap-2.5 mb-3">
        <MessageCircleHeart className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
          Llegaste al límite de mensajes gratuitos de hoy. Regístrate para seguir hablando con Luka a través de WhatsApp.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {limitActions.map((action) =>
          /^https?:\/\//.test(action.href) ? (
            <a
              key={action.href}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-emerald-500 active:scale-[0.98]"
            >
              <span>{action.label}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : (
            <Link
              key={action.href}
              to={action.href}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-emerald-500 active:scale-[0.98]"
            >
              <span>{action.label}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
