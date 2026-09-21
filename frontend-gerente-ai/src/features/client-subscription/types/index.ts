import { PlanBackend, CicloFacturacion } from '@/shared/api/planesApi';

export type MetodoPagoWompi = 'CARD' | 'PSE' | 'NEQUI' | 'BANCOLOMBIA_TRANSFER';

export type TipoDocumento = 'CC' | 'NIT' | 'CE' | 'PPN';
export type TipoPersonaPse = '0' | '1'; // 0 = Natural, 1 = Jurídica

export interface DatosFacturacion {
  nombreCompleto: string;
  email: string;
  telefono: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
}

/**
 * ============================================================
 * SEGURIDAD Y CUMPLIMIENTO PCI DSS:
 * ============================================================
 * NUNCA declarar ni recopilar tipos o campos para datos sensibles de tarjeta
 * (número de tarjeta/PAN, CVV/CVC, fecha de expiración) en esta aplicación.
 * 
 * Luka AI delega el 100% del procesamiento de tarjetas a pasarelas certificadas
 * (Wompi Widget / Hosted Checkout / Tokenización directa en cliente de Wompi).
 * Capturar o manipular estos datos directamente en nuestro frontend o backend
 * colocaría inmediatamente a toda la infraestructura bajo el alcance estricto
 * de auditoría y responsabilidad de PCI DSS (SAQ D / SAQ A-EP).
 */

export interface DatosPse {
  bancoCodigo: string;
  tipoPersona: TipoPersonaPse;
}

export interface DatosNequi {
  telefonoNequi: string;
}

export interface CheckoutPayload {
  negocioId: string;
  plan: PlanBackend;
  ciclo: CicloFacturacion;
  metodo: MetodoPagoWompi;
  facturacion: DatosFacturacion;
  pse?: DatosPse;
  nequi?: DatosNequi;
}

export interface ResultadoTransaccionWompi {
  idTransaccion: string;
  referencia: string;
  estado: 'APROBADA' | 'RECHAZADA' | 'PENDIENTE';
  montoEnCentavos: number;
  moneda: 'COP';
  fecha: string;
  metodoPago: MetodoPagoWompi;
  planId: number;
  planNombre: string;
  ciclo: CicloFacturacion;
  mensaje: string;
}

export interface BancoPse {
  codigo: string;
  nombre: string;
}
