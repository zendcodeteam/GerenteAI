import { Injectable } from '@nestjs/common';

import { LlmService } from '../../../ai/services/llm.service';
import type { LlmMessage } from '../../../ai/core/llm.types';
import { PlanesService } from '../../../services/planes.service';
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
}

export interface LandingAskResult {
  answer: string;
  meta: {
    promptVersion: string;
    provider: string;
    model: string;
  };
}

/**
 * Asistente informativo del landing publico: sin tools, sin tenant, sin
 * acceso a datos de ningun negocio. Una sola llamada al modelo con el
 * catalogo de planes vigente.
 */
@Injectable()
export class LandingAssistantService {
  constructor(
    private readonly llm: LlmService,
    private readonly planes: PlanesService,
  ) {}

  async ask(request: LandingAskRequest): Promise<LandingAskResult> {
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

    return {
      answer: response.text.trim(),
      meta: {
        promptVersion: LANDING_ASSISTANT_PROMPT_VERSION,
        provider: response.providerId,
        model: response.model,
      },
    };
  }
}
