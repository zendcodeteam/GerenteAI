import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PagosService } from '../services/pagos.service';
import { CrearCheckoutDto } from '../dto/pagos/crear-checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

type AuthUser = { userId: string; rolGlobal: string };

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  crearCheckout(@CurrentUser() user: AuthUser, @Body() dto: CrearCheckoutDto) {
    return this.pagosService.crearCheckout(user.userId, user.rolGlobal, dto);
  }

  /**
   * Webhook de Wompi. Es el único endpoint del módulo sin `JwtAuthGuard`, y lo
   * es por necesidad: quien llama es Wompi, que no tiene ninguna sesión. Lo que
   * autentica la llamada es la firma del evento, que se verifica en el servicio.
   *
   * El cuerpo se recibe como `unknown` a propósito. El `ValidationPipe` global
   * corre con `forbidNonWhitelisted`, así que un DTO rechazaría el evento por
   * traer campos que no declaramos —y Wompi manda decenas—. Sin DTO, el pipe no
   * se activa y la comprobación la hace el servicio, que además tiene que
   * validarlo como dato hostil de todos modos.
   *
   * Responde 200 incluso ante un evento inválido: Wompi reintenta lo que no
   * confirmamos, y devolver error por algo que nunca vamos a poder procesar lo
   * dejaría reintentando indefinidamente.
   */
  @Post('webhook')
  @HttpCode(200)
  // Wompi reintenta lo que no confirmamos; un 429 solo generaría más
  // reintentos. Lo autentica la firma, no hace falta limitarlo por IP.
  @SkipThrottle()
  webhook(@Body() cuerpo: unknown) {
    return this.pagosService.procesarEvento(cuerpo);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('negocioId') negocioId?: string,
  ) {
    return this.pagosService.findAll(user.userId, user.rolGlobal, negocioId);
  }

  // Por referencia y no por id: la referencia es lo que el frontend conoce al
  // volver del checkout, porque es lo que él mismo le pasó a Wompi.
  @Get(':referencia')
  @UseGuards(JwtAuthGuard)
  porReferencia(
    @Param('referencia') referencia: string,
    @CurrentUser() user: AuthUser,
    @Query('wompiId') wompiId?: string,
  ) {
    return this.pagosService.porReferencia(
      referencia,
      user.userId,
      user.rolGlobal,
      wompiId,
    );
  }
}
