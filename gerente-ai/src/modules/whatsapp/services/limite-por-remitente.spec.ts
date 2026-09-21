import { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../../../services/prisma.service';
import { WhatsAppMessageService } from '../../finance-ai/services/whatsapp-message.service';
import { LimitePorRemitenteService } from './limite-por-remitente.service';
import { MessageDedupeService } from './message-dedupe.service';
import { WhatsappInterpretService } from './whatsapp-interpret.service';
import type { WhatsappRoutingService } from './whatsapp-routing.service';

/**
 * Todo WhatsApp entra por n8n, desde una sola IP: el límite de /ai/interpret
 * tiene que ser por remitente, o un negocio que escribe mucho dejaría sin
 * servicio a todos los demás.
 */

describe('LimitePorRemitenteService', () => {
  const T0 = 1_000_000;

  it('deja pasar hasta el límite y rechaza el siguiente', () => {
    const limite = new LimitePorRemitenteService();

    for (let i = 0; i < limite.limite; i++) {
      expect(limite.permitir('573001', T0 + i)).toBe(true);
    }
    expect(limite.permitir('573001', T0 + limite.limite)).toBe(false);
  });

  it('cada remitente lleva su propio cupo', () => {
    const limite = new LimitePorRemitenteService();

    for (let i = 0; i < limite.limite; i++) limite.permitir('573001', T0);

    expect(limite.permitir('573001', T0)).toBe(false);
    expect(limite.permitir('573002', T0)).toBe(true);
  });

  it('recupera cupo cuando vencen los mensajes viejos', () => {
    const limite = new LimitePorRemitenteService();

    for (let i = 0; i < limite.limite; i++) limite.permitir('573001', T0);

    expect(limite.permitir('573001', T0 + limite.ventanaMs - 1)).toBe(false);
    expect(limite.permitir('573001', T0 + limite.ventanaMs)).toBe(true);
  });

  it('los mensajes rechazados no alargan el castigo', () => {
    const limite = new LimitePorRemitenteService();

    for (let i = 0; i < limite.limite; i++) limite.permitir('573001', T0);
    // Sigue insistiendo durante toda la ventana...
    for (let t = 1; t < limite.ventanaMs; t += 10_000) {
      limite.permitir('573001', T0 + t);
    }
    // ...y aun así recupera cupo cuando vencen los que sí contaron.
    expect(limite.permitir('573001', T0 + limite.ventanaMs)).toBe(true);
  });

  it('RATE_LIMIT_DISABLED lo apaga', () => {
    const limite = new LimitePorRemitenteService();
    for (let i = 0; i < limite.limite; i++) limite.permitir('573001', T0);

    process.env.RATE_LIMIT_DISABLED = 'true';
    try {
      expect(limite.permitir('573001', T0)).toBe(true);
    } finally {
      delete process.env.RATE_LIMIT_DISABLED;
    }
  });
});

const RESPUESTA_OK = {
  intent: {
    type: 'unclear',
    amount: null,
    category: null,
    concept: null,
    responseText: '¡Hola! ¿En qué te ayudo?',
    queryPeriod: null,
    confidence: 0.9,
    movements: [],
    declaredTotal: null,
  },
  transactions: [],
  transaction: null,
  summary: null,
  replyText: '¡Hola! ¿En qué te ayudo?',
  meta: {
    promptVersion: 'v1',
    provider: 'fake',
    model: 'fake-1',
    latencyMs: 1,
    costUsd: 0,
  },
};

describe('WhatsappInterpretService · límite por remitente', () => {
  function armar() {
    let llamadasALaIa = 0;

    const prisma = {
      mensaje: {
        findMany: () => Promise.resolve([]),
        create: ({ data }: { data: unknown }) => Promise.resolve(data),
      },
    } as unknown as PrismaService;

    const routing = {
      resolve: () =>
        Promise.resolve({
          negocioId: 'n1',
          negocioNombre: 'Panadería El Virrey',
          sedeId: 'sede-1',
          sedeNombre: 'Sede principal',
          plan: 'asistente',
          planName: 'Asistente',
          planIsFree: true,
          currency: 'COP',
          diaInicioPeriodo: 1,
          contexto: null,
        }),
      findUsuarioSinNegocio: () => Promise.resolve(null),
    } as unknown as WhatsappRoutingService;

    const whatsapp = {
      handleMessage: () => {
        llamadasALaIa++;
        return Promise.resolve(RESPUESTA_OK);
      },
    } as unknown as WhatsAppMessageService;

    const limite = new LimitePorRemitenteService();
    const service = new WhatsappInterpretService(
      routing,
      whatsapp,
      new MessageDedupeService(),
      prisma,
      { get: () => undefined } as unknown as ConfigService,
      limite,
    );

    return { service, limite, llamadasALaIa: () => llamadasALaIa };
  }

  it('pasado el límite contesta un aviso (200) sin llamar a la IA', async () => {
    const { service, limite, llamadasALaIa } = armar();

    for (let i = 0; i < limite.limite; i++) {
      await service.interpret({
        message: 'hola',
        phone: '573001234567',
        messageId: `wamid.${i}`,
      });
    }
    const antes = llamadasALaIa();

    const respuesta = await service.interpret({
      message: 'hola',
      phone: '573001234567',
      messageId: 'wamid.extra',
    });

    expect(llamadasALaIa()).toBe(antes);
    expect(respuesta.reply).toMatch(/muchos mensajes/);
  });

  it('un reintento de n8n del mismo mensaje no gasta cupo', async () => {
    const { service, limite } = armar();

    for (let i = 0; i < limite.limite + 5; i++) {
      await service.interpret({
        message: 'hola',
        phone: '573001234567',
        messageId: 'wamid.mismo',
      });
    }

    const respuesta = await service.interpret({
      message: 'otro',
      phone: '573001234567',
      messageId: 'wamid.nuevo',
    });

    expect(respuesta.reply).not.toMatch(/muchos mensajes/);
  });

  it('otro negocio sigue atendido aunque uno se pase', async () => {
    const { service, limite } = armar();

    for (let i = 0; i < limite.limite + 1; i++) {
      await service.interpret({
        message: 'hola',
        phone: '573001234567',
        messageId: `wamid.a${i}`,
      });
    }

    const respuesta = await service.interpret({
      message: 'hola',
      phone: '573009999999',
      messageId: 'wamid.b',
    });

    expect(respuesta.reply).not.toMatch(/muchos mensajes/);
  });
});
