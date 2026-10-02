import { createContext, useContext, useState, ReactNode } from "react";
import { ChatActionButton, ChatMessage, QuickPrompt } from "../types";

interface LukaChatContextType {
  messages: ChatMessage[];
  isTyping: boolean;
  isFloatingOpen: boolean;
  setIsFloatingOpen: (open: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  quickPrompts: QuickPrompt[];
  heroDockPulse: number;
  triggerHeroDockPulse: () => void;
  /** Chat del landing con respuestas fijas: nunca se llega al tope, se deja en false para no romper los componentes que lo leen. */
  isLimitReached: boolean;
  limitActions: ChatActionButton[];
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    sender: "assistant",
    text: "¡Hola! Soy Luka 👋 Pregúntame lo que quieras saber antes de registrarte: cómo funciono, qué planes hay o cualquier duda sobre el producto.",
    timestamp: "Ahora",
  },
];

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "p1",
    label: "¿Cómo funciona Luka?",
    query: "¿Cómo funciona Luka paso a paso?",
  },
  {
    id: "p2",
    label: "¿Qué planes hay?",
    query: "¿Qué planes tienen disponibles y cuánto cuestan?",
  },
  {
    id: "p3",
    label: "¿Necesito saber de contabilidad?",
    query: "¿Necesito saber de contabilidad para usar Luka?",
  },
  {
    id: "p4",
    label: "¿Cómo me registro?",
    query: "¿Cómo puedo registrarme y empezar a usar Luka?",
  },
];

const REGISTER_ACTION = {
  label: "Registrarme en Luka",
  href: "/register",
};

const OUT_OF_SCOPE_RESPONSE =
  "No estoy habilitado para responder preguntas que no estén relacionadas con Luka AI. Puedes preguntarme cómo funciono, qué planes hay o cómo registrarte.";

type FallbackResponse = Pick<ChatMessage, "text"> &
  Partial<Pick<ChatMessage, "actionButtons">>;

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
    "cuesta",
    "cuánto",
    "cuanto",
    "precio",
    "gratis",
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
    "registr",
    "movimiento",
    "whatsapp",
    "plan",
    "suscrip",
    "funciona",
    "contabilidad",
    "empezar",
    "probar",
    "prueba",
  ].some((keyword) => normalizedQuery.includes(keyword));
};

const LukaChatContext = createContext<LukaChatContextType | undefined>(undefined);

export function LukaChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);
  const [heroDockPulse, setHeroDockPulse] = useState(0);
  const [isLimitReached] = useState(false);
  const [limitActions] = useState<ChatActionButton[]>([]);

  const triggerHeroDockPulse = () => {
    setHeroDockPulse((prev) => prev + 1);
  };

  const getFallbackResponse = (query: string): FallbackResponse => {
    const q = query.toLowerCase();

    if (q.includes("hola") || q.includes("buenas") || q.includes("qué puedes hacer") || q.includes("que puedes hacer")) {
      return {
        text: "Puedo ayudarte a entender y organizar las finanzas de tu negocio. En WhatsApp, Luka responde consultas sobre ventas, gastos, rentabilidad, inventario y cartera, y también puede ayudarte a registrar movimientos. Regístrate para conectar tus datos y comenzar.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("funciona") || q.includes("paso a paso")) {
      return {
        text: "Luka funciona por WhatsApp: le cuentas lo que pasa en tu negocio (ventas, gastos, fiados, inventario) con un mensaje, audio o foto, y Luka lo organiza automáticamente para que luego puedas consultar reportes y recomendaciones. Regístrate para conectar tu negocio y empezar a usarlo.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("plan") || q.includes("suscrip") || q.includes("cuesta") || q.includes("precio") || q.includes("gratis")) {
      return {
        text: "Luka tiene planes para distintos tamaños de negocio, incluyendo una opción gratuita para empezar. Regístrate para ver el detalle de cada plan y elegir el que mejor se ajuste a tu negocio.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("contabilidad")) {
      return {
        text: "No necesitas saber de contabilidad para usar Luka. Le hablas en lenguaje cotidiano (por ejemplo, 'vendí 80.000 hoy') y Luka se encarga de organizar y traducir esa información en reportes claros. Regístrate para comenzar sin complicaciones.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("inventario") || q.includes("stock") || q.includes("producto") || q.includes("existencia")) {
      return {
        text: "Si necesitas controlar tu inventario, Luka puede consultar existencias, detectar productos con poco stock y ayudarte a revisar qué artículos se mueven más. Puedes hacerle estas preguntas por WhatsApp después de registrar tu negocio.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("reporte") || q.includes("informe") || q.includes("resumen") || q.includes("estadística") || q.includes("estadistica")) {
      return {
        text: "Luka convierte tus movimientos en reportes fáciles de entender: ventas, gastos, flujo de caja, rentabilidad y cartera. Pídele el resumen que necesites por WhatsApp y regístrate para recibir análisis basados en tus propios datos.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("registrar") || q.includes("anota") || q.includes("vendí") || q.includes("vendi") || q.includes("compré") || q.includes("compre") || q.includes("pagó") || q.includes("pago")) {
      return {
        text: "Puedes contarle a Luka lo que ocurrió en tu negocio con un mensaje sencillo. Por WhatsApp, te ayuda a registrar ventas, compras, gastos y abonos para que luego puedas consultarlos en tus reportes. Regístrate para empezar a guardar tus movimientos.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("venta") || q.includes("ingreso") || q.includes("ganancia")) {
      return {
        text: "Si le escribes a Luka por WhatsApp, puedes pedirle un resumen de tus ventas para cualquier periodo: separa lo vendido de contado y fiado, compara con el mes anterior y señala tus días más fuertes. Registra tu negocio para consultar tus cifras reales y recibir el detalle completo.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("gasto") || q.includes("compra") || q.includes("egreso")) {
      return {
        text: "¿Quieres entender en qué se va el dinero? Desde WhatsApp, Luka organiza tus compras y gastos por categoría, descubre cuáles pesan más y te alerta sobre aumentos o costos que conviene revisar. Registra tu negocio para analizar tus movimientos reales con mayor detalle.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("balance") || q.includes("rentabilidad")) {
      return {
        text: "Con tus datos conectados, puedes preguntarle a Luka en WhatsApp si el negocio está siendo rentable: calculará el balance neto, estimará tu margen y explicará qué movimientos están afectando el resultado. Registra tu negocio para obtener el cálculo basado en tus datos y recomendaciones más precisas.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    if (q.includes("fiad") || q.includes("cobrar") || q.includes("pendiente")) {
      return {
        text: "Para controlar los fiados, envíale una consulta a Luka por WhatsApp: te mostrará cuánto está pendiente, qué cuentas llevan más tiempo abiertas y cómo avanzan los abonos de cada cliente. Registra tu negocio para llevar el control de tu cartera actualizada.",
        actionButtons: [REGISTER_ACTION],
      };
    }

    return { text: OUT_OF_SCOPE_RESPONSE };
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLimitReached) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Chat informativo del landing: respuestas fijas, sin llamar a ningún
    // modelo de IA. Así siempre se mantiene dentro de tema y siempre
    // termina invitando a registrarse.
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: "assistant",
      ...(isWithinLukaScope(text)
        ? getFallbackResponse(text)
        : { text: OUT_OF_SCOPE_RESPONSE }),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setIsTyping(false);
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
        isLimitReached,
        limitActions,
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
