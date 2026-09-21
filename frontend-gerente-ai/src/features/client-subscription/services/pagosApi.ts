import { apiClient } from '@/lib/apiClient';
import type { CicloFacturacion } from '@/shared/api/planesApi';

export type EstadoPago =
  | 'PENDIENTE'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'ANULADO'
  | 'ERROR';

export interface DatosDeCheckout {
  referencia: string;
  montoEnCentavos: number;
  moneda: string;
  firmaDeIntegridad: string;
  llavePublica: string;
  plan: {
    id: number;
    nombre: string;
  };
  ciclo: CicloFacturacion;
}

export interface Pago {
  id: string;
  referencia: string;
  estado: EstadoPago;
  plan: number;
  ciclo: 'MENSUAL' | 'ANUAL';
  montoEnCentavos: number;
  moneda: string;
  wompiTransaccionId: string | null;
  procesadoEl: string | null;
  createdAt: string;
  metodoPago: {
    tipo: string;
    ultimos4: string | null;
  } | null;
}

export function crearCheckout(
  negocioId: string,
  plan: number,
  ciclo: CicloFacturacion,
): Promise<DatosDeCheckout> {
  return apiClient<DatosDeCheckout>(
    '/pagos/checkout',
    {
      method: 'POST',
      body: JSON.stringify({
        negocioId,
        plan,
        ciclo,
      }),
    },
  );
}

export function consultarPago(
  referencia: string,
  wompiId?: string,
): Promise<Pago> {
  const params = new URLSearchParams();
  if (wompiId) {
    params.set('wompiId', wompiId);
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';
  return apiClient<Pago>(
    `/pagos/${encodeURIComponent(referencia)}${queryString}`,
  );
}

export function historialDePagos(
  negocioId: string,
): Promise<Pago[]> {
  return apiClient<Pago[]>(
    `/pagos?negocioId=${encodeURIComponent(
      negocioId,
    )}`,
  );
}

/**
 * Cambia voluntariamente el negocio al plan Asistente.
 *
 * No cancela una suscripción de Wompi porque los pagos de Luka
 * no se manejan como una suscripción automática: simplemente
 * cambia el plan que rige actualmente en el negocio.
 *
 * Los datos del negocio y el historial de pagos permanecen intactos.
 */
export function cambiarAAsistente(
  negocioId: string,
) {
  return apiClient(
    `/negocios/${encodeURIComponent(
      negocioId,
    )}/plan/asistente`,
    {
      method: 'PATCH',
    },
  );
}

/**
 * Arma el enlace del checkout alojado de Wompi.
 */
export function urlDelCheckout(
  datos: DatosDeCheckout,
): string {
  const base =
    import.meta.env.VITE_WOMPI_CHECKOUT_URL ||
    'https://checkout.wompi.co/p/';

  const redireccion =
    `${window.location.origin}` +
    `/pago/resultado?ref=` +
    `${encodeURIComponent(
      datos.referencia,
    )}`;

  const parametros = new URLSearchParams({
    'public-key': datos.llavePublica,
    currency: datos.moneda,
    'amount-in-cents': String(
      datos.montoEnCentavos,
    ),
    reference: datos.referencia,
    'signature:integrity':
      datos.firmaDeIntegridad,
    'redirect-url': redireccion,
  });

  return `${base}?${parametros.toString()}`;
}

export async function iniciarPago(
  negocioId: string,
  plan: number,
  ciclo: CicloFacturacion,
): Promise<never> {
  const datos = await crearCheckout(
    negocioId,
    plan,
    ciclo,
  );

  window.location.href =
    urlDelCheckout(datos);

  return new Promise<never>(() => { });
}

export async function esperarResultado(
  referencia: string,
  opciones: {
    intentos?: number;
    esperaMs?: number;
    wompiId?: string;
  } = {},
): Promise<Pago> {
  const {
    intentos = 20,
    esperaMs = 2500,
    wompiId,
  } = opciones;

  let ultimo =
    await consultarPago(referencia, wompiId);

  for (
    let i = 0;
    i < intentos &&
    ultimo.estado === 'PENDIENTE';
    i++
  ) {
    await new Promise((seguir) =>
      setTimeout(
        seguir,
        esperaMs,
      ),
    );

    ultimo =
      await consultarPago(referencia, wompiId);
  }

  return ultimo;
}