import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LlmError, type LlmErrorCode } from '../../../ai/core/llm.errors';
import { fechaColombiana } from '../../finance-ai/domain/dia-colombia';
import { PrismaService } from '../../../services/prisma.service';
import {
  CATEGORY_LABELS,
  type MessageIntentType,
  type QueryPeriod,
  type TransactionCategory,
} from '../../finance-ai/domain/finance.types';
import {
  WhatsAppMessageService,
  type WhatsAppMessageResult,
} from '../../finance-ai/services/whatsapp-message.service';
import type { InterpretMessageDto } from '../dto/interpret-message.dto';
import { MessageDedupeService } from './message-dedupe.service';
import { LimitePorRemitenteService } from './limite-por-remitente.service';
import {
  maskPhone,
  normalizePhone,
  WhatsappRoutingService,
  type WhatsappContext,
  type WhatsappSender,
} from './whatsapp-routing.service';

/**
 * Adaptador entre n8n y el cerebro financiero.
 *
 * Responsabilidades, en orden:
 *   1. descartar duplicados (Meta reintenta)
 *   2. resolver telefono -> sede (sin sede no hay donde guardar)
 *   3. dejar el mensaje del usuario en el historial
 *   4. pedirle la interpretacion a `WhatsAppMessageService` (Persona 3)
 *   5. guardar la respuesta en el historial
 *   6. devolver el contrato plano que n8n espera
 *
 * REGLA DE ORO DE ESTE SERVICIO: nunca deja al usuario sin respuesta. Si la IA
 * falla, se responde con un texto degradado y `ok:false`; el 500 se reserva
 * para fallos de infraestructura que n8n si debe reintentar.
 */

/** Tipos en espanol: es el vocabulario del contrato publico con n8n. */
export type PublicIntentType =
  | 'gasto'
  | 'ingreso'
  | 'inversion'
  | 'desglose'
  | 'reparto_utilidades'
  /** Le pagaron un fiado: baja la deuda, no crea un movimiento. */
  | 'abono'
  /** Contesto si o no a una pregunta de Luka. */
  | 'confirmacion'
  | 'consulta'
  | 'correccion'
  | 'no_claro'
  | 'fuera_de_alcance'
  | 'plan_requerido'
  | 'no_registrado'
  | 'sin_negocio'
  | 'error';

export interface InterpretResponse {
  /** false = hubo un fallo y `reply` es un mensaje degradado. */
  ok: boolean;
  /** Texto listo para enviar por WhatsApp. Vacio = no responder nada. */
  reply: string;
  interpreted: {
    type: PublicIntentType;
    /** El tipo interno (income/expense/...), por si n8n necesita ramificar. */
    rawType: MessageIntentType | null;
    amount: number | null;
    category: string | null;
    categoryLabel: string | null;
    concept: string | null;
    confidence: number;
    period: QueryPeriod | null;
    /** true = quedo escrito en PostgreSQL. */
    saved: boolean;
    transactionId: string | null;
    /**
     * Todos los movimientos del mensaje. Un mensaje puede traer varios
     * ("pague 50.000 de transporte y 30.000 de almuerzo") y `amount` solo
     * lleva la suma; aqui esta el detalle de cada uno.
     */
    movements: {
      id: string;
      type: string;
      amount: number;
      category: string;
      categoryLabel: string;
      concept: string;
      paymentMethod: string | null;
      isCredit: boolean;
    }[];
  };
  meta: {
    negocioId: string | null;
    sedeId: string | null;
    duplicate: boolean;
    /**
     * Id del mensaje de Luka en la base.
     *
     * n8n lo devuelve en `POST /ai/interpret/enviado` junto con el wamid que
     * le dio Meta al enviarlo. Es lo que permite reconocer despues un mensaje
     * de Luka cuando el usuario lo cita.
     */
    assistantMessageId: string | null;
    promptVersion: string | null;
    provider: string | null;
    model: string | null;
    latencyMs: number | null;
    costUsd: number | null;
    durationMs: number;
  };
  error?: { code: string; retryable: boolean };
}

const TYPE_LABELS: Record<MessageIntentType, PublicIntentType> = {
  expense: 'gasto',
  income: 'ingreso',
  investment: 'inversion',
  breakdown: 'desglose',
  profit_share: 'reparto_utilidades',
  payment: 'abono',
  confirmation: 'confirmacion',
  query: 'consulta',
  correction: 'correccion',
  unclear: 'no_claro',
  out_of_scope: 'fuera_de_alcance',
  premium: 'plan_requerido',
};

/**
 * Que se le dice al usuario cuando la IA falla. Nada de codigos ni de jerga:
 * al otro lado hay un tendero, no un desarrollador.
 */
const FALLBACK_REPLY: Partial<Record<LlmErrorCode, string>> = {
  rate_limit:
    'Estoy recibiendo muchos mensajes en este momento 😅 Reenviame el tuyo en un minuto y lo registro.',
  timeout:
    'Me demore mas de la cuenta procesando tu mensaje. ¿Me lo reenvias, por favor?',
  network:
    'Tuve un problema de conexion y no pude procesar tu mensaje. Intenta de nuevo en un momento.',
  server:
    'Tuve un problema tecnico y no pude procesar tu mensaje. Intenta de nuevo en un momento.',
  quota_exceeded:
    'Alcanzaste el limite de mensajes de tu plan este mes. Puedes ampliarlo desde el panel de Luka AI.',
  content_filter:
    'No pude procesar ese mensaje. ¿Me lo escribes de otra forma?',
  auth: 'El asistente esta en mantenimiento. Ya estamos trabajando en ello 🙏',
};

/**
 * A donde se manda a registrar a quien escribe desde un numero desconocido.
 * Se puede sobreescribir con FRONTEND_REGISTER_URL.
 *
 * No se reutiliza FRONTEND_URL a proposito: esa apunta al entorno desde el que
 * se arman los enlaces de los correos, y en desarrollo vale localhost, que
 * dentro de un WhatsApp no le sirve a nadie.
 */
const DEFAULT_REGISTER_URL = 'https://luka-gules.vercel.app/home';

/** Pantalla de planes, para cuando piden algo que su plan no incluye. */
const DEFAULT_PLANS_URL = 'https://luka-gules.vercel.app/subscription';

/** Panel donde se crea el negocio. Quien ya tiene cuenta va directo aqui. */
const DEFAULT_APP_URL = 'https://luka-gules.vercel.app/';

/**
 * Turnos de conversacion que se le pasan al modelo. 12 = 6 idas y vueltas.
 *
 * Eran 6, y se quedaban cortos en cuanto la conversacion tenia una pregunta de
 * por medio: desambiguar una correccion o confirmar un borrado gasta dos o tres
 * turnos, y para cuando el usuario contestaba, lo que se estaba corrigiendo ya
 * se habia salido de la ventana.
 */
const HISTORY_TURNS = 12;

const GENERIC_FALLBACK =
  'No pude procesar tu mensaje en este momento 😔 Intenta de nuevo en unos minutos.';

const MENSAJE_LIMITE_REMITENTE =
  'Estás enviando muchos mensajes seguidos 🙏 Espera unos minutos y vuelve a escribirme; no registré este último.';

@Injectable()
export class WhatsappInterpretService {
  private readonly logger = new Logger(WhatsappInterpretService.name);

  constructor(
    private readonly routing: WhatsappRoutingService,
    private readonly whatsapp: WhatsAppMessageService,
    private readonly dedupe: MessageDedupeService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly limite: LimitePorRemitenteService = new LimitePorRemitenteService(),
  ) {}

  /**
   * Depuracion puntual: solo con DEBUG_MESSAGE_CONTENT activo se escribe el
   * contenido del mensaje en los logs. Fuera de eso basta con su longitud.
   */
  private get logMessageContent(): boolean {
    const raw = this.config
      .get<string>('DEBUG_MESSAGE_CONTENT')
      ?.trim()
      .toLowerCase();

    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'si';
  }

  async interpret(dto: InterpretMessageDto): Promise<InterpretResponse> {
    const startedAt = Date.now();
    const sender = readSender(dto);

    if (!sender.phone && !sender.userId) {
      // n8n no deberia llamar sin remitente; si pasa, conviene un 400 claro y
      // no un fallo mas adelante con un mensaje que no explica nada.
      throw new BadRequestException(
        'Falta identificar al remitente: se requiere phone o userId.',
      );
    }

    // El texto trae nombres y deudas de los clientes, asi que por defecto solo
    // se registra su tamano; el tipo de intencion se loguea al cerrar el turno,
    // cuando ya se conoce. El contenido queda detras de DEBUG_MESSAGE_CONTENT,
    // para depuracion puntual (mismo criterio que AI_LOG_PROMPTS).
    const marcas = `${dto.quotedMessageId ? ' [responde a un mensaje citado]' : ''}${dto.media ? ` [${dto.media.kind}]` : ''}`;

    this.logger.log(
      `Mensaje de ${dto.name ?? 'sin nombre'} (${describeSender(sender)}): ${dto.message.length} caracteres${marcas}`,
    );

    if (this.logMessageContent) {
      this.logger.debug(`Contenido: "${dto.message.slice(0, 120)}"`);
    }

    // ---- 1. Duplicados ----------------------------------------------------
    if (!this.dedupe.isFirstTime(dto.messageId)) {
      const previa = this.dedupe.recall<InterpretResponse>(dto.messageId);

      if (previa) {
        // Se repite la respuesta ya calculada en vez de devolver vacio: el
        // movimiento NO se registra dos veces, pero el usuario recibe su
        // confirmacion aunque n8n haya reintentado por timeout.
        this.logger.log(
          `Mensaje repetido (${dto.messageId}): se reenvia la respuesta anterior.`,
        );
        return { ...previa, meta: { ...previa.meta, duplicate: true } };
      }

      // Sin respuesta guardada, el original sigue en curso: contestara el.
      return this.emptyResponse({
        type: 'no_claro',
        reply: '',
        durationMs: Date.now() - startedAt,
        duplicate: true,
      });
    }

    // ---- 2. Límite por remitente -------------------------------------------
    // Después de los duplicados, para que un reintento de n8n no gaste cupo.
    // Se contesta 200 con un aviso y no un 429: un error lo trataría n8n como
    // fallo y el comerciante no recibiría nada.
    if (!this.limite.permitir(sender.phone ?? `id:${sender.userId}`)) {
      this.logger.warn(
        `${describeSender(sender)} superó ${this.limite.limite} mensajes en ${this.limite.ventanaMs / 60_000} min: mensaje sin procesar.`,
      );
      const aviso = this.emptyResponse({
        type: 'no_claro',
        reply: MENSAJE_LIMITE_REMITENTE,
        durationMs: Date.now() - startedAt,
        duplicate: false,
      });
      this.dedupe.remember(dto.messageId, aviso);
      return aviso;
    }

    try {
      const respuesta = await this.process(dto, sender, startedAt);
      this.dedupe.remember(dto.messageId, respuesta);
      return respuesta;
    } catch (error) {
      // El mensaje no llego a atenderse: se libera el id para que el reintento
      // de n8n vuelva a intentarlo en vez de recibir "duplicado".
      this.dedupe.forget(dto.messageId);
      throw error;
    }
  }

  /** Todo lo que ocurre una vez descartado el duplicado. */
  private async process(
    dto: InterpretMessageDto,
    sender: WhatsappSender,
    startedAt: number,
  ): Promise<InterpretResponse> {
    // ---- 2. ¿De quien es este remitente? ----------------------------------
    const context = await this.routing.resolve(sender);

    if (!context) {
      // Sin negocio asociado no se llama al modelo: no se gasta cuota con
      // numeros desconocidos (y ahi es donde llega el spam).
      //
      // Pero hay dos casos distintos y al usuario le importan: quien nunca se
      // registro, y quien ya tiene cuenta pero no creo su negocio. A este
      // segundo, mandarlo a registrarse lo deja dando vueltas.
      const registrado = await this.routing.findUsuarioSinNegocio(sender);

      return this.emptyResponse({
        type: registrado ? 'sin_negocio' : 'no_registrado',
        reply: registrado
          ? this.noBusinessReply(registrado.nombre)
          : this.unregisteredReply(dto.name, sender),
        durationMs: Date.now() - startedAt,
        duplicate: false,
      });
    }

    // ---- 3. Historial ------------------------------------------------------
    // Se lee ANTES de guardar el mensaje nuevo: si no, el modelo recibiria dos
    // veces el mismo texto (como turno anterior y como mensaje actual).
    const remitente = sender.phone ?? sender.userId ?? null;

    const [history, quotedMessage] = await Promise.all([
      this.loadHistory(context.sedeId, remitente),
      this.loadQuoted(context.sedeId, dto.quotedMessageId),
    ]);

    // Sin esto no hay forma de saber, leyendo los logs, si una cita no llego o
    // si llego y el modelo la ignoro.
    if (dto.quotedMessageId && !quotedMessage) {
      this.logger.warn(
        `El mensaje citado ${dto.quotedMessageId} no esta guardado: la respuesta se interpreta sin ese contexto.`,
      );
    }

    // ---- 4. Interpretacion ------------------------------------------------
    let result: WhatsAppMessageResult;
    try {
      result = await this.whatsapp.handleMessage({
        tenantId: context.negocioId,
        businessId: context.sedeId,
        message: dto.message,
        businessName: context.negocioNombre,
        currency: context.currency,
        // El periodo contable del negocio: hay quienes cierran el 20, no el 30.
        diaInicioPeriodo: context.diaInicioPeriodo,
        // Los 30 dias contra los que se mide la cuota de IA de este negocio.
        ventanaDeCuota: context.ventanaDeCuota,
        plan: context.plan,
        planName: context.planName,
        planIsFree: context.planIsFree,
        history,
        quotedMessage,
        // La nota de voz o la foto, si venia una. El corte por plan lo hace
        // WhatsAppMessageService antes de llamar al modelo.
        media: dto.media ?? null,
        // El bot existe para registrar: se guarda salvo que n8n pida lo contrario.
        persist: dto.persist ?? true,
      });
    } catch (error) {
      return this.degradedResponse(error, context, Date.now() - startedAt);
    }

    // ---- 5. Funciones que su plan no incluye -------------------------------
    // El texto lo pone el backend, no el modelo: los precios y el enlace no se
    // improvisan, y asi el mensaje comercial es siempre el mismo.
    const replyText =
      result.intent.type === 'premium' && context.planIsFree
        ? this.upgradeReply(context.planName)
        : result.replyText;

    // ---- 6. Historial: lo que respondio el bot ----------------------------
    // El par pregunta/respuesta se guarda junto y solo si se pudo atender.
    //
    // Guardar el mensaje del usuario antes de interpretarlo dejaba, cuando algo
    // fallaba, un turno sin responder en el historial. El modelo lo veia en el
    // siguiente mensaje, intentaba contestarlo otra vez y volvia a fallar por lo
    // mismo: la conversacion quedaba trabada y hasta un "Hola" devolvia error.
    await this.saveMessage(context.sedeId, 'USER', dto.message, {
      wamid: dto.messageId,
      remitente,
    });
    const assistantMessageId = await this.saveMessage(
      context.sedeId,
      'ASSISTANT',
      replyText,
      { movimientoIds: result.transactions.map((row) => row.id) },
    );

    const category = result.intent.category as TransactionCategory | null;

    this.logger.log(
      `→ ${result.intent.type} · ${result.intent.amount ?? '-'} ${context.currency} · confianza ${result.intent.confidence} · movimientos=${result.transactions.length} · ${result.meta.provider}/${result.meta.model} · ${Date.now() - startedAt} ms`,
    );

    // ---- 7. Contrato de salida -------------------------------------------
    return {
      ok: true,
      reply: replyText,
      interpreted: {
        type: TYPE_LABELS[result.intent.type],
        rawType: result.intent.type,
        amount: result.intent.amount,
        category,
        categoryLabel: category ? CATEGORY_LABELS[category] : null,
        concept: result.intent.concept,
        confidence: result.intent.confidence,
        period: result.intent.queryPeriod,
        saved: result.transactions.length > 0,
        transactionId: result.transaction?.id ?? null,
        movements: result.transactions.map((movimiento) => ({
          id: movimiento.id,
          type: movimiento.type,
          amount: movimiento.amount,
          category: movimiento.category,
          categoryLabel: CATEGORY_LABELS[movimiento.category],
          concept: movimiento.description,
          paymentMethod: movimiento.paymentMethod ?? null,
          isCredit: movimiento.isCredit ?? false,
        })),
      },
      meta: {
        negocioId: context.negocioId,
        sedeId: context.sedeId,
        duplicate: false,
        assistantMessageId,
        promptVersion: result.meta.promptVersion,
        provider: result.meta.provider,
        model: result.meta.model,
        latencyMs: result.meta.latencyMs,
        costUsd: result.meta.costUsd,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  // ------------------------------------------------------------------ interno

  /**
   * El historial es util (auditoria, contexto futuro, soporte) pero no es
   * critico: si falla, el usuario igual debe recibir su respuesta.
   */
  private async saveMessage(
    sedeId: string,
    rol: 'USER' | 'ASSISTANT',
    contenido: string,
    extra: {
      wamid?: string | null;
      remitente?: string | null;
      movimientoIds?: string[];
    } = {},
  ): Promise<string | null> {
    try {
      const mensaje = await this.prisma.mensaje.create({
        data: {
          sedeId,
          rol,
          contenido,
          // El wamid es lo que permite encontrar este mensaje cuando alguien lo
          // cite mas adelante.
          wamid: extra.wamid ?? null,
          remitente: extra.remitente ?? null,
          // Los ids de lo que se acaba de registrar: sin esto, citar la
          // respuesta para borrarla obliga a adivinar cuales eran.
          movimientoIds: extra.movimientoIds ?? [],
        },
      });
      return mensaje.id;
    } catch (error) {
      this.logger.error(
        `No se pudo guardar el mensaje (${rol}) de la sede ${sedeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * El mensaje que el usuario esta citando, si lo tenemos guardado.
   *
   * Devuelve null cuando el wamid no esta en la base: pasa con los mensajes
   * anteriores a que se guardara el wamid, y con las respuestas de Luka cuyo
   * envio n8n todavia no ha confirmado. En ese caso el modelo se apoya en el
   * historial normal, que es peor pero no es nada.
   */
  private async loadQuoted(
    sedeId: string,
    wamid: string | undefined,
  ): Promise<{
    fromLuka: boolean;
    date: string;
    content: string;
    transactionIds: string[];
  } | null> {
    if (!wamid) return null;

    try {
      const citado = await this.prisma.mensaje.findFirst({
        where: { wamid, sedeId },
      });

      if (!citado) {
        this.logger.debug(`Mensaje citado ${wamid} no esta guardado.`);
        return null;
      }

      return {
        fromLuka: citado.rol === 'ASSISTANT',
        date: fechaColombiana(citado.fecha),
        content: citado.contenido,
        transactionIds: citado.movimientoIds,
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo leer el mensaje citado ${wamid}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Anota el wamid con el que Meta acepto la respuesta de Luka.
   *
   * Lo llama n8n despues de enviar. Sin este paso, un usuario que responde
   * citando un mensaje de Luka manda un wamid que no esta en ninguna parte, y
   * la cita se pierde. Va aparte de `/ai/interpret` a proposito: el envio
   * ocurre despues de responder, y el usuario no tiene por que esperarlo.
   */
  async registrarEnvio(mensajeId: string, wamid: string): Promise<boolean> {
    try {
      const { count } = await this.prisma.mensaje.updateMany({
        where: { id: mensajeId, rol: 'ASSISTANT' },
        data: { wamid },
      });
      return count > 0;
    } catch (error) {
      this.logger.warn(
        `No se pudo anotar el wamid ${wamid} del mensaje ${mensajeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  /** La IA fallo: se responde algo util y se deja constancia del codigo real. */
  private degradedResponse(
    error: unknown,
    context: WhatsappContext,
    durationMs: number,
  ): InterpretResponse {
    const llmError = LlmError.isLlmError(error) ? error : null;
    const code = llmError?.code ?? 'unknown';

    this.logger.error(
      `Fallo la interpretacion para la sede ${context.sedeId} [${code}]: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

    return {
      ok: false,
      reply: FALLBACK_REPLY[code] ?? GENERIC_FALLBACK,
      interpreted: {
        type: 'error',
        rawType: null,
        amount: null,
        category: null,
        categoryLabel: null,
        concept: null,
        confidence: 0,
        period: null,
        saved: false,
        transactionId: null,
        movements: [],
      },
      meta: {
        negocioId: context.negocioId,
        sedeId: context.sedeId,
        duplicate: false,
        assistantMessageId: null,
        promptVersion: null,
        provider: null,
        model: null,
        latencyMs: null,
        costUsd: null,
        durationMs,
      },
      error: { code, retryable: llmError?.retryable ?? false },
    };
  }

  /**
   * Ultimos turnos de la conversacion de esa sede.
   *
   * Es lo que permite completar un movimiento a medias: sin historial, el
   * modelo preguntaba el monto, el usuario lo respondia suelto y volvia a
   * preguntar lo mismo, porque cada mensaje llegaba sin pasado.
   *
   * Es por PERSONA dentro de la sede. Antes era solo por sede y las
   * conversaciones de dos empleados del mismo negocio se mezclaban: Luka le
   * contestaba a uno con el contexto del otro, y una pregunta abierta de uno
   * se la respondia el otro sin saberlo.
   *
   * Los mensajes de Luka no llevan remitente, asi que se traen todos los de la
   * sede y se filtran despues: un ASSISTANT solo cuenta si viene despues de un
   * USER de esta misma persona. Los mensajes anteriores a que existiera el
   * campo tienen remitente nulo y se siguen viendo, para no dejar sin memoria
   * a las conversaciones que ya estaban en curso.
   */
  private async loadHistory(
    sedeId: string,
    remitente: string | null,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    try {
      const mensajes = await this.prisma.mensaje.findMany({
        where: {
          sedeId,
          rol: { in: ['USER', 'ASSISTANT'] },
          ...(remitente
            ? {
                OR: [
                  { remitente },
                  { remitente: null },
                  { rol: 'ASSISTANT' as const },
                ],
              }
            : {}),
        },
        orderBy: { fecha: 'desc' },
        take: HISTORY_TURNS,
      });

      return mensajes.reverse().map((m) => ({
        role: m.rol === 'USER' ? ('user' as const) : ('assistant' as const),
        content: m.contenido,
      }));
    } catch (error) {
      // Sin historial el bot responde peor, pero responde. No vale la pena
      // dejar al usuario sin respuesta por esto.
      this.logger.warn(
        `No se pudo leer el historial de la sede ${sedeId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  /**
   * Ya tiene cuenta, pero ningun negocio: no hay donde imputar un movimiento.
   *
   * Se le dice explicitamente que su cuenta si existe, para que no crea que el
   * registro no funciono y lo repita.
   */
  private noBusinessReply(nombre: string): string {
    const url =
      this.config.get<string>('FRONTEND_APP_URL')?.trim() || DEFAULT_APP_URL;

    return [
      SALUDO_CON_NOMBRE(nombre) + ' Soy Luka, tu asistente financiero con IA.',
      '',
      'Veo que ya tienes tu cuenta creada 🎉 pero todavía no has registrado tu negocio, y sin él no puedo llevarte las cuentas.',
      '',
      'Créalo aquí, toma menos de un minuto:',
      url,
      '',
      'Cuando lo tengas listo, escríbeme y empezamos 🚀',
    ].join('\n');
  }

  /** Pidio algo que su plan no incluye. Se le dice con que plan si lo tendria. */
  private upgradeReply(planName: string): string {
    const url =
      this.config.get<string>('FRONTEND_PLANS_URL')?.trim() ||
      DEFAULT_PLANS_URL;

    return [
      `Esa función no está incluida en tu plan ${planName} 😊`,
      '',
      'Con los planes Gerente o Administrador puedes tener reportes por producto, reporte de fiados, recomendaciones con IA y registrar por foto o audio.',
      '',
      `Puedes verlos aquí:
${url}`,
      '',
      'Mientras tanto sigo registrando tus gastos, ingresos e inversiones y dándote tus resúmenes 💪',
    ].join('\n');
  }

  /**
   * Numero desconocido: no hay negocio al cual imputar nada.
   *
   * Se responde igual, porque del otro lado puede haber un cliente, pero sin
   * gastar un solo token de IA: el modelo ni se llama. El enlace de registro va
   * explicito porque es la unica salida posible.
   */
  private unregisteredReply(
    name: string | undefined,
    sender: WhatsappSender,
  ): string {
    const saludo = name ? SALUDO_CON_NOMBRE(name) : '¡Hola! 👋';
    const url =
      this.config.get<string>('FRONTEND_REGISTER_URL')?.trim() ||
      DEFAULT_REGISTER_URL;

    // A quien tiene el nombre de usuario de WhatsApp activado no se le puede
    // pedir "agrega este numero": ni el ni nosotros lo vemos. Se le pide su
    // nombre de usuario, que si conoce y puede escribir. El BSUID solo aparece
    // si Meta no mando el usuario, porque es la unica llave que quedaria.
    const cuerpo = sender.phone
      ? [
          'Todavía no encuentro este número registrado en ningún negocio, así que aún no puedo llevarte las cuentas.',
          '',
          'Regístrate aquí y agrega este número a tu negocio:',
        ]
      : [
          'Todavía no encuentro tu negocio. Regístrate y, al crearlo, pon tu usuario de WhatsApp:',
          '',
          sender.username ?? sender.userId ?? '',
          '',
          'Puedes hacerlo aquí:',
        ];

    return [
      saludo + ' Soy Luka, tu asistente financiero con IA.',
      '',
      ...cuerpo,
      url,
      '',
      'Cuando termines, escríbeme de nuevo y empezamos 🚀',
    ].join('\n');
  }

  private emptyResponse(options: {
    type: PublicIntentType;
    reply: string;
    durationMs: number;
    duplicate: boolean;
  }): InterpretResponse {
    return {
      ok: true,
      reply: options.reply,
      interpreted: {
        type: options.type,
        rawType: null,
        amount: null,
        category: null,
        categoryLabel: null,
        concept: null,
        confidence: 0,
        period: null,
        saved: false,
        transactionId: null,
        movements: [],
      },
      meta: {
        negocioId: null,
        sedeId: null,
        duplicate: options.duplicate,
        assistantMessageId: null,
        promptVersion: null,
        provider: null,
        model: null,
        latencyMs: null,
        costUsd: null,
        durationMs: options.durationMs,
      },
    };
  }
}

/**
 * Identidad del remitente tal como la manda n8n.
 *
 * El telefono se normaliza a digitos; la identidad de WhatsApp se toma tal cual,
 * porque no es un numero y cualquier "limpieza" la romperia.
 */
function readSender(dto: InterpretMessageDto): WhatsappSender {
  const phone = dto.phone ? normalizePhone(dto.phone) : '';
  return {
    phone: phone.length > 0 ? phone : undefined,
    userId: dto.userId?.trim() || undefined,
    username: dto.username?.trim() || undefined,
  };
}

/** Para logs: nunca el telefono completo, y algo util cuando solo hay identidad. */
function describeSender(sender: WhatsappSender): string {
  if (sender.phone) return maskPhone(sender.phone);
  return sender.userId ? `id ${sender.userId}` : 'sin remitente';
}

/** "Angelica Marcillo" -> "¡Hola Angelica! 👋". Solo el primer nombre. */
const SALUDO_CON_NOMBRE = (name: string): string =>
  `¡Hola ${name.trim().split(' ')[0]}! 👋`;
