import { Injectable, Logger } from '@nestjs/common';

import { LlmService } from '../../../ai/services/llm.service';
import type { LlmMessage } from '../../../ai/core/llm.types';
import { PlanesService } from '../../../services/planes.service';
import { LandingRateLimitService } from './landing-rate-limit.service';
import {
  LANDING_ASSISTANT_PROMPT_VERSION,
  buildLandingSystemPrompt,
} from '../prompts/landing-assistant.prompt';

export interface LandingTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface LandingAskRequest {
  question: string;
  /** Historial de la conversacion, del mas antiguo al mas reciente. Vive solo en el frontend (React state): no se persiste aqui. */
  history?: LandingTurn[];
  /** IP del visitante, para el tope diario. Nunca se guarda ni se loguea. */
  ip: string;
}

export interface LandingAction {
  type: 'register' | 'whatsapp';
  label: string;
  href: string;
}

export interface LandingAskResult {
  answer: string;
  actions: LandingAction[];
  /** true cuando la respuesta es el aviso de tope, no algo generado por el modelo. */
  limited?: boolean;
  meta: {
    promptVersion: string;
    provider: string;
    model: string;
  };
}

const REGISTER_ACTION: LandingAction = {
  type: 'register',
  label: 'Registrarme en Luka',
  href: '/register',
};

const WHATSAPP_ACTION: LandingAction = {
  type: 'whatsapp',
  label: 'Escribir por WhatsApp',
  href: 'https://wa.me/573043904488?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Luka',
};

const ACTION_MARKER = /\[ACCION:(REGISTRO|WHATSAPP)\]/gi;

/**
 * El modelo termina su respuesta con marcadores como `[ACCION:REGISTRO]` en
 * vez de escribir un link o el numero de WhatsApp (ver reglas 6 y 7 del
 * prompt). Aqui se extraen y se limpian del texto que ve el usuario.
 */
function extractActions(rawText: string): {
  text: string;
  actions: LandingAction[];
} {
  const found = new Set<string>();
  for (const match of rawText.matchAll(ACTION_MARKER)) {
    found.add(match[1].toUpperCase());
  }

  const text = rawText.replace(ACTION_MARKER, '').trim();

  const actions: LandingAction[] = [];
  if (found.has('REGISTRO')) actions.push(REGISTER_ACTION);
  if (found.has('WHATSAPP')) actions.push(WHATSAPP_ACTION);

  return { text, actions };
}

/** Reduce la pregunta a una clave estable para la cache: mismas palabras, mismo hit. */
function cacheKeyFor(question: string): string {
  return question
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos
    .replace(/[¿?¡!.,]/g, '')
    .replace(/\s+/g, ' ');
}

interface CacheEntry {
  result: LandingAskResult;
  expiresAt: number;
}

/**
 * Asistente informativo del landing publico: sin tools, sin tenant, sin
 * acceso a datos de ningun negocio. Una sola llamada al modelo con el
 * catalogo de planes vigente.
 */
@Injectable()
export class LandingAssistantService {
  private readonly logger = new Logger(LandingAssistantService.name);

  /**
   * Cache de respuestas para preguntas de primer turno (sin historial): la
   * gran mayoria de visitantes preguntan lo mismo ("que planes hay", "como
   * funciona") y no tiene sentido pagarle al modelo la misma respuesta miles
   * de veces. Solo aplica al primer mensaje: una respuesta con historial
   * depende de la conversacion previa y no se puede reutilizar entre
   * visitantes distintos.
   */
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 60 * 60 * 1_000;
  private readonly cacheMaxEntries = 500;

  constructor(
    private readonly llm: LlmService,
    private readonly planes: PlanesService,
    private readonly rateLimit: LandingRateLimitService,
  ) {}

  async ask(request: LandingAskRequest): Promise<LandingAskResult> {
    // Interruptor de emergencia: si el costo se dispara, se apaga solo esta
    // IA sin tocar el resto del backend (RATE_LIMIT_DISABLED es lo opuesto:
    // apagaria TODOS los limites del sistema).
    const iaHabilitada = process.env.LANDING_CHAT_AI_ENABLED !== 'false';

    if (!iaHabilitada || !this.rateLimit.permitir(request.ip)) {
      if (iaHabilitada) {
        this.logger.warn(
          `IP superó ${this.rateLimit.limite} mensajes/día en el chat del landing: respuesta sin llamar al modelo.`,
        );
      }
      return this.limitedResponse();
    }

    const isFirstTurn = !request.history?.length;
    const cacheKey = isFirstTurn ? cacheKeyFor(request.question) : null;

    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
      }
    }

    const messages: LlmMessage[] = [
      ...(request.history ?? []).map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
      { role: 'user' as const, content: request.question },
    ];

    // Sin `context` (tenant): `LlmService.complete` no descuenta cuota de
    // nadie ni intenta registrar consumo por negocio, que aqui no existe.
    const response = await this.llm.complete({
      system: buildLandingSystemPrompt(this.planes.catalogo()),
      messages,
      temperature: 0.3,
      effort: 'low',
      // 800 y no 400: al listar los 5 planes con formato, 400 lo cortaba a
      // mitad de frase.
      maxOutputTokens: 800,
    });

    const { text, actions } = extractActions(response.text.trim());

    const result: LandingAskResult = {
      answer: text,
      actions,
      meta: {
        promptVersion: LANDING_ASSISTANT_PROMPT_VERSION,
        provider: response.providerId,
        model: response.model,
      },
    };

    if (cacheKey) this.setCached(cacheKey, result);

    return result;
  }

  private setCached(key: string, result: LandingAskResult): void {
    if (this.cache.size >= this.cacheMaxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { result, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private limitedResponse(): LandingAskResult {
    return {
      answer:
        'Llegaste al límite de mensajes gratuitos de hoy. Para seguir hablando con Luka, regístrate o escríbenos por WhatsApp.',
      actions: [REGISTER_ACTION, WHATSAPP_ACTION],
      limited: true,
      meta: {
        promptVersion: LANDING_ASSISTANT_PROMPT_VERSION,
        provider: 'n/a',
        model: 'n/a',
      },
    };
  }
}
