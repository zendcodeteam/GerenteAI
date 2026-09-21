import { createContext, useContext, useState, ReactNode } from "react";
import { ChatMessage, QuickPrompt } from "../types";
import { resolveActiveSedeId } from "@/lib/activeBusiness";
import { assistantApi } from "../api/assistantApi";

interface LukaChatContextType {
  messages: ChatMessage[];
  isTyping: boolean;
  isFloatingOpen: boolean;
  setIsFloatingOpen: (open: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  quickPrompts: QuickPrompt[];
  heroDockPulse: number;
  triggerHeroDockPulse: () => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    sender: "assistant",
    text: "¡Hola! Soy Luka, tu Gerente Financiero con Inteligencia Artificial. ¿En qué puedo ayudarte hoy? Puedes preguntarme sobre tus ingresos, gastos, margen de ganancia o reportes de ventas.",
    timestamp: "Ahora",
  },
];

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "p1",
    label: "¿Cuánto vendimos este mes?",
    query: "¿Cuál es el resumen de ventas e ingresos de este mes?",
  },
  {
    id: "p2",
    label: "¿Cuáles son los mayores gastos?",
    query: "¿En qué categorías se han concentrado los mayores gastos operativos?",
  },
  {
    id: "p3",
    label: "Balance y Rentabilidad",
    query: "¿Cuál es el balance neto y el margen de rentabilidad actual?",
  },
  {
    id: "p4",
    label: "Cuentas por Cobrar (Fiados)",
    query: "¿Cuánto dinero tenemos pendiente en cuentas por cobrar fiadas?",
  },
];

const REGISTER_ACTION = {
  label: "Registrarme en Luka",
  href: "/register",
};

const OUT_OF_SCOPE_RESPONSE =
  "No estoy habilitado para responder preguntas que no estén relacionadas con la gestión de tu negocio. Puedes preguntarme por tus ventas, gastos, inventario, rentabilidad, fiados o reportes.";

type FallbackResponse = Pick<ChatMessage, "text"> &
  Partial<Pick<ChatMessage, "actionButton">>;

const isWithinLukaScope = (query: string) => {
  const normalizedQuery = query.toLowerCase();

  return [
    "luka",
    "hola",
    "buenas",
    "qué puedes hacer",
    "que puedes hacer",
    "negocio",
    "empresa",
    "tienda",
    "venta",
    "vendi",
    "ingreso",
    "gasto",
    "compra",
    "compre",
    "egreso",
    "costo",
    "rentab",
    "margen",
    "balance",
    "fiad",
    "cobrar",
    "abono",
    "deuda",
    "cliente",
    "inventario",
    "stock",
    "producto",
    "existencia",
    "reporte",
    "informe",
    "resumen",
    "estadística",
    "estadistica",
    "registrar",
    "movimiento",
    "whatsapp",
    "plan",
    "suscrip",
  ].some((keyword) => normalizedQuery.includes(keyword));
};

const LukaChatContext = createContext<LukaChatContextType | undefined>(undefined);

export function LukaChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);
  const [heroDockPulse, setHeroDockPulse] = useState(0);

  const triggerHeroDockPulse = () => {
    setHeroDockPulse((prev) => prev + 1);
  };

  const getFallbackResponse = (query: string): FallbackResponse => {
    const q = query.toLowerCase();

    if (q.includes("hola") || q.includes("buenas") || q.includes("qué puedes hacer") || q.includes("que puedes hacer")) {
      return {
        text: "Puedo ayudarte a entender y organizar las finanzas de tu negocio. En WhatsApp, Luka responde consultas sobre ventas, gastos, rentabilidad, inventario y cartera, y también puede ayudarte a registrar movimientos. Regístrate para conectar tus datos y comenzar.",
        actionButton: REGISTER_ACTION,
      };
    }

    if (q.includes("inventario") || q.includes("stock") || q.includes("producto") || q.includes("existencia")) {
      return {
        text: "Si necesitas controlar tu inventario, Luka puede consultar existencias, detectar productos con poco stock y ayudarte a revisar qué artículos se mueven más. Puedes hacerle estas preguntas por WhatsApp después de registrar tu negocio.",
        actionButton: REGISTER_ACTION,
      };
    }

    if (q.includes("reporte") || q.includes("informe") || q.includes("resumen") || q.includes("estadística") || q.includes("estadistica")) {
      return {
        text: "Luka convierte tus movimientos en reportes fáciles de entender: ventas, gastos, flujo de caja, rentabilidad y cartera. Pídele el resumen que necesites por WhatsApp y regístrate para recibir análisis basados en tus propios datos.",
        actionButton: REGISTER_ACTION,
      };
    }

    if (q.includes("registrar") || q.includes("anota") || q.includes("vendí") || q.includes("vendi") || q.includes("compré") || q.includes("compre") || q.includes("pagó") || q.includes("pago")) {
      return {
        text: "Puedes contarle a Luka lo que ocurrió en tu negocio con un mensaje sencillo. Por WhatsApp, te ayuda a registrar ventas, compras, gastos y abonos para que luego puedas consultarlos en tus reportes. Regístrate para empezar a guardar tus movimientos.",
        actionButton: REGISTER_ACTION,
      };
    }

    if (q.includes("venta") || q.includes("ingreso") || q.includes("ganancia")) {
      return {
        text: "Si le escribes a Luka por WhatsApp, puedes pedirle un resumen de tus ventas para cualquier periodo: separa lo vendido de contado y fiado, compara con el mes anterior y señala tus días más fuertes. Registra tu negocio para consultar tus cifras reales y recibir el detalle completo.",
        actionButton: REGISTER_ACTION,
      };
    }

    if (q.includes("gasto") || q.includes("compra") || q.includes("egreso")) {
      return {
        text: "¿Quieres entender en qué se va el dinero? Desde WhatsApp, Luka organiza tus compras y gastos por categoría, descubre cuáles pesan más y te alerta sobre aumentos o costos que conviene revisar. Registra tu negocio para analizar tus movimientos reales con mayor detalle.",
        actionButton: REGISTER_ACTION,
      };
    }

    if (q.includes("balance") || q.includes("rentabilidad")) {
      return {
        text: "Con tus datos conectados, puedes preguntarle a Luka en WhatsApp si el negocio está siendo rentable: calculará el balance neto, estimará tu margen y explicará qué movimientos están afectando el resultado. Registra tu negocio para obtener el cálculo basado en tus datos y recomendaciones más precisas.",
        actionButton: REGISTER_ACTION,
      };
    }

    if (q.includes("fiad") || q.includes("cobrar") || q.includes("pendiente")) {
      return {
        text: "Para controlar los fiados, envíale una consulta a Luka por WhatsApp: te mostrará cuánto está pendiente, qué cuentas llevan más tiempo abiertas y cómo avanzan los abonos de cada cliente. Registra tu negocio para llevar el control de tu cartera actualizada.",
        actionButton: REGISTER_ACTION,
      };
    }

    return { text: OUT_OF_SCOPE_RESPONSE };
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    if (!isWithinLukaScope(text)) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: OUT_OF_SCOPE_RESPONSE,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setIsTyping(false);
      return;
    }

    try {
      // /ai/* identifica al negocio por su SEDE, no por el Negocio: es donde
      // cuelgan las ventas y los gastos. Con el id del negocio la respuesta
      // llegaba igual, pero calculada sobre cero movimientos.
      const sedeId = await resolveActiveSedeId();
      const tenantId = localStorage.getItem("active_business_id") ?? undefined;

      if (!sedeId) {
        throw new Error("Todavía no hay una sede asociada a este negocio.");
      }

      // Historial para contexto de conversación en el LLM
      const history = messages.slice(-6).map((m) => ({
        role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.text,
      }));

      const result = await assistantApi.ask({
        businessId: sedeId,
        ...(tenantId ? { tenantId } : {}),
        question: text.trim(),
        history,
      });

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        ...(result.answer ? { text: result.answer } : getFallbackResponse(text)),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.warn("Luka AI offline o respondiendo con heurísticas locales:", err);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        ...getFallbackResponse(text),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <LukaChatContext.Provider
      value={{
        messages,
        isTyping,
        isFloatingOpen,
        setIsFloatingOpen,
        sendMessage,
        quickPrompts: QUICK_PROMPTS,
        heroDockPulse,
        triggerHeroDockPulse,
      }}
    >
      {children}
    </LukaChatContext.Provider>
  );
}

export function useLukaChat() {
  const context = useContext(LukaChatContext);
  if (!context) {
    throw new Error("useLukaChat must be used within a LukaChatProvider");
  }
  return context;
}
