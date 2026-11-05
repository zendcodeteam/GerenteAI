import { LlmService } from './llm.service';
import type { AiConfig } from '../config/ai.config';
import type { LlmProvider } from '../core/llm.provider';
import type { LlmRequest, LlmResponse } from '../core/llm.types';
import type { AiCallContext, AiUsageService } from '../usage/usage.service';

/**
 * SCRUM-51: un solo plazo para todo no sirve.
 *
 * 45 segundos son razonables para un informe que corre de noche, y una
 * eternidad para alguien que escribio por WhatsApp y esta mirando el chat. Y
 * con reintentos encima el plazo se multiplica: tres intentos de 45 s son dos
 * minutos esperando una respuesta que ya no le sirve a nadie.
 */

const RESPUESTA: LlmResponse = {
  text: 'ok',
  toolCalls: [],
  finishReason: 'stop',
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  providerId: 'fake',
  model: 'fake-1',
  latencyMs: 1,
  costUsd: 0,
};

function servicio() {
  const visto: LlmRequest[] = [];

  const provider = {
    id: 'fake',
    model: 'fake-1',
    capabilities: {},
    generate: (request: LlmRequest) => {
      visto.push(request);
      return Promise.resolve(RESPUESTA);
    },
  } as unknown as LlmProvider;

  const config = {
    timeoutMs: 45_000,
    interactiveTimeoutMs: 20_000,
    maxRetries: 1,
    maxOutputTokens: 2_048,
    temperature: 0.2,
    logPrompts: false,
    anthropicServerFallback: false,
  } as AiConfig;

  const usage = {
    assertWithinQuota: () => Promise.resolve(),
    recordSuccess: () => Promise.resolve(),
    recordFailure: () => Promise.resolve(),
  } as unknown as AiUsageService;

  return { service: new LlmService(provider, config, usage), visto };
}

const contexto = (feature: string): AiCallContext => ({
  tenantId: 't1',
  businessId: 'b1',
  feature,
});

describe('LlmService · plazos segun quien espera', () => {
  const peticion: LlmRequest = {
    messages: [{ role: 'user', content: 'hola' }],
  };

  it('un mensaje de WhatsApp lleva el plazo corto', async () => {
    const { service, visto } = servicio();

    await service.complete(peticion, contexto('whatsapp.request'));

    expect(visto[0].timeoutMs).toBe(20_000);
  });

  it('la interpretacion interna tambien: es el mismo usuario esperando', async () => {
    const { service, visto } = servicio();

    await service.complete(peticion, contexto('whatsapp.internal'));

    expect(visto[0].timeoutMs).toBe(20_000);
  });

  it('un informe del panel se queda con el plazo largo', async () => {
    const { service, visto } = servicio();

    await service.complete(peticion, contexto('insights.generate'));

    expect(visto[0].timeoutMs).toBe(45_000);
  });

  it('sin contexto, el plazo largo: no se sabe quien espera', async () => {
    const { service, visto } = servicio();

    await service.complete(peticion);

    expect(visto[0].timeoutMs).toBe(45_000);
  });

  it('lo que pida la llamada manda sobre cualquier defecto', async () => {
    const { service, visto } = servicio();

    await service.complete(
      { ...peticion, timeoutMs: 3_000 },
      contexto('insights.generate'),
    );

    expect(visto[0].timeoutMs).toBe(3_000);
  });
});
