import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import { AI_CONFIG, type AiConfig } from '../config/ai.config';
import { withRetry } from '../core/http.util';
import { parseJsonResponse } from '../core/json.util';
import { LlmError } from '../core/llm.errors';
import {
  LLM_FALLBACK_PROVIDER,
  LLM_PROVIDER,
  type LlmProvider,
} from '../core/llm.provider';
import type {
  JsonSchema,
  LlmHealth,
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmToolDefinition,
} from '../core/llm.types';
import { AiUsageService, type AiCallContext } from '../usage/usage.service';

/**
 * Fachada de IA que usa TODO el dominio.
 *
 * Anade sobre el proveedor crudo lo que no debe reimplementarse en cada caso
 * de uso: cuotas del plan, reintentos, proveedor de respaldo, medicion de
 * consumo y trazas. El dominio nunca inyecta un proveedor directamente.
 */

/**
 * Llamadas con un humano esperando la respuesta.
 *
 * Son las que llevan el tope corto. El resto —informes, recomendaciones del
 * panel, lo que corre por la noche— se queda con el general, donde esperar
 * mas no le molesta a nadie.
 */
const INTERACTIVE_FEATURES = new Set([
  'whatsapp.request',
  'whatsapp.internal',
  'landing.chat',
  'assistant.chat',
]);

/** Ejecuta una herramienta pedida por el modelo y devuelve el texto del resultado. */
export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<string> | string;

export interface ToolLoopOptions {
  tools: LlmToolDefinition[];
  execute: ToolExecutor;
  /** Tope de vueltas modelo → herramienta → modelo. Evita bucles infinitos. */
  maxSteps?: number;
}

export interface ToolLoopResult {
  response: LlmResponse;
  /** Historial completo, util para depurar y para continuar la conversacion. */
  messages: LlmMessage[];
  toolCallsExecuted: { name: string; args: Record<string, unknown> }[];
  /** Consumo acumulado de todas las vueltas. */
  totalUsage: { inputTokens: number; outputTokens: number; costUsd: number };
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly primary: LlmProvider,
    @Inject(AI_CONFIG) private readonly config: AiConfig,
    private readonly usage: AiUsageService,
    @Optional()
    @Inject(LLM_FALLBACK_PROVIDER)
    private readonly fallback?: LlmProvider | null,
  ) {}

  /** Proveedor activo. El dominio no deberia necesitarlo, pero /health si. */
  get provider(): LlmProvider {
    return this.primary;
  }

  // --------------------------------------------------------------- llamadas

  async complete(
    request: LlmRequest,
    context?: AiCallContext,
  ): Promise<LlmResponse> {
    if (context) await this.usage.assertWithinQuota(context);

    const startedAt = Date.now();
    const prepared = this.applyDefaults(request, context);

    try {
      const response = await this.callWithResilience(prepared, context);
      if (context) await this.usage.recordSuccess(context, response);

      this.logger.log(
        `IA ok · ${response.providerId}/${response.model} · ${response.usage.inputTokens}→${response.usage.outputTokens} tok${formatCacheHit(response.usage.cachedInputTokens)} · ${response.latencyMs} ms · ${formatCost(response.costUsd)}${context ? ` · ${context.feature}` : ''}`,
      );

      if (this.config.logPrompts) {
        this.logger.debug(
          `Prompt: ${JSON.stringify({ system: prepared.system, messages: prepared.messages })}`,
        );
        this.logger.debug(`Respuesta: ${response.text}`);
      }

      return response;
    } catch (error) {
      const code = LlmError.isLlmError(error) ? error.code : 'unknown';
      if (context && code !== 'quota_exceeded') {
        await this.usage.recordFailure(
          context,
          this.primary.id,
          this.primary.model,
          code,
          Date.now() - startedAt,
        );
      }
      throw error;
    }
  }

  /**
   * Pide una respuesta JSON validada contra un esquema y la devuelve parseada.
   *
   * Si el modelo devuelve algo que no es JSON (tipico en modelos gratuitos
   * pequenos), hace UN intento de correccion antes de fallar.
   */
  async completeJson<T>(
    request: Omit<LlmRequest, 'responseFormat'> & {
      schemaName: string;
      schema: JsonSchema;
    },
    context?: AiCallContext,
  ): Promise<{ data: T; response: LlmResponse }> {
    const { schemaName, schema, ...rest } = request;

    const baseRequest: LlmRequest = {
      ...rest,
      responseFormat: { type: 'json_schema', name: schemaName, schema },
    };

    const response = await this.complete(baseRequest, context);

    try {
      return {
        data: parseJsonResponse<T>(response.text, response.providerId),
        response,
      };
    } catch (error) {
      if (!LlmError.isLlmError(error) || error.code !== 'parse') throw error;

      this.logger.warn(
        `${response.providerId} devolvio JSON invalido; reintentando con correccion explicita.`,
      );

      const repaired = await this.complete(
        {
          ...baseRequest,
          messages: [
            ...baseRequest.messages,
            { role: 'assistant', content: response.text },
            {
              role: 'user',
              content:
                'Tu respuesta anterior no era JSON valido. Devuelve SOLO el objeto JSON pedido, sin texto ni bloques de codigo.',
            },
          ],
        },
        context,
      );

      return {
        data: parseJsonResponse<T>(repaired.text, repaired.providerId),
        response: repaired,
      };
    }
  }

  /**
   * Conversacion con herramientas: el modelo pide datos, el backend los
   * entrega y el modelo responde. Funciona igual con cualquier proveedor que
   * declare `capabilities.tools`.
   */
  async runToolLoop(
    request: LlmRequest,
    options: ToolLoopOptions,
    context?: AiCallContext,
  ): Promise<ToolLoopResult> {
    if (!this.primary.capabilities.tools) {
      throw new LlmError(
        'unsupported',
        `El proveedor ${this.primary.id} no soporta herramientas; usa otro proveedor para el asistente.`,
        { providerId: this.primary.id },
      );
    }

    const maxSteps = options.maxSteps ?? 4;
    const messages: LlmMessage[] = [...request.messages];
    const executed: ToolLoopResult['toolCallsExecuted'] = [];
    const totals = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

    let response = await this.complete(
      { ...request, messages, tools: options.tools },
      context,
    );
    accumulate(totals, response);

    for (let step = 0; step < maxSteps; step++) {
      if (!response.toolCalls.length) break;

      messages.push({
        role: 'assistant',
        content: response.text,
        toolCalls: response.toolCalls,
      });

      for (const call of response.toolCalls) {
        executed.push({ name: call.name, args: call.arguments });

        let result: string;
        try {
          result = await options.execute(call.name, call.arguments);
        } catch (error) {
          // Un fallo de herramienta se le cuenta al modelo, no rompe la peticion.
          result = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
          this.logger.warn(`Herramienta "${call.name}" fallo: ${result}`);
        }

        messages.push({
          role: 'tool',
          name: call.name,
          toolCallId: call.id,
          content: result,
        });
      }

      response = await this.complete(
        { ...request, messages, tools: options.tools },
        context,
      );
      accumulate(totals, response);
    }

    if (response.toolCalls.length) {
      this.logger.warn(
        `El asistente alcanzo el limite de ${maxSteps} pasos con herramientas pendientes.`,
      );
    }

    return {
      response,
      messages,
      toolCallsExecuted: executed,
      totalUsage: {
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        costUsd: Number(totals.costUsd.toFixed(6)),
      },
    };
  }

  // ------------------------------------------------------------ diagnostico

  async health(): Promise<LlmHealth[]> {
    const checks = [this.primary.healthCheck()];
    if (this.fallback) checks.push(this.fallback.healthCheck());
    return Promise.all(checks);
  }

  describe() {
    return {
      primary: {
        provider: this.primary.id,
        label: this.config.primary.preset.label,
        tier: this.config.primary.preset.tier,
        model: this.primary.model,
        capabilities: this.primary.capabilities,
      },
      fallback: this.fallback
        ? {
            provider: this.fallback.id,
            model: this.fallback.model,
            capabilities: this.fallback.capabilities,
          }
        : null,
      limits: {
        timeoutMs: this.config.timeoutMs,
        maxRetries: this.config.maxRetries,
        maxOutputTokens: this.config.maxOutputTokens,
      },
    };
  }

  // ----------------------------------------------------------------- interno

  private applyDefaults(
    request: LlmRequest,
    context?: AiCallContext,
  ): LlmRequest {
    return {
      ...request,
      temperature: request.temperature ?? this.config.temperature,
      maxOutputTokens: request.maxOutputTokens ?? this.config.maxOutputTokens,
      timeoutMs: request.timeoutMs ?? this.timeoutFor(context),
    };
  }

  /**
   * Cuanto se espera a esta llamada.
   *
   * Depende de si hay alguien mirando la pantalla. El tope general esta
   * pensado para lo que corre solo; aplicarselo a un mensaje de WhatsApp
   * significa que el usuario espera 45 segundos —por reintento— una respuesta
   * que, cuando llega, ya no le sirve.
   */
  private timeoutFor(context?: AiCallContext): number {
    return context && INTERACTIVE_FEATURES.has(context.feature)
      ? this.config.interactiveTimeoutMs
      : this.config.timeoutMs;
  }

  /** Reintentos sobre el proveedor principal y, si se agotan, el de respaldo. */
  private async callWithResilience(
    request: LlmRequest,
    context?: AiCallContext,
  ): Promise<LlmResponse> {
    try {
      return await withRetry(() => this.primary.generate(request), {
        attempts: this.config.maxRetries,
        baseDelayMs: 500,
        onRetry: (error, attempt, delay) =>
          this.logger.warn(
            `Reintento ${attempt}/${this.config.maxRetries} en ${Math.round(delay)} ms · ${this.primary.id} · ${error.code}: ${error.message}`,
          ),
      });
    } catch (error) {
      if (!this.fallback || !this.shouldFallback(error)) throw error;

      this.logger.warn(
        `Cambiando al proveedor de respaldo (${this.fallback.id}) tras fallar ${this.primary.id}${context ? ` en ${context.feature}` : ''}.`,
      );

      return withRetry(() => this.fallback!.generate(request), {
        attempts: Math.max(1, this.config.maxRetries - 1),
        baseDelayMs: 500,
      });
    }
  }

  private shouldFallback(error: unknown): boolean {
    if (!LlmError.isLlmError(error)) return false;
    // Un payload invalido fallara igual en el respaldo: no vale la pena.
    return ['rate_limit', 'timeout', 'network', 'server', 'auth'].includes(
      error.code,
    );
  }
}

function accumulate(
  totals: { inputTokens: number; outputTokens: number; costUsd: number },
  response: LlmResponse,
): void {
  totals.inputTokens += response.usage.inputTokens;
  totals.outputTokens += response.usage.outputTokens;
  totals.costUsd += response.costUsd;
}

/**
 * Cuantos tokens de entrada salieron de la cache del proveedor.
 *
 * Va en el log de cada llamada porque es la unica forma de saber si la cache
 * esta funcionando: si este numero es siempre 0, algo esta moviendo el prefijo
 * y el ahorro no existe, aunque el codigo diga que si.
 */
function formatCacheHit(cachedInputTokens: number | undefined): string {
  return cachedInputTokens ? ` (${cachedInputTokens} de cache)` : '';
}

function formatCost(costUsd: number): string {
  return costUsd > 0 ? `$${costUsd.toFixed(6)}` : 'sin costo';
}
