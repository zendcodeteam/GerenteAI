import { Injectable, Logger } from '@nestjs/common';

import type {
  PayrollDraft,
  ProductDraft,
  StockDraft,
  QueryPeriod,
  SupplyDebtDraft,
  Transaction,
} from '../domain/finance.types';

/**
 * Lo que quedo a medias en la conversacion y hay que recordar para el proximo
 * mensaje.
 *
 * Nace de un error que corrompio datos reales: Luka mostraba tres movimientos
 * parecidos y preguntaba cual corregir, el usuario contestaba "la primera" y
 * el backend, que no guardaba esa lista, interpretaba la respuesta como un
 * mensaje suelto. Al no reconocer ningun identificador caia en la regla "sin
 * referencia = el ultimo movimiento" y termino cambiandole el monto a una
 * compra que no tenia nada que ver.
 *
 * La leccion: mientras hay una pregunta abierta, "no dijo cual" NO puede
 * significar "el ultimo". Significa que hay que volver a preguntar.
 *
 * ALCANCE: memoria del proceso, igual que `MessageDedupeService`. Alcanza
 * porque hay una sola instancia y porque una pregunta se resuelve en segundos:
 * el usuario esta escribiendo del otro lado. Si el backend reinicia en la
 * mitad, la pregunta se pierde y Luka vuelve a preguntar, que es el
 * comportamiento seguro. Con varias instancias, esto se mueve a una tabla.
 */

/** Cual de varios movimientos parecidos hay que tocar. */
export interface PendingCorrection {
  kind: 'correction';
  action: 'update' | 'delete';
  /** Los movimientos que se le mostraron al usuario, en el mismo orden. */
  candidates: Transaction[];
  /** El cambio que ya habia pedido, para no volver a preguntarlo. */
  newAmount: number | null;
  newConcept: string | null;
  at: number;
}

/**
 * Un borrado esperando el "si".
 *
 * Borrar no se deshace, asi que nunca se ejecuta en el mismo turno en que se
 * pide: primero se le enseña al usuario exactamente que se va a ir.
 */
export interface PendingDeletion {
  kind: 'deletion';
  /** Los movimientos que se borrarian, tal como se le enseñaron. */
  targets: Transaction[];
  /** El periodo, cuando el borrado era masivo ("todo lo de hoy"). */
  period: QueryPeriod | null;
  at: number;
}

/**
 * Movimientos entendidos de una nota de voz o una foto, esperando el visto
 * bueno.
 *
 * En texto escrito el usuario ve lo que escribio; en un audio o una foto no
 * hay tal cosa, y el margen de error es mucho mayor. Registrar mal sin avisar
 * es peor que no registrar: el error se esconde en la contabilidad y nadie lo
 * encuentra hasta que las cuentas no cuadran.
 */
export interface PendingRegistration {
  kind: 'registration';
  transactions: Transaction[];
  /** De donde salio, para poder decirlo en la respuesta. */
  source: 'audio' | 'image' | 'texto';
  /**
   * Por que quedo pendiente.
   *
   * "media" = salio de un audio o una foto y hay que ensenarlo antes de
   * guardar. "descuadre" = las partes no suman el total que dijo el usuario y
   * hay que aclararlo.
   */
  reason: 'media' | 'descuadre';
  /** El total que dijo el usuario, cuando no cuadraba con las partes. */
  declaredTotal: number | null;
  at: number;
}

/**
 * Un pago de nomina a medio armar, esperando el dato que falta o el visto
 * bueno final.
 *
 * Es la unica pregunta abierta que sobrevive a varios turnos seguidos: nombre,
 * porcentaje y monto se piden de a uno. Sin guardar el borrador, cada
 * respuesta llegaria suelta ("Carlos") y el modelo tendria que reconstruir de
 * la nada lo que ya se habia dicho.
 */
export interface PendingPayroll {
  kind: 'payroll';
  draft: PayrollDraft;
  /**
   * `datos` = todavia falta algo y se esta preguntando.
   * `confirmacion` = ya esta completo, se le enseno el resumen y se espera el si.
   */
  stage: 'datos' | 'confirmacion';
  at: number;
}

/**
 * Un suministro que queda a deber, a medio armar.
 *
 * Los datos se piden de a uno y el borrador sobrevive entre turnos. Aqui son
 * siete —proveedor, suministro, monto, fecha, modalidad, cuotas e interes—,
 * asi que perder lo ya dicho seria especialmente caro.
 */
export interface PendingSupplyDebt {
  kind: 'supply-debt';
  draft: SupplyDebtDraft;
  /** `datos` = falta algo. `confirmacion` = ya vio el plan y falta el si. */
  stage: 'datos' | 'confirmacion';
  at: number;
}

/**
 * Un producto del catalogo a medio armar.
 *
 * Mismo patron que la nomina y la deuda con proveedor: los datos se piden de
 * a uno y el borrador sobrevive entre turnos.
 */
export interface PendingProduct {
  kind: 'product';
  draft: ProductDraft;
  /** `datos` = falta algo. `confirmacion` = ya vio el resumen y falta el si. */
  stage: 'datos' | 'confirmacion';
  at: number;
}

/**
 * Un ajuste de existencias esperando el visto bueno.
 *
 * Guarda el producto ya resuelto y las unidades que tenia ANTES: el resumen
 * que se le ensena al usuario dice de cuanto a cuanto va, y ese "antes" hay
 * que haberlo leido en el momento de armarlo, no al confirmar.
 */
export interface PendingStock {
  kind: 'stock';
  draft: StockDraft;
  stage: 'datos' | 'confirmacion';
  productoId: string | null;
  nombreGuardado: string | null;
  unidadesAntes: number | null;
  at: number;
}

export type PendingAction =
  | PendingCorrection
  | PendingDeletion
  | PendingRegistration
  | PendingPayroll
  | PendingSupplyDebt
  | PendingProduct
  | PendingStock;

@Injectable()
export class ConversationStateService {
  private readonly logger = new Logger(ConversationStateService.name);
  private readonly pendientes = new Map<string, PendingAction>();

  /**
   * Cuanto sobrevive una pregunta sin responder.
   *
   * Corto a proposito: si el usuario vuelve media hora despues con un "si", ya
   * no se acuerda de que estaba confirmando, y ejecutar un borrado a ciegas es
   * justo lo que se quiere evitar.
   */
  private readonly ttlMs = 10 * 60 * 1_000;

  /**
   * Solo cabe una pregunta abierta por sede: Luka pregunta una cosa a la vez.
   *
   * La clave es la SEDE, igual que el historial. Hereda su limitacion: dos
   * personas escribiendo desde el mismo negocio comparten la pregunta abierta.
   */
  private recordar(businessId: string, accion: PendingAction): void {
    this.pendientes.set(businessId, accion);
    this.logger.debug(
      `Pregunta abierta (${accion.kind}) en sede ${businessId}.`,
    );
  }

  recordarCorreccion(
    businessId: string,
    pendiente: Omit<PendingCorrection, 'at' | 'kind'>,
  ): void {
    this.recordar(businessId, {
      ...pendiente,
      kind: 'correction',
      at: Date.now(),
    });
  }

  recordarBorrado(
    businessId: string,
    pendiente: Omit<PendingDeletion, 'at' | 'kind'>,
  ): void {
    this.recordar(businessId, {
      ...pendiente,
      kind: 'deletion',
      at: Date.now(),
    });
  }

  recordarRegistro(
    businessId: string,
    pendiente: Omit<PendingRegistration, 'at' | 'kind'>,
  ): void {
    this.recordar(businessId, {
      ...pendiente,
      kind: 'registration',
      at: Date.now(),
    });
  }

  recordarNomina(
    businessId: string,
    pendiente: Omit<PendingPayroll, 'at' | 'kind'>,
  ): void {
    this.recordar(businessId, {
      ...pendiente,
      kind: 'payroll',
      at: Date.now(),
    });
  }

  recordarDeudaProveedor(
    businessId: string,
    pendiente: Omit<PendingSupplyDebt, 'at' | 'kind'>,
  ): void {
    this.recordar(businessId, {
      ...pendiente,
      kind: 'supply-debt',
      at: Date.now(),
    });
  }

  recordarProducto(
    businessId: string,
    pendiente: Omit<PendingProduct, 'at' | 'kind'>,
  ): void {
    this.recordar(businessId, {
      ...pendiente,
      kind: 'product',
      at: Date.now(),
    });
  }

  /** La pregunta abierta de esa sede, si sigue vigente. */
  pendiente(businessId: string): PendingAction | null {
    const abierta = this.pendientes.get(businessId);
    if (!abierta) return null;

    if (Date.now() - abierta.at > this.ttlMs) {
      this.pendientes.delete(businessId);
      return null;
    }

    return abierta;
  }

  correccionPendiente(businessId: string): PendingCorrection | null {
    const abierta = this.pendiente(businessId);
    return abierta?.kind === 'correction' ? abierta : null;
  }

  borradoPendiente(businessId: string): PendingDeletion | null {
    const abierta = this.pendiente(businessId);
    return abierta?.kind === 'deletion' ? abierta : null;
  }

  registroPendiente(businessId: string): PendingRegistration | null {
    const abierta = this.pendiente(businessId);
    return abierta?.kind === 'registration' ? abierta : null;
  }

  nominaPendiente(businessId: string): PendingPayroll | null {
    const abierta = this.pendiente(businessId);
    return abierta?.kind === 'payroll' ? abierta : null;
  }

  deudaProveedorPendiente(businessId: string): PendingSupplyDebt | null {
    const abierta = this.pendiente(businessId);
    return abierta?.kind === 'supply-debt' ? abierta : null;
  }

  recordarStock(
    businessId: string,
    pendiente: Omit<PendingStock, 'at' | 'kind'>,
  ): void {
    this.recordar(businessId, {
      ...pendiente,
      kind: 'stock',
      at: Date.now(),
    });
  }

  stockPendiente(businessId: string): PendingStock | null {
    const abierta = this.pendiente(businessId);
    return abierta?.kind === 'stock' ? abierta : null;
  }

  productoPendiente(businessId: string): PendingProduct | null {
    const abierta = this.pendiente(businessId);
    return abierta?.kind === 'product' ? abierta : null;
  }

  /** Se resolvio (o el usuario cambio de tema): deja de haber pregunta abierta. */
  olvidar(businessId: string): void {
    this.pendientes.delete(businessId);
  }
}
