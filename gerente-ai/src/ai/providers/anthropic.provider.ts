import Anthropic from '@anthropic-ai/sdk';

import { buildJsonSchemaInstruction } from '../core/json.util';
import { LlmError } from '../core/llm.errors';
import type { LlmProvider } from '../core/llm.provider';
import type {
  LlmCapabilities,
  LlmEffort,
  LlmFinishReason,
  LlmHealth,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmToolCall,
} from '../core/llm.types';
import { estimateCostUsd } from '../config/provider.catalog';

/**
 * Adaptador de Anthropic (Claude) — el destino de pago sugerido.
 *
 * Usa el SDK oficial `@anthropic-ai/sdk`. Aqui viven todas las particularidades
 * del modelo (razonamiento adaptativo, parametros de muestreo prohibidos,
 * salida estructurada nativa, rechazos por politica) para que el dominio no
 * tenga que enterarse de ninguna.
 */

/** Modelos que aceptan `thinking: {type:'adaptive'}` y `output_config.effort`. */
const ADAPTIVE_THINKING_MODELS = new Set([
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
]);

/**
 * Modelos que RECHAZAN `temperature`/`top_p`/`top_k` con error 400.
 * El adaptador los filtra en silencio: el dominio puede seguir pidiendo
 * temperatura sin romperse al migrar.
 */
const NO_SAMPLING_PARAMS_MODELS = new Set([
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-5',
]);

/** Modelos con salida estructurada garantizada por esquema. */
const STRUCTURED_OUTPUT_MODELS = new Set([
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-haiku-4-5',
]);

/** Modelos donde tiene sentido pedir enrutamiento automatico ante un rechazo. */
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5', 'claude-fable-5']);

const SERVER_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Por encima de este limite hay que usar streaming o el HTTP se cae por timeout. */
const STREAMING_THRESHOLD_TOKENS = 16_000;

export interface AnthropicProviderOptions {
  providerId: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  defaultMaxOutputTokens: number;
  /** Reintenta en otro modelo de Anthropic si los clasificadores rechazan la peticion. */
  serverFallback: boolean;
}

export class AnthropicProvider implements LlmProvider {
  private readonly client: Anthropic;
  private serverFallbackAvailable: boolean;

  constructor(private readonly options: AnthropicProviderOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      timeout: options.timeoutMs,
      // Los reintentos los gobierna LlmService, no el SDK.
      maxRetries: 0,
    });
    this.serverFallbackAvailable =
      options.serverFallback && SERVER_FALLBACK_MODELS.has(options.model);
  }

  get id(): string {
    return this.options.providerId;
  }

  get model(): string {
    return this.options.model;
  }

  get capabilities(): LlmCapabilities {
    return {
      tools: true,
      nativeJsonSchema: STRUCTURED_OUTPUT_MODELS.has(this.model),
      jsonMode: STRUCTURED_OUTPUT_MODELS.has(this.model),
      vision: true,
      maxOutputTokens: this.options.defaultMaxOutputTokens,
    };
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const startedAt = Date.now();
    const maxTokens =
      request.maxOutputTokens ?? this.options.defaultMaxOutputTokens;

    const message = await this.call(
      this.buildParams(request, maxTokens),
      maxTokens,
      request.timeoutMs,
    );
    return this.mapResponse(message, Date.now() - startedAt);
  }

  async healthCheck(): Promise<LlmHealth> {
    const startedAt = Date.now();
    try {
      const response = await this.generate({
        messages: [{ role: 'user', content: 'Responde exactamente: OK' }],
        maxOutputTokens: 64,
        effort: 'low',
      });
      return {
        ok: true,
        providerId: this.id,
        model: this.model,
        latencyMs: Date.now() - startedAt,
        detail: response.text.slice(0, 60),
      };
    } catch (error) {
      return {
        ok: false,
        providerId: this.id,
        model: this.model,
        latencyMs: Date.now() - startedAt,
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ------------------------------------------------------------- traduccion

  private buildParams(
    request: LlmRequest,
    maxTokens: number,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      messages: this.mapMessages(request.messages),
    };

    const system = this.buildSystemPrompt(request);
    if (system) {
      params.system = this.toSystemBlocks(
        system,
        request.cacheableSystemPrefix,
      );
    }

    // Muestreo: prohibido en los modelos nuevos, permitido en los antiguos.
    if (
      request.temperature !== undefined &&
      !NO_SAMPLING_PARAMS_MODELS.has(this.model)
    ) {
      params.temperature = request.temperature;
    }

    const outputConfig: Record<string, unknown> = {};

    if (ADAPTIVE_THINKING_MODELS.has(this.model)) {
      // Razonamiento adaptativo: el modelo decide cuanto pensar.
      params.thinking = { type: 'adaptive' };
      outputConfig.effort = mapEffort(request.effort);
    }

    if (request.tools?.length) {
      params.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
      params.tool_choice = mapToolChoice(request);
    } else {
      const format = request.responseFormat;
      if (
        format?.type === 'json_schema' &&
        this.capabilities.nativeJsonSchema
      ) {
        outputConfig.format = { type: 'json_schema', schema: format.schema };
      }
    }

    if (Object.keys(outputConfig).length) {
      params.output_config = outputConfig;
    }

    return params;
  }

  /**
   * El system prompt, partido en dos bloques cuando hay algo que cachear.
   *
   * El prompt del asistente de WhatsApp son ~14.500 tokens que viajan
   * IDENTICOS en cada mensaje; lo unico que cambia es el bloque de contexto
   * del final (la fecha, el negocio, la pregunta abierta). Marcando el primer
   * bloque con `cache_control`, Anthropic lo cobra al 10% y lo sirve mucho mas
   * rapido a partir de la segunda llamada.
   *
   * El texto que acaba leyendo el modelo es el mismo byte a byte: dos bloques
   * seguidos se concatenan igual que la cadena de antes. Si el prefijo no
   * encaja —porque alguien cambio el orden— se manda como siempre, sin cache,
   * en vez de arriesgar un prompt distinto.
   */
  private toSystemBlocks(system: string, prefix: string | undefined): unknown {
    if (
      !prefix ||
      !system.startsWith(prefix) ||
      prefix.length === system.length
    ) {
      return system;
    }

    return [
      {
        type: 'text',
        text: prefix,
        cache_control: { type: 'ephemeral' },
      },
      { type: 'text', text: system.slice(prefix.length) },
    ];
  }

  private buildSystemPrompt(request: LlmRequest): string | undefined {
    const parts: string[] = [];
    if (request.system) parts.push(request.system);

    const format = request.responseFormat;
    const usingNativeSchema =
      format?.type === 'json_schema' &&
      this.capabilities.nativeJsonSchema &&
      !request.tools?.length;

    if (format?.type === 'json_schema' && !usingNativeSchema) {
      parts.push(buildJsonSchemaInstruction(format.name, format.schema));
    } else if (format?.type === 'json') {
      parts.push('\nResponde unicamente con un objeto JSON valido.');
    }

    return parts.length ? parts.join('\n') : undefined;
  }

  private mapMessages(messages: LlmMessage[]): Record<string, unknown>[] {
    const mapped: Record<string, unknown>[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Anthropic lleva el sistema en un campo aparte; si llega uno suelto
        // en el historial lo degradamos a turno de usuario.
        mapped.push({ role: 'user', content: textOf(message.content) });
        continue;
      }

      if (message.role === 'tool') {
        mapped.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: message.toolCallId,
              content: textOf(message.content),
            },
          ],
        });
        continue;
      }

      const blocks: Record<string, unknown>[] = [];

      if (typeof message.content === 'string') {
        if (message.content)
          blocks.push({ type: 'text', text: message.content });
      } else {
        for (const part of message.content) {
          if (part.type === 'text')
            blocks.push({ type: 'text', text: part.text });
          else
            blocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: part.mimeType,
                data: part.dataBase64,
              },
            });
        }
      }

      for (const call of message.toolCalls ?? []) {
        blocks.push({
          type: 'tool_use',
          id: call.id,
          name: call.name,
          input: call.arguments ?? {},
        });
      }

      if (!blocks.length) blocks.push({ type: 'text', text: '' });

      mapped.push({ role: message.role, content: blocks });
    }

    return mapped;
  }

  // ------------------------------------------------------------------ envio

  private async call(
    params: Record<string, unknown>,
    maxTokens: number,
    timeoutMs?: number,
  ): Promise<AnthropicMessage> {
    try {
      return await this.dispatch(
        params,
        maxTokens,
        this.serverFallbackAvailable,
        timeoutMs,
      );
    } catch (error) {
      // Si la cuenta no tiene habilitada la beta de fallback, reintentamos sin ella
      // una sola vez y desactivamos la opcion para el resto del proceso.
      if (this.serverFallbackAvailable && isBetaRejection(error)) {
        this.serverFallbackAvailable = false;
        try {
          return await this.dispatch(params, maxTokens, false, timeoutMs);
        } catch (retryError) {
          throw this.toLlmError(retryError);
        }
      }
      throw this.toLlmError(error);
    }
  }

  private async dispatch(
    params: Record<string, unknown>,
    maxTokens: number,
    withServerFallback: boolean,
    timeoutMs?: number,
  ): Promise<AnthropicMessage> {
    // Con max_tokens alto hay que ir por streaming o el HTTP muere por timeout.
    const useStreaming = maxTokens > STREAMING_THRESHOLD_TOKENS;

    // El SDK aun no tipa `fallbacks` ni `output_config.format`; los parametros
    // viajan tal cual al API. Tipamos el punto de entrada para no perder
    // seguridad en el resto del adaptador.
    const surface = (withServerFallback
      ? this.client.beta.messages
      : this.client.messages) as unknown as AnthropicMessagesSurface;

    const finalParams = withServerFallback
      ? { ...params, betas: [SERVER_FALLBACK_BETA], fallbacks: 'default' }
      : params;

    // El timeout del constructor es el de todo el proceso; este es el de ESTA
    // llamada. Sin el, una interpretacion de WhatsApp —con alguien esperando
    // del otro lado— heredaba los 45 segundos pensados para los informes.
    const opciones = timeoutMs ? { timeout: timeoutMs } : undefined;

    return useStreaming
      ? surface.stream(finalParams, opciones).finalMessage()
      : surface.create(finalParams, opciones);
  }

  private mapResponse(
    message: AnthropicMessage,
    latencyMs: number,
  ): LlmResponse {
    // Los clasificadores pueden declinar la peticion: hay que revisarlo ANTES
    // de leer el contenido, que puede venir vacio.
    if (message.stop_reason === 'refusal') {
      throw new LlmError(
        'refusal',
        `Claude rechazo la peticion (${message.stop_details?.category ?? 'sin categoria'}).`,
        { providerId: this.id },
      );
    }

    const blocks = Array.isArray(message.content) ? message.content : [];

    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');

    const toolCalls: LlmToolCall[] = blocks
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({
        id: block.id ?? '',
        name: block.name ?? '',
        arguments: (block.input ?? {}) as Record<string, unknown>,
      }));

    const inputTokens = message.usage?.input_tokens ?? 0;
    const outputTokens = message.usage?.output_tokens ?? 0;
    const model = message.model ?? this.model;

    return {
      text,
      toolCalls,
      finishReason: mapStopReason(message.stop_reason),
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cachedInputTokens: message.usage?.cache_read_input_tokens,
      },
      providerId: this.id,
      model,
      latencyMs,
      costUsd: estimateCostUsd(model, inputTokens, outputTokens),
      raw: message,
    };
  }

  private toLlmError(error: unknown): LlmError {
    if (LlmError.isLlmError(error)) return error;

    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return new LlmError('timeout', `Anthropic no respondio a tiempo.`, {
        providerId: this.id,
        cause: error,
      });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new LlmError('network', `No se pudo conectar con Anthropic.`, {
        providerId: this.id,
        cause: error,
      });
    }
    if (error instanceof Anthropic.APIError) {
      const status = typeof error.status === 'number' ? error.status : 500;
      return LlmError.fromHttpStatus(
        status,
        `Anthropic respondio ${status}: ${error.message}`,
        this.id,
        { cause: error },
      );
    }

    return new LlmError(
      'unknown',
      `Fallo inesperado de Anthropic: ${error instanceof Error ? error.message : String(error)}`,
      { providerId: this.id, cause: error },
    );
  }
}

// ------------------------------------------------------------------ helpers

/** Forma de la respuesta que consumimos. Evita `any` en todo el adaptador. */
interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicMessage {
  model?: string;
  stop_reason?: string;
  stop_details?: { category?: string } | null;
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/** Punto de entrada al SDK, tipado para los parametros que aun no expone. */
interface AnthropicMessagesSurface {
  create(
    params: Record<string, unknown>,
    options?: AnthropicRequestOptions,
  ): Promise<AnthropicMessage>;
  stream(
    params: Record<string, unknown>,
    options?: AnthropicRequestOptions,
  ): {
    finalMessage(): Promise<AnthropicMessage>;
  };
}

/** Opciones por peticion del SDK. El timeout va en milisegundos. */
interface AnthropicRequestOptions {
  timeout?: number;
}

function mapEffort(effort: LlmEffort | undefined): string {
  switch (effort) {
    case 'low':
      return 'low';
    case 'high':
      return 'high';
    default:
      return 'medium';
  }
}

function mapToolChoice(request: LlmRequest): Record<string, unknown> {
  const choice = request.toolChoice ?? 'auto';
  if (typeof choice === 'object') return { type: 'tool', name: choice.name };
  if (choice === 'required') return { type: 'any' };
  if (choice === 'none') return { type: 'none' };
  return { type: 'auto' };
}

function mapStopReason(reason: string | undefined): LlmFinishReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    case 'refusal':
      return 'refusal';
    default:
      return reason ? 'unknown' : 'stop';
  }
}

function isBetaRejection(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError)) return false;
  if (error.status !== 400 && error.status !== 403) return false;
  const message = error.message?.toLowerCase() ?? '';
  return message.includes('beta') || message.includes('fallback');
}

function textOf(content: LlmMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    )
    .map((part) => part.text)
    .join('\n');
}
