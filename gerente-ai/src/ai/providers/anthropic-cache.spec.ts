import { AnthropicProvider } from './anthropic.provider';

/**
 * SCRUM-51: el prompt del asistente son ~14.500 tokens que viajan IDENTICOS en
 * cada mensaje de WhatsApp. Marcados como prefijo cacheable, Anthropic los
 * cobra al 10% y responde antes; sin marcar, se pagan enteros cada vez.
 *
 * Lo que se prueba aqui es que el cuerpo que sale por la red lleva el
 * `cache_control` donde toca y que el texto que lee el modelo no cambia ni un
 * byte: partir el prompt en dos bloques no puede cambiar lo que entiende.
 *
 * Se intercepta `fetch`, igual que en las pruebas de Gemini: asi se mira el
 * cuerpo real que arma el SDK, sin tocar la red ni gastar cuota.
 */

interface BloqueDeSistema {
  type: string;
  text: string;
  cache_control?: { type: string };
}

interface CuerpoAnthropic {
  system?: string | BloqueDeSistema[];
}

const RESPUESTA = {
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5',
  content: [{ type: 'text', text: 'ok' }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 9 },
};

function provider() {
  return new AnthropicProvider({
    providerId: 'anthropic',
    model: 'claude-opus-5',
    apiKey: 'llave-de-prueba',
    timeoutMs: 5_000,
    defaultMaxOutputTokens: 256,
    serverFallback: false,
  });
}

async function capturarCuerpo(
  request: Parameters<AnthropicProvider['generate']>[0],
): Promise<CuerpoAnthropic> {
  let enviado = {} as CuerpoAnthropic;

  const original = global.fetch;
  global.fetch = jest.fn((_url: unknown, init: { body: string }) => {
    enviado = JSON.parse(init.body) as CuerpoAnthropic;
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve(JSON.stringify(RESPUESTA)),
      json: () => Promise.resolve(RESPUESTA),
    });
  }) as unknown as typeof fetch;

  try {
    await provider().generate(request);
  } finally {
    global.fetch = original;
  }

  return enviado;
}

const PROMPT_FIJO = 'Eres Luka. '.repeat(50);
const CONTEXTO = '\n\nCONTEXTO: hoy es 2026-11-05, negocio El Virrey.';

describe('AnthropicProvider · cache del prompt', () => {
  it('parte el system en dos bloques y marca el fijo', async () => {
    const cuerpo = await capturarCuerpo({
      system: PROMPT_FIJO + CONTEXTO,
      cacheableSystemPrefix: PROMPT_FIJO,
      messages: [{ role: 'user', content: 'hola' }],
    });

    const bloques = cuerpo.system as BloqueDeSistema[];
    expect(Array.isArray(bloques)).toBe(true);
    expect(bloques).toHaveLength(2);
    expect(bloques[0].cache_control).toEqual({ type: 'ephemeral' });
    // El contexto NO se cachea: cambia en cada mensaje y marcarlo haria que la
    // cache no acertara nunca.
    expect(bloques[1].cache_control).toBeUndefined();
  });

  it('el modelo lee exactamente el mismo texto que antes', async () => {
    const completo = PROMPT_FIJO + CONTEXTO;
    const cuerpo = await capturarCuerpo({
      system: completo,
      cacheableSystemPrefix: PROMPT_FIJO,
      messages: [{ role: 'user', content: 'hola' }],
    });

    const bloques = cuerpo.system as BloqueDeSistema[];
    expect(bloques.map((b) => b.text).join('')).toBe(completo);
  });

  it('sin prefijo declarado manda el system de siempre', async () => {
    const cuerpo = await capturarCuerpo({
      system: PROMPT_FIJO + CONTEXTO,
      messages: [{ role: 'user', content: 'hola' }],
    });

    expect(typeof cuerpo.system).toBe('string');
  });

  it('si el prefijo no encaja, no arriesga: manda el system entero', async () => {
    // Pasa cuando alguien reordena el prompt y el prefijo deja de ser prefijo.
    // Mandarlo partido ahi cambiaria el texto; mejor perder la cache.
    const cuerpo = await capturarCuerpo({
      system: PROMPT_FIJO + CONTEXTO,
      cacheableSystemPrefix: 'esto no es el principio del prompt',
      messages: [{ role: 'user', content: 'hola' }],
    });

    expect(typeof cuerpo.system).toBe('string');
  });

  it('reporta los tokens que vinieron de cache', async () => {
    const original = global.fetch;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: () => Promise.resolve(JSON.stringify(RESPUESTA)),
        json: () => Promise.resolve(RESPUESTA),
      }),
    ) as unknown as typeof fetch;

    try {
      const respuesta = await provider().generate({
        system: PROMPT_FIJO + CONTEXTO,
        cacheableSystemPrefix: PROMPT_FIJO,
        messages: [{ role: 'user', content: 'hola' }],
      });

      // Sin este dato no hay forma de saber si la cache funciona de verdad.
      expect(respuesta.usage.cachedInputTokens).toBe(9);
    } finally {
      global.fetch = original;
    }
  });
});

describe('AnthropicProvider · timeout por peticion', () => {
  it('corta la llamada en el plazo de ESTA peticion, no en el del proceso', async () => {
    // El cliente se construye con 5 segundos; esta peticion pide 60 ms. Antes
    // el valor de la peticion se ignoraba y una interpretacion de WhatsApp
    // heredaba el plazo pensado para los informes.
    const original = global.fetch;
    global.fetch = jest.fn(
      (_url: unknown, init: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('abortado');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;

    try {
      const empezo = Date.now();
      await expect(
        provider().generate({
          messages: [{ role: 'user', content: 'hola' }],
          timeoutMs: 60,
        }),
      ).rejects.toThrow();

      expect(Date.now() - empezo).toBeLessThan(3_000);
    } finally {
      global.fetch = original;
    }
  });
});
