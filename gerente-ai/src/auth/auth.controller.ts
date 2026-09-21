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

import { Throttle } from '@nestjs/throttler';

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
import { ActivarMfaDto, VerificarMfaDto } from './dto/mfa.dto';

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

/**
 * Límites por IP de los endpoints públicos de auth.
 *
 * CREDENCIALES (login, Google, códigos MFA): 30 cada 15 minutos. No son 5
 * porque en Colombia muchos usuarios comparten IP pública (redes móviles con
 * CGNAT, el wifi de un negocio con varios empleados) y se bloquearían entre
 * sí sin haber hecho nada. La fuerza bruta contra UNA cuenta la corta el
 * bloqueo por cuenta del login (5 contraseñas incorrectas) y el de MFA
 * (5 códigos), que no dependen de la IP.
 *
 * CORREOS (registro, recuperar contraseña, reenviar verificación, cambio de
 * correo): 5 cada 15 minutos. Cada petición manda un correo a una dirección
 * que elige quien llama, así que el límite protege la reputación del
 * remitente y la cuota de Brevo. Son operaciones que nadie repite seguido.
 *
 * ENLACES (verificar correo, reset, confirmar cambio): 10 cada 15 minutos.
 * Se abren desde el correo y a veces se reintentan.
 */
const VENTANA = 15 * 60_000;

const LIMITE_CREDENCIALES = {
  default: { limit: 30, ttl: VENTANA },
};

const LIMITE_CORREOS = {
  default: { limit: 5, ttl: VENTANA },
};

const LIMITE_ENLACES = {
  default: { limit: 10, ttl: VENTANA },
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // ============================================================
  // REGISTRO TRADICIONAL
  // ============================================================

  @Throttle(LIMITE_CORREOS)
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

  @Throttle(LIMITE_ENLACES)
  @Get('verificar-email')
  verificarEmail(
    @Query('token') token: string,
  ) {
    return this.authService.verificarEmail(token);
  }

  // ============================================================
  // LOGIN TRADICIONAL
  // ============================================================

  /**
   * Inicio de sesión mediante correo y contraseña.
   *
   * CLIENTE:
   *   Devuelve directamente la sesión.
   *
   * MASTER sin MFA:
   *   Devuelve las instrucciones/token temporal para activar MFA.
   *
   * MASTER con MFA:
   *   Devuelve un token temporal para completar la verificación
   *   del segundo factor.
   *
   * IMPORTANTE:
   *
   * Nunca debe persistirse un access_token definitivo en el
   * frontend mientras un MASTER tenga MFA pendiente.
   */
  @Throttle(LIMITE_CREDENCIALES)
  @Post('login')
  login(
    @Body() dto: LoginDto,
  ) {
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
   *
   * Google únicamente valida la identidad inicial.
   *
   * Si la cuenta pertenece a un MASTER, el flujo continúa
   * obligatoriamente por MFA antes de emitir la sesión definitiva.
   */
  @Throttle(LIMITE_CREDENCIALES)
  @Post('google')
  googleLogin(
    @Body() dto: GoogleLoginDto,
  ) {
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
   */
  @Throttle(LIMITE_CREDENCIALES)
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
  // MFA - ACTIVAR SEGUNDO FACTOR
  // ============================================================

  /**
   * Inicia la activación de MFA para un usuario MASTER.
   *
   * Este endpoint NO utiliza JwtAuthGuard porque el MASTER todavía
   * no tiene una sesión definitiva cuando MFA es obligatorio.
   *
   * Recibe el token temporal entregado por el login.
   *
   * El backend:
   *
   *   1. Valida el token temporal.
   *   2. Comprueba que pertenece a un MASTER.
   *   3. Genera/configura el secreto TOTP.
   *   4. Devuelve la información necesaria para configurar
   *      Google Authenticator, Microsoft Authenticator, Authy, etc.
   *
   * IMPORTANTE:
   *
   * Este endpoint NO crea todavía una sesión definitiva.
   */
  @Throttle(LIMITE_CREDENCIALES)
  @Post('mfa/activar')
  activarMfa(
    @Body() body: ActivarMfaDto,
  ) {
    return this.authService.activarMfa(
      body.mfaToken,
    );
  }

  // ============================================================
  // MFA - CONFIRMAR ACTIVACIÓN
  // ============================================================

  /**
   * Confirma que el MASTER configuró correctamente su
   * aplicación autenticadora.
   *
   * El usuario introduce el código TOTP de seis dígitos.
   *
   * Si el código es correcto:
   *
   *   - MFA queda activado.
   *   - Se invalida el flujo temporal de activación.
   *   - Se genera la sesión definitiva.
   *
   * Si el código es incorrecto:
   *   - No se activa MFA.
   *   - No se entrega access_token.
   */
  @Throttle(LIMITE_CREDENCIALES)
  @Post('mfa/verificar-activacion')
  verificarActivacionMfa(
    @Body() body: VerificarMfaDto,
  ) {
    return this.authService.verificarActivacionMfa(
      body.mfaToken,
      body.codigo,
    );
  }

  // ============================================================
  // MFA - VERIFICAR LOGIN
  // ============================================================

  /**
   * Completa el inicio de sesión de un usuario MASTER que
   * ya tiene MFA activado.
   *
   * El usuario proporciona:
   *
   *   - Token temporal del login.
   *   - Código TOTP de su aplicación autenticadora.
   *
   * Solamente después de verificar correctamente el código,
   * AuthService genera el access_token definitivo.
   *
   * Este endpoint NO utiliza JwtAuthGuard porque precisamente
   * su objetivo es convertir una autenticación pendiente en
   * una sesión autenticada.
   */
  @Throttle(LIMITE_CREDENCIALES)
  @Post('mfa/verificar')
  verificarMfa(
    @Body() body: VerificarMfaDto,
  ) {
    return this.authService.verificarMfa(
      body.mfaToken,
      body.codigo,
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
  private getClientIp(
    req: RequestWithIp,
  ): string {
    const forwardedFor =
      req.headers['x-forwarded-for'];

    if (forwardedFor) {
      const firstIp = forwardedFor
        .split(',')
        .map((ip) => ip.trim())
        .find(Boolean);

      if (firstIp) {
        return firstIp;
      }
    }

    const realIp =
      req.headers['x-real-ip']?.trim();

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
  getPerfil(
    @CurrentUser() user: AuthUser,
  ) {
    return this.authService.getPerfil(
      user.userId,
    );
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
  buscarPorEmail(
    @Query('email') email?: string,
  ) {
    return this.authService.buscarPorEmail(
      email,
    );
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

  @Throttle(LIMITE_CORREOS)
  @Post('reenviar-verificacion')
  reenviarVerificacion(
    @Body() dto: ReenviarVerificacionDto,
  ) {
    return this.authService.reenviarVerificacion(
      dto,
    );
  }

  // ============================================================
  // ACTUALIZAR USUARIO
  // ============================================================

  @Patch('usuarios/me')
  @UseGuards(JwtAuthGuard)
  updateUsuario(
    @CurrentUser() user: {
      userId: string;
    },
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

  @Throttle(LIMITE_CORREOS)
  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(
      dto,
    );
  }

  // ============================================================
  // RESTABLECER CONTRASEÑA
  // ============================================================

  @Throttle(LIMITE_ENLACES)
  @Post('reset-password')
  resetPassword(
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(
      dto,
    );
  }

  // ============================================================
  // CAMBIAR EMAIL
  // ============================================================

  @Throttle(LIMITE_CORREOS)
  @Post('cambiar-email')
  @UseGuards(JwtAuthGuard)
  cambiarEmail(
    @CurrentUser() user: {
      userId: string;
    },
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

  @Throttle(LIMITE_ENLACES)
  @Post('confirmar-cambio-email')
  confirmarCambioEmail(
    @Body() dto: ConfirmarCambioEmailDto,
  ) {
    return this.authService.confirmarCambioEmail(
      dto,
    );
  }
}