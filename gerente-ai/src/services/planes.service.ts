import { Injectable } from '@nestjs/common';

/**
 * Catalogo comercial de planes.
 *
 * El plan se guarda como `Int` en `Negocio.plan` y NO como enum: el modulo de
 * WhatsApp mapea ese entero por indice para resolver la cuota de IA, y cambiarlo
 * de tipo romperia su codigo. Este archivo es la fuente de verdad de las reglas
 * de negocio (sedes y funcionalidades); la cuota de mensajes de IA la sigue
 * definiendo `PLAN_LIMITS` en el modulo de IA, que es su dominio.
 */

export const PLAN_ASISTENTE = 1;
export const PLAN_GERENTE = 2;
export const PLAN_ADMINISTRADOR = 3;
export const PLAN_SOCIO = 4;
/** Plan interno: sin topes, no se compra desde la aplicacion. */
export const PLAN_CORPORATIVO = 5;

/**
 * Funcionalidades que un plan habilita. El backend solo AUTORIZA: quien calcula
 * las recomendaciones o procesa fotos y audios es el equipo de IA.
 */
export type Funcionalidad =
  | 'reportes_por_producto'
  | 'reporte_fiados'
  | 'recomendaciones_estadisticas'
  | 'anotaciones_por_foto'
  | 'anotaciones_por_audio'
  | 'ia_avanzada'
  /** Catalogo de productos: registrar, consultar y gestionar el inventario. */
  | 'inventario';

/** La cuota de IA se mide en bloques de 30 dias, no en meses de calendario. */
const DIAS_DE_CUOTA_MS = 30 * 86_400_000;

/**
 * Como se contrata cada plan. Distingue tres casos que antes se deducian del
 * precio, y mal: el Asistente y el Corporativo valen 0 en el catalogo, pero uno
 * es gratuito de verdad y el otro se cotiza en una reunion.
 */
export type Contratacion = 'gratuito' | 'directo' | 'cotizacion';

export interface DefinicionPlan {
  id: number;
  nombre: string;
  /** En pesos colombianos. 0 = no se cobra desde aqui (ver `contratacion`). */
  precioMensual: number;
  /**
   * `null` cuando el plan no se vende por año. No es lo mismo que 0: el Gerente
   * solo existe en mensual, y pedir su ciclo anual tiene que fallar, no cobrar
   * cero.
   */
  precioAnual: number | null;
  /** Tope de sedes dentro del negocio. */
  maxSedes: number;
  contratacion: Contratacion;
  funcionalidades: Funcionalidad[];
}

/**
 * Las siete funciones Premium. Van juntas en todos los planes de pago: lo que
 * diferencia un plan de otro son las sedes y la cuota de IA, no las funciones.
 *
 * El Asistente (gratuito) tiene la lista vacia, asi que no hay que excluirlo
 * de nada: lo que se anada aqui queda fuera de su plan automaticamente. Y un
 * plan de pago vencido cae a Asistente en `estado()`, con lo que pierde el
 * acceso sin que nadie tenga que acordarse de quitarselo.
 */
const TODAS_LAS_FUNCIONES: Funcionalidad[] = [
  'reportes_por_producto',
  'reporte_fiados',
  'recomendaciones_estadisticas',
  'anotaciones_por_foto',
  'anotaciones_por_audio',
  'ia_avanzada',
  'inventario',
];

/**
 * Los precios anuales se escriben a mano y no se derivan del mensual.
 *
 * Antes se calculaban con un 16% fijo, lo cual garantizaba que no discreparan.
 * Ya no se puede: cada plan lleva su propio descuento (16,6% el Administrador,
 * 19,4% el Socio), asi que el numero es una decision comercial y no una formula.
 * A cambio, hay que revisarlos a mano cuando cambie un precio mensual.
 */
export const PLANES: Record<number, DefinicionPlan> = {
  [PLAN_ASISTENTE]: {
    id: PLAN_ASISTENTE,
    nombre: 'Asistente',
    precioMensual: 0,
    precioAnual: null,
    maxSedes: 1,
    contratacion: 'gratuito',
    funcionalidades: [],
  },
  [PLAN_GERENTE]: {
    id: PLAN_GERENTE,
    nombre: 'Gerente',
    precioMensual: 39_900,
    // Sin ciclo anual a proposito: es el plan de entrada y se vende mes a mes.
    precioAnual: null,
    maxSedes: 1,
    contratacion: 'directo',
    funcionalidades: TODAS_LAS_FUNCIONES,
  },
  [PLAN_ADMINISTRADOR]: {
    id: PLAN_ADMINISTRADOR,
    nombre: 'Administrador',
    precioMensual: 79_900,
    precioAnual: 799_900,
    maxSedes: 3,
    contratacion: 'directo',
    funcionalidades: TODAS_LAS_FUNCIONES,
  },
  [PLAN_SOCIO]: {
    id: PLAN_SOCIO,
    nombre: 'Socio',
    precioMensual: 149_900,
    precioAnual: 1_449_900,
    maxSedes: 5,
    contratacion: 'directo',
    funcionalidades: TODAS_LAS_FUNCIONES,
  },
  /**
   * Corporativo: sin topes y fuera del autoservicio. Se muestra en la pantalla
   * de precios, pero se contrata hablando con el equipo, asi que su precio no
   * vive aqui. El checkout lo rechaza por tener `precioMensual` en 0.
   */
  [PLAN_CORPORATIVO]: {
    id: PLAN_CORPORATIVO,
    nombre: 'Corporativo',
    precioMensual: 0,
    precioAnual: null,
    maxSedes: Number.POSITIVE_INFINITY,
    contratacion: 'cotizacion',
    funcionalidades: TODAS_LAS_FUNCIONES,
  },
};

/**
 * Un plan tal como sale por la API.
 *
 * `maxSedes` viaja como `null` cuando no hay tope. `Infinity` no existe en JSON
 * —`JSON.stringify` lo convierte en `null` por su cuenta— asi que se hace
 * explicito aqui en vez de dejarlo al azar de la serializacion: quien consuma
 * el endpoint tiene que saber que `null` significa "sin limite", no "cero".
 */
export type PlanPublicado = Omit<DefinicionPlan, 'maxSedes'> & {
  maxSedes: number | null;
};

/** Lo que el backend necesita saber de un negocio para decidir. */
export interface EstadoDelPlan {
  /** El plan que se pagó, aunque esté vencido. */
  contratado: DefinicionPlan;
  /** El que rige hoy: si venció, es Asistente. */
  vigente: DefinicionPlan;
  vencido: boolean;
  venceEl: Date | null;
}

@Injectable()
export class PlanesService {
  /** Catalogo publico, para la pantalla de suscripcion del frontend. */
  catalogo(): PlanPublicado[] {
    // Incluye el Corporativo: se muestra en la pantalla de precios aunque no se
    // pueda comprar. Que aparezca o no lo decide `contratacion`, no esta lista.
    return [
      PLAN_ASISTENTE,
      PLAN_GERENTE,
      PLAN_ADMINISTRADOR,
      PLAN_SOCIO,
      PLAN_CORPORATIVO,
    ].map((id) => {
      const plan = PLANES[id];
      return {
        ...plan,
        maxSedes: Number.isFinite(plan.maxSedes) ? plan.maxSedes : null,
      };
    });
  }

  /**
   * Resuelve que plan rige hoy.
   *
   * Un plan vencido NO deja al negocio bloqueado: cae a Asistente. El comerciante
   * sigue registrando ventas en su primera sede aunque se haya atrasado con la
   * suscripcion; lo que pierde son las sedes adicionales y las funciones Premium.
   */
  estado(
    plan: number,
    planVenceEl: Date | null,
    ahora = new Date(),
  ): EstadoDelPlan {
    const contratado = PLANES[plan] ?? PLANES[PLAN_ASISTENTE];

    // Sin fecha de vencimiento el plan no caduca (es el caso del gratuito).
    const vencido =
      planVenceEl !== null && planVenceEl.getTime() <= ahora.getTime();

    return {
      contratado,
      vigente: vencido ? PLANES[PLAN_ASISTENTE] : contratado,
      vencido,
      venceEl: planVenceEl,
    };
  }

  /**
   * Ventana de 30 dias contra la que se cuenta la cuota de mensajes de IA.
   *
   * Antes era el mes de calendario, y no coincidia con el ciclo que se cobra:
   * quien pagaba el 25 estrenaba cuota completa el 1, asi que en un mes de plan
   * podia llegar a tener casi tres cuotas.
   *
   * Ahora la ventana se ancla a lo que corresponde en cada caso:
   *
   * - **Plan de pago vigente:** al vencimiento, retrocediendo en bloques de 30
   *   dias. En el plan anual eso da el bloque de 30 dias en curso y no los 365
   *   de golpe, que es lo que se vende: mensajes al mes, no al año.
   * - **Gratuito o vencido:** a la fecha en que se creo el negocio. Cada 30 dias
   *   desde que existe, que es lo mas parecido a "un mes desde que empezo".
   *
   * La misma formula cubre los dos: `bloques` sale negativo cuando el ancla esta
   * en el futuro (vencimiento) y positivo cuando esta en el pasado (creacion).
   */
  ventanaDeCuota(
    plan: number,
    planVenceEl: Date | null,
    creadoEl: Date,
    ahora = new Date(),
  ): { inicio: Date; fin: Date } {
    const estado = this.estado(plan, planVenceEl, ahora);

    const ancla =
      !estado.vencido && planVenceEl !== null ? planVenceEl : creadoEl;

    const bloques = Math.floor(
      (ahora.getTime() - ancla.getTime()) / DIAS_DE_CUOTA_MS,
    );
    const inicio = new Date(ancla.getTime() + bloques * DIAS_DE_CUOTA_MS);

    return { inicio, fin: new Date(inicio.getTime() + DIAS_DE_CUOTA_MS) };
  }

  /** Tope de sedes que puede usar el negocio hoy. */
  maxSedes(plan: number, planVenceEl: Date | null, ahora = new Date()): number {
    return this.estado(plan, planVenceEl, ahora).vigente.maxSedes;
  }

  /**
   * Las funcionalidades se evaluan contra el plan VIGENTE, no el contratado:
   * un Gerente vencido no puede ver el reporte de fiados.
   */
  tieneFuncionalidad(
    plan: number,
    planVenceEl: Date | null,
    funcionalidad: Funcionalidad,
    ahora = new Date(),
  ): boolean {
    return this.estado(
      plan,
      planVenceEl,
      ahora,
    ).vigente.funcionalidades.includes(funcionalidad);
  }
}
