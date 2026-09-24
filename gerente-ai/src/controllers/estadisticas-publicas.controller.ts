import { Controller, Get } from '@nestjs/common';
import { EstadisticasPublicasService } from '../services/estadisticas-publicas.service';

/**
 * Estadísticas agregadas y públicas de la plataforma.
 *
 * Alimenta la página de inversores (`/investors`) del frontend, que no
 * requiere sesión. Por eso no lleva guard, igual que `/planes`: solo se
 * exponen números agregados, nunca datos de un negocio o usuario concreto.
 */
@Controller('estadisticas')
export class EstadisticasPublicasController {
  constructor(
    private readonly estadisticasPublicasService: EstadisticasPublicasService,
  ) {}

  @Get('publicas')
  resumen() {
    return this.estadisticasPublicasService.resumen();
  }
}
