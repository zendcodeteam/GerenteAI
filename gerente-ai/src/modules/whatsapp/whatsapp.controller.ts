import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { DestinatariosService } from './services/destinatarios.service';
import { InterpretMessageDto } from './dto/interpret-message.dto';
import { N8nApiKeyGuard } from './guards/n8n-api-key.guard';
import { RegistrarEnvioDto } from './dto/registrar-envio.dto';
import {
  WhatsappInterpretService,
  type InterpretResponse,
} from './services/whatsapp-interpret.service';
import type { FiadoPorCobrar } from './services/destinatarios.service';
import { CuentasProveedoresService } from '../../services/cuentas-proveedores.service';

/**
 * API que consume n8n. Es la unica puerta de entrada del canal de WhatsApp.
 *
 * No se monta en `FinanceAiController` a proposito: aquel sirve al frontend
 * (respuestas envueltas en `{success, data}`) y este sirve a un workflow, que
 * necesita un JSON plano y estable. Mezclarlos obligaria a n8n a cambiar cada
 * vez que cambie el panel.
 */
@Controller('ai')
@UseGuards(N8nApiKeyGuard)
// Todo lo de este controlador llega desde n8n, o sea desde una sola IP: el
// límite global por IP sumaría a todos los negocios como si fueran uno. Ya lo
// protege la API key, y /interpret se limita por remitente (en el servicio).
@SkipThrottle()
export class WhatsappController {
  /** Dias que se le dan al fiado antes de recordarle al duenno que cobre. */
  private static readonly DIAS_PARA_COBRAR_FIADO = 5;

  constructor(
    private readonly interpretService: WhatsappInterpretService,
    private readonly destinatarios: DestinatariosService,
    private readonly cuentasProveedores: CuentasProveedoresService,
  ) {}

  /**
   * Interpreta un mensaje de WhatsApp y devuelve el texto de respuesta.
   *
   * Responde 200 incluso cuando la IA falla (con `ok:false` y un `reply`
   * degradado): asi el usuario de WhatsApp siempre recibe algo. Los unicos
   * errores que llegan a n8n como fallo son los que si conviene reintentar
   * (400 por payload invalido, 401 por API key, 5xx por caida del backend).
   */
  @Post('interpret')
  @HttpCode(200)
  interpret(@Body() dto: InterpretMessageDto): Promise<InterpretResponse> {
    return this.interpretService.interpret(dto);
  }

  /**
   * n8n avisa con que id quedo enviada la respuesta de Luka.
   *
   * El backend calcula la respuesta pero no la envia, asi que el `wamid` con
   * el que Meta la acepta solo lo conoce el workflow. Guardarlo es lo que
   * permite reconocer despues ese mensaje cuando el usuario lo cita para
   * responderle ("pero esto es lo que me dijiste").
   *
   * Responde 200 aunque el mensaje ya no exista: es una anotacion util, no una
   * operacion critica, y no vale la pena que n8n reintente por ella.
   */
  @Post('interpret/enviado')
  @HttpCode(200)
  async registrarEnvio(@Body() dto: RegistrarEnvioDto) {
    const anotado = await this.interpretService.registrarEnvio(
      dto.mensajeId,
      dto.wamid,
    );
    return { ok: true, anotado };
  }

  /**
   * Sedes que hoy no registraron nada: la lista del recordatorio de las 9 p.m.
   *
   * Antes n8n resolvia esto con su propio SQL, que solo miraba la linea de la
   * sede. Quien usaba el bot desde su telefono personal escribia sin problema
   * pero nunca recibia el recordatorio. Ahora la definicion de "contacto
   * alcanzable" es una sola y vive junto al enrutamiento que ya la conocia.
   */
  @Get('recordatorios/nocturno')
  async recordatorioNocturno() {
    const destinatarios = await this.destinatarios.sedesSinMovimientosHoy();
    const resumenes = await this.destinatarios.resumenesConMovimientosHoy();
    return {
      total: destinatarios.length + resumenes.length,
      destinatarios,
      resumenes,
    };
  }

  /**
   * Fiados que llevan 5 dias sin cobrarse.
   *
   * Servirlos los marca como avisados: si se marcaran despues del envio, dos
   * ejecuciones simultaneas mandarian el mismo recordatorio dos veces.
   */
  @Get('recordatorios/fiados')
  async recordatorioFiados() {
    const fiados = await this.destinatarios.fiadosPorCobrar(
      WhatsappController.DIAS_PARA_COBRAR_FIADO,
    );
    await this.destinatarios.marcarFiadosAvisados(fiados);

    return {
      total: fiados.length,
      fiados: fiados.map((fiado) => ({
        ...fiado,
        // El monto ya formateado. Si lo armara n8n, el formato colombiano
        // acabaria escrito en dos sitios y terminarian discrepando.
        montoTexto: montoColombiano(fiado.saldo),
        // Texto completo, para los canales que admiten texto libre y para el
        // log. WhatsApp fuera de la ventana de 24 h exige plantilla, asi que el
        // workflow envia las partes por separado; el tono se cambia aqui.
        mensaje: mensajeDeCobro(fiado),
      })),
    };
  }

  @Get('recordatorios/proveedores')
  async recordatorioProveedores() {
    const recordatorios = await this.cuentasProveedores.recordatorios();
    return {
      total: recordatorios.length,
      recordatorios,
    };
  }

  /** Comprobacion rapida desde n8n: ¿esta viva la integracion y la API key es correcta? */
  @Get('interpret/ping')
  ping() {
    return {
      ok: true,
      service: 'whatsapp-interpret',
      at: new Date().toISOString(),
    };
  }
}

/**
 * El texto del recordatorio de cobro.
 *
 * Se nombran la persona y el monto porque el duenno puede tener varios fiados
 * abiertos y un aviso generico no le dice a quien perseguir.
 */
function mensajeDeCobro(fiado: FiadoPorCobrar): string {
  const monto = montoColombiano(fiado.saldo);

  return (
    `Hola ${fiado.contacto} 👋 Un recordatorio de ${fiado.negocio} (${fiado.sede}):

` +
    `${fiado.cliente} te debe ${monto} del fiado que registraste hace ${fiado.diasTranscurridos} días.

` +
    `No olvides cobrarle. Cuando te pague, escríbeme y lo marco como cobrado.`
  );
}

/** Pesos colombianos, sin decimales: `$45.000`. */
function montoColombiano(valor: number): string {
  return `$${Math.round(valor).toLocaleString('es-CO')}`;
}
