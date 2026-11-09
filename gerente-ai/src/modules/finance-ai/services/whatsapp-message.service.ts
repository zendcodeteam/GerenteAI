import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { LlmService } from '../../../ai/services/llm.service';
import type { LlmContentPart } from '../../../ai/core/llm.types';
import type { AiCallContext } from '../../../ai/usage/usage.service';
import {
  fechaColombiana,
  partesDelDia,
  sumarDias,
} from '../domain/dia-colombia';
import {
  DIA_INICIO_POR_DEFECTO,
  normalizarDiaInicio,
  periodoContableDe,
} from '../domain/periodo-contable';
import {
  CATEGORIES_BY_TYPE,
  CATEGORY_LABELS,
  DEFAULT_CATEGORY_BY_TYPE,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PROFIT_BENEFICIARIES,
  PROFIT_BENEFICIARY_LABELS,
  type CorrectionRequest,
  type MessageIntent,
  type MessageIntentType,
  type MovementDraft,
  type PaymentDraft,
  type PaymentMethod,
  type PayrollDraft,
  type ProductDraft,
  type StockDraft,
  type SupplyDebtDraft,
  type PeriodSummary,
  type ProfitBeneficiary,
  type ProfitShare,
  type QueryKind,
  type QueryPeriod,
  type Receivable,
  type Transaction,
  type TransactionCategory,
  type TransactionType,
} from '../domain/finance.types';
import {
  FINANCE_DATA_PORT,
  type FinanceDataPort,
  type PaymentResult,
  type PayrollPayment,
  type ProductRegistration,
  type SupplyDebt,
} from '../ports/finance-data.port';
import {
  planDeDeudaProveedor,
  type PlanDeDeuda,
} from '../../../services/plan-deuda-proveedor';
import {
  ConversationStateService,
  type PendingAction,
  type PendingCorrection,
  type PendingDeletion,
  type PendingPayroll,
  type PendingRegistration,
  type PendingProduct,
  type PendingStock,
  type PendingSupplyDebt,
} from './conversation-state.service';
import {
  WHATSAPP_ASSISTANT_PROMPT_VERSION,
  WHATSAPP_INTENT_SCHEMA,
  WHATSAPP_ASSISTANT_SYSTEM_PROMPT,
  buildWhatsAppAssistantSystemPrompt,
  type WhatsAppIntentOutput,
} from '../prompts/whatsapp-assistant.prompt';

/** Por debajo de esto la interpretacion se registra como sospechosa en los logs. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

export interface WhatsAppMessageRequest {
  tenantId: string;
  businessId: string;
  message: string;
  businessName?: string;
  currency?: string;
  plan?: string;
  /** Guarda el movimiento detectado a traves del puerto de datos. */
  persist?: boolean;
  /**
   * Turnos anteriores de la conversacion, del mas viejo al mas nuevo.
   *
   * Sin esto el modelo no puede completar un movimiento a medias: preguntaba
   * el monto, el usuario lo respondia suelto y volvia a preguntar lo mismo.
   */
  history?: { role: 'user' | 'assistant'; content: string }[];
  /**
   * Dia en que arranca el periodo contable del negocio (1 a 28).
   *
   * Sin esto, "este mes" seria siempre del 1 al 30. Hay negocios cuyo mes va
   * del 21 al 20 y sus totales cortarian por donde no es.
   */
  diaInicioPeriodo?: number;
  /**
   * Los 30 dias contra los que se mide la cuota de IA.
   *
   * Viene del catalogo de planes, anclada al vencimiento del negocio. Sin ella
   * se cae al mes de calendario, que no coincide con el ciclo de cobro.
   */
  ventanaDeCuota?: { inicio: Date; fin: Date };
  /** Nombre comercial del plan, para decidir que funciones estan incluidas. */
  planName?: string;
  /** true si el plan vigente es el gratuito. */
  planIsFree?: boolean;
  /** Identificador único del mensaje entrante de WhatsApp. */
  requestId?: string;
  /**
   * El mensaje al que el usuario esta respondiendo, cuando cito uno.
   *
   * En WhatsApp se puede responder a un mensaje concreto, y la gente lo usa
   * justamente cuando se refiere a algo que no es lo ultimo que se dijo. Sin
   * esto, "pero esto es lo que me dijiste" llegaba suelto.
   */
  quotedMessage?: {
    fromLuka: boolean;
    date: string;
    content: string;
    /**
     * Los movimientos que ese mensaje reporto, cuando era una respuesta de
     * Luka.
     *
     * Es la diferencia entre borrar exactamente lo que el usuario esta
     * senalando y adivinarlo por fecha. Vacio en los mensajes del usuario y en
     * los de Luka anteriores a que esto se guardara.
     */
    transactionIds: string[];
  } | null;
  /**
   * Nota de voz o foto que acompana al mensaje.
   *
   * Solo se atiende en los planes pagos. El corte se hace antes de llamar al
   * modelo: interpretar audio e imagen es lo caro, y no tiene sentido gastarlo
   * para despues responder que no esta incluido.
   */
  media?: {
    kind: 'audio' | 'image';
    mimeType: string;
    dataBase64: string;
  } | null;
}

export interface WhatsAppMessageResult {
  /** Lo que el modelo entendio, ya validado. Es el JSON del system prompt. */
  intent: MessageIntent;
  /**
   * Todos los movimientos creados por el mensaje. Un mensaje puede traer
   * varios ("pague 50.000 de transporte y 30.000 de almuerzo").
   */
  transactions: Transaction[];
  /**
   * El primer movimiento, o null.
   *
   * Se conserva por compatibilidad con quienes solo esperaban uno (n8n, el
   * panel). Para saber todo lo que se registro, usa `transactions`.
   */
  transaction: Transaction | null;
  /** Reparto de utilidades registrado, si el mensaje lo pedia. */
  profitDistribution: {
    total: number;
    shares: ProfitShare[];
  } | null;
  /** Como quedo la deuda, si el mensaje avisaba de un cobro de fiado. */
  payment: PaymentResult | null;
  /** Resumen real del periodo, si el mensaje era una consulta. */
  summary: PeriodSummary | null;
  /** El texto que se le responde al usuario por WhatsApp. */
  replyText: string;
  meta: {
    promptVersion: string;
    provider: string;
    model: string;
    latencyMs: number;
    costUsd: number;
  };
}

/**
 * Cerebro del chatbot financiero de WhatsApp.
 *
 * Flujo: mensaje → modelo → intencion validada → accion.
 *
 *   income / expense / investment → crea el movimiento
 *   query                        → consulta los datos reales y arma el resumen
 *   correction / unclear         → responde pidiendo o confirmando
 *
 * No sabe que IA hay detras: le pide a `LlmService` una respuesta con esquema.
 * Cambiar de proveedor no afecta a este archivo.
 */
@Injectable()
export class WhatsAppMessageService {
  private readonly logger = new Logger(WhatsAppMessageService.name);

  constructor(
    private readonly llm: LlmService,
    @Inject(FINANCE_DATA_PORT) private readonly financeData: FinanceDataPort,
    private readonly state: ConversationStateService,
  ) {}

  async handleMessage(
    request: WhatsAppMessageRequest,
  ): Promise<WhatsAppMessageResult> {
    const currency = request.currency ?? 'COP';
    const referenceDate = todayIso();

    // Si quedo una pregunta sin responder, el modelo tiene que verla: de otro
    // modo lee "3 de septiembre" como un mensaje suelto y no como la respuesta
    // que es.
    const pendiente = this.state.pendiente(request.businessId);

    // El corte por plan va antes del modelo: interpretar un audio cuesta, y
    // gastarlo para luego decir que no esta incluido es tirar la plata.
    if (request.media && request.planIsFree) {
      // No se llamo al modelo, asi que no hay proveedor ni latencia que
      // reportar: se deja constancia de la version del prompt y nada mas.
      return this.mediaNoIncluida(request.media.kind, {
        promptVersion: WHATSAPP_ASSISTANT_PROMPT_VERSION,
        provider: 'sin-modelo',
        model: 'sin-modelo',
        latencyMs: 0,
        costUsd: 0,
      });
    }

    const context: AiCallContext = {
      tenantId: request.tenantId,
      businessId: request.businessId,
      feature: 'whatsapp.internal',
      solicitudId: request.requestId,
      plan: request.plan,
      periodo: request.ventanaDeCuota,
    };

    // ---- 1. La IA interpreta el mensaje -----------------------------------
    const { data, response } =
      await this.llm.completeJson<WhatsAppIntentOutput>(
        {
          // Los ~14.500 tokens del prompt viajan identicos en cada mensaje;
          // solo cambia el bloque de contexto que va al final. Marcandolos
          // como prefijo cacheable, el proveedor los cobra al 10% y responde
          // antes. El texto que lee el modelo no cambia.
          cacheableSystemPrefix: WHATSAPP_ASSISTANT_SYSTEM_PROMPT,
          system: buildWhatsAppAssistantSystemPrompt({
            businessName: request.businessName ?? 'el negocio',
            currency,
            referenceDate,
            planName: request.planName,
            planIsFree: request.planIsFree,
            pendingQuestion: pendiente
              ? renderPendingQuestion(pendiente, currency)
              : null,
            quotedMessage: request.quotedMessage
              ? renderQuotedMessage(request.quotedMessage)
              : null,
          }),
          messages: [
            ...(request.history ?? []),
            { role: 'user', content: contenidoDelUsuario(request) },
          ],
          schemaName: 'intencion_financiera',
          schema: WHATSAPP_INTENT_SCHEMA,
          // Interpretar un mensaje es determinista: sin creatividad.
          temperature: 0,
          effort: 'low',
          // Un mensaje puede traer varios movimientos y cada uno son ~70 tokens
          // de JSON. Con 512 el modelo cortaba la respuesta a la mitad ("...
          // customerName) y el parseo fallaba: el usuario veia "no pude
          // procesar" cada vez que registraba mas de dos ventas juntas.
          maxOutputTokens: 2048,
        },
        context,
      );

    const intent = this.normalizeIntent(data);

    if (request.planIsFree && isAdvancedAnalysisRequest(request.message)) {
      return this.plainResult(
        { ...intent, type: 'premium' },
        'Esta consulta avanzada está disponible desde el Plan Gerente. Mejora tu plan para acceder a recomendaciones y análisis de margen.',
        {
          promptVersion: WHATSAPP_ASSISTANT_PROMPT_VERSION,
          provider: response.providerId,
          model: response.model,
          latencyMs: response.latencyMs,
          costUsd: response.costUsd,
        },
      );
    }

    if (intent.confidence < LOW_CONFIDENCE_THRESHOLD) {
      // Traza para depurar el prompt: que mensajes reales confunden al modelo.
      this.logger.warn(
        `Interpretacion floja (confidence=${intent.confidence}, type=${intent.type}) para: "${request.message.slice(0, 80)}"`,
      );
    }

    // ---- 2. El backend actua segun la intencion ---------------------------
    const meta = {
      promptVersion: WHATSAPP_ASSISTANT_PROMPT_VERSION,
      provider: response.providerId,
      model: response.model,
      latencyMs: response.latencyMs,
      costUsd: response.costUsd,
    };

    // Cada intencion tiene su manejador. El switch deja a la vista todos los
    // caminos posibles del mensaje, que antes estaban encadenados en ifs.
    // Cambiar de tema cierra la pregunta abierta. Dejarla viva haria que una
    // correccion de dentro de un rato se resolviera contra una lista que ya no
    // tiene nada que ver con lo que se esta hablando.
    // "payroll" tambien conserva: una nomina se arma en varios turnos y cada
    // respuesta del usuario llega como un payroll nuevo con un solo dato. Si
    // se olvidara aqui, el borrador moriria entre mensaje y mensaje y Luka
    // volveria a preguntar el nombre despues de que se lo dijeron.
    if (
      intent.type !== 'correction' &&
      intent.type !== 'confirmation' &&
      intent.type !== 'unclear' &&
      intent.type !== 'payroll' &&
      intent.type !== 'supply_debt' &&
      intent.type !== 'product' &&
      // "stock" conserva por lo mismo: el ajuste se arma en dos turnos
      // —que producto y cuantas quedan— y cada respuesta llega como un
      // stock nuevo con un solo dato.
      intent.type !== 'stock'
    ) {
      this.state.olvidar(request.businessId);
    }

    switch (intent.type) {
      case 'query':
        return this.handleQuery(intent, request, currency, meta);

      case 'breakdown':
        return this.handleBreakdown(intent, request, currency, meta);

      case 'profit_share':
        return this.handleProfitShare(intent, request, currency, meta);

      case 'correction':
        return this.handleCorrection(intent, request, currency, meta);

      case 'payment':
        return this.handlePayment(
          intent,
          request,
          currency,
          referenceDate,
          meta,
        );

      case 'confirmation':
        return this.handleConfirmation(
          intent,
          request,
          currency,
          referenceDate,
          meta,
        );

      case 'payroll':
        return this.handlePayroll(
          intent,
          request,
          currency,
          referenceDate,
          meta,
        );

      case 'supply_debt':
        return this.handleSupplyDebt(intent, request, currency, meta);

      case 'product':
        return this.handleProduct(intent, request, currency, meta);

      case 'stock':
        return this.handleStock(intent, request, meta);

      case 'income':
      case 'expense':
      case 'investment':
        return this.handleMovements(
          intent,
          request,
          currency,
          referenceDate,
          meta,
        );

      default:
        // unclear, out_of_scope y premium solo responden.
        return this.plainResult(intent, intent.responseText, meta);
    }
  }

  // ------------------------------------------------------------- movimientos

  /**
   * Registra uno o varios movimientos.
   *
   * Antes de guardar nada comprueba que el desglose cuadre con el total que
   * dijo el usuario: registrar cifras que no suman es peor que no registrar,
   * porque el error queda escondido en la contabilidad.
   */
  private async handleMovements(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    referenceDate: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    if (!intent.movements.length) {
      this.logger.warn(
        `Intencion "${intent.type}" sin monto valido: "${request.message.slice(0, 80)}"`,
      );
      return this.needsClarification(
        intent,
        'No alcancé a identificar el monto. ¿Me lo confirmas para registrarlo?',
        meta,
      );
    }

    // Un fiado sin nombre es una deuda que nadie puede cobrar: no se sabe a
    // quien reclamarle ni a que saldo aplicarle un abono despues. Preguntar
    // ahora cuesta un mensaje; descubrirlo un mes despues cuesta la plata.
    const fiadoSinCliente = intent.movements.find(
      (movimiento) => movimiento.isCredit && !movimiento.customerName,
    );

    if (fiadoSinCliente) {
      return this.needsClarification(
        intent,
        '¿A quién le fiaste? Necesito el nombre para saber después quién te debe.',
        meta,
      );
    }

    // Un fiado sin plazo es una deuda sin fecha de cobro: el recordatorio no
    // tiene contra que comparar y el dueno nunca sabe cuando reclamar. Antes
    // el sistema le inventaba unos dias fijos; ahora se pregunta, porque el
    // plazo lo acuerdan el y su cliente, no el software.
    const fiadoSinPlazo = intent.movements.find(
      (movimiento) => movimiento.isCredit && !movimiento.dueDate,
    );

    if (fiadoSinPlazo) {
      return this.needsClarification(
        intent,
        `¿Para cuándo quedó de pagarte ${fiadoSinPlazo.customerName}? Puedes decirme "el viernes", "el 15" o "fin de mes".`,
        meta,
      );
    }

    const compraSinPlazo = intent.movements.find(
      (movimiento) =>
        movimiento.isSupplierCredit &&
        (!movimiento.supplierName || !movimiento.supplierCreditDays),
    );
    if (compraSinPlazo) {
      return this.needsClarification(
        intent,
        compraSinPlazo.supplierName
          ? `¿A cuántos días le pagarás a ${compraSinPlazo.supplierName}?`
          : '¿A qué proveedor le quedó pendiente esta compra y a cuántos días le pagarás?',
        meta,
      );
    }

    const descuadre = checkBreakdown(
      intent.declaredTotal,
      intent.movements,
      intent.discount,
    );

    if (descuadre) {
      this.logger.warn(
        `Desglose que no cuadra: total ${descuadre.declared}, partes ${descuadre.sum}.`,
      );

      // Se guarda lo que si se entendio. Cuando el descuadre venia de una foto,
      // la imagen NO viaja al siguiente turno: sin esto, el usuario explicaba
      // la diferencia ("es que me dieron un descuento") y Luka le pedia otra
      // vez la lista de productos que acababa de leer.
      const entendidos = this.buildTransactions(
        intent.movements,
        request,
        currency,
        referenceDate,
      );

      this.state.recordarRegistro(request.businessId, {
        transactions: entendidos,
        source: request.media?.kind ?? 'texto',
        reason: 'descuadre',
        declaredTotal: intent.declaredTotal,
      });

      return this.needsClarification(
        intent,
        renderMismatch(descuadre, currency),
        meta,
      );
    }

    const transactions = this.buildTransactions(
      intent.movements,
      request,
      currency,
      referenceDate,
      undefined,
      intent.discount,
    );

    // De una nota de voz o una foto no se registra nada sin visto bueno: el
    // usuario no vio lo que Luka entendio, y ahi es donde se cuelan los errores.
    if (request.media) {
      this.state.recordarRegistro(request.businessId, {
        transactions,
        source: request.media.kind,
        reason: 'media',
        declaredTotal: intent.declaredTotal,
      });

      return {
        intent,
        transactions,
        transaction: transactions[0] ?? null,
        profitDistribution: null,
        payment: null,
        summary: null,
        replyText: renderRegistrationConfirmation(
          transactions,
          request.media.kind,
          currency,
          intent.discount,
        ),
        meta,
      };
    }

    /*
     * El inventario se mira ANTES de guardar, porque el aviso habla del estante
     * tal como estaba: después de guardar, las existencias ya cambiaron.
     */
    const revision = request.persist
      ? await this.revisarInventario(transactions, request)
      : { faltaCantidad: null, avisos: [] };

    if (revision.faltaCantidad) {
      return this.needsClarification(
        intent,
        `¿Cuántas unidades de ${revision.faltaCantidad.productName} fueron? Lo necesito para descontarlas de tu inventario.`,
        meta,
      );
    }

    if (request.persist) {
      await this.financeData.saveTransactions(transactions);
    }

    return {
      intent,
      transactions,
      transaction: transactions[0] ?? null,
      profitDistribution: null,
      payment: null,
      summary: null,
      // Con un solo movimiento se respeta el texto del modelo, que suena
      // natural. Con varios lo arma el backend: son cifras, y las cifras las
      // pone quien tiene los datos. El plazo del fiado se agrega aparte por lo
      // mismo: que salga o no en la confirmacion no puede depender de que al
      // modelo se le ocurra mencionarlo.
      replyText: [
        transactions.length === 1 && !intent.discount
          ? intent.responseText + lineaDePlazo(transactions[0])
          : renderMovementsRegistered(transactions, currency, intent.discount),
        ...revision.avisos,
      ].join('\n\n'),
      meta,
    };
  }

  /** Audio y foto son de los planes pagos. */
  private mediaNoIncluida(
    kind: 'audio' | 'image',
    meta: WhatsAppMessageResult['meta'],
  ): WhatsAppMessageResult {
    const que = kind === 'audio' ? 'notas de voz' : 'fotos';

    return this.plainResult(
      {
        type: 'premium',
        movements: [],
        declaredTotal: null,
        profitShares: [],
        correction: null,
        payment: null,
        payroll: null,
        supplyDebt: null,
        product: null,
        stock: null,
        confirmed: null,
        confirmedCount: null,
        discount: null,
        amount: null,
        category: null,
        concept: null,
        responseText: '',
        queryKind: null,
        queryPeriod: null,
        confidence: 0.9,
      },
      `Registrar por ${que} está disponible en los planes pagos.`,
      meta,
    );
  }

  /**
   * El usuario contesto a una pregunta de si o no.
   *
   * Hoy la unica que se hace asi es la de borrar. Borrar no se deshace, y por
   * eso nunca ocurre en el turno en que se pide: se le enseña exactamente que
   * se va a ir y solo despues se ejecuta.
   */
  private async handleConfirmation(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    referenceDate: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    const ajuste = this.state.stockPendiente(request.businessId);

    if (ajuste?.stage === 'confirmacion') {
      return this.confirmarStock(ajuste, intent, request, meta);
    }

    const producto = this.state.productoPendiente(request.businessId);

    if (producto?.stage === 'confirmacion') {
      return this.confirmarProducto(
        producto,
        intent,
        request,
        currency,
        meta,
      );
    }

    const deuda = this.state.deudaProveedorPendiente(request.businessId);

    if (deuda?.stage === 'confirmacion') {
      return this.confirmarDeudaProveedor(
        deuda,
        intent,
        request,
        currency,
        meta,
      );
    }

    const nomina = this.state.nominaPendiente(request.businessId);

    if (nomina?.stage === 'confirmacion') {
      return this.confirmarNomina(
        nomina,
        intent,
        request,
        currency,
        referenceDate,
        meta,
      );
    }

    const registro = this.state.registroPendiente(request.businessId);

    // Un descuadre no se resuelve con un si: lo que se pidio ahi fue la cifra
    // buena, no un visto bueno. Confirmarlo guardaria justo los montos que no
    // cuadraban.
    if (registro && registro.reason === 'media') {
      this.state.olvidar(request.businessId);

      if (intent.confirmed !== true) {
        return this.plainResult(
          intent,
          'Listo, no registré nada. Cuéntame de nuevo cómo fue 😊',
          meta,
        );
      }

      if (request.persist) {
        await this.financeData.saveTransactions(registro.transactions);
      }

      return {
        ...this.plainResult(intent, '', meta),
        transactions: registro.transactions,
        transaction: registro.transactions[0] ?? null,
        replyText: renderMovementsRegistered(registro.transactions, currency),
      };
    }

    const borrado = this.state.borradoPendiente(request.businessId);

    if (!borrado) {
      // Un "si" sin pregunta abierta no puede ejecutar nada: no hay forma de
      // saber que estaba confirmando.
      return this.plainResult(
        { ...intent, type: 'unclear' },
        'No tengo nada pendiente de confirmar 😅 ¿Qué necesitas?',
        meta,
      );
    }

    if (intent.confirmed !== true) {
      this.state.olvidar(request.businessId);
      return this.plainResult(
        intent,
        'Listo, no borré nada. Todo queda como estaba 👍',
        meta,
      );
    }

    // Un "si" a secas no basta para borrar varios. El usuario tiene que repetir
    // cuantos son: es la unica forma de saber que leyo la lista. La pregunta
    // sigue abierta, asi que puede confirmar bien o escoger uno.
    if (
      borrado.targets.length > 1 &&
      intent.confirmedCount !== borrado.targets.length
    ) {
      this.logger.warn(
        `Confirmacion floja de un borrado de ${borrado.targets.length} movimientos en sede ${request.businessId}.`,
      );

      return this.plainResult(
        intent,
        renderCountConfirmationNeeded(borrado.targets, currency),
        meta,
      );
    }

    this.state.olvidar(request.businessId);

    if (request.persist) {
      for (const objetivo of borrado.targets) {
        await this.financeData.deleteTransaction(
          request.businessId,
          objetivo.id,
        );
      }
    }

    this.logger.log(
      `Borrados ${borrado.targets.length} movimientos en sede ${request.businessId} tras confirmacion.`,
    );

    return {
      ...this.plainResult(intent, '', meta),
      replyText: renderDeletedMany(borrado.targets, currency),
    };
  }

  /**
   * Registra que le pagaron un fiado.
   *
   * No crea un movimiento: baja el saldo de las ventas a credito que ya
   * estaban registradas. El ingreso aparece solo, porque el abono se lee
   * despues como un movimiento de categoria "cobros" con la fecha del pago.
   * Registrarlo como venta nueva —que es lo que pasaba antes— contaba la
   * misma plata dos veces y dejaba la deuda del cliente intacta.
   */
  private async handlePayment(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    referenceDate: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    const abono = intent.payment;

    // Sin nombre no hay deuda a la cual aplicarlo. Preguntar es mejor que
    // adivinar: aplicarselo al cliente equivocado descuadra dos cuentas.
    if (!abono?.customerName) {
      return this.needsClarification(
        intent,
        '¡Qué bueno que te pagaron! 😊 ¿De quién es el pago? Dime el nombre y lo descuento de su deuda.',
        meta,
      );
    }

    if (!request.persist) {
      return this.plainResult(intent, intent.responseText, meta);
    }

    const resultado = await this.financeData.registerPayment({
      businessId: request.businessId,
      customerName: abono.customerName,
      // "Ya me pago todo" no trae monto: se salda lo que deba, que el sistema
      // si sabe cuanto es.
      amount: abono.settlesDebt ? null : abono.amount,
      date: abono.date ?? referenceDate,
      // Mismo criterio que los movimientos: sin fecha dicha, vale la hora real
      // del mensaje.
      occurredAt: abono.date ? null : new Date().toISOString(),
    });

    if (resultado.applied) {
      this.logger.log(
        `Abono de ${resultado.amount} de "${resultado.customerName}" en sede ${request.businessId}: quedan ${resultado.remaining}.`,
      );
    } else {
      this.logger.warn(
        `Abono no aplicado (${resultado.reason}) para "${abono.customerName}" en sede ${request.businessId}.`,
      );
    }

    return {
      intent,
      transactions: [],
      transaction: null,
      profitDistribution: null,
      payment: resultado,
      summary: null,
      // Las cifras las pone el backend: cuanto quedo debiendo es justo el dato
      // que el modelo no puede saber y el dueno si necesita.
      replyText: renderPayment(resultado, currency),
      meta,
    };
  }

  /**
   * Desglosa un total que ya estaba registrado.
   *
   * Busca el movimiento del que se esta hablando y lo sustituye por sus partes.
   * Si no lo encuentra (el usuario nunca registro ese total), trata el mensaje
   * como movimientos nuevos en vez de perderlo.
   */
  private async handleBreakdown(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    if (!intent.movements.length) {
      return this.needsClarification(
        intent,
        'No entendí el desglose. ¿Me repites cuánto fue en cada forma de pago?',
        meta,
      );
    }

    const referenceDate = todayIso();
    const suma = sumAmounts(intent.movements);
    const original = await this.findTransactionToBreakDown(
      request.businessId,
      intent.movements[0].type,
      suma,
    );

    const partes = this.buildTransactions(
      intent.movements,
      request,
      currency,
      referenceDate,
      original?.groupId ?? randomUUID(),
    );

    if (!original) {
      // No hay un total previo con esa cifra: son movimientos nuevos.
      this.logger.warn(
        `Desglose sin total previo de ${suma} en sede ${request.businessId}: se registra como movimientos nuevos.`,
      );
      if (request.persist) {
        await this.financeData.saveTransactions(partes);
      }
      return {
        intent,
        transactions: partes,
        transaction: partes[0] ?? null,
        profitDistribution: null,
        payment: null,
        summary: null,
        replyText: renderMovementsRegistered(partes, currency),
        meta,
      };
    }

    if (request.persist) {
      await this.financeData.replaceTransaction(
        request.businessId,
        original.id,
        partes,
      );
    }

    return {
      intent,
      transactions: partes,
      transaction: partes[0] ?? null,
      profitDistribution: null,
      payment: null,
      summary: null,
      replyText: renderBreakdown(partes, suma, currency),
      meta,
    };
  }

  /**
   * Busca el movimiento total que el desglose viene a detallar.
   *
   * Criterio: mismo tipo, mismo monto que la suma de las partes, sin desglosar
   * todavia y reciente. Es deterministico y no necesita memoria de la
   * conversacion, que en WhatsApp no siempre llega completa.
   */
  private async findTransactionToBreakDown(
    businessId: string,
    type: TransactionType,
    total: number,
  ): Promise<Transaction | null> {
    const hoy = todayIso();
    const rows = await this.financeData.listTransactions({
      businessId,
      from: sumarDias(hoy, -BREAKDOWN_WINDOW_DAYS),
      to: hoy,
      type,
      limit: 200,
    });

    // No se filtra por `source`: la base no guarda de donde vino el movimiento
    // y el adaptador de Prisma devuelve "manual" para todo, asi que exigir
    // "whatsapp" no encontraria nunca el total y el desglose terminaria
    // duplicando el dinero.
    return (
      rows.find((row) => !row.groupId && Math.abs(row.amount - total) < 0.01) ??
      null
    );
  }

  // ------------------------------------------------------------ correcciones

  /**
   * Corrige o borra un movimiento ya registrado.
   *
   * Antes esta intencion solo respondia con buenas palabras y no cambiaba nada:
   * el usuario creia haber corregido y la contabilidad seguia mal. Ahora se
   * ubica el movimiento y se escribe en la misma base que lee el panel, asi que
   * el cambio aparece tambien en la web.
   */
  private async handleCorrection(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    const correccion = intent.correction;

    if (!correccion) {
      return this.needsClarification(
        intent,
        '¿Qué movimiento quieres corregir y cuál es el valor correcto?',
        meta,
      );
    }

    // Lo que el usuario esta senalando al citar un mensaje de Luka, y el
    // borrado que ya este sobre la mesa. Se calculan ANTES de cualquier otra
    // decision porque las dos cosas son mas concretas que un "borra todo".
    const citados = await this.buscarCitados(request);
    const borradoAbierto = this.state.borradoPendiente(request.businessId);

    /**
     * "Borra todo lo de hoy" junta todos los del periodo. Pero solo cuando el
     * usuario no señalo nada mas preciso.
     *
     * AQUI ESTABA EL DAÑO. Esta comprobacion iba primero y cortaba el metodo,
     * asi que cuando el usuario contestaba "el 1" a una lista, el modelo seguia
     * devolviendo deleteAll —el hilo venia de un borrado masivo— y se volvia a
     * ofrecer borrar el dia entero. La posicion que acababa de dar se
     * descartaba sin mirarla.
     *
     * Ahora una posicion dicha por el usuario, o un mensaje citado, mandan
     * sobre el "todo". No se bloquea por tener un borrado abierto: repetir
     * "borra todo lo de hoy" es legitimo y solo vuelve a preguntar.
     */
    const señaloAlgoConcreto =
      tieneIdentificador(correccion) || citados !== null;

    if (
      correccion.action === 'delete' &&
      correccion.deleteAll &&
      !señaloAlgoConcreto
    ) {
      return this.handleDeleteAll(intent, request, currency, meta);
    }

    // Con un borrado ya sobre la mesa, un identificador no abre una busqueda
    // nueva: acota lo que se iba a borrar. "El 2" significa "solo ese", que es
    // justo lo que hay que poder decir cuando la lista trae de mas.

    if (borradoAbierto && tieneIdentificador(correccion)) {
      const elegidos = resolverEntreCandidatos(
        borradoAbierto.targets,
        correccion,
      );

      if (elegidos.length) {
        this.state.recordarBorrado(request.businessId, {
          targets: elegidos,
          period: null,
        });

        return {
          ...this.plainResult(intent, '', meta),
          replyText: renderDeleteConfirmation(elegidos, null, currency),
        };
      }
    }

    if (citados) {
      return this.corregirCitados(
        intent,
        request,
        correccion,
        citados,
        currency,
        meta,
      );
    }

    const pendiente = this.state.correccionPendiente(request.businessId);

    // El usuario no repite el valor nuevo cuando solo esta contestando "cual":
    // ya lo dijo en el mensaje que abrio la correccion.
    const cambio = {
      newAmount: correccion.newAmount ?? pendiente?.newAmount ?? null,
      newConcept: correccion.newConcept ?? pendiente?.newConcept ?? null,
    };

    let accion = correccion.action;
    let candidatos: Transaction[];

    if (pendiente) {
      const elegidos = resolverEntreCandidatos(
        pendiente.candidates,
        correccion,
      );

      if (
        elegidos.length === 1 ||
        (elegidos.length > 1 && correccion.matchAll)
      ) {
        // Contesto cual: se aplica lo que ya habia pedido, sobre lo que el
        // mismo eligio de la lista. Con "todos esos", sobre todos.
        candidatos = elegidos;
        accion = pendiente.action;
      } else if (!tieneIdentificador(correccion) && !correccion.matchAll) {
        // AQUI ESTABA EL DANO: sin identificador y con una lista abierta, el
        // codigo caia en "sin referencia = el ultimo movimiento" y corregia uno
        // que ni siquiera estaba en la lista. Con una pregunta abierta, no
        // haber dicho cual significa volver a preguntar.
        return this.plainResult(
          intent,
          renderAmbiguousCorrection(pendiente.candidates, currency),
          meta,
        );
      } else {
        // Dio un identificador que no cuadra con la lista: esta hablando de
        // otra cosa. Se cierra la pregunta y se busca de cero.
        this.state.olvidar(request.businessId);
        candidatos = await this.buscarParaCorregir(
          request,
          correccion,
          intent.queryPeriod,
        );
      }
    } else {
      candidatos = await this.buscarParaCorregir(
        request,
        correccion,
        intent.queryPeriod,
      );
    }

    if (candidatos.length === 0) {
      // Se deja traza de lo que se busco: cuando alguien reporta un "no
      // encontre" que no deberia serlo, esto es lo unico que dice por que.
      this.logger.warn(
        `Correccion sin resultados en sede ${request.businessId}: ${describirBusqueda(correccion, intent.queryPeriod)}`,
      );

      return this.plainResult(
        intent,
        renderCorrectionNotFound(correccion, currency, intent.queryPeriod),
        meta,
      );
    }

    // "Elimina estos dos" habla de un grupo, no de uno: no hay que preguntar
    // cual, hay que ensenar los que se van a ir y esperar el si.
    if (accion === 'delete' && correccion.matchAll) {
      this.state.recordarBorrado(request.businessId, {
        targets: candidatos,
        period: null,
      });

      return {
        ...this.plainResult(intent, '', meta),
        replyText: renderDeleteConfirmation(candidatos, null, currency),
      };
    }

    // Varios candidatos: no se elige por el usuario. Corregir el equivocado es
    // peor que preguntar, porque el error queda escondido en la contabilidad.
    if (candidatos.length > 1) {
      this.state.recordarCorreccion(request.businessId, {
        action: accion,
        candidates: candidatos,
        newAmount: cambio.newAmount,
        newConcept: cambio.newConcept,
      });

      return this.plainResult(
        intent,
        renderAmbiguousCorrection(candidatos, currency),
        meta,
      );
    }

    const objetivo = candidatos[0];
    this.state.olvidar(request.businessId);

    if (accion === 'delete') {
      // No se borra todavia: primero se le enseña que se va a ir. Un borrado
      // no se deshace, y el que se equivoca de movimiento pierde el dato.
      this.state.recordarBorrado(request.businessId, {
        targets: [objetivo],
        period: null,
      });

      return {
        ...this.plainResult(intent, '', meta),
        replyText: renderDeleteConfirmation([objetivo], null, currency),
      };
    }

    return this.aplicarCorreccion(
      intent,
      request,
      objetivo,
      cambio,
      currency,
      meta,
    );
  }

  /**
   * Escribe la correccion sobre un movimiento ya identificado.
   *
   * Vive aparte porque hay dos caminos que llegan aqui —la busqueda normal y
   * la resolucion por mensaje citado— y duplicar esto significaba que un
   * arreglo en uno no llegara al otro.
   */
  private async aplicarCorreccion(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    objetivo: Transaction,
    cambio: { newAmount: number | null; newConcept: string | null },
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    if (cambio.newAmount === null && cambio.newConcept === null) {
      return this.needsClarification(
        intent,
        `Encontré el movimiento "${objetivo.description}" por ${formatMoney(objetivo.amount, currency)}. ¿Cuál es el valor correcto?`,
        meta,
      );
    }

    const cambios = {
      ...(cambio.newAmount !== null ? { amount: cambio.newAmount } : {}),
      ...(cambio.newConcept !== null ? { description: cambio.newConcept } : {}),
    };

    const actualizado = request.persist
      ? await this.financeData.updateTransaction(
          request.businessId,
          objetivo.id,
          cambios,
        )
      : { ...objetivo, ...cambios };

    if (!actualizado) {
      return this.plainResult(
        intent,
        'No pude corregir ese movimiento. ¿Lo intentamos de nuevo?',
        meta,
      );
    }

    return {
      ...this.plainResult(intent, '', meta),
      transactions: [actualizado],
      transaction: actualizado,
      replyText: renderCorrected(objetivo, actualizado, currency),
    };
  }

  /**
   * Movimientos que podrian ser el que hay que corregir.
   *
   * Sin referencia se devuelve el ultimo registrado, que es lo que la gente
   * quiere decir con "el ultimo gasto". Con referencia se busca por texto y se
   * devuelven todas las coincidencias, para poder preguntar si hay varias.
   */
  /**
   * "Borra todos los registros de hoy".
   *
   * Se listan uno por uno antes de preguntar: un "¿seguro?" a ciegas sobre
   * catorce movimientos no es una confirmacion, es una apuesta.
   */
  private async handleDeleteAll(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    const period = intent.queryPeriod ?? 'day';
    const { from, to } = periodRange(period, new Date(), diaInicioDe(request));

    const movimientos = await this.financeData.listTransactions({
      businessId: request.businessId,
      from,
      to,
      limit: 1_000,
    });

    if (!movimientos.length) {
      return this.plainResult(
        intent,
        `No tienes movimientos registrados ${etiquetaPeriodo(period)} para borrar.`,
        meta,
      );
    }

    this.state.recordarBorrado(request.businessId, {
      targets: movimientos,
      period,
    });

    return {
      ...this.plainResult(intent, '', meta),
      replyText: renderDeleteConfirmation(movimientos, period, currency),
    };
  }

  /**
   * Los movimientos del mensaje que el usuario esta citando.
   *
   * Devuelve null cuando no hay cita o cuando esa cita no trae ids (mensajes
   * viejos, o del propio usuario). Devuelve lista vacia cuando los traia pero
   * ya no existen: no es lo mismo "no se de que hablas" que "eso ya lo
   * borraste", y responder lo segundo evita que el usuario lo intente otra vez.
   */
  private async buscarCitados(
    request: WhatsAppMessageRequest,
  ): Promise<Transaction[] | null> {
    const ids = request.quotedMessage?.transactionIds ?? [];
    if (!ids.length) return null;

    const hoy = todayIso();
    const rows = await this.financeData.listTransactions({
      businessId: request.businessId,
      // Ventana ancha: un mensaje citado puede ser de hace meses, y aqui no se
      // esta buscando "algo parecido" sino ids exactos.
      from: sumarDias(hoy, -QUOTED_WINDOW_DAYS),
      to: hoy,
      limit: 2_000,
    });

    const porId = new Map(rows.map((row) => [row.id, row]));
    return ids
      .map((id) => porId.get(id))
      .filter((row): row is Transaction => row !== undefined);
  }

  /**
   * Corrige o borra sobre los movimientos que el usuario esta citando.
   *
   * Aqui NO se busca nada: el conjunto ya esta acotado por la cita. Lo unico
   * que se decide es si habla de todos o de uno solo.
   *
   * Sin esto pasaron dos cosas feas. Citando "Registre el fiado de $2.000 a
   * Kevin", Luka ofrecio borrar un pago de gas de $60.000, porque la cita no
   * identificaba nada y caia en "el ultimo". Y citando un mensaje con cuatro
   * compras, listo cinco movimientos —todos los del dia— y el usuario confirmo
   * sin revisar.
   */
  private async corregirCitados(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    correccion: CorrectionRequest,
    citados: Transaction[],
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    if (!citados.length) {
      return this.plainResult(
        intent,
        'Esos movimientos ya no están: parece que se borraron antes. ¿Te ayudo con otra cosa?',
        meta,
      );
    }

    // Si dio una pista para escoger dentro de la cita, se respeta. La
    // seleccion MANDA sobre matchAll: "borra el segundo y el tercero" suena a
    // varios, y el modelo tiende a marcar matchAll; hacerle caso ahi hacia que
    // Luka ofreciera borrar tambien el primero, que el usuario acababa de
    // pedir que dejara.
    const elegidos = resolverEntreCandidatos(citados, correccion);
    const objetivos = elegidos.length ? elegidos : citados;

    if (correccion.action === 'delete') {
      this.state.recordarBorrado(request.businessId, {
        targets: objetivos,
        period: null,
      });

      return {
        ...this.plainResult(intent, '', meta),
        replyText: renderDeleteConfirmation(objetivos, null, currency),
      };
    }

    // Una correccion sobre varios no tiene sentido: hay que saber cual.
    if (objetivos.length > 1) {
      this.state.recordarCorreccion(request.businessId, {
        action: 'update',
        candidates: objetivos,
        newAmount: correccion.newAmount,
        newConcept: correccion.newConcept,
      });

      return this.plainResult(
        intent,
        renderAmbiguousCorrection(objetivos, currency),
        meta,
      );
    }

    return this.aplicarCorreccion(
      intent,
      request,
      objetivos[0],
      { newAmount: correccion.newAmount, newConcept: correccion.newConcept },
      currency,
      meta,
    );
  }

  /**
   * Movimientos que encajan con lo que el usuario dijo para identificar cual.
   *
   * Antes solo se comparaba contra el texto de la descripcion, asi que Luka
   * pedia "dime la fecha o el monto" y despues no sabia usar ninguno de los
   * dos: las descripciones no llevan ni fechas ni cifras. El usuario contestaba
   * bien y recibia "no encontre ningun movimiento que mencione 3 de
   * septiembre".
   */
  private async buscarParaCorregir(
    request: WhatsAppMessageRequest,
    correccion: CorrectionRequest,
    periodo: QueryPeriod | null,
  ): Promise<Transaction[]> {
    const { from, to } = rangoParaCorregir(
      correccion,
      periodo,
      new Date(),
      diaInicioDe(request),
    );
    const todo = await this.financeData.listTransactions({
      businessId: request.businessId,
      from,
      to,
      // Mismo tope que el resto de consultas. Con 200 se traian solo los mas
      // recientes y, en un negocio con movimiento, lo de hace dos o tres
      // semanas —lo del mes anterior— ya no entraba al filtro.
      limit: 1_000,
    });

    // Los abonos quedan fuera: no son movimientos que se corrijan, son el
    // cobro de un fiado. 'deleteTransaction' no los toca, asi que si entraran
    // el bot responderia "listo, lo borre" sin haber borrado nada. Deshacer un
    // abono se hace desde el panel, donde ademas se devuelve la deuda.
    const rows = todo.filter((row) => row.category !== 'cobros');

    if (!tieneIdentificador(correccion)) {
      // Nada que identifique y ninguna pregunta abierta: es "el ultimo".
      // `listTransactions` viene ordenado del mas reciente al mas viejo.
      return rows.slice(0, 1);
    }

    const coinciden = rows.filter((row) =>
      coincideConIdentificador(row, correccion),
    );

    // Con "estos dos" no se recorta a los candidatos de una desambiguacion: se
    // van a ensenar todos antes de borrar, y recortar dejaria fuera justo los
    // que el usuario esta senalando.
    return correccion.matchAll
      ? coinciden.slice(0, MAX_MOVEMENTS_PER_DELETE)
      : coinciden.slice(0, CORRECTION_MAX_CANDIDATES);
  }

  // --------------------------------------------------- reparto de utilidades

  /**
   * Reparte las utilidades del periodo entre el dueno y los trabajadores.
   *
   * Los porcentajes los da el usuario; los montos los calcula el backend. Un
   * modelo de lenguaje no es de fiar haciendo aritmetica, y aqui el resultado
   * es plata que alguien va a recibir.
   */
  private async handleProfitShare(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    if (!intent.profitShares.length) {
      return this.needsClarification(
        intent,
        'Con gusto reparto las utilidades 😊 ¿Qué porcentaje te queda a ti y qué porcentaje va para los trabajadores?',
        meta,
      );
    }

    const suma = intent.profitShares.reduce(
      (total, share) => total + share.percentage,
      0,
    );
    if (Math.abs(suma - 100) > 0.01) {
      return this.needsClarification(
        intent,
        `Los porcentajes que me diste suman ${round2(suma)}% y deberían sumar 100%. ¿Me los confirmas?`,
        meta,
      );
    }

    const summary = await this.buildSummary(
      request.businessId,
      intent.queryPeriod ?? 'month',
      currency,
      diaInicioDe(request),
    );

    if (summary.balance <= 0) {
      return this.plainResult(
        intent,
        `Este periodo no hay utilidades para repartir: llevas ${formatMoney(summary.balance, currency)} de balance.`,
        meta,
      );
    }

    const shares = intent.profitShares.map((share) => ({
      ...share,
      amount: round2((summary.balance * share.percentage) / 100),
    }));

    if (request.persist) {
      await this.financeData.saveProfitDistribution({
        businessId: request.businessId,
        total: summary.balance,
        shares,
        date: todayIso(),
        groupId: randomUUID(),
      });
    }

    return {
      intent: { ...intent, profitShares: shares },
      transactions: [],
      transaction: null,
      profitDistribution: { total: summary.balance, shares },
      payment: null,
      summary,
      replyText: renderProfitShare(summary.balance, shares, currency),
      meta,
    };
  }

  // ---------------------------------------------------------------- consultas

  /** Resumen, listado o busqueda, segun lo que pidio el usuario. */
  private async handleQuery(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    const period = intent.queryPeriod ?? 'month';
    const diaInicio = diaInicioDe(request);

    if (intent.queryKind === 'receivables') {
      return this.handleReceivables(intent, request, currency, meta);
    }

    // Una busqueda sin termino no se puede hacer: cae al resumen.
    if (intent.queryKind === 'search' && intent.concept) {
      const encontrados = await this.searchTransactions(
        request.businessId,
        intent.concept,
        diaInicio,
        intent.queryPeriod,
      );
      return {
        ...this.plainResult(intent, '', meta),
        replyText: renderSearch(
          intent.concept,
          encontrados,
          currency,
          intent.queryPeriod,
        ),
      };
    }

    const summary = await this.buildSummary(
      request.businessId,
      period,
      currency,
      diaInicio,
    );

    if (intent.queryKind === 'list') {
      const { from, to } = periodRange(period, new Date(), diaInicio);
      // Se traen todos y el renderizador recorta: si se pidieran solo los 20
      // primeros, el encabezado diria "tus 20 movimientos" aunque hubiera 50,
      // y no cuadraria con el conteo que el resumen acaba de dar.
      const movimientos = await this.financeData.listTransactions({
        businessId: request.businessId,
        from,
        to,
        limit: 1_000,
      });
      return {
        ...this.plainResult(intent, '', meta),
        summary,
        replyText: renderMovementList(movimientos, period, currency),
      };
    }

    return {
      ...this.plainResult(intent, '', meta),
      summary,
      replyText: renderSummary(summary),
    };
  }

  // ------------------------------------------------------------------ nomina

  /**
   * Registra el pago de nomina de un trabajador.
   *
   * Son tres datos —a quien, que porcentaje y cuanto— y se piden de a uno: un
   * mensaje de WhatsApp que pregunta tres cosas a la vez se contesta a medias,
   * y el usuario termina repitiendose. El borrador se guarda entre turnos, asi
   * que cada respuesta rellena un hueco sin perder lo ya dicho.
   *
   * Nada se guarda sin visto bueno. Una nomina mal registrada no se nota en el
   * momento: aparece a fin de mes, cuando las cuentas del trabajador no
   * cuadran con las del dueno.
   */
  private handlePayroll(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    referenceDate: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    const abierta = this.state.nominaPendiente(request.businessId);
    const borrador = mezclarNomina(abierta?.draft, intent.payroll);

    const falta = primerDatoQueFalta(borrador);

    if (falta) {
      this.state.recordarNomina(request.businessId, {
        draft: borrador,
        stage: 'datos',
      });

      return Promise.resolve(
        this.plainResult(intent, preguntaDeNomina(falta, borrador), meta),
      );
    }

    // Completo: se le ensena y se espera el si. El borrador queda guardado tal
    // cual, para que la confirmacion registre exactamente lo que se mostro.
    this.state.recordarNomina(request.businessId, {
      draft: borrador,
      stage: 'confirmacion',
    });

    return Promise.resolve(
      this.plainResult(
        intent,
        renderPayrollSummary(borrador, currency, referenceDate),
        meta,
      ),
    );
  }

  /** Guarda la nomina que el usuario acaba de confirmar. */
  private async confirmarNomina(
    pendiente: PendingPayroll,
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    referenceDate: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    this.state.olvidar(request.businessId);

    if (intent.confirmed !== true) {
      return this.plainResult(
        intent,
        'Listo, no registré ese pago. Si quieres lo hacemos de nuevo 😊',
        meta,
      );
    }

    const pago: PayrollPayment = {
      id: randomUUID(),
      businessId: request.businessId,
      workerName: pendiente.draft.workerName ?? '',
      percentage: pendiente.draft.percentage ?? 0,
      amount: pendiente.draft.amount ?? 0,
      date: pendiente.draft.date ?? referenceDate,
      currency,
    };

    if (request.persist) {
      await this.financeData.savePayroll(pago);
    }

    return this.plainResult(
      intent,
      renderPayrollRegistered(pago, currency),
      meta,
    );
  }

  // ------------------------------------------------- suministros a credito

  /**
   * Marca un suministro como pendiente de pago al proveedor.
   *
   * Son siete datos y por WhatsApp nunca llegan juntos: el mensaje tipico es
   * "la harina de Molinos quedo a deber" y ahi acaba la informacion. Se piden
   * de a uno, en el orden en que una persona los piensa —a quien, que, cuanto,
   * para cuando, como— y el borrador se conserva entre mensajes.
   *
   * Antes de guardar se le ensena el plan de cuotas ya calculado. Es el unico
   * momento en que puede ver lo que de verdad va a pagar: el interes mensual
   * sobre saldo no se adivina de cabeza, y descubrir en la tercera cuota que
   * el total era otro es exactamente lo que hay que evitar.
   */
  private handleSupplyDebt(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    const abierta = this.state.deudaProveedorPendiente(request.businessId);
    const borrador = mezclarDeuda(abierta?.draft, intent.supplyDebt);

    const falta = primerDatoDeDeudaQueFalta(borrador);

    if (falta) {
      this.state.recordarDeudaProveedor(request.businessId, {
        draft: borrador,
        stage: 'datos',
      });

      return Promise.resolve(
        this.plainResult(intent, preguntaDeDeuda(falta, borrador), meta),
      );
    }

    this.state.recordarDeudaProveedor(request.businessId, {
      draft: borrador,
      stage: 'confirmacion',
    });

    return Promise.resolve(
      this.plainResult(
        intent,
        renderSupplyDebtSummary(borrador, currency),
        meta,
      ),
    );
  }

  /** Guarda la deuda con proveedor que el usuario acaba de confirmar. */
  private async confirmarDeudaProveedor(
    pendiente: PendingSupplyDebt,
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    this.state.olvidar(request.businessId);

    if (intent.confirmed !== true) {
      return this.plainResult(
        intent,
        'Listo, no registré esa deuda. Si quieres lo hacemos de nuevo 😊',
        meta,
      );
    }

    const deuda = aDeudaDeProveedor(pendiente.draft, request.businessId);

    if (request.persist) {
      await this.financeData.saveSupplyDebt(deuda);
    }

    return this.plainResult(
      intent,
      renderSupplyDebtRegistered(deuda, currency),
      meta,
    );
  }

  // ----------------------------------------------------------- catalogo

  /**
   * Da de alta un producto del catalogo.
   *
   * Tres datos obligatorios —nombre, a cuanto lo vende y a cuanto lo compra—
   * que se piden de a uno, igual que en el resto de altas por conversacion. El
   * precio de compra no se salta: sin el no hay margen, y el margen es lo
   * unico que el dueno le va a preguntar despues a este catalogo.
   *
   * Categoria y stock son opcionales a proposito. Se completan desde el panel
   * cuando haga falta, y pedirlos aqui alargaria la conversacion para datos
   * que no cambian lo que el producto hace.
   */
  /**
   * Qué tiene que ver el inventario con estos movimientos.
   *
   * La regla, entera: **se lleva inventario de lo que está en el catálogo, y
   * de nada más**. El catálogo es la declaración de intenciones del tendero;
   * no hace falta preguntarle en qué modo quiere trabajar.
   *
   * De ahí salen los tres casos:
   *
   * - Producto EN el catálogo: la venta descuenta existencias, automático.
   * - Producto que no está: la venta se registra igual. Si el negocio lleva
   *   catálogo, se le avisa; si no lleva ninguno —una peluquería, un
   *   restaurante— no se le menciona el inventario jamás.
   * - Vendió más de lo anotado: también se registra. La venta ocurrió; lo que
   *   estaba mal era el conteo.
   *
   * Nada de esto bloquea. Registrar el movimiento es LA función del producto.
   */
  private async revisarInventario(
    transactions: Transaction[],
    request: WhatsAppMessageRequest,
  ): Promise<{ faltaCantidad: Transaction | null; avisos: string[] }> {
    const vacio = { faltaCantidad: null, avisos: [] };

    // El gratuito llega aquí sin productName: `buildTransactions` ya se lo
    // quitó. La comprobación es por si acaso y para ahorrarse las consultas.
    if (request.planIsFree) return vacio;

    const conProducto = transactions.filter(
      (movimiento) => movimiento.type === 'income' && movimiento.productName,
    );
    if (!conProducto.length) return vacio;

    // Sin catálogo, este negocio no lleva inventario y no hay nada que decirle.
    if (!(await this.financeData.hasCatalog(request.businessId))) return vacio;

    const avisos: string[] = [];

    for (const movimiento of conProducto) {
      const producto = await this.financeData.findProductByName(
        request.businessId,
        movimiento.productName!,
      );

      if (!producto) {
        avisos.push(
          `Ojo: "${movimiento.productName}" no está en tu catálogo, así que no descontó existencias. Si quieres llevarle inventario, dime "agrega ${movimiento.productName}".`,
        );
        continue;
      }

      // El producto SÍ está en el catálogo: aquí la cantidad sí hace falta,
      // porque sin ella no se sabe cuántas unidades salieron del estante.
      if (!movimiento.quantity) {
        return { faltaCantidad: movimiento, avisos: [] };
      }

      if (movimiento.quantity > producto.stock) {
        avisos.push(
          `Ojo: tenías ${producto.stock} ${producto.name} anotadas y vendiste ${movimiento.quantity}. Dejé el estante en 0; revisa el conteo cuando puedas.`,
        );
      }
    }

    return { faltaCantidad: null, avisos };
  }

  /**
   * Corrige cuántas unidades quedan de un producto.
   *
   * Un conteo, una merma o una rotura cambian el estante sin mover un peso. No
   * se registra ningún movimiento, y el resumen se lo dice al usuario con todas
   * las letras: confundir un ajuste con una venta es el error que esconde
   * ingresos, y más vale sobrar en avisar.
   *
   * Se pide confirmación mostrando de cuánto a cuánto va. Un stock mal dictado
   * no da la cara: no se nota hasta que la venta falla por existencias o hasta
   * que el reporte de reposición manda comprar lo que ya está en la bodega.
   */
  private async handleStock(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    if (request.planIsFree) {
      return this.plainResult(
        { ...intent, type: 'premium' },
        'Llevar inventario está disponible en los planes pagos.',
        meta,
      );
    }

    const abierta = this.state.stockPendiente(request.businessId);
    const borrador: StockDraft = {
      productName:
        intent.stock?.productName ?? abierta?.draft.productName ?? null,
      units: intent.stock?.units ?? abierta?.draft.units ?? null,
    };

    if (!borrador.productName) {
      this.state.recordarStock(request.businessId, {
        draft: borrador,
        stage: 'datos',
        productoId: null,
        nombreGuardado: null,
        unidadesAntes: null,
      });

      return this.plainResult(
        intent,
        '¿De qué producto quieres ajustar el inventario?',
        meta,
      );
    }

    const producto = await this.financeData.findProductByName(
      request.businessId,
      borrador.productName,
    );

    if (!producto) {
      // No se deja al usuario con un "no existe" y nada mas: se le dice el
      // camino exacto, que es darlo de alta primero.
      this.state.olvidar(request.businessId);

      return this.plainResult(
        intent,
        `No encontré "${borrador.productName}" en tu catálogo, así que no hay inventario que ajustar 😊

Si quieres agregarlo, dime por ejemplo: "agrega ${borrador.productName}, lo vendo en 2.000 y me cuesta 1.200".`,
        meta,
      );
    }

    if (borrador.units === null) {
      this.state.recordarStock(request.businessId, {
        draft: borrador,
        stage: 'datos',
        productoId: producto.id,
        nombreGuardado: producto.name,
        unidadesAntes: producto.stock,
      });

      return this.plainResult(
        intent,
        `¿Cuántas unidades de ${producto.name} te quedan? Ahora tengo anotadas ${producto.stock}.`,
        meta,
      );
    }

    this.state.recordarStock(request.businessId, {
      draft: borrador,
      stage: 'confirmacion',
      productoId: producto.id,
      nombreGuardado: producto.name,
      unidadesAntes: producto.stock,
    });

    return this.plainResult(
      intent,
      renderStockSummary(producto.name, producto.stock, borrador.units),
      meta,
    );
  }

  /** Aplica el ajuste de inventario que el usuario acaba de confirmar. */
  private async confirmarStock(
    pendiente: PendingStock,
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    this.state.olvidar(request.businessId);

    if (intent.confirmed !== true) {
      return this.plainResult(
        intent,
        'Listo, dejé el inventario como estaba 😊',
        meta,
      );
    }

    const nombre = pendiente.nombreGuardado ?? '';
    const antes = pendiente.unidadesAntes ?? 0;
    const despues = pendiente.draft.units ?? 0;

    if (request.persist && pendiente.productoId) {
      await this.financeData.setProductStock(
        request.businessId,
        pendiente.productoId,
        despues,
      );
    }

    return this.plainResult(
      intent,
      renderStockAjustado(nombre, antes, despues),
      meta,
    );
  }

  private handleProduct(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    /*
     * El catálogo es de planes pagos.
     *
     * Se devuelve la intención como `premium` en vez de un texto propio: el
     * mensaje comercial —con los precios y el enlace— lo arma el backend en un
     * solo sitio, y así no hay dos versiones del argumento de venta que acaben
     * discrepando.
     *
     * No se bloquea aquí el resto del inventario (listar, vender contra él):
     * eso ya no llega, porque `ajustarPorInventario` deja fuera al gratuito.
     */
    if (request.planIsFree) {
      return Promise.resolve(
        this.plainResult(
          { ...intent, type: 'premium' },
          'Llevar catálogo de productos está disponible en los planes pagos.',
          meta,
        ),
      );
    }

    const abierta = this.state.productoPendiente(request.businessId);
    const borrador = mezclarProducto(abierta?.draft, intent.product);

    const falta = primerDatoDeProductoQueFalta(borrador);

    if (falta) {
      this.state.recordarProducto(request.businessId, {
        draft: borrador,
        stage: 'datos',
      });

      return Promise.resolve(
        this.plainResult(intent, preguntaDeProducto(falta, borrador), meta),
      );
    }

    this.state.recordarProducto(request.businessId, {
      draft: borrador,
      stage: 'confirmacion',
    });

    return Promise.resolve(
      this.plainResult(intent, renderProductSummary(borrador, currency), meta),
    );
  }

  /** Guarda el producto que el usuario acaba de confirmar. */
  private async confirmarProducto(
    pendiente: PendingProduct,
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    this.state.olvidar(request.businessId);

    if (intent.confirmed !== true) {
      return this.plainResult(
        intent,
        'Listo, no lo agregué al catálogo. Si quieres lo hacemos de nuevo 😊',
        meta,
      );
    }

    const producto = aProductoDelCatalogo(pendiente.draft, request.businessId);

    // Sin persistencia no hay a quien preguntarle si ya existe: se responde
    // como si hubiera entrado, que es lo que espera quien esta probando.
    if (!request.persist) {
      return this.plainResult(
        intent,
        renderProductRegistered(producto, currency),
        meta,
      );
    }

    const resultado = await this.financeData.saveProduct(producto);

    return this.plainResult(
      intent,
      resultado.created
        ? renderProductRegistered(producto, currency)
        : renderProductDuplicado(producto),
      meta,
    );
  }

  // -------------------------------------------------------------- resultados

  /** Resultado sin movimientos ni reparto: solo texto. */
  private plainResult(
    intent: MessageIntent,
    replyText: string,
    meta: WhatsAppMessageResult['meta'],
  ): WhatsAppMessageResult {
    return {
      intent,
      transactions: [],
      transaction: null,
      profitDistribution: null,
      payment: null,
      summary: null,
      replyText,
      meta,
    };
  }

  /**
   * El mensaje se entendio a medias: se pregunta y no se guarda nada.
   *
   * Al degradar a "unclear" se limpian los campos del movimiento: dejarlos
   * puestos haria creer que hay un registro a medio hacer.
   */
  private needsClarification(
    intent: MessageIntent,
    pregunta: string,
    meta: WhatsAppMessageResult['meta'],
  ): WhatsAppMessageResult {
    return this.plainResult(
      {
        ...intent,
        type: 'unclear',
        movements: [],
        amount: null,
        category: null,
        discount: null,
        payment: null,
        confirmed: null,
        confirmedCount: null,
        queryKind: null,
        queryPeriod: null,
        // Si no se pudo completar, la interpretacion no puede considerarse
        // buena por mucho que el modelo diga lo contrario.
        confidence: Math.min(intent.confidence, 0.4),
      },
      pregunta,
      meta,
    );
  }

  // ------------------------------------------------------------ validacion

  /**
   * Saneamiento defensivo: aunque el esquema obligue, un modelo puede devolver
   * un tipo raro, un monto negativo o una categoria inventada. Nada de eso
   * debe llegar a la contabilidad del cliente.
   */
  private normalizeIntent(output: WhatsAppIntentOutput): MessageIntent {
    const type = normalizeType(output?.type);
    const movements = normalizeMovements(output?.movements);
    const concept = cleanText(output?.concept);
    const payment = normalizePayment(output?.payment);

    // `amount` y `category` se derivan de los movimientos para que quien solo
    // entiende un movimiento (n8n, el panel) siga leyendo algo coherente.
    const amount = movements.length ? sumAmounts(movements) : null;
    const category = movements.length === 1 ? movements[0].category : null;
    // Con un solo movimiento su concepto es el del mensaje; con varios, no hay
    // uno que represente al conjunto y se deja el que haya dado el modelo.
    const conceptoEfectivo =
      movements.length === 1 ? (movements[0].concept ?? concept) : concept;

    const queryKind =
      type === 'query' ? normalizeQueryKind(output?.queryKind, concept) : null;

    return {
      type,
      movements,
      declaredTotal: normalizeAmount(output?.declaredTotal),
      discount: normalizeAmount(output?.discount),
      profitShares: normalizeProfitShares(output?.profitShares),
      correction: normalizeCorrection(output?.correction),
      payment,
      payroll: normalizePayroll(output?.payroll),
      supplyDebt: normalizeSupplyDebt(output?.supplyDebt),
      product: normalizeProduct(output?.product),
      stock: normalizeStockDraft(output?.stock),
      confirmed: normalizeConfirmed(output?.confirmed),
      confirmedCount: normalizePosition(output?.confirmedCount),
      amount,
      category,
      concept: conceptoEfectivo,
      responseText:
        cleanText(output?.responseText) ??
        'Recibí tu mensaje, pero no logré interpretarlo. ¿Me lo repites?',
      queryKind,
      // En una correccion o una busqueda el periodo es opcional: acota donde
      // buscar ("el transporte de la semana pasada") y, si no viene, se busca
      // en la ventana amplia de siempre. Por eso aqui no se le pone "month"
      // por defecto, que convertiria "¿que dia compre jabones?" en "este mes".
      // En la correccion es tambien lo que dice que borrar con "borra todo lo
      // de esta semana"; antes se descartaba y ese borrado caia en "hoy".
      queryPeriod:
        type === 'correction' || queryKind === 'search'
          ? periodoValido(output?.queryPeriod)
          : type === 'query' || type === 'profit_share'
            ? normalizePeriod(output?.queryPeriod)
            : null,
      confidence: normalizeConfidence(output?.confidence, {
        type,
        amount,
        concept: conceptoEfectivo,
        hasPayment: payment !== null,
      }),
    };
  }

  /**
   * Convierte los movimientos entendidos por el modelo en filas listas para
   * guardar.
   *
   * Cuando hay mas de uno comparten `groupId`: asi el panel puede mostrarlos
   * juntos y se sabe que salieron del mismo mensaje.
   */
  private buildTransactions(
    movements: MovementDraft[],
    request: WhatsAppMessageRequest,
    currency: string,
    referenceDate: string,
    groupId?: string,
    discount?: number | null,
  ): Transaction[] {
    const grupo = groupId ?? (movements.length > 1 ? randomUUID() : null);
    const createdAt = new Date().toISOString();
    const netos = repartirDescuento(movements, discount ?? null);

    return movements.map((movement, indice) => ({
      id: randomUUID(),
      businessId: request.businessId,
      // La fecha que dijo el usuario manda; si no dijo ninguna, es hoy.
      date: movement.date ?? referenceDate,
      // Cuando no dijo fecha, la hora del mensaje SI es un dato real y se
      // guarda. Cuando la dijo, no hay hora: el adaptador usa el mediodia para
      // que el movimiento no se corra de dia en ninguna zona horaria.
      occurredAt: movement.date ? null : createdAt,
      description: describirMovimiento(movement),
      category: movement.category,
      amount: netos[indice],
      type: movement.type,
      currency,
      source: 'whatsapp',
      createdAt,
      paymentMethod: movement.paymentMethod,
      isCredit: movement.isCredit,
      customerName: movement.customerName,
      dueDate: movement.dueDate,
      /*
       * El enganche con el inventario solo existe en los planes pagos.
       *
       * Sin esto, un tendero del plan gratuito que dijera "vendi 2 gaseosas"
       * acababa contra `resolveProducts`, que exige que el producto este dado
       * de alta en el catalogo, y su venta se perdia. El inventario llego
       * despues; su forma de registrar no puede romperse por eso.
       *
       * La descripcion SI conserva lo que vendio ("Venta de gaseosas"): se
       * pierde el enganche con el catalogo, no el dato.
       */
      productName: request.planIsFree ? null : movement.productName,
      quantity: request.planIsFree ? null : movement.quantity,
      supplierName: movement.supplierName,
      supplierCreditDays: movement.supplierCreditDays,
      isSupplierCredit: movement.isSupplierCredit,
      groupId: grupo,
    }));
  }

  // -------------------------------------------------------------- consultas

  /**
   * Movimientos cuyo texto coincide con lo que pregunto el usuario.
   *
   * La ventana es amplia a proposito: quien pregunta "¿que dia compre jabones?"
   * no esta pensando en un periodo, esta buscando un hecho, y suele haber pasado
   * hace semanas. Se compara sin tildes ni mayusculas para que "jabon" encuentre
   * "Jabones".
   */
  private async searchTransactions(
    businessId: string,
    termino: string,
    diaInicioPeriodo: number,
    periodo: QueryPeriod | null,
  ): Promise<Transaction[]> {
    const { from, to } = rangoDeBusqueda(periodo, new Date(), diaInicioPeriodo);

    const rows = await this.financeData.listTransactions({
      businessId,
      from,
      to,
      limit: 1_000,
    });

    const buscado = normalizeText(termino);
    if (!buscado) return [];

    // Se devuelven TODAS las que coinciden y el renderizador recorta la
    // lista: "¿cuanto gaste en transporte?" pide el total, y sumar solo las
    // que caben en el mensaje daba una cifra menor a la real.
    return rows.filter((row) =>
      normalizeText(row.description).includes(buscado),
    );
  }

  /**
   * La cartera completa: quien debe, cuanto y desde cuando.
   *
   * El corte por plan se hace aqui y no solo en el prompt: que el modelo
   * clasifique bien es deseable, pero no es una garantia, y de esto depende
   * que una funcion de pago no se regale. Degradar a "premium" hace que
   * WhatsappInterpretService ponga el mensaje comercial de siempre, con sus
   * precios y su enlace.
   */
  private async handleReceivables(
    intent: MessageIntent,
    request: WhatsAppMessageRequest,
    currency: string,
    meta: WhatsAppMessageResult['meta'],
  ): Promise<WhatsAppMessageResult> {
    if (request.planIsFree) {
      return this.plainResult(
        { ...intent, type: 'premium' },
        'El reporte de fiados está disponible en los planes pagos.',
        meta,
      );
    }

    const cartera = await this.financeData.listReceivables(request.businessId);

    return {
      ...this.plainResult(intent, '', meta),
      replyText: renderReceivables(cartera, currency),
    };
  }

  private async buildSummary(
    businessId: string,
    period: QueryPeriod,
    currency: string,
    diaInicioPeriodo: number,
  ): Promise<PeriodSummary> {
    const { from, to } = periodRange(period, new Date(), diaInicioPeriodo);

    const rows = await this.financeData.listTransactions({
      businessId,
      from,
      to,
      limit: 1_000,
    });

    const totals = { income: 0, expense: 0, investment: 0 };
    // Una venta fiada NO es caja: se cuenta aparte y no toca los ingresos ni
    // el balance. El dueno necesita saber cuanto tiene, no cuanto vendio.
    let pendingCollection = 0;
    const byCategory = new Map<string, PeriodSummary['byCategory'][number]>();
    const byPaymentMethod: PeriodSummary['byPaymentMethod'] = {};
    let unspecifiedIncome = 0;

    for (const row of rows) {
      if (row.isCredit) {
        // El SALDO, no lo vendido: lo que el cliente ya abono dejo de ser una
        // cuenta por cobrar y entro a los ingresos por su lado, como abono.
        pendingCollection += row.pendingAmount ?? row.amount;
        // Tampoco entra en el desglose por categoria: si entrara, las
        // categorias no sumarian los ingresos y el resumen se contradiria.
        continue;
      }

      totals[row.type] += row.amount;

      if (row.type === 'income' && row.paymentMethod) {
        byPaymentMethod[row.paymentMethod] =
          (byPaymentMethod[row.paymentMethod] ?? 0) + row.amount;
      } else if (row.type === 'income') {
        unspecifiedIncome += row.amount;
      }

      const key = `${row.type}:${row.category}`;
      const bucket = byCategory.get(key) ?? {
        category: row.category,
        type: row.type,
        total: 0,
      };
      bucket.total += row.amount;
      byCategory.set(key, bucket);
    }

    return {
      period,
      from,
      to,
      currency,
      income: totals.income,
      expense: totals.expense,
      investment: totals.investment,
      balance: totals.income - totals.expense - totals.investment,
      pendingCollection,
      transactionCount: rows.length,
      byCategory: [...byCategory.values()].sort((a, b) => b.total - a.total),
      byPaymentMethod,
      unspecifiedIncome,
    };
  }
}

// ------------------------------------------------------------------ helpers

/**
 * Tipos aceptados en tiempo de ejecucion.
 *
 * Tiene que incluir todos los de `MessageIntentType`: lo que no este aqui se
 * degrada a "unclear" aunque el modelo lo haya devuelto bien.
 */
const INTENT_TYPES: MessageIntentType[] = [
  'income',
  'expense',
  'investment',
  'breakdown',
  'profit_share',
  'payroll',
  'supply_debt',
  'product',
  'stock',
  'query',
  'correction',
  'unclear',
  'out_of_scope',
  'premium',
  'payment',
  'confirmation',
];

const TRANSACTION_TYPES: TransactionType[] = [
  'income',
  'expense',
  'investment',
];

function normalizeType(value: unknown): MessageIntentType {
  return typeof value === 'string' && (INTENT_TYPES as string[]).includes(value)
    ? (value as MessageIntentType)
    : 'unclear';
}

function normalizeAmount(value: unknown): number | null {
  const amount = Math.abs(Number(value));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return round2(amount);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Suma los montos de una lista de movimientos, sin errores de coma flotante. */
function sumAmounts(movements: { amount: number }[]): number {
  return round2(movements.reduce((total, row) => total + row.amount, 0));
}

/**
 * Valida los movimientos que devolvio el modelo.
 *
 * Se descartan los que no tienen un monto usable en vez de inventarlo, y se
 * corrige la categoria cuando no corresponde al tipo (un gasto no puede ser
 * "ventas": desalinearia los reportes).
 */
/**
 * Fecha declarada por el usuario, saneada.
 *
 * Se rechaza lo que no sea una fecha real en formato YYYY-MM-DD, lo que quede
 * en el futuro (nadie registra una venta que no ha ocurrido, y un ano mal
 * tecleado mandaria el movimiento a 2027) y lo anterior a dos anos, que a esta
 * altura es siempre un error de interpretacion. En cualquiera de esos casos se
 * devuelve null y el movimiento queda con la fecha de hoy.
 */
function normalizeMovementDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const texto = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;

  const fecha = new Date(`${texto}T12:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  // "2026-02-31" pasa el regex pero se desborda a marzo: se compara de vuelta.
  if (fecha.toISOString().slice(0, 10) !== texto) return null;

  const hoy = new Date();
  if (fecha.getTime() > hoy.getTime() + DIA_MS) return null;

  const haceDosAnios = new Date(hoy);
  haceDosAnios.setFullYear(haceDosAnios.getFullYear() - 2);
  if (fecha.getTime() < haceDosAnios.getTime()) return null;

  return texto;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Mas alla de esto no es un fiado, es otra cosa: se descarta y se repregunta. */
const MAX_DIAS_DE_PLAZO = 366;

/**
 * Fecha maxima de pago de un fiado.
 *
 * Es el espejo de `normalizeMovementDate`: aquella rechaza el futuro porque
 * nadie registra lo que no ha pasado; esta rechaza el pasado porque un plazo
 * que ya vencio no es un plazo. Devolver null no pierde nada: el servicio lo
 * lee como "no la dijo" y se la vuelve a preguntar, que es mejor que guardar
 * una fecha que el modelo resolvio mal.
 */
function normalizeDueDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const texto = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;

  const fecha = new Date(`${texto}T12:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  // "2026-11-31" pasa el regex pero se desborda a diciembre.
  if (fecha.toISOString().slice(0, 10) !== texto) return null;

  // Se compara contra el dia colombiano, no contra el del contenedor: a las
  // 8 p.m. en Colombia ya es manana en UTC, y "me paga manana" se habria
  // leido como una fecha de hoy.
  if (texto <= todayIso()) return null;
  if (texto > sumarDias(todayIso(), MAX_DIAS_DE_PLAZO)) return null;

  return texto;
}

function normalizeMovements(value: unknown): MovementDraft[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw): MovementDraft | null => {
      const row = (raw ?? {}) as Record<string, unknown>;
      const amount = normalizeAmount(row.amount);
      if (amount === null) return null;

      const type = normalizeMovementType(row.type);

      return {
        type,
        amount,
        category: normalizeCategory(row.category, type),
        concept: cleanText(row.concept),
        productName: cleanText(row.productName),
        supplierName: cleanText(row.supplierName),
        supplierCreditDays: normalizeQuantity(row.supplierCreditDays),
        isSupplierCredit: row.isSupplierCredit === true,
        paymentMethod: normalizePaymentMethod(row.paymentMethod),
        isCredit: row.isCredit === true,
        customerName: cleanText(row.customerName),
        dueDate: normalizeDueDate(row.dueDate),
        quantity: normalizeQuantity(row.quantity),
        date: normalizeMovementDate(row.date),
      };
    })
    .filter((movement): movement is MovementDraft => movement !== null)
    .slice(0, MAX_MOVEMENTS_PER_MESSAGE);
}

// --------------------------------------------------------------------- nomina

/** Los tres datos de una nomina, en el orden en que se preguntan. */
type DatoDeNomina = 'workerName' | 'percentage' | 'amount';

/**
 * Funde lo que ya se sabia con lo que acaba de decir el usuario.
 *
 * Lo nuevo manda, pero solo cuando viene: si el modelo devuelve el porcentaje
 * en null porque este turno el usuario solo dijo el monto, el porcentaje de
 * antes se conserva. Sin esto, cada respuesta borraria la anterior y la
 * conversacion no avanzaria nunca.
 */
function mezclarNomina(
  previo: PayrollDraft | undefined,
  nuevo: PayrollDraft | null,
): PayrollDraft {
  return {
    workerName: nuevo?.workerName ?? previo?.workerName ?? null,
    percentage: nuevo?.percentage ?? previo?.percentage ?? null,
    amount: nuevo?.amount ?? previo?.amount ?? null,
    date: nuevo?.date ?? previo?.date ?? null,
  };
}

/** El primer dato que falta, o null si ya esta completa. */
function primerDatoQueFalta(draft: PayrollDraft): DatoDeNomina | null {
  if (!draft.workerName) return 'workerName';
  if (draft.percentage === null) return 'percentage';
  if (draft.amount === null) return 'amount';
  return null;
}

/**
 * La pregunta por el dato que falta.
 *
 * Nombra al trabajador en cuanto se sabe quien es: "¿Qué porcentaje?" a secas,
 * tres mensajes despues de haberlo dicho, obliga al usuario a acordarse de
 * que estaba haciendo.
 */
function preguntaDeNomina(falta: DatoDeNomina, draft: PayrollDraft): string {
  if (falta === 'workerName') {
    return '¿A quién le vas a pagar? Dime el nombre del trabajador.';
  }

  const quien = draft.workerName ?? 'esta persona';

  if (falta === 'percentage') {
    return `¿Qué porcentaje le corresponde a ${quien}? Dímelo en números, por ejemplo 40%.`;
  }

  return `¿Cuánto le vas a pagar a ${quien} en total?`;
}

/**
 * El resumen que se le ensena antes de guardar.
 *
 * Lleva los tres datos juntos aunque los haya dicho de a uno: es la unica
 * oportunidad de ver si lo que entendio Luka es lo que el acordo.
 */
export function renderPayrollSummary(
  draft: PayrollDraft,
  currency: string,
  referenceDate: string,
): string {
  const fecha = FECHA_CORTA.format(
    new Date(`${draft.date ?? referenceDate}T12:00:00.000Z`),
  );

  return [
    'Voy a registrar este pago de nómina:',
    `• Trabajador: ${draft.workerName}`,
    `• Porcentaje: ${formatPercentage(draft.percentage ?? 0)}`,
    `• Monto: ${formatMoney(draft.amount ?? 0, currency)}`,
    `• Fecha: ${fecha}`,
    '',
    '¿Lo registro así? Responde sí o no.',
  ].join('\n');
}

/** Confirmacion de la nomina ya guardada. */
export function renderPayrollRegistered(
  pago: PayrollPayment,
  currency: string,
): string {
  const fecha = FECHA_CORTA.format(new Date(`${pago.date}T12:00:00.000Z`));

  return [
    `✅ Registré el pago de nómina de ${pago.workerName}:`,
    `${formatMoney(pago.amount, currency)} (${formatPercentage(pago.percentage)}) · ${fecha}`,
  ].join('\n');
}

/** "40%" y "12,5%": sin decimales cuando son redondos, que es lo normal. */
function formatPercentage(valor: number): string {
  return `${Number.isInteger(valor) ? valor : valor.toFixed(2).replace('.', ',')}%`;
}

/**
 * El borrador de nomina tal como lo devolvio el modelo.
 *
 * Los tres datos pueden venir sueltos o de a uno: el usuario dice "pagale a
 * Carlos" y el porcentaje llega dos mensajes despues. Lo que no se entienda
 * va en null y el servicio lo pregunta.
 */
function normalizePayroll(value: unknown): PayrollDraft | null {
  if (!value || typeof value !== 'object') return null;

  const crudo = value as Record<string, unknown>;

  return {
    workerName: cleanText(crudo.workerName),
    percentage: normalizePercentage(crudo.percentage),
    amount: normalizeAmount(crudo.amount),
    date: normalizeMovementDate(crudo.date),
  };
}

/**
 * Un porcentaje de 0 a 100.
 *
 * El 0 se descarta junto con lo que no es numero: "le pago el 0%" no es un
 * pago de nomina, es un error de dictado, y preguntar de nuevo cuesta menos
 * que guardar un porcentaje que nadie quiso decir.
 */
function normalizePercentage(value: unknown): number | null {
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero <= 0 || numero > 100) return null;
  return round2(numero);
}

// ------------------------------------------------- suministros a credito

/** Los datos de una deuda, en el orden en que se preguntan. */
type DatoDeDeuda =
  | 'supplierName'
  | 'supply'
  | 'amount'
  | 'dueDate'
  | 'mode'
  | 'installments'
  | 'interestRate';

/**
 * Funde lo que ya se sabia con lo que acaba de decir el usuario.
 *
 * Lo nuevo manda, pero solo cuando viene: el modelo devuelve en null lo que
 * este mensaje no menciona, y eso no puede borrar lo de antes.
 */
function mezclarDeuda(
  previo: SupplyDebtDraft | undefined,
  nuevo: SupplyDebtDraft | null,
): SupplyDebtDraft {
  return {
    supplierName: nuevo?.supplierName ?? previo?.supplierName ?? null,
    supply: nuevo?.supply ?? previo?.supply ?? null,
    amount: nuevo?.amount ?? previo?.amount ?? null,
    dueDate: nuevo?.dueDate ?? previo?.dueDate ?? null,
    mode: nuevo?.mode ?? previo?.mode ?? null,
    installments: nuevo?.installments ?? previo?.installments ?? null,
    interestRate: nuevo?.interestRate ?? previo?.interestRate ?? null,
  };
}

/** El primer dato que falta, o null si la deuda ya se puede guardar. */
function primerDatoDeDeudaQueFalta(
  draft: SupplyDebtDraft,
): DatoDeDeuda | null {
  if (!draft.supplierName) return 'supplierName';
  if (!draft.supply) return 'supply';
  if (draft.amount === null) return 'amount';
  if (!draft.dueDate) return 'dueDate';
  if (!draft.mode) return 'mode';
  // Las cuotas solo se preguntan si va a pagar en cuotas; en el pago unico la
  // pregunta no tiene sentido y seria un turno regalado.
  if (draft.mode === 'cuotas' && draft.installments === null) {
    return 'installments';
  }
  if (draft.interestRate === null) return 'interestRate';
  return null;
}

/** La pregunta por el dato que falta, nombrando lo que ya se sabe. */
function preguntaDeDeuda(falta: DatoDeDeuda, draft: SupplyDebtDraft): string {
  const quien = draft.supplierName ?? 'ese proveedor';

  switch (falta) {
    case 'supplierName':
      return '¿A qué proveedor le quedaste debiendo?';
    case 'supply':
      return `¿Qué le compraste a ${quien}?`;
    case 'amount':
      return `¿Cuánto le quedaste debiendo a ${quien} en total?`;
    case 'dueDate':
      return `¿Para cuándo tienes que pagarle? Puedes decirme "el 30 de noviembre", "en 15 días" o "fin de mes".`;
    case 'mode':
      return '¿Lo vas a pagar de una sola vez o en cuotas?';
    case 'installments':
      return '¿En cuántas cuotas?';
    default:
      return '¿Te cobra interés? Dime el porcentaje mensual, o "sin interés" si no te cobra.';
  }
}

/** El borrador, ya completo, como deuda lista para guardar. */
function aDeudaDeProveedor(
  draft: SupplyDebtDraft,
  businessId: string,
): SupplyDebt {
  const mode = draft.mode ?? 'unico';

  return {
    businessId,
    supplierName: draft.supplierName ?? '',
    supply: draft.supply ?? '',
    amount: draft.amount ?? 0,
    dueDate: draft.dueDate ?? '',
    mode,
    installments: mode === 'cuotas' ? (draft.installments ?? 1) : 1,
    interestRate: draft.interestRate ?? 0,
  };
}

/**
 * El resumen con el plan de cuotas, antes de guardar nada.
 *
 * El plan lo calcula `planDeDeudaProveedor`, el mismo que usa el panel: si
 * aqui se recalculara aparte, WhatsApp y la pantalla acabarian diciendo
 * cifras distintas de la misma deuda.
 */
export function renderSupplyDebtSummary(
  draft: SupplyDebtDraft,
  currency: string,
): string {
  const deuda = aDeudaDeProveedor(draft, '');
  const plan = planDeLaDeuda(deuda);

  const lineas = [
    'Voy a registrar este suministro como pendiente de pago:',
    `• Proveedor: ${deuda.supplierName}`,
    `• Suministro: ${deuda.supply}`,
    `• Monto: ${formatMoney(deuda.amount, currency)}`,
    `• Fecha límite: ${formatearFechaCorta(deuda.dueDate)}`,
    deuda.mode === 'cuotas'
      ? `• Modalidad: ${deuda.installments} cuotas mensuales`
      : '• Modalidad: un solo pago',
    deuda.interestRate > 0
      ? `• Interés: ${formatPercentage(deuda.interestRate)} mensual`
      : '• Interés: sin interés',
  ];

  if (deuda.interestRate > 0) {
    lineas.push(
      `• Total con interés: ${formatMoney(plan.total, currency)} (${formatMoney(plan.interesTotal, currency)} de interés)`,
    );
  }

  if (deuda.mode === 'cuotas') {
    lineas.push('', 'Plan de cuotas:');
    for (const cuota of plan.cuotas) {
      lineas.push(
        `${cuota.numero}) ${formatearFecha(cuota.fechaVencimiento)} · ${formatMoney(cuota.monto, currency)}`,
      );
    }
  }

  lineas.push('', '¿Lo registro así? Responde sí o no.');
  return lineas.join('\n');
}

/** Confirmacion de la deuda ya guardada. */
export function renderSupplyDebtRegistered(
  deuda: SupplyDebt,
  currency: string,
): string {
  const plan = planDeLaDeuda(deuda);
  const cierre =
    deuda.mode === 'cuotas'
      ? `${deuda.installments} cuotas de ${formatMoney(plan.cuotas[0]?.monto ?? 0, currency)}`
      : `un pago de ${formatMoney(plan.total, currency)}`;

  return [
    `✅ Anoté que le debes ${formatMoney(deuda.amount, currency)} a ${deuda.supplierName} por ${deuda.supply}.`,
    `${cierre} · última fecha ${formatearFechaCorta(deuda.dueDate)}`,
  ].join('\n');
}

/** El plan de pagos, calculado por el mismo motor que usa el panel. */
function planDeLaDeuda(deuda: SupplyDebt): PlanDeDeuda {
  return planDeDeudaProveedor({
    montoTotal: deuda.amount,
    fechaLimite: new Date(`${deuda.dueDate}T12:00:00.000Z`),
    modalidad: deuda.mode === 'cuotas' ? 'CUOTAS' : 'UNICO',
    numeroCuotas: deuda.mode === 'cuotas' ? deuda.installments : null,
    aplicaInteres: deuda.interestRate > 0,
    porcentajeInteres: deuda.interestRate,
  });
}

function formatearFechaCorta(fecha: string): string {
  return FECHA_CORTA.format(new Date(`${fecha}T12:00:00.000Z`));
}

function formatearFecha(fecha: Date): string {
  return FECHA_CORTA.format(fecha);
}

/**
 * El borrador de deuda tal como lo devolvio el modelo.
 *
 * Todo puede venir en null: el usuario va contestando de a uno y el servicio
 * pregunta lo que falte.
 */
function normalizeSupplyDebt(value: unknown): SupplyDebtDraft | null {
  if (!value || typeof value !== 'object') return null;

  const crudo = value as Record<string, unknown>;
  const mode = crudo.mode;

  return {
    supplierName: cleanText(crudo.supplierName),
    supply: cleanText(crudo.supply),
    amount: normalizeAmount(crudo.amount),
    dueDate: normalizeSupplyDueDate(crudo.dueDate),
    mode: mode === 'cuotas' || mode === 'unico' ? mode : null,
    installments: normalizeInstallments(crudo.installments),
    interestRate: normalizeInterestRate(crudo.interestRate),
  };
}

/**
 * Fecha limite de pago al proveedor: tiene que ser futura.
 *
 * Es el espejo de `normalizeMovementDate`, que rechaza el futuro porque nadie
 * registra lo que no ha pasado. Aqui se rechaza el pasado: una fecha limite
 * vencida no es un plazo, y el plan de cuotas que saldria de ella nace mal.
 *
 * Separada de `normalizeDueDate`, la de los fiados, porque el tope no es el
 * mismo: un fiado a mas de un año es un error de dictado, pero una deuda con
 * proveedor en cuotas puede pasar de ahi con toda normalidad.
 */
function normalizeSupplyDueDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const texto = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;

  const fecha = new Date(`${texto}T12:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  // "2026-11-31" pasa el regex pero se desborda a diciembre.
  if (fecha.toISOString().slice(0, 10) !== texto) return null;

  // Se compara contra el dia colombiano, no el del contenedor.
  if (texto <= todayIso()) return null;
  if (texto > sumarDias(todayIso(), MAX_DIAS_DE_PLAZO_PROVEEDOR)) return null;

  return texto;
}

/** Mas de tres años no es un plazo de proveedor, es un error de dictado. */
const MAX_DIAS_DE_PLAZO_PROVEEDOR = 1_096;

/** Entre 2 y 60 cuotas. Una sola cuota es un pago unico, no un plan. */
function normalizeInstallments(value: unknown): number | null {
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < 2 || numero > 60) return null;
  return Math.round(numero);
}

/**
 * Interes mensual en porcentaje.
 *
 * El 0 SI es valido y significa "no me cobra interes": es la unica forma de
 * que quien compra sin recargo salga de la pregunta. Lo que se descarta es lo
 * que no es numero o no cabe en un interes mensual.
 */
function normalizeInterestRate(value: unknown): number | null {
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < 0 || numero > 100) return null;
  return round2(numero);
}


// ----------------------------------------------------------------- catalogo

/** Lo obligatorio de un producto, en el orden en que se pregunta. */
type DatoDeProducto = 'name' | 'salePrice' | 'costPrice';

/** Lo que se guarda cuando el usuario no dijo categoria. */
const CATEGORIA_SIN_CLASIFICAR = 'Sin categoría';

/**
 * Funde lo que ya se sabia con lo que acaba de decir el usuario.
 *
 * Lo nuevo manda, pero solo cuando viene: el modelo devuelve en null lo que
 * este mensaje no menciona, y eso no puede borrar lo de antes.
 */
function mezclarProducto(
  previo: ProductDraft | undefined,
  nuevo: ProductDraft | null,
): ProductDraft {
  return {
    name: nuevo?.name ?? previo?.name ?? null,
    salePrice: nuevo?.salePrice ?? previo?.salePrice ?? null,
    costPrice: nuevo?.costPrice ?? previo?.costPrice ?? null,
    category: nuevo?.category ?? previo?.category ?? null,
    stock: nuevo?.stock ?? previo?.stock ?? null,
  };
}

/** El primer dato obligatorio que falta, o null si ya se puede guardar. */
function primerDatoDeProductoQueFalta(
  draft: ProductDraft,
): DatoDeProducto | null {
  if (!draft.name) return 'name';
  if (draft.salePrice === null) return 'salePrice';
  if (draft.costPrice === null) return 'costPrice';
  return null;
}

/** La pregunta por el dato que falta, nombrando el producto si ya se sabe. */
function preguntaDeProducto(
  falta: DatoDeProducto,
  draft: ProductDraft,
): string {
  if (falta === 'name') {
    return '¿Qué producto quieres agregar? Dime el nombre.';
  }

  const que = draft.name ?? 'ese producto';

  if (falta === 'salePrice') {
    return `¿En cuánto vendes ${que}?`;
  }

  return `¿En cuánto te cuesta ${que}? Lo necesito para saber cuánto te deja.`;
}

/** El borrador completo, como producto listo para el catalogo. */
function aProductoDelCatalogo(
  draft: ProductDraft,
  businessId: string,
): ProductRegistration {
  return {
    businessId,
    name: draft.name ?? '',
    salePrice: draft.salePrice ?? 0,
    costPrice: draft.costPrice ?? 0,
    category: draft.category ?? CATEGORIA_SIN_CLASIFICAR,
    stock: draft.stock ?? 0,
  };
}

/**
 * El resumen que se le ensena antes de guardar.
 *
 * Lleva el margen calculado: es el dato por el que se registra un producto, y
 * verlo aqui es lo que permite cazar un precio mal dictado antes de que entre
 * al catalogo y contamine los reportes.
 */
export function renderProductSummary(
  draft: ProductDraft,
  currency: string,
): string {
  const producto = aProductoDelCatalogo(draft, '');
  const margen = round2(producto.salePrice - producto.costPrice);

  const lineas = [
    'Voy a agregar este producto a tu catálogo:',
    `• Producto: ${producto.name}`,
    `• Lo vendes en: ${formatMoney(producto.salePrice, currency)}`,
    `• Te cuesta: ${formatMoney(producto.costPrice, currency)}`,
    `• Te deja: ${formatMoney(margen, currency)} por unidad`,
    `• Categoría: ${producto.category}`,
    `• Stock inicial: ${producto.stock}`,
  ];

  if (margen <= 0) {
    // No se bloquea —hay quien vende a perdida a proposito— pero no puede
    // pasar inadvertido: lo normal es que sea un precio mal dictado.
    lineas.push(
      '',
      '⚠️ Ojo: con esos precios no ganas nada. ¿Están bien?',
    );
  }

  lineas.push('', '¿Lo agrego así? Responde sí o no.');
  return lineas.join('\n');
}

/**
 * El ajuste antes de aplicarlo, de cuanto a cuanto.
 *
 * Dice explicitamente que no se registra ninguna venta ni gasto. Es la duda
 * razonable de quien corrige un conteo —"¿esto me va a descuadrar la plata?"—
 * y dejarla sin responder hace que no se use la funcion.
 */
export function renderStockSummary(
  nombre: string,
  antes: number,
  despues: number,
): string {
  const diferencia = despues - antes;

  const cambio =
    diferencia === 0
      ? 'Queda igual que ahora.'
      : diferencia > 0
        ? `Suben ${diferencia} unidades.`
        : `Bajan ${Math.abs(diferencia)} unidades.`;

  return [
    `Voy a ajustar el inventario de ${nombre}:`,
    `\u2022 Antes: ${antes} unidades`,
    `\u2022 Despu\u00e9s: ${despues} unidades`,
    cambio,
    '',
    'Esto solo corrige el conteo: no registra ninguna venta ni ning\u00fan gasto.',
    '',
    '\u00bfLo ajusto as\u00ed? Responde s\u00ed o no.',
  ].join('\n');
}

/** El ajuste ya aplicado. */
export function renderStockAjustado(
  nombre: string,
  antes: number,
  despues: number,
): string {
  return `\u2705 Listo, ${nombre} queda con ${despues} unidades (antes ten\u00eda ${antes}).`;
}

/** El ajuste a medio armar, contado para el modelo. */
function renderPendingStock(pendiente: PendingStock): string {
  const nombre =
    pendiente.nombreGuardado ?? pendiente.draft.productName ?? 'un producto';

  if (pendiente.stage === 'confirmacion') {
    return `Hay un ajuste de inventario de ${nombre} esperando un s\u00ed o un no.`;
  }

  return pendiente.draft.productName
    ? `Se est\u00e1 ajustando el inventario de ${nombre} y falta saber cu\u00e1ntas unidades quedan.`
    : 'Se est\u00e1 ajustando un inventario y falta saber de qu\u00e9 producto.';
}

/**
 * Las unidades que quedan, tal como las entiende el sistema.
 *
 * El 0 es valido y distinto de null: "se acabaron" es una respuesta. Por eso
 * no vale `normalizeQuantity`, que descarta el cero, ni `Number(null)`, que lo
 * convierte en uno.
 */
function normalizeStockDraft(value: unknown): StockDraft | null {
  if (!value || typeof value !== 'object') return null;

  const crudo = value as Record<string, unknown>;

  return {
    productName: cleanText(crudo.productName),
    units: normalizeStock(crudo.units),
  };
}

/** Confirmacion del producto ya guardado. */
export function renderProductRegistered(
  producto: ProductRegistration,
  currency: string,
): string {
  const margen = round2(producto.salePrice - producto.costPrice);

  return [
    `✅ Agregué ${producto.name} a tu catálogo.`,
    `Lo vendes en ${formatMoney(producto.salePrice, currency)} y te deja ${formatMoney(margen, currency)} por unidad.`,
  ].join('\n');
}

/**
 * Lo que se responde cuando el producto ya estaba.
 *
 * No se crea un segundo: dos productos con el mismo nombre en la misma sede
 * dejan la venta sin saber a cual descontarle el stock. Se dice que ya existe
 * y donde cambiarlo, que es lo accionable.
 */
export function renderProductDuplicado(producto: ProductRegistration): string {
  return [
    `Ya tienes un producto llamado "${producto.name}" en tu catálogo, así que no lo agregué de nuevo.`,
    'Si querías cambiarle el precio, puedes hacerlo desde el panel.',
  ].join('\n');
}

/**
 * El borrador de producto tal como lo devolvio el modelo.
 *
 * Todo puede venir en null: el usuario va contestando de a uno y el servicio
 * pregunta lo que falte.
 */
function normalizeProduct(value: unknown): ProductDraft | null {
  if (!value || typeof value !== 'object') return null;

  const crudo = value as Record<string, unknown>;

  return {
    name: cleanText(crudo.name),
    salePrice: normalizeAmount(crudo.salePrice),
    costPrice: normalizeAmount(crudo.costPrice),
    category: cleanText(crudo.category),
    stock: normalizeStock(crudo.stock),
  };
}

/**
 * Unidades iniciales: un entero de 0 en adelante.
 *
 * El 0 es valido y distinto de null: "no tengo ninguno todavia" es una
 * respuesta, y `normalizeQuantity` no sirve aqui porque descarta el 0.
 */
function normalizeStock(value: unknown): number | null {
  /*
   * "No dijo nada" NO es cero.
   *
   * `Number(null)` es 0, asi que sin esta guarda un `stock: null` del modelo
   * —lo que devuelve en cada turno que no habla de unidades— se convertia en
   * un 0 bien formado. Y como `mezclarProducto` usa `??`, ese 0 PISABA lo que
   * el usuario ya habia dicho: "agrega arroz, tengo 20" y al contestar la
   * siguiente pregunta el stock volvia a 0.
   */
  if (value === null || value === undefined || value === '') return null;

  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return Math.round(numero);
}

/** Unidades: un entero positivo, o nada. */
function normalizeQuantity(value: unknown): number | null {
  const numero = Number(value);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero) : null;
}

/**
 * Reparte el descuento entre los movimientos, en proporcion a lo que pesa cada
 * uno.
 *
 * Lo que salio de la caja es el total pagado, no el subtotal de la factura.
 * Guardar los precios de lista inflaria los gastos del mes por plata que nunca
 * se movio, que es el mismo error que se corrigio con los fiados.
 *
 * El ultimo movimiento absorbe el redondeo para que la suma cuadre al peso: si
 * cada linea se redondeara por su cuenta, el total podria quedar uno o dos
 * pesos lejos del que dijo el usuario.
 */
export function repartirDescuento(
  movements: { amount: number }[],
  discount: number | null,
): number[] {
  const original = movements.map((movimiento) => movimiento.amount);
  if (!discount || discount <= 0 || !movements.length) return original;

  const total = sumAmounts(movements);
  if (total <= 0) return original;

  // Un descuento mayor que la compra no tiene sentido: se ignora y se registra
  // lo que dice la factura, que es mejor que dejar montos en cero.
  if (discount >= total) return original;

  const netos = original.map((monto) =>
    round2(monto - (monto / total) * discount),
  );

  const objetivo = round2(total - discount);
  const diferencia = round2(
    objetivo - sumAmounts(netos.map((amount) => ({ amount }))),
  );
  netos[netos.length - 1] = round2(netos[netos.length - 1] + diferencia);

  return netos;
}

/**
 * El texto con el que se guarda el movimiento.
 *
 * Si se dijeron las unidades, van en la descripcion: "480 u." al lado del
 * producto es lo que permite entender el gasto al releerlo meses despues.
 */
function describirMovimiento(movement: MovementDraft): string {
  const base =
    movement.concept ?? `Movimiento registrado por WhatsApp (${movement.type})`;

  return movement.quantity ? `${base} · ${movement.quantity} u.` : base;
}

function normalizeMovementType(value: unknown): TransactionType {
  return typeof value === 'string' &&
    (TRANSACTION_TYPES as string[]).includes(value)
    ? (value as TransactionType)
    : 'expense';
}

function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase();
  return (
    PAYMENT_METHODS.find((method) => method === candidate) ??
    (candidate ? 'otro' : null)
  );
}

/** Porcentajes del reparto, saneados. Los montos se calculan en el servicio. */
function normalizeProfitShares(value: unknown): ProfitShare[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((raw): ProfitShare | null => {
      const row = (raw ?? {}) as Record<string, unknown>;
      const percentage = Number(row.percentage);
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        return null;
      }

      const beneficiary =
        typeof row.beneficiary === 'string' &&
        (PROFIT_BENEFICIARIES as readonly string[]).includes(row.beneficiary)
          ? (row.beneficiary as ProfitBeneficiary)
          : 'trabajador';

      return {
        beneficiary,
        name: cleanText(row.name),
        percentage: round2(percentage),
        // Provisional: lo reemplaza el servicio con la cifra real.
        amount: 0,
      };
    })
    .filter((share): share is ProfitShare => share !== null);
}

/**
 * Correccion pedida por el usuario, saneada.
 *
 * Se descarta si el modelo no dijo una accion valida: aplicar una correccion a
 * ciegas es peor que preguntar.
 */
function normalizeCorrection(value: unknown): CorrectionRequest | null {
  if (!value || typeof value !== 'object') return null;

  const row = value as Record<string, unknown>;
  const action = row.action === 'delete' ? 'delete' : 'update';

  return {
    action,
    reference: cleanText(row.reference),
    referenceAmount: normalizeAmount(row.referenceAmount),
    referenceDate: normalizeMovementDate(row.referenceDate),
    referenceIndexes: normalizePositions(
      row.referenceIndexes ?? row.referenceIndex,
    ),
    newAmount: normalizeAmount(row.newAmount),
    newConcept: cleanText(row.newConcept),
    deleteAll: row.deleteAll === true,
    matchAll: row.matchAll === true,
  };
}

/** Un si o un no. Cualquier otra cosa es "no contesto". */
function normalizeConfirmed(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/** Posicion en una lista, desde 1. Cualquier otra cosa es null. */
function normalizePosition(value: unknown): number | null {
  const numero = Number(value);
  return Number.isInteger(numero) && numero >= 1 ? numero : null;
}

/**
 * Las posiciones que señalo el usuario, ya limpias y sin repetir.
 *
 * Acepta tambien un numero suelto: un modelo puede devolver `referenceIndex: 2`
 * en vez de la lista, y perder esa respuesta significaria borrar de mas o
 * preguntar otra vez.
 */
function normalizePositions(value: unknown): number[] {
  const crudos = Array.isArray(value) ? value : [value];

  const posiciones = crudos
    .map((posicion) => normalizePosition(posicion))
    .filter((posicion): posicion is number => posicion !== null);

  return [...new Set(posiciones)];
}

/**
 * Con que se busco, en una linea, para el log.
 *
 * Cuando alguien reporta que Luka "no encontro" algo que si existe, esto es lo
 * unico que dice si el problema fue el identificador, la fecha o el texto.
 */
function describirBusqueda(
  correccion: CorrectionRequest,
  periodo: QueryPeriod | null = null,
): string {
  const partes = [
    correccion.reference ? `texto="${correccion.reference}"` : null,
    periodo ? `periodo=${periodo}` : null,
    correccion.referenceAmount !== null
      ? `monto=${correccion.referenceAmount}`
      : null,
    correccion.referenceDate ? `fecha=${correccion.referenceDate}` : null,
    correccion.referenceIndexes.length
      ? `posiciones=${correccion.referenceIndexes.join('+')}`
      : null,
    correccion.matchAll ? 'todos los que coincidan' : null,
  ].filter(Boolean);

  return partes.length ? partes.join(', ') : 'sin identificadores';
}

/** ¿Dijo algo que sirva para saber de cual movimiento habla? */
export function tieneIdentificador(correccion: CorrectionRequest): boolean {
  return (
    correccion.reference !== null ||
    correccion.referenceAmount !== null ||
    correccion.referenceDate !== null ||
    correccion.referenceIndexes.length > 0
  );
}

/**
 * ¿Este movimiento encaja con lo que dijo el usuario?
 *
 * Los identificadores se acumulan: si dio fecha Y monto, tienen que cuadrar
 * los dos. Mas datos siempre reducen la lista, nunca la amplian.
 */
export function coincideConIdentificador(
  row: Transaction,
  correccion: CorrectionRequest,
): boolean {
  if (
    correccion.reference !== null &&
    !normalizeText(row.description).includes(
      normalizeText(correccion.reference),
    )
  ) {
    return false;
  }

  // Tolerancia de un peso: el monto llega del modelo y puede traer decimales.
  if (
    correccion.referenceAmount !== null &&
    Math.abs(row.amount - correccion.referenceAmount) >= 1
  ) {
    return false;
  }

  if (
    correccion.referenceDate !== null &&
    row.date !== correccion.referenceDate
  ) {
    return false;
  }

  return true;
}

/**
 * Cual de los movimientos que Luka mostro eligio el usuario.
 *
 * La posicion se resuelve contra la lista tal como se le enseño, que es como
 * contesta la gente ("la primera", "la de arriba"). El resto de
 * identificadores filtra igual que en una busqueda normal.
 */
export function resolverEntreCandidatos(
  candidatos: Transaction[],
  correccion: CorrectionRequest,
): Transaction[] {
  // "Todos esos" sin mas identificadores: son los de la lista, tal cual.
  if (correccion.matchAll && !tieneIdentificador(correccion)) {
    return candidatos;
  }

  if (correccion.referenceIndexes.length) {
    const elegidos = new Set(
      correccion.referenceIndexes
        .map((posicion) => candidatos[posicion - 1])
        .filter((row): row is Transaction => row !== undefined),
    );

    // En el orden en que se los enseñamos, que es como los vio el usuario.
    return candidatos.filter((row) => elegidos.has(row));
  }

  if (!tieneIdentificador(correccion)) return [];

  return candidatos.filter((row) => coincideConIdentificador(row, correccion));
}

/**
 * Clase de consulta.
 *
 * Si el modelo no la dice pero dejo un termino de busqueda, es una busqueda:
 * un modelo pequeno omite el campo nuevo antes que el que ya conocia.
 */
/**
 * Saneamiento del abono.
 *
 * Sin nombre de cliente no se devuelve nada: el manejador lo trata como un
 * mensaje incompleto y pregunta, que es preferible a aplicarle el pago a
 * quien no era.
 */
function normalizePayment(value: unknown): PaymentDraft | null {
  if (!value || typeof value !== 'object') return null;

  const crudo = value as Record<string, unknown>;
  const customerName = cleanText(crudo.customerName);
  if (!customerName) return null;

  const amount = normalizeAmount(crudo.amount);
  // "Pago todo" tambien se deduce de la ausencia de monto: si el modelo no
  // marco settlesDebt pero tampoco dijo cuanto, saldar la deuda entera es la
  // unica lectura posible del mensaje.
  const settlesDebt = crudo.settlesDebt === true || amount === null;

  return {
    customerName,
    amount: settlesDebt ? null : amount,
    settlesDebt,
    date: normalizeMovementDate(crudo.date),
  };
}

function normalizeQueryKind(value: unknown, concept: string | null): QueryKind {
  if (
    value === 'summary' ||
    value === 'list' ||
    value === 'search' ||
    value === 'receivables'
  ) {
    return value;
  }
  return concept ? 'search' : 'summary';
}

/** Descuadre entre el total declarado y la suma de las partes. */
export interface BreakdownMismatch {
  declared: number;
  sum: number;
  difference: number;
}

/**
 * Comprueba que el desglose sume el total que dijo el usuario.
 *
 * Lo hace el backend y no el prompt a proposito: un modelo de lenguaje no es
 * de fiar sumando, y aqui una suma mal hecha se convierte en contabilidad
 * equivocada. Se tolera un peso de diferencia por los redondeos.
 */
export function checkBreakdown(
  declaredTotal: number | null,
  movements: { amount: number }[],
  discount: number | null = null,
): BreakdownMismatch | null {
  if (declaredTotal === null || movements.length < 2) return null;

  const sum = sumAmounts(movements);
  // El descuento explica la diferencia: sin restarlo, una factura con subtotal
  // 1.920.000, descuento 920.000 y total 1.000.000 se veia como un error de
  // dedo y no se registraba nada.
  const difference = round2(declaredTotal - (sum - (discount ?? 0)));

  return Math.abs(difference) <= BREAKDOWN_TOLERANCE
    ? null
    : { declared: declaredTotal, sum, difference };
}

function normalizeCategory(
  value: unknown,
  type: TransactionType,
): TransactionCategory {
  if (typeof value !== 'string') return DEFAULT_CATEGORY_BY_TYPE[type];

  const candidate = value.trim().toLowerCase();
  const allowed = CATEGORIES_BY_TYPE[type];
  const match = allowed.find((category) => category === candidate);

  // Una categoria de otro tipo (p.ej. "ventas" en un gasto) no se acepta:
  // desalinearia los reportes.
  return match ?? DEFAULT_CATEGORY_BY_TYPE[type];
}

/**
 * Confianza del modelo, saneada.
 *
 * Un modelo pequeno a veces omite el campo, devuelve "0.9" como texto o pone
 * 1.0 en todo. Se acepta el valor solo si es un numero utilizable; si no, se
 * deriva de lo que realmente extrajo: sin monto no hay interpretacion buena.
 */
function normalizeConfidence(
  value: unknown,
  intent: {
    type: MessageIntentType;
    amount: number | null;
    concept: string | null;
    hasPayment: boolean;
  },
): number {
  const reported = Number(value);
  if (Number.isFinite(reported) && reported >= 0 && reported <= 1) {
    return Math.round(reported * 100) / 100;
  }

  if (intent.type === 'unclear') return 0.3;
  // Reconocer que algo NO es del dominio suele ser facil: no es una duda.
  if (intent.type === 'out_of_scope') return 0.9;
  if (intent.type === 'premium') return 0.9;
  if (intent.type === 'query') return 0.85;
  if (intent.type === 'correction') return 0.6;
  // Un abono no lleva monto propio ("Rosa ya me pago" no dice cuanto): lo que
  // lo hace interpretable es saber de quien es el pago, no la cifra.
  if (intent.type === 'payment') return intent.hasPayment ? 0.9 : 0.4;
  if (intent.amount === null) return 0.4;
  return intent.concept ? 0.9 : 0.7;
}

function normalizePeriod(value: unknown): QueryPeriod {
  return periodoValido(value) ?? 'month';
}

/** El periodo si es uno que se sabe calcular; null si no vino o no sirve. */
function periodoValido(value: unknown): QueryPeriod | null {
  if (typeof value !== 'string') return null;
  if (Object.hasOwn(PERIOD_LABELS, value)) return value as QueryPeriod;

  const dias = diasDelPeriodo(value as QueryPeriod);
  return dias !== null && dias >= 1 && dias <= MAX_DIAS_ATRAS
    ? `last_${dias}_days`
    : null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length ? text : null;
}

/**
 * El dia de HOY en Colombia, no en la hora del contenedor.
 *
 * `toISOString()` da la fecha UTC: a las 7 p.m. en Colombia ya es el dia
 * siguiente en UTC, y los movimientos se confirmaban con la fecha de manana
 * aunque quedaran guardados con la de hoy. El resto del modulo ya calculaba
 * sobre el dia colombiano; esta funcion era la ultima que faltaba.
 */
/**
 * Dia de corte del periodo contable de este negocio.
 *
 * Si no viene en la peticion se asume mes calendario, que es lo que hace la
 * mayoria: es mejor un default explicito que arrastrar un `undefined` hasta el
 * calculo del rango.
 */
function diaInicioDe(request: WhatsAppMessageRequest): number {
  return normalizarDiaInicio(request.diaInicioPeriodo);
}

/**
 * Lo que se le manda al modelo como mensaje del usuario.
 *
 * Con audio o foto son dos partes: el texto (el pie de foto, o un marcador) y
 * el archivo. El contrato de IA ya sabia de imagenes; el audio se agrego con la
 * misma forma, y los proveedores que lo soportan lo traducen igual.
 */
function contenidoDelUsuario(
  request: WhatsAppMessageRequest,
): string | LlmContentPart[] {
  if (!request.media) return request.message;

  return [
    { type: 'text', text: request.message },
    {
      type: request.media.kind,
      mimeType: tipoBase(request.media.mimeType),
      dataBase64: request.media.dataBase64,
    },
  ];
}

/**
 * El tipo MIME sin sus parametros: "audio/ogg; codecs=opus" -> "audio/ogg".
 *
 * Los proveedores esperan el tipo pelado, y Meta manda las notas de voz con el
 * codec pegado.
 */
function tipoBase(mimeType: string): string {
  return mimeType.split(';')[0].trim();
}

function todayIso(): string {
  return fechaColombiana(new Date());
}

/**
 * Rango de fechas real de un periodo, en dias colombianos, ambos inclusive.
 *
 * Se arma siempre restando dias a la fecha de hoy, nunca fijando el mes o el
 * año: asi "la semana pasada" del 4 de noviembre va del 26 de octubre al 1 de
 * noviembre, y la del 3 de enero arranca en diciembre del año anterior.
 */
export function periodRange(
  period: QueryPeriod,
  now: Date = new Date(),
  diaInicioPeriodo: number = DIA_INICIO_POR_DEFECTO,
): { from: string; to: string } {
  // Todo se calcula sobre el dia colombiano, no sobre la hora del contenedor:
  // asi el periodo es el mismo corra donde corra el proceso.
  const { fecha: hoy, diaDeLaSemana } = partesDelDia(now);
  // 0 = domingo. La semana laboral arranca el lunes.
  const lunes = sumarDias(hoy, -(diaDeLaSemana === 0 ? 6 : diaDeLaSemana - 1));

  const dias = diasDelPeriodo(period);
  if (dias !== null) return { from: sumarDias(hoy, -(dias - 1)), to: hoy };

  switch (period) {
    case 'day':
      return { from: hoy, to: hoy };
    case 'yesterday': {
      const ayer = sumarDias(hoy, -1);
      return { from: ayer, to: ayer };
    }
    case 'week':
      return { from: lunes, to: hoy };
    case 'last_week':
      // Lunes a domingo completos de la semana anterior.
      return { from: sumarDias(lunes, -7), to: sumarDias(lunes, -1) };
    case 'last_month': {
      // El periodo contable anterior completo: el que termina el dia antes de
      // que arranque el actual. Con corte el 21 es del 21 al 20, no del 1 al 30.
      const actual = periodoContableDe(hoy, diaInicioPeriodo);
      const anterior = periodoContableDe(
        sumarDias(actual.desde, -1),
        diaInicioPeriodo,
      );
      return { from: anterior.desde, to: anterior.hasta };
    }
    default: {
      // "Este mes" es el periodo contable del negocio, que no siempre arranca
      // el 1.
      const periodo = periodoContableDe(hoy, diaInicioPeriodo);
      return { from: periodo.desde, to: hoy };
    }
  }
}

/** Tope de "ultimos N dias": un año cubre cualquier pregunta razonable. */
const MAX_DIAS_ATRAS = 366;

/** N de "last_N_days", o null si el periodo no es de ese tipo. */
function diasDelPeriodo(period: QueryPeriod): number | null {
  const encontrado = /^last_(\d+)_days$/.exec(period);
  return encontrado ? Number(encontrado[1]) : null;
}

type PeriodoConNombre = Exclude<QueryPeriod, `last_${number}_days`>;

const PERIOD_LABELS: Record<PeriodoConNombre, string> = {
  day: 'hoy',
  yesterday: 'ayer',
  week: 'esta semana',
  last_week: 'la semana pasada',
  month: 'este mes',
  last_month: 'el mes pasado',
};

/** Como se nombra el periodo en una frase: "tus movimientos de ayer". */
function etiquetaPeriodo(period: QueryPeriod): string {
  const dias = diasDelPeriodo(period);
  return dias !== null
    ? `en los últimos ${dias} días`
    : PERIOD_LABELS[period as PeriodoConNombre];
}

/** El periodo como complemento del titulo: "Resumen del mes pasado". */
function tituloPeriodo(period: QueryPeriod): string {
  const dias = diasDelPeriodo(period);
  if (dias !== null) return `de los últimos ${dias} días`;

  const etiqueta = PERIOD_LABELS[period as PeriodoConNombre];
  return etiqueta.startsWith('el ')
    ? `del ${etiqueta.slice(3)}`
    : `de ${etiqueta}`;
}

/**
 * Arma la respuesta de una consulta con cifras reales.
 *
 * El modelo solo dice "dame un momento": los numeros los pone el backend, que
 * es la unica fuente confiable. Texto plano y sin markdown, es para WhatsApp.
 */
export function renderSummary(summary: PeriodSummary): string {
  const money = (value: number) => formatMoney(value, summary.currency);

  if (summary.transactionCount === 0) {
    return `Todavía no tienes movimientos registrados ${etiquetaPeriodo(summary.period)}.`;
  }

  const lines = [
    `📊 Resumen ${tituloPeriodo(summary.period)}:`,
    `Ingresos: ${money(summary.income)}`,
    `Gastos: ${money(summary.expense)}`,
  ];

  if (summary.investment > 0) {
    lines.push(`Inversiones: ${money(summary.investment)}`);
  }

  // Va aparte y despues del balance, para que quede claro que es plata que
  // todavia no entro y no forma parte de los ingresos de arriba. Es el saldo
  // vivo: lo que ya te abonaron dejo de estar aqui y esta en "Ingresos".
  if (summary.pendingCollection > 0) {
    lines.push(
      `Aparte, te deben ${money(summary.pendingCollection)} de ventas fiadas.`,
    );
  }

  const paymentLines = PAYMENT_METHODS.filter(
    (method) => (summary.byPaymentMethod?.[method] ?? 0) > 0,
  ).map(
    (method) =>
      `${PAYMENT_METHOD_LABELS[method]}: ${money(summary.byPaymentMethod?.[method] ?? 0)}`,
  );

  if (paymentLines.length > 0) {
    lines.push('Ingresos por forma de pago:', ...paymentLines);
  }

  if (summary.unspecifiedIncome > 0) {
    if (paymentLines.length === 0) lines.push('Ingresos por forma de pago:');
    lines.push(`Sin especificar: ${money(summary.unspecifiedIncome)}`);
  }

  lines.push(
    `Balance: ${money(summary.balance)}`,
    `(${summary.transactionCount} movimientos entre ${summary.from} y ${summary.to})`,
  );

  const topExpense = summary.byCategory.find((row) => row.type === 'expense');
  if (topExpense) {
    lines.push(
      `Tu mayor gasto fue ${CATEGORY_LABELS[topExpense.category]}: ${money(topExpense.total)}.`,
    );
  }

  // El resumen y el listado quedan conectados: quien ve el conteo sabe que
  // puede pedir el detalle, y el modelo tiene la pista para clasificar la
  // respuesta como queryKind "list".
  lines.push(
    'Escríbeme "muéstrame los movimientos" si quieres verlos uno por uno.',
  );

  return lines.join('\n');
}

function formatMoney(value: number, currency: string): string {
  // Formato colombiano (punto para miles). Ajustar si se opera en otro pais.
  return `$${Math.round(value).toLocaleString('es-CO')} ${currency}`;
}

function isAdvancedAnalysisRequest(message: string): boolean {
  const normalized = message
    .toLocaleLowerCase('es-CO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return [
    'recomend',
    'margen',
    'rentabilidad',
    'rentable',
    'ranking',
    'rankings',
    'producto que mas',
    'en que estoy gastando de mas',
    'analiza',
    'analisis',
  ].some((keyword) => normalized.includes(keyword));
}

/** Ventana de busqueda hacia atras. Cuatro meses cubre lo que la gente recuerda. */
/**
 * Tope de movimientos por mensaje. Nadie dicta veinte gastos de una sentada;
 * pasado ese punto es mas probable que el modelo se haya descarrilado.
 */
const MAX_MOVEMENTS_PER_MESSAGE = 15;

/** Diferencia que se acepta entre el total declarado y la suma de las partes. */
const BREAKDOWN_TOLERANCE = 1;

/**
 * Cuanto se mira hacia atras para encontrar el total que un desglose detalla.
 * Dos dias cubren el "ayer se me olvido decirte como me pagaron".
 */
const BREAKDOWN_WINDOW_DAYS = 2;

/** Cuantos movimientos caben comodos en un mensaje de WhatsApp. */
const LIST_MAX_RESULTS = 20;

/**
 * Cuanto se mira hacia atras para encontrar el movimiento a corregir cuando
 * el usuario no dice de cuando es. Con fecha o periodo se busca ahi, sea de
 * hace una semana o de hace tres meses.
 */
const CORRECTION_WINDOW_DAYS = 31;

/**
 * Donde buscar el movimiento a corregir.
 *
 * Lo mas concreto manda: una fecha exacta ("el del 28 de octubre") se busca
 * en ese dia aunque quede fuera de la ventana; un periodo ("el de la semana
 * pasada") en su rango; y sin ninguno de los dos, los ultimos 31 dias. Antes
 * siempre era la ventana, asi que una fecha de hace mas de un mes nunca se
 * encontraba.
 */
export function rangoParaCorregir(
  correccion: CorrectionRequest,
  periodo: QueryPeriod | null,
  now: Date = new Date(),
  diaInicioPeriodo: number = DIA_INICIO_POR_DEFECTO,
): { from: string; to: string } {
  if (correccion.referenceDate) {
    return { from: correccion.referenceDate, to: correccion.referenceDate };
  }

  if (periodo) return periodRange(periodo, now, diaInicioPeriodo);

  const hoy = fechaColombiana(now);
  return { from: sumarDias(hoy, -CORRECTION_WINDOW_DAYS), to: hoy };
}

/** Mas candidatos que esto no se listan: la pregunta se vuelve ilegible. */
/**
 * Cuantos movimientos se enumeran antes de pedir confirmacion de un borrado
 * masivo. Una lista de cincuenta lineas en WhatsApp no la lee nadie; se
 * muestran los primeros y se dice cuantos faltan.
 */
const DELETE_PREVIEW_MAX = 10;

/** Tope de un borrado por grupo. Mas que esto es un "borra todo el dia". */
const MAX_MOVEMENTS_PER_DELETE = 50;

/**
 * Cuanto hacia atras se buscan los movimientos de un mensaje citado.
 *
 * Ancho a proposito: se buscan ids exactos, no coincidencias, asi que no hay
 * riesgo de traer de mas, y un mensaje se puede citar meses despues.
 */
const QUOTED_WINDOW_DAYS = 400;

const CORRECTION_MAX_CANDIDATES = 5;

const SEARCH_WINDOW_DAYS = 120;

/**
 * Donde se busca por concepto.
 *
 * Con periodo ("¿cuanto gaste en transporte la semana pasada?"), en ese rango
 * aunque cruce de mes. Sin el, la ventana amplia: quien pregunta "¿que dia
 * compre jabones?" busca un hecho, no un periodo, y suele ser de hace semanas.
 */
export function rangoDeBusqueda(
  periodo: QueryPeriod | null,
  now: Date = new Date(),
  diaInicioPeriodo: number = DIA_INICIO_POR_DEFECTO,
): { from: string; to: string } {
  if (periodo) return periodRange(periodo, now, diaInicioPeriodo);

  const { from, to } = periodRange('month', now, diaInicioPeriodo);
  return { from: sumarDias(from, -SEARCH_WINDOW_DAYS), to };
}
/** Mas de esto no se lee comodo en un WhatsApp. */
const SEARCH_MAX_RESULTS = 8;

/** Sin tildes y en minusculas: "Jabón" y "jabones" deben cruzarse. */
function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
});

/**
 * Respuesta a una busqueda concreta.
 *
 * Se listan los movimientos con su fecha, que es justo lo que se pregunta
 * ("¿que dia fue?"), y el total, que es lo que se pregunta despues.
 */
/**
 * La cartera, cliente por cliente.
 *
 * Lo que le sirve al dueno no es un total: es a quien llamar. Por eso cada
 * linea lleva nombre, saldo, lo ya abonado y desde cuando, y la lista viene
 * ordenada con la deuda mas vieja primero.
 */
export function renderReceivables(
  cartera: Receivable[],
  currency: string,
): string {
  const money = (value: number) => formatMoney(value, currency);

  if (!cartera.length) {
    return 'Nadie te debe nada ahora mismo 🎉 Todos tus fiados están cobrados.';
  }

  const lineas = cartera.map((cliente) => {
    const partes = [
      `• ${cliente.customerName}: te debe ${money(cliente.pending)}`,
    ];

    if (cliente.paid > 0) {
      partes.push(
        `ya te abonó ${money(cliente.paid)} de ${money(cliente.total)}`,
      );
    }

    partes.push(
      cliente.daysOutstanding === 0
        ? 'fiado hoy'
        : `hace ${cliente.daysOutstanding} días`,
    );

    if (cliente.daysSinceLastPayment !== null) {
      partes.push(
        cliente.daysSinceLastPayment === 0
          ? 'te abonó hoy'
          : `último abono hace ${cliente.daysSinceLastPayment} días`,
      );
    } else {
      partes.push('no ha abonado nada');
    }

    return partes.join(' · ');
  });

  const total = cartera.reduce((suma, cliente) => suma + cliente.pending, 0);

  return [
    `💰 Te deben ${money(total)} en total:`,
    ...lineas,
    '',
    'Empieza por los de arriba: son los que llevan más tiempo debiendo.',
  ].join('\n');
}

export function renderSearch(
  termino: string,
  encontrados: Transaction[],
  currency: string,
  periodo: QueryPeriod | null = null,
): string {
  const cuando = periodo ? etiquetaPeriodo(periodo) : 'en los últimos 4 meses';

  if (encontrados.length === 0) {
    return `No encontré movimientos que mencionen "${termino}" ${cuando}. Si lo registraste con otro nombre, dime cuál y lo busco.`;
  }

  // El total es de todas las que coinciden, no solo de las que se muestran.
  const total = encontrados.reduce((suma, row) => suma + row.amount, 0);
  const mostrados = encontrados.slice(0, SEARCH_MAX_RESULTS);
  const lineas = mostrados.map((row) => {
    const signo = row.type === 'income' ? '+' : '-';
    const fecha = FECHA_CORTA.format(new Date(`${row.date}T12:00:00.000Z`));
    return `• ${fecha} · ${row.description} · ${signo}${formatMoney(row.amount, currency)}`;
  });

  const enElPeriodo = periodo ? ` ${cuando}` : '';
  const encabezado =
    encontrados.length === 1
      ? `🔎 Encontré 1 movimiento con "${termino}"${enElPeriodo}:`
      : `🔎 Encontré ${encontrados.length} movimientos con "${termino}"${enElPeriodo}:`;

  const resto =
    encontrados.length > mostrados.length
      ? [`...y ${encontrados.length - mostrados.length} más.`]
      : [];

  return [
    encabezado,
    ...lineas,
    ...resto,
    `Total: ${formatMoney(total, currency)}`,
  ].join('\n');
}

// ----------------------------------------------- respuestas de correcciones

/**
 * Confirmacion de una correccion.
 *
 * Se dicen el valor viejo y el nuevo: el usuario esta corrigiendo justamente
 * porque una cifra estaba mal, y necesita ver que ahora quedo la que queria.
 */
/**
 * Como quedo la deuda despues de un abono.
 *
 * El dato que el dueno quiere no es "registrado": es cuanto le siguen
 * debiendo. Por eso lo escribe el backend y no el modelo, que no lo sabe.
 */
export function renderPayment(
  resultado: PaymentResult,
  currency: string,
): string {
  const money = (value: number) => formatMoney(value, currency);

  if (!resultado.applied) {
    return resultado.reason === 'sin_deuda'
      ? `${resultado.customerName} no tiene fiados pendientes: ya está al día. ¿Era otro cliente?`
      : `No encontré ningún fiado a nombre de ${resultado.customerName}. ¿Me confirmas cómo se llama en tus registros?`;
  }

  const lines: string[] = [];

  if (resultado.remaining === 0) {
    lines.push(
      `🎉 ${resultado.customerName} quedó al día. Registré ${money(resultado.amount)} y ya no te debe nada.`,
    );
  } else {
    lines.push(
      `✅ Registré el abono de ${money(resultado.amount)} de ${resultado.customerName}.`,
      `Le quedan ${money(resultado.remaining)} por pagarte.`,
    );
  }

  // Cobrar de mas dejaria la deuda en negativo, asi que se recorta. Callarlo
  // haria que el dueno creyera que registro una cifra que no registro.
  if (resultado.excess > 0) {
    lines.push(
      `Ojo: solo te debía ${money(resultado.amount)}, así que los ${money(resultado.excess)} de más no los registré.`,
    );
  }

  return lines.join('\n');
}

export function renderCorrected(
  antes: Transaction,
  despues: Transaction,
  currency: string,
): string {
  const lineas = [`✅ Corregido: ${despues.description}`];

  if (antes.amount !== despues.amount) {
    lineas.push(
      `Monto: ${formatMoney(antes.amount, currency)} → ${formatMoney(despues.amount, currency)}`,
    );
  }
  if (antes.description !== despues.description) {
    lineas.push(`Concepto: "${antes.description}" → "${despues.description}"`);
  }

  lineas.push('Ya quedó actualizado también en tu panel.');
  return lineas.join('\n');
}

/** Confirmacion de un movimiento eliminado. */
export function renderDeleted(
  movimiento: Transaction,
  currency: string,
): string {
  return [
    `🗑️ Eliminé el movimiento: ${movimiento.description} · ${formatMoney(movimiento.amount, currency)}`,
    'Ya no aparece en tu panel.',
  ].join('\n');
}

/**
 * Varios movimientos coinciden con lo que dijo el usuario.
 *
 * Se listan con su fecha y monto para que pueda distinguirlos. Elegir uno por
 * el seria peor: corregir el movimiento equivocado deja el error escondido.
 */
export function renderAmbiguousCorrection(
  candidatos: Transaction[],
  currency: string,
): string {
  // Numerada, no con vinetas: la gente contesta "la primera", y sin numeros esa
  // respuesta no se puede resolver contra nada.
  const lineas = candidatos.map((row, indice) =>
    movementLine(row, currency, `${indice + 1})`),
  );

  return [
    `Encontré ${candidatos.length} movimientos que podrían ser:`,
    ...lineas,
    '¿Cuál de todos corrijo? Dime el número, la fecha o el monto.',
  ].join('\n');
}

/**
 * Lo que se le dice al usuario cuando su identificador no encontro nada.
 *
 * Repite lo que el dijo, no un campo interno: "no encontre ninguno del 3 de
 * septiembre" se entiende; 'no encontre ningun movimiento que mencione
 * "2026-09-03"' parece un error del sistema.
 */
/**
 * El mensaje citado, redactado para el modelo (no para el usuario).
 *
 * Se dice de quien era y de cuando: "pero esto es lo que me dijiste" solo se
 * entiende sabiendo cual de las cosas que dijo Luka es, y un mensaje propio de
 * hace semanas necesita su fecha para ubicarse.
 */
/**
 * Lo que se va a borrar, antes de borrarlo.
 *
 * Se enumeran los movimientos con su fecha, concepto y monto: un "¿seguro?"
 * sin decir sobre que no es una confirmacion. Y borrar no se deshace.
 */
/**
 * Lo que Luka entendio de un audio o una foto, antes de guardarlo.
 *
 * En texto escrito el usuario ve lo que escribio y puede releerlo; de un audio
 * no queda nada que revisar. Ensenar la interpretacion es lo que convierte un
 * error en una correccion de un mensaje en vez de un dato malo en la
 * contabilidad.
 */
export function renderRegistrationConfirmation(
  transactions: Transaction[],
  source: 'audio' | 'image',
  currency: string,
  discount: number | null = null,
): string {
  const de = source === 'audio' ? 'tu nota de voz' : 'tu foto';

  if (!transactions.length) {
    return `No logré identificar ningún movimiento en ${de} 😅 ¿Me lo cuentas por escrito?`;
  }

  const lineas = transactions.map((row) => movementLine(row, currency));
  const pagado = transactions.reduce((suma, row) => suma + row.amount, 0);

  return [
    `Esto entendí de ${de}:`,
    ...lineas,
    ...(discount
      ? [
          '',
          ...lineasDeDescuento(round2(pagado + discount), discount, currency),
        ]
      : transactions.length > 1
        ? ['', `Son ${formatMoney(pagado, currency)} en total.`]
        : []),
    '',
    '¿Lo registro así? Respóndeme "sí", o dime qué corregir.',
  ].join('\n');
}

export function renderDeleteConfirmation(
  objetivos: Transaction[],
  period: QueryPeriod | null,
  currency: string,
): string {
  const total = objetivos.reduce((suma, row) => suma + row.amount, 0);

  if (objetivos.length === 1) {
    return [
      '⚠️ Voy a borrar este movimiento:',
      movementLine(objetivos[0], currency),
      '',
      '¿Lo confirmas? Respóndeme "sí" o "no".',
    ].join('\n');
  }

  // Con muchos, se muestran los primeros y se dice cuantos faltan: una lista
  // de cincuenta lineas en WhatsApp no la lee nadie, y hay que decir la verdad
  // sobre cuantos son.
  const mostrados = objetivos.slice(0, DELETE_PREVIEW_MAX);
  // Numerada: sin numeros, "dime cuál" no se puede contestar.
  const lineas = mostrados.map((row, indice) =>
    movementLine(row, currency, `${indice + 1})`),
  );

  const encabezado = period
    ? `⚠️ Voy a borrar TODOS tus movimientos ${etiquetaPeriodo(period)} (${objetivos.length}):`
    : `⚠️ Voy a borrar estos ${objetivos.length} movimientos:`;

  const resto =
    objetivos.length > mostrados.length
      ? [`...y ${objetivos.length - mostrados.length} más.`]
      : [];

  return [
    encabezado,
    ...lineas,
    ...resto,
    '',
    `En total son ${formatMoney(total, currency)}. Esto no se puede deshacer.`,
    // No vale un "si": hay que repetir el numero. Un usuario contesto "Si" sin
    // leer una lista de cinco y perdio los movimientos de todo el dia.
    `¿Seguro que son los ${objetivos.length}? Respóndeme "borrar los ${objetivos.length}".`,
    'Si solo era uno, dime cuál: "el 2".',
  ].join('\n');
}

/**
 * Lo que se responde cuando alguien confirma un borrado multiple sin decir
 * cuantos.
 *
 * Se vuelve a enseñar la lista: si el "si" fue distraido, esta es la segunda
 * oportunidad de leerla.
 */
export function renderCountConfirmationNeeded(
  objetivos: Transaction[],
  currency: string,
): string {
  const mostrados = objetivos.slice(0, DELETE_PREVIEW_MAX);

  return [
    `Espera, son ${objetivos.length} movimientos y borrarlos no se puede deshacer.`,
    ...mostrados.map((row, indice) =>
      movementLine(row, currency, `${indice + 1})`),
    ),
    ...(objetivos.length > mostrados.length
      ? [`...y ${objetivos.length - mostrados.length} más.`]
      : []),
    '',
    `Si de verdad son los ${objetivos.length}, escríbeme "borrar los ${objetivos.length}".`,
    'Si solo querías uno, dime cuál: "el 2".',
  ].join('\n');
}

/** Lo que se borro, ya hecho. */
export function renderDeletedMany(
  borrados: Transaction[],
  currency: string,
): string {
  if (borrados.length === 1) return renderDeleted(borrados[0], currency);

  const total = borrados.reduce((suma, row) => suma + row.amount, 0);

  return `🗑️ Listo, borré ${borrados.length} movimientos por ${formatMoney(total, currency)}.`;
}

export function renderQuotedMessage(quoted: {
  fromLuka: boolean;
  date: string;
  content: string;
}): string {
  const autor = quoted.fromLuka ? 'TUYO' : 'del usuario';

  return [
    'EL USUARIO ESTA RESPONDIENDO A ESTE MENSAJE ' + autor + ':',
    `(${quoted.date}) "${quoted.content}"`,
    'Lo que escriba ahora se refiere a ese mensaje, no necesariamente al ultimo',
    'de la conversacion. Usalo para entenderlo.',
  ].join('\n');
}

export function renderCorrectionNotFound(
  correccion: CorrectionRequest,
  currency: string,
  periodo: QueryPeriod | null = null,
): string {
  // Se nombran TODOS los criterios, no solo el primero: buscar por fecha Y por
  // texto a la vez y no encontrar nada se explicaba antes como si solo hubiera
  // fallado la fecha, y el usuario no entendia por que.
  const criterios = [
    correccion.referenceDate
      ? `del ${correccion.referenceDate}`
      : periodo
        ? etiquetaPeriodo(periodo)
        : null,
    correccion.referenceAmount !== null
      ? `por ${formatMoney(correccion.referenceAmount, currency)}`
      : null,
    correccion.reference ? `que mencione "${correccion.reference}"` : null,
  ].filter(Boolean);

  if (!criterios.length) {
    return 'No encontré movimientos recientes para corregir.';
  }

  return `No encontré ningún movimiento ${criterios.join(' y ')}. ¿Me dices de cuál se trata?`;
}

/**
 * La pregunta abierta, redactada para el modelo (no para el usuario).
 *
 * Va dentro del system prompt del siguiente turno. Sin ella el modelo recibe
 * "la primera" sin saber primera de que, y devuelve cualquier cosa.
 */
export function renderPendingQuestion(
  pendiente: PendingAction,
  currency: string,
): string {
  if (pendiente.kind === 'deletion') {
    return renderPendingDeletion(pendiente, currency);
  }

  if (pendiente.kind === 'registration') {
    return renderPendingRegistration(pendiente, currency);
  }

  if (pendiente.kind === 'payroll') {
    return renderPendingPayroll(pendiente, currency);
  }

  if (pendiente.kind === 'supply-debt') {
    return renderPendingSupplyDebt(pendiente, currency);
  }

  if (pendiente.kind === 'product') {
    return renderPendingProduct(pendiente, currency);
  }

  if (pendiente.kind === 'stock') {
    return renderPendingStock(pendiente);
  }

  return renderPendingCorrection(pendiente, currency);
}

/**
 * La nomina a medio armar, contada para el modelo.
 *
 * Es la pieza que hace que la conversacion funcione: sin esto, el usuario
 * contesta "Carlos" y el modelo no tiene forma de saber que eso es el nombre
 * del trabajador de un pago que se esta armando, asi que lo lee como un
 * mensaje suelto y vuelve a empezar.
 */
function renderPendingPayroll(
  pendiente: PendingPayroll,
  currency: string,
): string {
  const { workerName, percentage, amount } = pendiente.draft;

  const sabido = [
    `- trabajador: ${workerName ?? 'todavia no lo dijo'}`,
    `- porcentaje: ${percentage === null ? 'todavia no lo dijo' : `${percentage}%`}`,
    `- monto: ${amount === null ? 'todavia no lo dijo' : formatMoney(amount, currency)}`,
  ];

  if (pendiente.stage === 'confirmacion') {
    return [
      'PREGUNTA ABIERTA (lo mas importante de este turno):',
      'Le acabas de enseñar este pago de nomina y le preguntaste si lo registras:',
      ...sabido,
      'Si dice que si, devuelve type "confirmation" con confirmed true.',
      'Si dice que no, confirmed false.',
      'Si te CORRIGE un dato ("no, son 900.000"), no es una confirmacion:',
      'devuelve type "payroll" con ese dato ya corregido.',
    ].join('\n');
  }

  return [
    'PREGUNTA ABIERTA (lo mas importante de este turno):',
    'Estas armando un pago de nomina y le preguntaste por el dato que falta.',
    'Esto es lo que ya sabes:',
    ...sabido,
    'Lo que conteste es ese dato: devuelve type "payroll" con el puesto donde',
    'corresponde. NO vuelvas a pedir lo que ya esta arriba y NO lo trates como',
    'un gasto ni como una venta.',
  ].join('\n');
}

/**
 * La deuda a medio armar, contada para el modelo.
 *
 * Sin esto, el usuario contesta "en 6 cuotas" y el modelo no tiene forma de
 * saber que eso pertenece a una deuda que se esta armando: lo lee como un
 * mensaje suelto y la conversacion vuelve a empezar.
 */
function renderPendingSupplyDebt(
  pendiente: PendingSupplyDebt,
  currency: string,
): string {
  const d = pendiente.draft;
  const sabido = [
    `- proveedor: ${d.supplierName ?? 'todavia no lo dijo'}`,
    `- suministro: ${d.supply ?? 'todavia no lo dijo'}`,
    `- monto: ${d.amount === null ? 'todavia no lo dijo' : formatMoney(d.amount, currency)}`,
    `- fecha limite: ${d.dueDate ?? 'todavia no la dijo'}`,
    `- modalidad: ${d.mode ?? 'todavia no lo dijo'}`,
    `- cuotas: ${d.installments ?? 'todavia no lo dijo'}`,
    `- interes mensual: ${d.interestRate === null ? 'todavia no lo dijo' : `${d.interestRate}%`}`,
  ];

  if (pendiente.stage === 'confirmacion') {
    return [
      'PREGUNTA ABIERTA (lo mas importante de este turno):',
      'Le acabas de enseñar esta deuda con su plan de cuotas y le preguntaste',
      'si la registras:',
      ...sabido,
      'Si dice que si, devuelve type "confirmation" con confirmed true.',
      'Si dice que no, confirmed false.',
      'Si te CORRIGE un dato ("no, son 8 cuotas"), no es una confirmacion:',
      'devuelve type "supply_debt" con ese dato ya corregido.',
    ].join('\n');
  }

  return [
    'PREGUNTA ABIERTA (lo mas importante de este turno):',
    'Estas armando una deuda con un proveedor y le preguntaste por el dato',
    'que falta. Esto es lo que ya sabes:',
    ...sabido,
    'Lo que conteste es ese dato: devuelve type "supply_debt" con el puesto',
    'donde corresponde. NO vuelvas a pedir lo que ya esta arriba y NO lo',
    'trates como un gasto nuevo.',
  ].join('\n');
}

/**
 * El producto a medio armar, contado para el modelo.
 *
 * Sin esto, el usuario contesta "5.000" y el modelo no sabe que eso es el
 * precio de un producto que se esta dando de alta: lo lee como un ingreso y
 * registra una venta que nadie hizo.
 */
function renderPendingProduct(
  pendiente: PendingProduct,
  currency: string,
): string {
  const d = pendiente.draft;
  const sabido = [
    `- producto: ${d.name ?? 'todavia no lo dijo'}`,
    `- precio de venta: ${d.salePrice === null ? 'todavia no lo dijo' : formatMoney(d.salePrice, currency)}`,
    `- precio de compra: ${d.costPrice === null ? 'todavia no lo dijo' : formatMoney(d.costPrice, currency)}`,
    `- categoria: ${d.category ?? 'no la dijo (es opcional)'}`,
    `- stock inicial: ${d.stock ?? 'no lo dijo (es opcional)'}`,
  ];

  if (pendiente.stage === 'confirmacion') {
    return [
      'PREGUNTA ABIERTA (lo mas importante de este turno):',
      'Le acabas de enseñar este producto y le preguntaste si lo agregas al',
      'catalogo:',
      ...sabido,
      'Si dice que si, devuelve type "confirmation" con confirmed true.',
      'Si dice que no, confirmed false.',
      'Si te CORRIGE un dato ("no, lo vendo en 6.000"), no es una',
      'confirmacion: devuelve type "product" con ese dato ya corregido.',
    ].join('\n');
  }

  return [
    'PREGUNTA ABIERTA (lo mas importante de este turno):',
    'Estas dando de alta un producto y le preguntaste por el dato que falta.',
    'Esto es lo que ya sabes:',
    ...sabido,
    'Lo que conteste es ese dato: devuelve type "product" con el puesto donde',
    'corresponde. Una cifra suelta aqui es un precio del producto, NO una',
    'venta ni un gasto.',
  ].join('\n');
}

/** Espera un si, un no, o directamente la correccion. */
function renderPendingRegistration(
  pendiente: PendingRegistration,
  currency: string,
): string {
  const lineas = pendiente.transactions.map(
    (row) =>
      `- ${row.date} · ${row.description} · ${row.type} · ${formatMoney(row.amount, currency)}`,
  );

  if (pendiente.reason === 'descuadre') {
    // La foto NO viaja al siguiente turno. Si no se le devuelven aqui las
    // lineas que ya se leyeron, el modelo le pide al usuario que le dicte otra
    // vez la factura que acaba de mirar.
    return [
      'PREGUNTA ABIERTA (lo mas importante de este turno):',
      `Entendiste estos movimientos, pero suman distinto del total que dijo el usuario (${formatMoney(pendiente.declaredTotal ?? 0, currency)}), asi que le preguntaste cual es la cifra buena:`,
      ...lineas,
      'Estas lineas ya las tienes: NO se las vuelvas a pedir.',
      'Si explica la diferencia con un DESCUENTO, devuelve otra vez estos mismos',
      'movimientos con sus montos originales, declaredTotal con el total que paga',
      'y discount con lo que le rebajaron. Si dice que una cifra estaba mal,',
      'devuelvelos corregidos.',
    ].join('\n');
  }

  return [
    'PREGUNTA ABIERTA (lo mas importante de este turno):',
    `Le acabas de enseñar lo que entendiste de su ${pendiente.source === 'audio' ? 'nota de voz' : 'foto'} y le preguntaste si lo registras asi:`,
    ...lineas,
    'Si dice que si, devuelve type "confirmation" con confirmed true.',
    'Si dice que no sin mas, confirmed false.',
    'Si en cambio te CORRIGE algo ("no, eran 95.000"), no es una confirmacion:',
    'devuelve el movimiento completo ya corregido como un registro normal.',
  ].join('\n');
}

/** Espera un si o un no, y nada mas. */
function renderPendingDeletion(
  pendiente: PendingDeletion,
  currency: string,
): string {
  const total = pendiente.targets.reduce((suma, row) => suma + row.amount, 0);

  // La lista numerada tiene que estar delante del modelo: sin ella, "solo el
  // 2 y el 3" no se puede convertir en posiciones y termina borrando otra cosa.
  const lineas = pendiente.targets.map(
    (row, indice) =>
      `${indice + 1}) ${row.date} · ${row.description} · ${formatMoney(row.amount, currency)}`,
  );

  return [
    'PREGUNTA ABIERTA (lo mas importante de este turno):',
    `Le acabas de preguntar si confirma borrar estos ${pendiente.targets.length} movimiento(s), ${formatMoney(total, currency)} en total:`,
    ...lineas,
    '',
    'El mensaje que sigue es la RESPUESTA a esa pregunta. Hay tres caminos:',
    `1. CONFIRMA TODOS: type "confirmation", confirmed true, y confirmedCount ${pendiente.targets.length}`,
    '   si repitio el numero ("borrar los 3", "si, los 3").',
    '2. CANCELA: type "confirmation", confirmed false ("no", "mejor no", "cancela").',
    '3. ESCOGE ALGUNOS de la lista de arriba: type "correction", action "delete",',
    '   y referenceIndexes con TODAS las posiciones que nombro.',
    '       "solo el 2 y el 3"        -> referenceIndexes [2, 3]',
    '       "el segundo y el tercero" -> referenceIndexes [2, 3]',
    '       "solo el ultimo"          -> referenceIndexes [' +
      '${pendiente.targets.length}]',
    '       "todos menos el 1"        -> las posiciones restantes, una por una',
    '   Con posiciones, matchAll SIEMPRE va en false.',
  ].join('\n');
}

function renderPendingCorrection(
  pendiente: PendingCorrection,
  currency: string,
): string {
  const lineas = pendiente.candidates.map(
    (row, indice) =>
      `${indice + 1}) ${row.date} · ${row.description} · ${formatMoney(row.amount, currency)}`,
  );

  const cambio =
    pendiente.newAmount !== null
      ? `dejarlo en ${formatMoney(pendiente.newAmount, currency)}`
      : pendiente.newConcept !== null
        ? `cambiarle el concepto a "${pendiente.newConcept}"`
        : pendiente.action === 'delete'
          ? 'borrarlo'
          : 'corregirlo';

  return [
    'PREGUNTA ABIERTA (lo mas importante de este turno):',
    `Ya le mostraste esta lista y le preguntaste cual ${pendiente.action === 'delete' ? 'borrar' : 'corregir'}:`,
    ...lineas,
    `Lo que ya te habia pedido: ${cambio}.`,
    'El mensaje que sigue es la RESPUESTA a esa pregunta. Devuelve type',
    '"correction" con referenceIndex (1, 2, 3...), referenceAmount o',
    'referenceDate segun lo que diga, y repite el newAmount o newConcept de',
    'arriba. No dejes los cuatro identificadores en null.',
  ].join('\n');
}

// ------------------------------------------------- respuestas de movimientos

/** Una linea por movimiento: "• 15 ago · Transporte · -$50.000 COP". */
/**
 * El recordatorio del plazo, para pegarlo al texto que escribio el modelo.
 *
 * Vacio en todo lo que no sea un fiado con fecha: no hay nada que recordar.
 */
function lineaDePlazo(transaction: Transaction | undefined): string {
  if (!transaction?.isCredit || !transaction.dueDate) return '';

  const fecha = FECHA_CORTA.format(
    new Date(`${transaction.dueDate}T12:00:00.000Z`),
  );

  return `
📅 Te paga el ${fecha}.`;
}

function movementLine(
  row: Transaction,
  currency: string,
  vineta = '•',
): string {
  const signo = row.type === 'income' ? '+' : '-';
  const fecha = FECHA_CORTA.format(new Date(`${row.date}T12:00:00.000Z`));
  const extras = [
    row.paymentMethod ? PAYMENT_METHOD_LABELS[row.paymentMethod] : null,
    // El plazo va pegado al "fiado" y no en una linea aparte: es lo que el
    // dueno necesita ver para saber si lo que entendio Luka es lo que acordo.
    row.isCredit
      ? row.dueDate
        ? `fiado, paga el ${FECHA_CORTA.format(new Date(`${row.dueDate}T12:00:00.000Z`))}`
        : 'fiado'
      : null,
  ].filter(Boolean);

  return (
    `${vineta} ${fecha} · ${row.description} · ${signo}${formatMoney(row.amount, currency)}` +
    (extras.length ? ` (${extras.join(', ')})` : '')
  );
}

/**
 * Confirmacion cuando el mensaje traia varios movimientos.
 *
 * Se detallan uno por uno a proposito: si el usuario dicto tres gastos y solo
 * ve un total, no tiene forma de saber si se separaron bien.
 */
/**
 * Las lineas del descuento, cuando lo hubo.
 *
 * Se ensenan las tres cifras —lo que costaba, lo que rebajaron y lo que se
 * pago— porque el usuario tiene la factura delante y quiere reconocerla.
 */
function lineasDeDescuento(
  bruto: number,
  discount: number,
  currency: string,
): string[] {
  return [
    `Subtotal: ${formatMoney(bruto, currency)}`,
    `Descuento: -${formatMoney(discount, currency)}`,
    `Total pagado: ${formatMoney(round2(bruto - discount), currency)}`,
  ];
}

export function renderMovementsRegistered(
  transactions: Transaction[],
  currency: string,
  discount: number | null = null,
): string {
  const pagado = sumAmounts(transactions);

  // Numerados cuando son varios: "borra el primero" necesita que haya un
  // primero A LA VISTA. Con viñetas, el usuario y el modelo tenian que deducir
  // el orden, y el modelo lo deducia mal.
  const lineas =
    transactions.length > 1
      ? transactions.map((row, indice) =>
          movementLine(row, currency, `${indice + 1})`),
        )
      : transactions.map((row) => movementLine(row, currency));

  // Con descuento se ensenan las tres cifras: el usuario tiene la factura
  // delante y quiere reconocer el subtotal que ahi dice, no solo lo que pago.
  const cierre = discount
    ? lineasDeDescuento(round2(pagado + discount), discount, currency)
    : [`Total: ${formatMoney(pagado, currency)}`];

  return [
    `✅ Registré ${transactions.length} movimiento${transactions.length === 1 ? '' : 's'}:`,
    ...lineas,
    ...cierre,
    ...(discount
      ? [
          'Repartí el descuento entre los productos, así tus gastos cuadran con lo que de verdad pagaste.',
        ]
      : []),
  ].join('\n');
}

/** Confirmacion de un desglose que reemplazo a un total ya registrado. */
export function renderBreakdown(
  partes: Transaction[],
  total: number,
  currency: string,
): string {
  const lineas = partes.map((row) => movementLine(row, currency));

  return [
    `✅ Listo, separé los ${formatMoney(total, currency)} así:`,
    ...lineas,
    'El total no cambia, solo queda detallado.',
  ].join('\n');
}

/**
 * El desglose no cuadra con el total.
 *
 * Se dicen las dos cifras y la diferencia exacta: el usuario necesita saber
 * cuanto falta para poder corregirlo, y asi no se registra nada inconsistente.
 */
export function renderMismatch(
  mismatch: BreakdownMismatch,
  currency: string,
): string {
  const falta = mismatch.difference > 0;

  return [
    `Me diste un total de ${formatMoney(mismatch.declared, currency)}, pero las partes suman ${formatMoney(mismatch.sum, currency)}.`,
    falta
      ? `Faltan ${formatMoney(Math.abs(mismatch.difference), currency)} por asignar.`
      : `Sobran ${formatMoney(Math.abs(mismatch.difference), currency)}.`,
    '¿Me confirmas las cifras para registrarlo bien?',
  ].join('\n');
}

/** Confirmacion del reparto de utilidades, con el monto de cada quien. */
export function renderProfitShare(
  total: number,
  shares: ProfitShare[],
  currency: string,
): string {
  const lineas = shares.map((share) => {
    const quien = share.name ?? PROFIT_BENEFICIARY_LABELS[share.beneficiary];
    return `• ${quien}: ${share.percentage}% → ${formatMoney(share.amount, currency)}`;
  });

  return [
    `💰 Reparto de utilidades sobre ${formatMoney(total, currency)}:`,
    ...lineas,
  ].join('\n');
}

/**
 * El detalle de los movimientos del periodo, uno por uno.
 *
 * Responde a "¿cuales son esos 8 movimientos?": antes el resumen decia cuantos
 * habia pero no habia forma de verlos, y volver a preguntar devolvia el mismo
 * resumen.
 */
export function renderMovementList(
  movimientos: Transaction[],
  period: QueryPeriod,
  currency: string,
): string {
  if (movimientos.length === 0) {
    return `No tienes movimientos registrados ${etiquetaPeriodo(period)}.`;
  }

  const mostrados = movimientos.slice(0, LIST_MAX_RESULTS);
  const lineas = mostrados.map((row) => movementLine(row, currency));
  const encabezado =
    movimientos.length === 1
      ? `📋 Tienes 1 movimiento ${etiquetaPeriodo(period)}:`
      : `📋 Tus ${movimientos.length} movimientos ${etiquetaPeriodo(period)}:`;

  const pie =
    movimientos.length > mostrados.length
      ? [
          `Te muestro los ${mostrados.length} más recientes. Pídeme un periodo más corto para ver el resto.`,
        ]
      : [];

  return [encabezado, ...lineas, ...pie].join('\n');
}
