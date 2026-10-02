import {
  Controller,
  ForbiddenException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RetencionMensajesService } from '../services/retencion-mensajes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthUser = { userId: string; rolGlobal: string };

@Controller('retencion-mensajes')
export class RetencionMensajesController {
  constructor(private readonly retencionService: RetencionMensajesService) {}

  /**
   * Dispara la purga de mensajes que superen el plazo de retención.
   *
   * Solo MASTER: purgar datos históricos es una operación administrativa que
   * solo puede ser invocada por personal autorizado o jobs de mantenimiento.
   */
  @Post('ejecutar')
  @UseGuards(JwtAuthGuard)
  async ejecutar(
    @CurrentUser() user: AuthUser,
    @Query('meses') meses?: string,
  ) {
    if (user.rolGlobal !== 'MASTER') {
      throw new ForbiddenException(
        'Solo la plataforma (rol MASTER) puede disparar la purga de mensajes',
      );
    }
    const mesesNum = meses ? parseInt(meses, 10) : undefined;
    return this.retencionService.purgarMensajes(
      mesesNum && !isNaN(mesesNum) ? mesesNum : undefined,
    );
  }
}
