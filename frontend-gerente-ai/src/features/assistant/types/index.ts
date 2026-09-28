export interface ChatActionButton {
  label: string;
  href: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  metricWidget?: {
    title: string;
    value: string;
    percentage: string;
    progress: number;
  };
  /** Botones dentro del globo del mensaje (ej. "Registrarme", "Escribir por WhatsApp"). */
  actionButtons?: ChatActionButton[];
}

export interface QuickPrompt {
  id: string;
  label: string;
  query: string;
  iconName?: string;
}
