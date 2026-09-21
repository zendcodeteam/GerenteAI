import { Injectable } from '@nestjs/common';

/**
 * Límite de mensajes por remitente de WhatsApp.
 *
 * `/ai/interpret` no se puede limitar por IP: todos los mensajes llegan desde
 * n8n, así que un límite por IP sumaría a todos los negocios como si fueran
 * una sola persona. Lo que hay que frenar es a UN remitente mandando ráfagas,
 * porque cada mensaje es una llamada a la IA. El total mensual ya lo acota la
 * cuota del plan (ConsumoIa); esto solo corta los picos.
 *
 * Ventana deslizante: se guardan las marcas de tiempo de los mensajes de cada
 * remitente dentro de la ventana y se rechaza cuando ya hay `limite`.
 *
 * ALCANCE: memoria del proceso, igual que MessageDedupeService. Con una sola
 * instancia basta; con varias réplicas cada una cuenta por su lado (el límite
 * se relaja, nunca se endurece).
 */
@Injectable()
export class LimitePorRemitenteService {
  private readonly mensajes = new Map<string, number[]>();

  /** 20 mensajes cada 5 minutos: holgado para quien registra ventas seguidas. */
  readonly limite = 20;
  readonly ventanaMs = 5 * 60 * 1_000;
  /** Tope de memoria: con más remitentes se barren los inactivos. */
  private readonly maxRemitentes = 10_000;

  /**
   * Registra un mensaje del remitente y devuelve false si ya superó el límite.
   * No escribe en el log: la clave lleva el teléfono completo, y quien llama
   * sabe enmascararlo.
   * El mensaje rechazado no cuenta: quien espera recupera cupo a medida que
   * vencen los anteriores, aunque siga insistiendo.
   */
  permitir(remitente: string, ahora = Date.now()): boolean {
    if (process.env.RATE_LIMIT_DISABLED === 'true') return true;

    if (this.mensajes.size > this.maxRemitentes) this.barrer(ahora);

    const recientes = (this.mensajes.get(remitente) ?? []).filter(
      (at) => ahora - at < this.ventanaMs,
    );

    if (recientes.length >= this.limite) {
      this.mensajes.set(remitente, recientes);
      return false;
    }

    recientes.push(ahora);
    this.mensajes.set(remitente, recientes);
    return true;
  }

  private barrer(ahora: number): void {
    for (const [remitente, marcas] of this.mensajes) {
      if (marcas.every((at) => ahora - at >= this.ventanaMs)) {
        this.mensajes.delete(remitente);
      }
    }
  }
}
