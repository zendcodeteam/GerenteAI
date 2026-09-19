import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DocumentoLegal, Prisma } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { PrismaService } from '../services/prisma.service';
import { NegociosService } from '../services/negocios.service';
import { MailService } from './mail/mail.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { GoogleRegisterDto } from './dto/google-register.dto';
import { AsociarNegocioDto } from './dto/asociar-negocio.dto';
import { ReenviarVerificacionDto } from './dto/reenviar-verificacion.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { CambiarEmailDto } from './dto/cambiar-email.dto';
import { ConfirmarCambioEmailDto } from './dto/confirmar-cambio-email.dto';

const BCRYPT_ROUNDS = 12;
const MAX_INTENTOS_FALLIDOS = 5;
const MINUTOS_BLOQUEO = 15;

const LEGAL_DOCUMENT_VERSION = '1.0';

@Injectable()
export class AuthService {
  private readonly DUMMY_HASH =
    '$2b$10$CwTycUXWue0Thq9StjUM0uJ8gcCX5eNiUV5NcH3H0aP5Z2v5X6dS2';

  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly negociosService: NegociosService,
  ) {
    this.googleClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
    );
  }

  // ============================================================
  // REGISTRO TRADICIONAL
  // ============================================================

  async register(
    dto: RegisterDto,
    ipAddress: string,
  ) {
    // ----------------------------------------------------------
    // VALIDAR ACEPTACIONES LEGALES
    // ----------------------------------------------------------

    if (!dto.termsAccepted) {
      throw new BadRequestException(
        'Debes aceptar los Términos de servicio para crear tu cuenta.',
      );
    }

    if (!dto.privacyAccepted) {
      throw new BadRequestException(
        'Debes autorizar el tratamiento de tus datos personales de acuerdo con la Política de privacidad.',
      );
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      BCRYPT_ROUNDS,
    );

    try {
      const resultado =
        await this.prisma.$transaction(
          async (tx) => {
            // --------------------------------------------------
            // USUARIO
            // --------------------------------------------------

            const usuario =
              await tx.usuario.create({
                data: {
                  nombre: dto.nombre,
                  telefono: dto.telefono,
                  email: dto.email.trim().toLowerCase(),
                  password: hashedPassword,
                },
              });

            // --------------------------------------------------
            // ACEPTACIONES LEGALES
            // --------------------------------------------------

            const aceptadoEn = new Date();

            await tx.consentimientoLegal.create({
              data: {
                usuarioId: usuario.id,
                documento:
                  DocumentoLegal.TERMINOS_SERVICIO,
                version: LEGAL_DOCUMENT_VERSION,
                aceptadoEn,
                ipAddress,
              },
            });

            await tx.consentimientoLegal.create({
              data: {
                usuarioId: usuario.id,
                documento:
                  DocumentoLegal.POLITICA_PRIVACIDAD,
                version: LEGAL_DOCUMENT_VERSION,
                aceptadoEn,
                ipAddress,
              },
            });

            return {
              usuario,
            };
          },
        );

      const usuario = resultado.usuario;

      const verificationToken = this.jwtService.sign(
        {
          sub: usuario.id,
          type: 'email-verification',
        },
        {
          expiresIn: '24h',
        },
      );

      /**
       * El correo se dispara sin esperarlo: la respuesta no depende
       * de que el SMTP conteste.
       */
      void this.mailService.sendVerificationEmail(
        usuario.email,
        usuario.nombre,
        verificationToken,
      );

      // No se devuelve accessToken a propósito.
      return {
        mensaje:
          'Cuenta creada. Revisa tu correo para activarla antes de iniciar sesión.',
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
        },
      };
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una cuenta registrada con ese correo. Intenta iniciar sesión.',
        );
      }

      throw error;
    }
  }

  // ============================================================
  // VERIFICACIÓN DE EMAIL
  // ============================================================

  async verificarEmail(token: string) {
    let payload: {
      sub: string;
      type: string;
    };

    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException(
        'El enlace de verificación es inválido o expiró',
      );
    }

    if (payload.type !== 'email-verification') {
      throw new UnauthorizedException(
        'Token inválido para esta operación',
      );
    }

    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          id: payload.sub,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado',
      );
    }

    if (usuario.emailVerificado) {
      return {
        mensaje:
          'Este correo ya había sido verificado anteriormente',
        usuarioId: usuario.id,
      };
    }

    await this.prisma.usuario.update({
      where: {
        id: usuario.id,
      },
      data: {
        emailVerificado: true,
      },
    });

    return {
      mensaje: 'Correo verificado correctamente',
      usuarioId: usuario.id,
    };
  }

  // ============================================================
  // LOGIN TRADICIONAL
  // ============================================================

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          email,
        },
        include: {
          negocios: true,
        },
      });

    // 1. Revisar bloqueo temporal ANTES de comparar la contraseña
    if (usuario && usuario.bloqueadoHasta) {
      if (usuario.bloqueadoHasta > new Date()) {
        const minutosRestantes = Math.ceil(
          (usuario.bloqueadoHasta.getTime() - Date.now()) / (1000 * 60),
        );
        throw new UnauthorizedException(
          `Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta nuevamente en ${minutosRestantes} minuto(s).`,
        );
      }
    }

    const passwordValida = usuario
      ? await bcrypt.compare(
          dto.password,
          usuario.password,
        )
      : await bcrypt.compare(
          dto.password,
          this.DUMMY_HASH,
        );

    if (!usuario || !passwordValida) {
      if (usuario) {
        const nuevosIntentos = usuario.intentosFallidos + 1;
        const seBloquea = nuevosIntentos >= MAX_INTENTOS_FALLIDOS;
        const bloqueadoHasta = seBloquea
          ? new Date(Date.now() + MINUTOS_BLOQUEO * 60 * 1000)
          : null;

        await this.prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            intentosFallidos: nuevosIntentos,
            ...(seBloquea ? { bloqueadoHasta } : {}),
          },
        });

        if (seBloquea) {
          throw new UnauthorizedException(
            `Has superado el límite de intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por ${MINUTOS_BLOQUEO} minutos.`,
          );
        }
      }

      throw new UnauthorizedException(
        'Correo o contraseña incorrectos',
      );
    }

    // Login exitoso: resetear intentos fallidos y bloqueo
    if (usuario.intentosFallidos > 0 || usuario.bloqueadoHasta) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: 0,
          bloqueadoHasta: null,
        },
      });
    }

    // Re-hashear en el login si la contraseña fue creada
    // con un factor menor a 12.
    try {
      if (
        bcrypt.getRounds(usuario.password) <
        BCRYPT_ROUNDS
      ) {
        const rehashedPassword =
          await bcrypt.hash(
            dto.password,
            BCRYPT_ROUNDS,
          );

        await this.prisma.usuario.update({
          where: {
            id: usuario.id,
          },
          data: {
            password: rehashedPassword,
          },
        });
      }
    } catch {
      // Si getRounds falla por formato no estándar,
      // no interrumpir el flujo de login.
    }

    if (!usuario.emailVerificado) {
      throw new UnauthorizedException(
        'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
      );
    }

    const usuarioNegocio =
      usuario.negocios[0];

    return this.buildAuthResponse(
      usuario.id,
      usuario.nombre,
      usuarioNegocio?.negocioId ?? null,
      usuarioNegocio?.role ?? null,
      usuario.rolGlobal,
    );
  }

  // ============================================================
  // VALIDAR CREDENCIAL DE GOOGLE
  // ============================================================

  /**
   * Google entrega un ID Token.
   *
   * Nunca confiamos directamente en nombre/email enviados
   * por el frontend.
   */
  private async validarGoogleCredential(
    credential: string,
  ) {
    const googleClientId =
      process.env.GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      throw new UnauthorizedException(
        'La autenticación con Google no está configurada en el servidor',
      );
    }

    if (!credential?.trim()) {
      throw new BadRequestException(
        'La credencial de Google es obligatoria',
      );
    }

    let ticket;

    try {
      ticket =
        await this.googleClient.verifyIdToken({
          idToken: credential,
          audience: googleClientId,
        });
    } catch {
      throw new UnauthorizedException(
        'La credencial de Google es inválida o expiró',
      );
    }

    const payload =
      ticket.getPayload();

    if (!payload) {
      throw new UnauthorizedException(
        'No fue posible obtener la información de la cuenta de Google',
      );
    }

    const googleId = payload.sub;

    const email = payload.email
      ?.trim()
      .toLowerCase();

    const nombre = payload.name?.trim();

    if (!googleId) {
      throw new UnauthorizedException(
        'Google no proporcionó un identificador de usuario válido',
      );
    }

    if (!email) {
      throw new UnauthorizedException(
        'La cuenta de Google no proporcionó un correo electrónico',
      );
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException(
        'La cuenta de Google debe tener el correo verificado',
      );
    }

    if (!nombre) {
      throw new UnauthorizedException(
        'Google no proporcionó el nombre de la cuenta',
      );
    }

    return {
      googleId,
      email,
      nombre,
    };
  }

  // ============================================================
  // LOGIN CON GOOGLE
  // ============================================================

  /**
   * Login mediante Google.
   *
   * Este método NO registra usuarios nuevos.
   */
  async googleLogin(dto: GoogleLoginDto) {
    const google =
      await this.validarGoogleCredential(
        dto.credential,
      );

    // ------------------------------------------------------------
    // 1. Buscar por Google ID
    // ------------------------------------------------------------

    const usuarioPorGoogle =
      await this.prisma.usuario.findUnique({
        where: {
          googleId: google.googleId,
        },
        include: {
          negocios: true,
        },
      });

    if (usuarioPorGoogle) {
      const usuarioNegocio =
        usuarioPorGoogle.negocios[0];

      return this.buildAuthResponse(
        usuarioPorGoogle.id,
        usuarioPorGoogle.nombre,
        usuarioNegocio?.negocioId ?? null,
        usuarioNegocio?.role ?? null,
        usuarioPorGoogle.rolGlobal,
      );
    }

    // ------------------------------------------------------------
    // 2. Buscar por email
    // ------------------------------------------------------------

    const usuarioPorEmail =
      await this.prisma.usuario.findUnique({
        where: {
          email: google.email,
        },
        include: {
          negocios: true,
        },
      });

    if (usuarioPorEmail) {
      throw new ConflictException(
        'Ya existe una cuenta de Luka con este correo. Inicia sesión con tu contraseña.',
      );
    }

    // ------------------------------------------------------------
    // 3. No existe la cuenta
    // ------------------------------------------------------------

    throw new NotFoundException(
      'No encontramos una cuenta de Luka con este correo de Google. Regístrate con Google para crear tu cuenta.',
    );
  }

  // ============================================================
  // REGISTRO CON GOOGLE
  // ============================================================

  async googleRegister(
    dto: GoogleRegisterDto,
    ipAddress: string,
  ) {
    // ----------------------------------------------------------
    // VALIDAR ACEPTACIONES LEGALES
    // ----------------------------------------------------------

    if (!dto.termsAccepted) {
      throw new BadRequestException(
        'Debes aceptar los Términos de servicio para crear tu cuenta.',
      );
    }

    if (!dto.privacyAccepted) {
      throw new BadRequestException(
        'Debes autorizar el tratamiento de tus datos personales de acuerdo con la Política de privacidad.',
      );
    }

    const google =
      await this.validarGoogleCredential(
        dto.credential,
      );

    // ------------------------------------------------------------
    // Limpiar información
    // ------------------------------------------------------------

    const telefono =
      this.normalizarTelefono(
        dto.telefono,
      );

    const nombreNegocio =
      dto.nombreNegocio?.trim();

    const whatsappUsername =
      dto.whatsappUsername
        ?.trim()
        .replace(/^@+/, '') || null;

    if (!telefono) {
      throw new BadRequestException(
        'El número de celular es obligatorio y debe tener formato colombiano, por ejemplo +573001234567',
      );
    }

    if (!nombreNegocio) {
      throw new BadRequestException(
        'El nombre del negocio es obligatorio',
      );
    }

    // ------------------------------------------------------------
    // Verificar cuenta por Google ID
    // ------------------------------------------------------------

    const cuentaPorGoogle =
      await this.prisma.usuario.findUnique({
        where: {
          googleId: google.googleId,
        },
        select: {
          id: true,
        },
      });

    if (cuentaPorGoogle) {
      throw new ConflictException(
        'Esta cuenta de Google ya está registrada en Luka. Inicia sesión con Google.',
      );
    }

    // ------------------------------------------------------------
    // Verificar cuenta por email
    // ------------------------------------------------------------

    const cuentaPorEmail =
      await this.prisma.usuario.findUnique({
        where: {
          email: google.email,
        },
        select: {
          id: true,
        },
      });

    if (cuentaPorEmail) {
      throw new ConflictException(
        'Ya existe una cuenta de Luka con este correo. Inicia sesión con tu cuenta existente.',
      );
    }

    // ------------------------------------------------------------
    // Contraseña interna
    // ------------------------------------------------------------

    const randomPassword =
      await bcrypt.hash(
        `${google.googleId}-${crypto.randomUUID()}`,
        BCRYPT_ROUNDS,
      );

    // ------------------------------------------------------------
    // CREACIÓN ATÓMICA
    // ------------------------------------------------------------

    try {
      const resultado =
        await this.prisma.$transaction(
          async (tx) => {
            // --------------------------------------------------
            // USUARIO
            // --------------------------------------------------

            const usuario =
              await tx.usuario.create({
                data: {
                  nombre: google.nombre,
                  email: google.email,
                  telefono,
                  password: randomPassword,

                  // Google ya verificó el correo.
                  emailVerificado: true,

                  googleId: google.googleId,
                },
              });

            // --------------------------------------------------
            // ACEPTACIONES LEGALES
            // --------------------------------------------------

            const aceptadoEn =
              new Date();

            await tx.consentimientoLegal.create({
              data: {
                usuarioId: usuario.id,
                documento:
                  DocumentoLegal.TERMINOS_SERVICIO,
                version:
                  LEGAL_DOCUMENT_VERSION,
                aceptadoEn,
                ipAddress,
              },
            });

            await tx.consentimientoLegal.create({
              data: {
                usuarioId: usuario.id,
                documento:
                  DocumentoLegal.POLITICA_PRIVACIDAD,
                version:
                  LEGAL_DOCUMENT_VERSION,
                aceptadoEn,
                ipAddress,
              },
            });

            // --------------------------------------------------
            // NEGOCIO
            // --------------------------------------------------

            const negocio =
              await tx.negocio.create({
                data: {
                  nombre: nombreNegocio,
                },
              });

            // --------------------------------------------------
            // USUARIO → NEGOCIO
            // --------------------------------------------------

            await tx.usuarioNegocio.create({
              data: {
                usuarioId: usuario.id,
                negocioId: negocio.id,
              },
            });

            // --------------------------------------------------
            // SEDE PRINCIPAL
            // --------------------------------------------------

            const sede =
              await tx.sede.create({
                data: {
                  nombre: 'Sede principal',
                  negocioId: negocio.id,
                  whatsappUsername,
                },
              });

            // --------------------------------------------------
            // USUARIO → SEDE
            // --------------------------------------------------

            await tx.usuarioSede.create({
              data: {
                usuarioId: usuario.id,
                sedeId: sede.id,
              },
            });

            return {
              usuario,
              negocio,
              sede,
            };
          },
        );

      // ----------------------------------------------------------
      // RESPUESTA
      // ----------------------------------------------------------

      return this.buildAuthResponse(
        resultado.usuario.id,
        resultado.usuario.nombre,
        resultado.negocio.id,
        'ADMIN',
        resultado.usuario.rolGlobal,
      );
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target =
          Array.isArray(error.meta?.target)
            ? (error.meta.target as string[])
            : [];

        if (
          target.includes('email') ||
          target.includes('googleId')
        ) {
          throw new ConflictException(
            'Ya existe una cuenta de Luka con este correo de Google.',
          );
        }

        throw new ConflictException(
          'No fue posible completar el registro. Algunos de los datos ya están registrados.',
        );
      }

      throw error;
    }
  }

  // ============================================================
  // NORMALIZAR TELÉFONO COLOMBIANO
  // ============================================================

  private normalizarTelefono(
    telefono?: string,
  ): string | null {
    const raw =
      (telefono ?? '').trim();

    if (!raw) {
      return null;
    }

    const digits =
      raw.replace(/\D/g, '');

    // 3001234567
    if (/^3\d{9}$/.test(digits)) {
      return `+57${digits}`;
    }

    // 573001234567
    if (/^57(3\d{9})$/.test(digits)) {
      return `+${digits}`;
    }

    return null;
  }

  // ============================================================
  // ASOCIAR NEGOCIO
  // ============================================================

  async asociarNegocio(
    solicitanteId: string,
    rolGlobal: string,
    dto: AsociarNegocioDto,
  ) {
    const negocio =
      await this.prisma.negocio.findUnique({
        where: {
          id: dto.negocioId,
        },
      });

    if (!negocio) {
      throw new NotFoundException(
        'El negocio no se encontró en el sistema o no está registrado',
      );
    }

    await this.negociosService.verificarPropietario(
      solicitanteId,
      dto.negocioId,
      rolGlobal,
    );

    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          id: dto.usuarioId,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'El usuario indicado no existe',
      );
    }

    try {
      return await this.prisma.usuarioNegocio.create({
        data: {
          usuarioId: dto.usuarioId,
          negocioId: dto.negocioId,
        },
      });
    } catch (error) {
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El usuario ya está asociado a ese negocio',
        );
      }

      throw error;
    }
  }

  // ============================================================
  // ELIMINAR USUARIO
  // ============================================================

  async removeUsuario(
    id: string,
    rolGlobal: string,
  ) {
    if (rolGlobal !== 'MASTER') {
      throw new ForbiddenException(
        'Solo un usuario MASTER puede eliminar cuentas',
      );
    }

    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          id,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        `Usuario con id ${id} no encontrado`,
      );
    }

    return this.prisma.usuario.delete({
      where: {
        id,
      },
    });
  }

  // ============================================================
  // CONSTRUIR RESPUESTA DE AUTENTICACIÓN
  // ============================================================

  private buildAuthResponse(
    usuarioId: string,
    nombre: string,
    negocioId: string | null,
    role: string | null,
    rolGlobal: string,
  ) {
    /**
     * `type` distingue este token de los tokens de:
     *
     * - verificación de email
     * - recuperación de contraseña
     * - cambio de email
     *
     * JwtStrategy solo acepta tokens de tipo `session`.
     */
    const payload = {
      sub: usuarioId,
      type: 'session',
      negocioId,
      role,
      rolGlobal,
    };

    return {
      access_token:
        this.jwtService.sign(payload),

      user: {
        id: usuarioId,
        nombre,
        negocioId,
        role,
        rolGlobal,
      },
    };
  }

  // ============================================================
  // REENVIAR VERIFICACIÓN
  // ============================================================

  async reenviarVerificacion(
    dto: ReenviarVerificacionDto,
  ) {
    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          email:
            dto.email.trim().toLowerCase(),
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'No existe una cuenta registrada con ese correo',
      );
    }

    const verificationToken =
      this.jwtService.sign(
        {
          sub: usuario.id,
          type: 'email-verification',
        },
        {
          expiresIn: '24h',
        },
      );

    void this.mailService.sendVerificationEmail(
      usuario.email,
      usuario.nombre,
      verificationToken,
    );

    return {
      mensaje:
        'Correo de verificación reenviado. Revisa tu bandeja de entrada.',
    };
  }

  // ============================================================
  // PERFIL
  // ============================================================

  async getPerfil(usuarioId: string) {
    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          id: usuarioId,
        },
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          emailVerificado: true,
          rolGlobal: true,
          plan: true,
          createdAt: true,
          negocios: {
            select: {
              negocio: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          sedes: {
            select: {
              sede: {
                select: {
                  id: true,
                  nombre: true,
                  negocioId: true,
                },
              },
            },
          },
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado',
      );
    }

    return usuario;
  }

  // ============================================================
  // BUSCAR USUARIO POR EMAIL
  // ============================================================

  async buscarPorEmail(email?: string) {
    if (!email) {
      throw new BadRequestException(
        'Debes indicar el email que quieres buscar',
      );
    }

    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          email:
            email.trim().toLowerCase(),
        },
        select: {
          id: true,
          nombre: true,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'No hay ninguna cuenta registrada con ese correo',
      );
    }

    return usuario;
  }

  // ============================================================
  // ACTUALIZAR USUARIO
  // ============================================================

  async updateUsuario(
    usuarioId: string,
    dto: UpdateUsuarioDto,
  ) {
    return this.prisma.usuario.update({
      where: {
        id: usuarioId,
      },
      data: {
        nombre: dto.nombre,
        telefono: dto.telefono,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
      },
    });
  }

  // ============================================================
  // RECUPERAR CONTRASEÑA
  // ============================================================

  async forgotPassword(
    dto: ForgotPasswordDto,
  ) {
    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          email:
            dto.email.trim().toLowerCase(),
        },
      });

    // Se firma y se envía solo si existe, pero la respuesta hacia
    // afuera es idéntica en ambos casos (evita enumeración de cuentas).
    if (usuario) {
      const resetToken =
        this.jwtService.sign(
          {
            sub: usuario.id,
            type: 'password-reset',
          },
          {
            expiresIn: '1h',
          },
        );

      void this.mailService.sendPasswordResetEmail(
        usuario.email,
        usuario.nombre,
        resetToken,
      );
    }

    return {
      mensaje:
        'Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.',
    };
  }

  // ============================================================
  // RESTABLECER CONTRASEÑA
  // ============================================================

  async resetPassword(
    dto: ResetPasswordDto,
  ) {
    let payload: {
      sub: string;
      type: string;
    };

    try {
      payload =
        this.jwtService.verify(
          dto.token,
        );
    } catch {
      throw new UnauthorizedException(
        'El enlace es inválido o expiró',
      );
    }

    if (payload.type !== 'password-reset') {
      throw new UnauthorizedException(
        'Token inválido para esta operación',
      );
    }

    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          id: payload.sub,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado',
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        dto.newPassword,
        BCRYPT_ROUNDS,
      );

    await this.prisma.usuario.update({
      where: {
        id: usuario.id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      mensaje:
        'Contraseña actualizada correctamente',
    };
  }

  // ============================================================
  // CAMBIAR EMAIL
  // ============================================================

  async cambiarEmail(
    usuarioId: string,
    dto: CambiarEmailDto,
  ) {
    const usuario =
      await this.prisma.usuario.findUnique({
        where: {
          id: usuarioId,
        },
      });

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado',
      );
    }

    const passwordValida =
      await bcrypt.compare(
        dto.password,
        usuario.password,
      );

    if (!passwordValida) {
      throw new UnauthorizedException(
        'Contraseña incorrecta',
      );
    }

    const nuevoEmail =
      dto.nuevoEmail
        .trim()
        .toLowerCase();

    const emailExistente =
      await this.prisma.usuario.findUnique({
        where: {
          email: nuevoEmail,
        },
      });

    if (emailExistente) {
      throw new ConflictException(
        'Ese correo ya está en uso por otra cuenta',
      );
    }

    const changeToken =
      this.jwtService.sign(
        {
          sub: usuario.id,
          nuevoEmail,
          type: 'email-change',
        },
        {
          expiresIn: '1h',
        },
      );

    void this.mailService.sendEmailChangeConfirmation(
      nuevoEmail,
      usuario.nombre,
      changeToken,
    );

    return {
      mensaje:
        'Enviamos un correo de confirmación a tu nueva dirección',
    };
  }

  // ============================================================
  // CONFIRMAR CAMBIO DE EMAIL
  // ============================================================

  async confirmarCambioEmail(
    dto: ConfirmarCambioEmailDto,
  ) {
    let payload: {
      sub: string;
      nuevoEmail: string;
      type: string;
    };

    try {
      payload =
        this.jwtService.verify(
          dto.token,
        );
    } catch {
      throw new UnauthorizedException(
        'El enlace es inválido o expiró',
      );
    }

    if (payload.type !== 'email-change') {
      throw new UnauthorizedException(
        'Token inválido para esta operación',
      );
    }

    const nuevoEmail =
      payload.nuevoEmail
        .trim()
        .toLowerCase();

    const emailExistente =
      await this.prisma.usuario.findUnique({
        where: {
          email: nuevoEmail,
        },
      });

    if (emailExistente) {
      throw new ConflictException(
        'Ese correo ya fue tomado por otra cuenta mientras tanto',
      );
    }

    await this.prisma.usuario.update({
      where: {
        id: payload.sub,
      },
      data: {
        email: nuevoEmail,
      },
    });

    return {
      mensaje:
        'Correo actualizado correctamente',
    };
  }
}