import { apiClient } from "@/lib/apiClient";

export interface InvestorStatsResponse {
  generadoEl: string;

  usuarios: {
    total: number;
  };

  negocios: {
    total: number;
    activosUltimos30Dias: number;
    conPlanPagoVigente: number;
  };

  monetizacion: {
    mrrEstimado: number;
    negociosQuePagaronAlgunaVez: number;
    tasaRetencionPagos: number;
    distribucionPorPlan: { plan: string; total: number }[];
  };

  actividadPlataforma: {
    mensajesWhatsapp: number;
    ventasRegistradas: number;
    gastosRegistrados: number;
    interaccionesIa: number;
    recordatoriosFiadosEnviados: number;
    reportesGenerados: number;
  };

  crecimiento: {
    usuarios: { mes: string; total: number }[];
    negocios: { mes: string; total: number }[];
    ingresosMensuales: { mes: string; ingresos: number }[];
  };

  actividadReciente: {
    tipo: "negocio" | "pago" | "usuario";
    titulo: string;
    descripcion: string;
    fecha: string;
  }[];
}

/**
 * Endpoint público (sin sesión) con estadísticas agregadas y reales de Luka.
 * Alimenta la página de inversores.
 */
export const investorApi = {
  obtenerResumen: () =>
    apiClient<InvestorStatsResponse>("/estadisticas/publicas", {
      skipCache: true,
    }),
};
