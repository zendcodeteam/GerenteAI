/**
 * Contrato neutral de IA (puerto).
 *
 * Nada de este archivo puede mencionar un proveedor concreto. Todo el dominio
 * (extraccion de gastos, insights, asistente) habla SOLO este lenguaje, y cada
 * proveedor traduce desde/hacia su formato nativo en `src/ai/providers`.
 *
 * Regla de oro para migrar de una IA a otra: si necesitas tocar algo fuera de
 * `src/ai/providers`, el contrato esta mal disenado.
 */

export type JsonSchemaType =
  'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';

/** Subconjunto de JSON Schema que todos los proveedores entienden. */
export interface JsonSchema {
  /**
   * Un tipo, o varios para campos que aceptan nulo: `['string', 'null']`.
   * Cada adaptador lo traduce a lo que su proveedor acepte (Gemini, por
   * ejemplo, no admite listas de tipos y usa `nullable`).
   */
  type?: JsonSchemaType | JsonSchemaType[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number | boolean | null)[];
  additionalProperties?: boolean;
  nullable?: boolean;
  format?: string;
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmTextPart {
  type: 'text';
  text: string;
}

export interface LlmImagePart {
  type: 'image';
  /** p.ej. "image/jpeg" — util para fotos de facturas enviadas por WhatsApp. */
  mimeType: string;
  /** Contenido en base64, sin el prefijo `data:`. */
  dataBase64: string;
}

export interface LlmAudioPart {
  type: 'audio';
  /** p.ej. "audio/ogg" — las notas de voz de WhatsApp llegan en Opus. */
  mimeType: string;
  /** Contenido en base64, sin el prefijo `data:`. */
  dataBase64: string;
}

export type LlmContentPart = LlmTextPart | LlmImagePart | LlmAudioPart;

/** Peticion del modelo para ejecutar una herramienta del backend. */
export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmMessage {
  role: LlmRole;
  content: string | LlmContentPart[];
  /** Solo en mensajes `assistant`: herramientas que el modelo quiere ejecutar. */
  toolCalls?: LlmToolCall[];
  /** Solo en mensajes `tool`: id de la llamada que este mensaje responde. */
  toolCallId?: string;
  /** Solo en mensajes `tool`: nombre de la herramienta ejecutada. */
  name?: string;
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export type LlmToolChoice = 'auto' | 'none' | 'required' | { name: string };

export type LlmResponseFormat =
  | { type: 'text' }
  /** JSON libre, sin esquema. */
  | { type: 'json' }
  /** JSON validado contra un esquema. Cada adaptador usa su modo nativo si existe. */
  | { type: 'json_schema'; name: string; schema: JsonSchema };

/**
 * Nivel de esfuerzo/razonamiento. Es una abstraccion deliberada: cada proveedor
 * lo mapea a lo suyo (effort, thinking, reasoning_effort) o lo ignora.
 */
export type LlmEffort = 'low' | 'medium' | 'high';

export interface LlmRequest {
  /** Instrucciones de sistema. Se envian por el canal nativo de cada proveedor. */
  system?: string;
  /**
   * Trozo inicial de `system` que es IDENTICO en todas las llamadas y, por lo
   * tanto, se puede cachear en el proveedor.
   *
   * Es un prefijo de `system`, no un campo aparte: asi el texto que recibe el
   * modelo no cambia ni una coma, y el proveedor que no sepa cachear puede
   * ignorarlo sin perder nada. El que si sabe lo corta en dos bloques y marca
   * el primero.
   *
   * Lo que va despues del prefijo tiene que ser lo volatil (la fecha, el
   * negocio, la pregunta abierta): la cache casa por prefijo exacto, asi que
   * un solo byte movido mas arriba la invalida entera.
   */
  cacheableSystemPrefix?: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  toolChoice?: LlmToolChoice;
  responseFormat?: LlmResponseFormat;
  maxOutputTokens?: number;
  /**
   * 0..1. Se ignora en modelos que no lo aceptan (p.ej. Claude Opus 5 lo
   * rechaza con 400), por eso el adaptador debe filtrarlo, no el dominio.
   */
  temperature?: number;
  effort?: LlmEffort;
  timeoutMs?: number;
  /** Trazabilidad: tenantId, businessId, feature. Nunca datos sensibles. */
  metadata?: Record<string, string>;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Tokens leidos de cache de prompt, si el proveedor lo reporta. */
  cachedInputTokens?: number;
}

export type LlmFinishReason =
  'stop' | 'length' | 'tool_calls' | 'content_filter' | 'refusal' | 'unknown';

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
  finishReason: LlmFinishReason;
  usage: LlmUsage;
  /** Identificador del proveedor que respondio (p.ej. "groq"). */
  providerId: string;
  /** Modelo concreto usado (p.ej. "llama-3.3-70b-versatile"). */
  model: string;
  latencyMs: number;
  /** Costo estimado en USD segun el catalogo de precios. 0 si es gratuito. */
  costUsd: number;
  /** Respuesta cruda del proveedor. Solo para depuracion/logs. */
  raw?: unknown;
}

export interface LlmCapabilities {
  /** Function calling nativo. */
  tools: boolean;
  /** JSON garantizado contra un esquema (structured outputs nativo). */
  nativeJsonSchema: boolean;
  /** Modo "responde JSON valido" sin esquema. */
  jsonMode: boolean;
  vision: boolean;
  /** Maximo de tokens de salida recomendado por defecto. */
  maxOutputTokens: number;
}

export interface LlmHealth {
  ok: boolean;
  providerId: string;
  model: string;
  latencyMs: number;
  detail?: string;
}
