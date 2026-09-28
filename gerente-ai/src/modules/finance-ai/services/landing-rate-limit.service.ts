import { Injectable } from '@nestjs/common';

/**
 * Tope diario por IP para el chat informativo del landing.
 *
 * El `@Throttle` del controlador (8/min) frena rafagas, pero no evita que una
 * sola IP se quede justo debajo de ese limite las 24 horas (~11.500
 * peticiones/dia). Este servicio pone un techo mas alto y mas lento: al
 * llegarlo, el servicio deja de llamar al modelo y devuelve una respuesta
 * fija invitando a continuar por WhatsApp o a registrarse.
 *
 * Ventana deslizante, mismo patron que LimitePorRemitenteService (WhatsApp).
 *
 * ALCANCE: memoria del proceso. Se reinicia con cada despliegue y, con varias
 * replicas, cada una cuenta por su lado (el limite se relaja, nunca se
 * endurece) - igual que el resto de los limitadores de este proyecto.
 */
@Injectable()
export class LandingRateLimitService {
  private readonly peticiones = new Map<string, number[]>();

  /** 40 mensajes/dia: generoso para una conversacion real, corta el abuso sostenido. */
  readonly limite = 40;
  readonly ventanaMs = 24 * 60 * 60 * 1_000;
  private readonly maxIps = 10_000;

  permitir(ip: string, ahora = Date.now()): boolean {
    if (process.env.RATE_LIMIT_DISABLED === 'true') return true;

    if (this.peticiones.size > this.maxIps) this.barrer(ahora);

    const recientes = (this.peticiones.get(ip) ?? []).filter(
      (at) => ahora - at < this.ventanaMs,
    );

    if (recientes.length >= this.limite) {
      this.peticiones.set(ip, recientes);
      return false;
    }

    recientes.push(ahora);
    this.peticiones.set(ip, recientes);
    return true;
  }

  private barrer(ahora: number): void {
    for (const [ip, marcas] of this.peticiones) {
      if (marcas.every((at) => ahora - at >= this.ventanaMs)) {
        this.peticiones.delete(ip);
      }
    }
  }
}
