import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleRegisterDto } from './dto/google-register.dto';
import { AsociarNegocioDto } from './dto/asociar-negocio.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ReenviarVerificacionDto } from './dto/reenviar-verificacion.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmarCambioEmailDto } from './dto/confirmar-cambio-email.dto';
import { CambiarEmailDto } from './dto/cambiar-email.dto';

type AuthUser = {
  userId: string;
  rolGlobal: string;
};

type RequestWithIp = {
  ip?: string;
  headers: {
    'x-forwarded-for'?: string;
    'x-real-ip'?: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ============================================================
  // REGISTRO TRADICIONAL
  // ============================================================

  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Req() req: RequestWithIp,
  ) {
    return this.authService.register(
      dto,
      this.getClientIp(req),
    );
  }

  // ============================================================
  // VERIFICACIÓN DE EMAIL
  // ============================================================

  @Get('verificar-email')
  verificarEmail(@Query('token') token: string) {
    return this.authService.verificarEmail(token);
  }

  // ============================================================
  // LOGIN TRADICIONAL
  // ============================================================

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ============================================================
  // LOGIN CON GOOGLE
  // ============================================================

  /**
   * Inicio de sesión mediante Google.
   *
   * Este endpoint es público.
   *
   * IMPORTANTE:
   * Este endpoint SOLO inicia sesión.
   *
   * Si el correo de Google no pertenece a una cuenta existente
   * de Luka, AuthService devuelve un error indicando que debe
   * utilizar el flujo de registro.
   */
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto);
  }

  // ============================================================
  // REGISTRO CON GOOGLE
  // ============================================================

  /**
   * Registro de una nueva cuenta utilizando Google.
   *
   * Google proporciona:
   *
   *   - Nombre
   *   - Email
   *   - Google ID
   *
   * Luka solicita adicionalmente:
   *
   *   - Teléfono colombiano
   *   - Nombre del negocio
   *   - Usuario de WhatsApp (opcional)
   *   - Aceptación de Términos de servicio
   *   - Autorización para el tratamiento de datos personales
   *
   * El AuthService se encarga de crear:
   *
   *   Usuario
   *   Negocio
   *   UsuarioNegocio
   *   Sede principal
   *   UsuarioSede
   *   Consentimientos legales
   *
   * y finalmente devuelve el JWT de sesión.
   */
  @Post('google/register')
  googleRegister(
    @Body() dto: GoogleRegisterDto,
    @Req() req: RequestWithIp,
  ) {
    return this.authService.googleRegister(
      dto,
      this.getClientIp(req),
    );
  }

  // ============================================================
  // OBTENER IP DEL CLIENTE
  // ============================================================

  /**
   * Obtiene la IP del cliente teniendo en cuenta que Luka
   * puede ejecutarse detrás de un proxy o balanceador.
   *
   * En producción, plataformas como Render pueden enviar
   * la IP original mediante X-Forwarded-For.
   *
   * Se toma únicamente la primera IP de la cadena.
   */
  private getClientIp(req: RequestWithIp): string {
    const forwardedFor = req.headers['x-forwarded-for'];

    if (forwardedFor) {
      const firstIp = forwardedFor
        .split(',')
        .map((ip) => ip.trim())
        .find(Boolean);

      if (firstIp) {
        return firstIp;
      }
    }

    const realIp = req.headers['x-real-ip']?.trim();

    if (realIp) {
      return realIp;
    }

    return req.ip?.trim() || 'unknown';
  }

  // ============================================================
  // ASOCIAR NEGOCIO
  // ============================================================

  @Post('asociar-negocio')
  @UseGuards(JwtAuthGuard)
  asociarNegocio(
    @CurrentUser() user: AuthUser,
    @Body() dto: AsociarNegocioDto,
  ) {
    return this.authService.asociarNegocio(
      user.userId,
      user.rolGlobal,
      dto,
    );
  }

  // ============================================================
  // PERFIL
  // ============================================================

  @Get('usuarios/me')
  @UseGuards(JwtAuthGuard)
  getPerfil(@CurrentUser() user: AuthUser) {
    return this.authService.getPerfil(user.userId);
  }

  // ============================================================
  // BUSCAR USUARIO POR EMAIL
  // ============================================================

  /**
   * Búsqueda por correo exacto, para vincular a alguien
   * a un negocio o a una sede.
   */
  @Get('usuarios')
  @UseGuards(JwtAuthGuard)
  buscarPorEmail(@Query('email') email?: string) {
    return this.authService.buscarPorEmail(email);
  }

  // ============================================================
  // ELIMINAR USUARIO
  // ============================================================

  @Delete('usuarios/:id')
  @UseGuards(JwtAuthGuard)
  removeUsuario(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.removeUsuario(
      id,
      user.rolGlobal,
    );
  }

  // ============================================================
  // REENVIAR VERIFICACIÓN
  // ============================================================

  @Post('reenviar-verificacion')
  reenviarVerificacion(
    @Body() dto: ReenviarVerificacionDto,
  ) {
    return this.authService.reenviarVerificacion(dto);
  }

  // ============================================================
  // ACTUALIZAR USUARIO
  // ============================================================

  @Patch('usuarios/me')
  @UseGuards(JwtAuthGuard)
  updateUsuario(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.authService.updateUsuario(
      user.userId,
      dto,
    );
  }

  // ============================================================
  // RECUPERAR CONTRASEÑA
  // ============================================================

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // ============================================================
  // RESTABLECER CONTRASEÑA
  // ============================================================

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ============================================================
  // CAMBIAR EMAIL
  // ============================================================

  @Post('cambiar-email')
  @UseGuards(JwtAuthGuard)
  cambiarEmail(
    @CurrentUser() user: { userId: string },
    @Body() dto: CambiarEmailDto,
  ) {
    return this.authService.cambiarEmail(
      user.userId,
      dto,
    );
  }

  // ============================================================
  // CONFIRMAR CAMBIO DE EMAIL
  // ============================================================

  @Post('confirmar-cambio-email')
  confirmarCambioEmail(
    @Body() dto: ConfirmarCambioEmailDto,
  ) {
    return this.authService.confirmarCambioEmail(dto);
  }
}