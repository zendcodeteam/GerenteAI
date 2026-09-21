import { apiClient } from '@/lib/apiClient';

export interface PlanBackend {
  id: number;
  nombre: string;
  precioMensual: number;
  precioAnual: number;
  maxSedes: number;
  funcionalidades: string[];
}

export interface NegocioPlanInfo {
  id: string;
  nombre: string;

  /** Plan que el negocio tiene contratado. */
  plan: number;

  /** Plan que realmente está vigente y puede utilizar. */
  planVigente: number;

  /** Indica si el plan contratado ya venció. */
  planVencido: boolean;

  /** Fecha de vencimiento del plan contratado. */
  planVenceEl: string | null;
}

export type CicloFacturacion =
  | 'mensual'
  | 'anual';

export const DESCUENTO_ANUAL = 0.16;

/**
 * Catálogo comercial oficial de 5 planes para Luka AI.
 */
export const PLANES_FALLBACK: PlanBackend[] = [
  {
    id: 1,
    nombre: 'Asistente',
    precioMensual: 0,
    precioAnual: 0,
    maxSedes: 1,
    funcionalidades: [],
  },
  {
    id: 2,
    nombre: 'Gerente',
    precioMensual: 39900,
    precioAnual: 0, // Sin opción anual
    maxSedes: 1,
    funcionalidades: [
      'reportes_por_producto',
      'reporte_fiados',
      'recomendaciones_estadisticas',
      'anotaciones_por_foto',
      'anotaciones_por_audio',
    ],
  },
  {
    id: 3,
    nombre: 'Administrador',
    precioMensual: 79900,
    precioAnual: 799900,
    maxSedes: 3,
    funcionalidades: [
      'reportes_por_producto',
      'reporte_fiados',
      'recomendaciones_estadisticas',
      'anotaciones_por_foto',
      'anotaciones_por_audio',
    ],
  },
  {
    id: 4,
    nombre: 'Socio',
    precioMensual: 149900,
    precioAnual: 1449900,
    maxSedes: 5,
    funcionalidades: [
      'reportes_por_producto',
      'reporte_fiados',
      'recomendaciones_estadisticas',
      'anotaciones_por_foto',
      'anotaciones_por_audio',
      'ia_avanzada',
    ],
  },
  {
    id: 5,
    nombre: 'Corporativo',
    precioMensual: 0,
    precioAnual: 0,
    maxSedes: 0, // Sedes por definir
    funcionalidades: [
      'reportes_por_producto',
      'reporte_fiados',
      'recomendaciones_estadisticas',
      'anotaciones_por_foto',
      'anotaciones_por_audio',
      'ia_avanzada',
      'soporte_dedicado',
    ],
  },
];

/**
 * Cuota de mensajes de IA que muestra cada plan.
 *
 * OJO: estos numeros estan duplicados. La fuente de verdad es `PLAN_LIMITS`
 * en el backend (`src/ai/usage/usage.service.ts`), que es quien realmente
 * corta el servicio cuando se agota la cuota. Si cambian alli, hay que
 * cambiarlos aqui tambien: la pagina llego a anunciar 50 mensajes mientras el
 * backend ya concedia 500.
 */
export const MENSAJES_IA_POR_PLAN: Record<
  number,
  string
> = {
  1: '100 mensajes de IA / mes',
  2: '500 mensajes de IA / mes',
  3: '1.500 mensajes de IA / mes',
  4: '3.000 mensajes de IA / mes',
  5: 'Mensajes de IA por definir',
};

export const LIMITE_MENSAJES_IA_POR_PLAN: Record<number, number> = {
  1: 100,
  2: 500,
  3: 1_500,
  4: 3_000,
};

export const DESCRIPCIONES_POR_PLAN: Record<
  number,
  string
> = {
  1: 'Para dar los primeros pasos y organizar tu negocio con Luka AI.',
  2: 'Control financiero total y copiloto con IA para 1 sede comercial.',
  3: 'Ideal para pymes en expansión con hasta 3 sedes y alto volumen.',
  4: 'Para empresas consolidadas que requieren IA avanzada y hasta 5 sedes.',
  5: 'Soluciones enterprise a la medida con soporte prioritario y sedes por definir.',
};

export const planesApi = {
  /**
   * Obtiene el catálogo comercial oficial de 5 planes
   * de Luka AI.
   */
  async getPlanesCatalogo(
    _forceRefresh = false,
  ): Promise<PlanBackend[]> {
    return PLANES_FALLBACK;
  },

  /**
   * Obtiene la información del plan
   * del negocio actual.
   */
  async getNegocioPlan(
    negocioId: string,
  ): Promise<NegocioPlanInfo | null> {
    if (!negocioId) {
      return null;
    }

    try {
      return await apiClient<NegocioPlanInfo>(
        `/negocios/${negocioId}`,
      );
    } catch {
      return null;
    }
  },

  /**
   * Baja voluntariamente el negocio
   * al plan Asistente.
   *
   * No cancela pagos.
   * No elimina información.
   * No requiere Wompi.
   *
   * El backend es quien autoriza y ejecuta
   * el cambio.
   */
  async cambiarAAsistente(
    negocioId: string,
  ): Promise<NegocioPlanInfo> {
    if (!negocioId) {
      throw new Error(
        'No hay un negocio activo.',
      );
    }

    return apiClient<NegocioPlanInfo>(
      `/negocios/${negocioId}/plan/asistente`,
      {
        method: 'PATCH',
      },
    );
  },
};