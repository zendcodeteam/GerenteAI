import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { DocumentoLegal, Prisma } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import {
  generateSecret,
  generateURI,
  verify as verifyTotp,
} from 'otplib';

import { PrismaService } from '../services/prisma.service';
import { NegociosService } from '../services/negocios.service';
import { MailService } from './mail/mail.service';

import { huellaDeContrasena } from './password-changed-at';

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

const ENLACE_YA_USADO =
  'Este enlace ya fue usado o dejó de ser válido. Pide uno nuevo desde "Olvidé mi contraseña".';
const MAX_INTENTOS_FALLIDOS = 5;
const MINUTOS_BLOQUEO = 15;

const LEGAL_DOCUMENT_VERSION = '1.0';

/**
 * ============================================================
 * MFA
 * ============================================================
 *
 * TOTP estándar:
 *
 * - SHA-1
 * - 6 dígitos
 * - 30 segundos
 *
 * Compatible con aplicaciones como:
 *
 * - Google Authenticator
 * - Microsoft Authenticator
 * - Authy
 * - otras aplicaciones compatibles con TOTP
 */

const MFA_ISSUER = 'Luka AI';

const MFA_TOKEN_EXPIRES_IN = '10m';

const MFA_EPOCH_TOLERANCE_SECONDS = 30;

/**
 * Códigos incorrectos permitidos antes de bloquear el segundo factor.
 *
 * Con la tolerancia de ±30 s hay unos 3 códigos válidos entre un millón:
 * sin este límite, un atacante que ya tiene la contraseña adivina el código
 * en minutos pidiendo un mfaToken nuevo con cada login.
 */
const MFA_MAX_INTENTOS = 5;

const MFA_BLOQUEO_MINUTOS = 15;

/**
 * ============================================================
 * CIFRADO DEL SECRETO MFA
 * ============================================================
 *
 * El secreto TOTP nunca se almacena en texto plano.
 *
 * MFA_ENCRYPTION_KEY:
 *
 * - 64 caracteres hexadecimales
 * - 32 bytes
 * - AES-256-GCM
 */

const MFA_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

const MFA_IV_LENGTH = 12;

const MFA_AUTH_TAG_LENGTH = 16;

const MFA_KEY_LENGTH = 32;

type MfaPendingPurpose =
  | 'setup'
  | 'login';

interface MfaPendingPayload {
  sub: string;
  type: 'mfa-pending';
  purpose: MfaPendingPurpose;
}

export interface AuthenticatedUserResponse {
  access_token: string;

  user: {
    id: string;
    nombre: string;
    negocioId: string | null;
    role: string | null;
    rolGlobal: string;
  };
}

export interface MfaSetupResponse {
  requiresMfa: true;
  mfaRequiredAction: 'setup';
  mfaToken: string;

  user: {
    id: string;
    nombre: string;
    email: string;
    rolGlobal: string;
  };
}

export interface MfaLoginResponse {
  requiresMfa: true;
  mfaRequiredAction: 'verify';
  mfaToken: string;

  user: {
    id: string;
    nombre: string;
    email: string;
    rolGlobal: string;
  };
}

export type AuthResponse =
  | AuthenticatedUserResponse
  | MfaSetupResponse
  | MfaLoginResponse;

@Injectable()
export class AuthService {
  private readonly DUMMY_HASH =
    '$2b$10$CwTycUXWue0Thq9StjUM0uJ8gcCX5eNiUV5NcH3H0aP5Z2v5X6dS2';

  private readonly googleClient: OAuth2Client;

  private readonly logger = new Logger(AuthService.name);

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

    const hashedPassword =
      await bcrypt.hash(
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
                  email: dto.email
                    .trim()
                    .toLowerCase(),
                  password: hashedPassword,
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

            return {
              usuario,
            };
          },
        );

      const usuario =
        resultado.usuario;

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

      /**
       * El correo se dispara sin esperarlo:
       * la respuesta no depende de que SMTP conteste.
       */
      void this.mailService.sendVerificationEmail(
        usuario.email,
        usuario.nombre,
        verificationToken,
      );

      // No se devuelve access_token a propósito.
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

  async verificarEmail(
    token: string,
  ) {
    let payload: {
      sub: string;
      type: string;
    };

    try {
      payload =
        this.jwtService.verify(
          token,
        );
    } catch {
      throw new UnauthorizedException(
        'El enlace de verificación es inválido o expiró',
      );
    }

    if (
      payload.type !==
      'email-verification'
    ) {
      throw new UnauthorizedException(
        'Token inválido para esta operación',
      );
    }

    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            id: payload.sub,
          },
        },
      );

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
      mensaje:
        'Correo verificado correctamente',
      usuarioId: usuario.id,
    };
  }

  // ============================================================
  // LOGIN — INTENTOS FALLIDOS
  // ============================================================

  /**
   * Suma un intento fallido y bloquea la cuenta al llegar al límite.
   *
   * El incremento es atómico (`increment`) y no leído-y-escrito: varias
   * peticiones en paralelo con contraseñas distintas contaban todas sobre el
   * mismo valor viejo, así que cinco intentos simultáneos dejaban el contador
   * en 1 y el bloqueo no llegaba nunca.
   *
   * Al bloquear, el contador vuelve a cero: cuando el bloqueo venza, la
   * persona tiene otra vez sus cinco intentos.
   */
  private async registrarIntentoFallido(
    usuarioId: string,
  ): Promise<void> {
    const { intentosFallidos } =
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          intentosFallidos: {
            increment: 1,
          },
        },
        select: {
          intentosFallidos: true,
        },
      });

    if (
      intentosFallidos <
      MAX_INTENTOS_FALLIDOS
    ) {
      return;
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        bloqueadoHasta: new Date(
          Date.now() +
            MINUTOS_BLOQUEO * 60_000,
        ),
        intentosFallidos: 0,
      },
    });

    this.logger.warn(
      `Login bloqueado ${MINUTOS_BLOQUEO} min para el usuario ${usuarioId} por contraseñas incorrectas`,
    );
  }

  // ============================================================
  // LOGIN TRADICIONAL
  // ============================================================

  async login(
    dto: LoginDto,
  ): Promise<AuthResponse> {
    const email =
      dto.email
        .trim()
        .toLowerCase();

    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            email,
          },

          select: {
            id: true,
            nombre: true,
            email: true,
            password: true,
            emailVerificado: true,
            rolGlobal: true,
            mfaActivado: true,
            intentosFallidos: true,
            bloqueadoHasta: true,
            negocios: true,
          },
        },
      );

    // La contraseña se compara SIEMPRE, exista o no la cuenta y esté o no
    // bloqueada: es lo que impide averiguar qué correos están registrados
    // midiendo cuánto tarda la respuesta.
    const passwordValida = usuario
      ? await bcrypt.compare(
          dto.password,
          usuario.password,
        )
      : await bcrypt.compare(
          dto.password,
          this.DUMMY_HASH,
        );

    const bloqueadoHasta =
      usuario?.bloqueadoHasta ?? null;

    const sigueBloqueada =
      bloqueadoHasta !== null &&
      bloqueadoHasta > new Date();

    if (sigueBloqueada) {
      // Solo se le explica el bloqueo a quien acertó la contraseña. Si se le
      // contara a cualquiera, bastaría con probar cinco contraseñas al azar
      // para saber qué correos existen, que es justo lo que se unificó en el
      // commit anterior de mensajes de login.
      if (passwordValida) {
        const minutosRestantes = Math.ceil(
          (bloqueadoHasta.getTime() -
            Date.now()) /
            60_000,
        );

        throw new UnauthorizedException(
          `Cuenta bloqueada temporalmente por demasiados intentos fallidos. Intenta nuevamente en ${minutosRestantes} minuto(s).`,
        );
      }

      // Insistir durante el bloqueo no lo alarga ni suma intentos: si lo
      // hiciera, un atacante podría dejar a alguien afuera indefinidamente.
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos',
      );
    }

    if (!usuario || !passwordValida) {
      if (usuario) {
        await this.registrarIntentoFallido(
          usuario.id,
        );
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

    // ----------------------------------------------------------
    // RE-HASHEAR CONTRASEÑA
    // ----------------------------------------------------------
    // Re-hashear en el login si la contraseña fue creada
    // con un factor menor a 12.
    try {
      if (
        bcrypt.getRounds(
          usuario.password,
        ) < BCRYPT_ROUNDS
      ) {
        const rehashedPassword =
          await bcrypt.hash(
            dto.password,
            BCRYPT_ROUNDS,
          );

        await this.prisma.usuario.update(
          {
            where: {
              id: usuario.id,
            },

            data: {
              password:
                rehashedPassword,
            },
          },
        );
      }
    } catch {
      // Si getRounds falla por formato no estándar,
      // no interrumpir el flujo de login.
    }

    // ----------------------------------------------------------
    // VERIFICAR EMAIL
    // ----------------------------------------------------------

    if (!usuario.emailVerificado) {
      throw new UnauthorizedException(
        'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.',
      );
    }

    const usuarioNegocio =
      usuario.negocios[0];

    // ==========================================================
    // MASTER
    // ==========================================================
    //
    // Nunca recibe el JWT definitivo directamente.
    //
    // MASTER sin MFA:
    //
    // contraseña
    //      ↓
    // token MFA temporal
    //      ↓
    // configurar MFA
    //      ↓
    // código TOTP
    //      ↓
    // JWT definitivo
    //
    // MASTER con MFA:
    //
    // contraseña
    //      ↓
    // token MFA temporal
    //      ↓
    // código TOTP
    //      ↓
    // JWT definitivo
    // ==========================================================

    if (
      usuario.rolGlobal ===
      'MASTER'
    ) {
      return this.buildMasterMfaResponse(
        usuario,
      );
    }

    // ==========================================================
    // CLIENTE
    // ==========================================================
    //
    // El comportamiento existente se conserva.
    // ==========================================================

    return this.buildAuthResponse(
      usuario.id,
      usuario.nombre,
      usuarioNegocio?.negocioId ??
        null,
      usuarioNegocio?.role ??
        null,
      usuario.rolGlobal,
    );
  }

  // ============================================================
  // VALIDAR CREDENCIAL DE GOOGLE
  // ============================================================

  /**
   * Google entrega un ID Token.
   *
   * Nunca confiamos directamente en nombre/email
   * enviados por el frontend.
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
        await this.googleClient.verifyIdToken(
          {
            idToken: credential,
            audience:
              googleClientId,
          },
        );
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

    const googleId =
      payload.sub;

    const email =
      payload.email
        ?.trim()
        .toLowerCase();

    const nombre =
      payload.name?.trim();

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
   *
   * Si el usuario es MASTER:
   *
   * Google
   *   ↓
   * MFA obligatorio
   *   ↓
   * JWT definitivo
   */
  async googleLogin(
    dto: GoogleLoginDto,
  ): Promise<AuthResponse> {
    const google =
      await this.validarGoogleCredential(
        dto.credential,
      );

    // ------------------------------------------------------------
    // 1. Buscar por Google ID
    // ------------------------------------------------------------

    const usuarioPorGoogle =
      await this.prisma.usuario.findUnique(
        {
          where: {
            googleId:
              google.googleId,
          },

          select: {
            id: true,
            nombre: true,
            email: true,
            rolGlobal: true,
            mfaActivado: true,
            negocios: true,
          },
        },
      );

    if (usuarioPorGoogle) {
      const usuarioNegocio =
        usuarioPorGoogle.negocios[0];

      if (
        usuarioPorGoogle.rolGlobal ===
        'MASTER'
      ) {
        return this.buildMasterMfaResponse(
          usuarioPorGoogle,
        );
      }

      return this.buildAuthResponse(
        usuarioPorGoogle.id,
        usuarioPorGoogle.nombre,
        usuarioNegocio?.negocioId ??
          null,
        usuarioNegocio?.role ??
          null,
        usuarioPorGoogle.rolGlobal,
      );
    }

    // ------------------------------------------------------------
    // 2. Buscar por email
    // ------------------------------------------------------------

    const usuarioPorEmail =
      await this.prisma.usuario.findUnique(
        {
          where: {
            email: google.email,
          },

          select: {
            id: true,
          },
        },
      );

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
    // LIMPIAR INFORMACIÓN
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
        .replace(/^@+/, '') ||
      null;

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
    // VERIFICAR CUENTA POR GOOGLE ID
    // ------------------------------------------------------------

    const cuentaPorGoogle =
      await this.prisma.usuario.findUnique(
        {
          where: {
            googleId:
              google.googleId,
          },

          select: {
            id: true,
          },
        },
      );

    if (cuentaPorGoogle) {
      throw new ConflictException(
        'Esta cuenta de Google ya está registrada en Luka. Inicia sesión con Google.',
      );
    }

    // ------------------------------------------------------------
    // VERIFICAR CUENTA POR EMAIL
    // ------------------------------------------------------------

    const cuentaPorEmail =
      await this.prisma.usuario.findUnique(
        {
          where: {
            email: google.email,
          },

          select: {
            id: true,
          },
        },
      );

    if (cuentaPorEmail) {
      throw new ConflictException(
        'Ya existe una cuenta de Luka con este correo. Inicia sesión con tu cuenta existente.',
      );
    }

    // ------------------------------------------------------------
    // CONTRASEÑA INTERNA
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
                  nombre:
                    google.nombre,

                  email:
                    google.email,

                  telefono,

                  password:
                    randomPassword,

                  // Google ya verificó el correo.
                  emailVerificado:
                    true,

                  googleId:
                    google.googleId,
                },
              });

            // --------------------------------------------------
            // ACEPTACIONES LEGALES
            // --------------------------------------------------

            const aceptadoEn =
              new Date();

            await tx.consentimientoLegal.create(
              {
                data: {
                  usuarioId:
                    usuario.id,

                  documento:
                    DocumentoLegal.TERMINOS_SERVICIO,

                  version:
                    LEGAL_DOCUMENT_VERSION,

                  aceptadoEn,

                  ipAddress,
                },
              },
            );

            await tx.consentimientoLegal.create(
              {
                data: {
                  usuarioId:
                    usuario.id,

                  documento:
                    DocumentoLegal.POLITICA_PRIVACIDAD,

                  version:
                    LEGAL_DOCUMENT_VERSION,

                  aceptadoEn,

                  ipAddress,
                },
              },
            );

            // --------------------------------------------------
            // NEGOCIO
            // --------------------------------------------------

            const negocio =
              await tx.negocio.create({
                data: {
                  nombre:
                    nombreNegocio,
                },
              });

            // --------------------------------------------------
            // USUARIO → NEGOCIO
            // --------------------------------------------------

            await tx.usuarioNegocio.create({
              data: {
                usuarioId:
                  usuario.id,

                negocioId:
                  negocio.id,
              },
            });

            // --------------------------------------------------
            // SEDE PRINCIPAL
            // --------------------------------------------------

            const sede =
              await tx.sede.create({
                data: {
                  nombre:
                    'Sede principal',

                  negocioId:
                    negocio.id,

                  whatsappUsername,
                },
              });

            // --------------------------------------------------
            // USUARIO → SEDE
            // --------------------------------------------------

            await tx.usuarioSede.create({
              data: {
                usuarioId:
                  usuario.id,

                sedeId:
                  sede.id,
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
          Array.isArray(
            error.meta?.target,
          )
            ? (error.meta
                .target as string[])
            : [];

        if (
          target.includes(
            'email',
          ) ||
          target.includes(
            'googleId',
          )
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
    if (
      /^3\d{9}$/.test(
        digits,
      )
    ) {
      return `+57${digits}`;
    }

    // 573001234567
    if (
      /^57(3\d{9})$/.test(
        digits,
      )
    ) {
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
      await this.prisma.negocio.findUnique(
        {
          where: {
            id: dto.negocioId,
          },
        },
      );

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
      await this.prisma.usuario.findUnique(
        {
          where: {
            id: dto.usuarioId,
          },
        },
      );

    if (!usuario) {
      throw new NotFoundException(
        'El usuario indicado no existe',
      );
    }

    try {
      return await this.prisma.usuarioNegocio.create(
        {
          data: {
            usuarioId:
              dto.usuarioId,

            negocioId:
              dto.negocioId,
          },
        },
      );
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
    if (
      rolGlobal !== 'MASTER'
    ) {
      throw new ForbiddenException(
        'Solo un usuario MASTER puede eliminar cuentas',
      );
    }

    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            id,
          },
        },
      );

    if (!usuario) {
      throw new NotFoundException(
        `Usuario con id ${id} no encontrado`,
      );
    }

    return this.prisma.usuario.delete(
      {
        where: {
          id,
        },
      },
    );
  }

  // ============================================================
  // MFA — RESPUESTA INICIAL PARA MASTER
  // ============================================================

  /**
   * Determina qué paso de MFA necesita completar un MASTER.
   *
   * Nunca genera un access_token definitivo.
   */
  private buildMasterMfaResponse(
    usuario: {
      id: string;
      nombre: string;
      email: string;
      rolGlobal: string;
      mfaActivado: boolean;
    },
  ):
    | MfaSetupResponse
    | MfaLoginResponse {
    // ----------------------------------------------------------
    // MFA NO ACTIVADO
    // ----------------------------------------------------------

    if (!usuario.mfaActivado) {
      const mfaToken =
        this.createMfaPendingToken(
          usuario.id,
          'setup',
        );

      return {
        requiresMfa: true,

        mfaRequiredAction:
          'setup',

        mfaToken,

        user: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rolGlobal:
            usuario.rolGlobal,
        },
      };
    }

    // ----------------------------------------------------------
    // MFA YA ACTIVADO
    // ----------------------------------------------------------

    const mfaToken =
      this.createMfaPendingToken(
        usuario.id,
        'login',
      );

    return {
      requiresMfa: true,

      mfaRequiredAction:
        'verify',

      mfaToken,

      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rolGlobal:
          usuario.rolGlobal,
      },
    };
  }

  // ============================================================
  // MFA — GENERAR TOKEN TEMPORAL
  // ============================================================

  /**
   * Token temporal de MFA.
   *
   * IMPORTANTE:
   *
   * Este token NO es un access_token de sesión.
   *
   * JwtStrategy debe aceptar únicamente:
   *
   *   type === 'session'
   *
   * para proteger el resto de la API.
   */
  private createMfaPendingToken(
    usuarioId: string,
    purpose: MfaPendingPurpose,
  ): string {
    return this.jwtService.sign(
      {
        sub: usuarioId,
        type: 'mfa-pending',
        purpose,
      },
      {
        expiresIn:
          MFA_TOKEN_EXPIRES_IN,
      },
    );
  }

  // ============================================================
  // MFA — VALIDAR TOKEN TEMPORAL
  // ============================================================

  private verifyMfaPendingToken(
    token: string,
    expectedPurpose: MfaPendingPurpose,
  ): MfaPendingPayload {
    if (!token?.trim()) {
      throw new BadRequestException(
        'El token temporal de MFA es obligatorio',
      );
    }

    let payload: MfaPendingPayload;

    try {
      payload =
        this.jwtService.verify<MfaPendingPayload>(
          token,
        );
    } catch {
      throw new UnauthorizedException(
        'El proceso de MFA expiró o es inválido. Inicia sesión nuevamente.',
      );
    }

    if (
      payload.type !==
        'mfa-pending' ||
      payload.purpose !==
        expectedPurpose ||
      !payload.sub
    ) {
      throw new UnauthorizedException(
        'Token de MFA inválido para esta operación',
      );
    }

    return payload;
  }

  // ============================================================
  // MFA — OBTENER CLAVE DE CIFRADO
  // ============================================================

  private getMfaEncryptionKey(): Buffer {
    const rawKey =
      process.env.MFA_ENCRYPTION_KEY?.trim();

    if (!rawKey) {
      throw this.errorDeConfiguracionMfa(
        'La configuración de seguridad MFA no está disponible en el servidor',
      );
    }

    if (
      !/^[0-9a-fA-F]{64}$/.test(
        rawKey,
      )
    ) {
      throw this.errorDeConfiguracionMfa(
        'La configuración de seguridad MFA es inválida',
      );
    }

    const key =
      Buffer.from(
        rawKey,
        'hex',
      );

    if (
      key.length !==
      MFA_KEY_LENGTH
    ) {
      throw this.errorDeConfiguracionMfa(
        'La configuración de seguridad MFA es inválida',
      );
    }

    return key;
  }

  // ============================================================
  // MFA — CIFRAR SECRETO
  // ============================================================

  private encryptMfaSecret(
    secret: string,
  ): string {
    const key =
      this.getMfaEncryptionKey();

    const iv =
      crypto.randomBytes(
        MFA_IV_LENGTH,
      );

    const cipher =
      crypto.createCipheriv(
        MFA_ENCRYPTION_ALGORITHM,
        key,
        iv,
        {
          authTagLength:
            MFA_AUTH_TAG_LENGTH,
        },
      );

    const encrypted =
      Buffer.concat([
        cipher.update(
          secret,
          'utf8',
        ),
        cipher.final(),
      ]);

    const authTag =
      cipher.getAuthTag();

    /**
     * Formato:
     *
     * iv:authTag:ciphertext
     *
     * Todo hexadecimal.
     */
    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  // ============================================================
  // MFA — DESCIFRAR SECRETO
  // ============================================================

  private decryptMfaSecret(
    encryptedSecret: string,
  ): string {
    const key =
      this.getMfaEncryptionKey();

    const parts =
      encryptedSecret.split(':');

    if (
      parts.length !== 3
    ) {
      throw this.errorDeConfiguracionMfa(
        'No fue posible recuperar la configuración MFA',
      );
    }

    const [
      ivHex,
      authTagHex,
      encryptedHex,
    ] = parts;

    try {
      const iv =
        Buffer.from(
          ivHex,
          'hex',
        );

      const authTag =
        Buffer.from(
          authTagHex,
          'hex',
        );

      const encrypted =
        Buffer.from(
          encryptedHex,
          'hex',
        );

      if (
        iv.length !==
          MFA_IV_LENGTH ||
        authTag.length !==
          MFA_AUTH_TAG_LENGTH
      ) {
        throw new Error(
          'Invalid MFA encryption metadata',
        );
      }

      const decipher =
        crypto.createDecipheriv(
          MFA_ENCRYPTION_ALGORITHM,
          key,
          iv,
          {
            authTagLength:
              MFA_AUTH_TAG_LENGTH,
          },
        );

      decipher.setAuthTag(
        authTag,
      );

      const decrypted =
        Buffer.concat([
          decipher.update(
            encrypted,
          ),
          decipher.final(),
        ]);

      return decrypted.toString(
        'utf8',
      );
    } catch {
      throw this.errorDeConfiguracionMfa(
        'No fue posible recuperar la configuración MFA',
      );
    }
  }

  // ============================================================
  // MFA — ACTIVAR / PREPARAR MFA
  // ============================================================

  /**
   * Genera una nueva configuración TOTP para un MASTER.
   *
   * El usuario todavía NO queda marcado como:
   *
   *   mfaActivado = true
   *
   * Flujo:
   *
   * 1. Generar secreto.
   * 2. Cifrar secreto.
   * 3. Guardar secreto cifrado.
   * 4. Generar URI otpauth.
   * 5. Frontend genera QR.
   * 6. Usuario introduce código.
   * 7. verificarActivacionMfa() valida el código.
   */
  async activarMfa(
    token: string,
  ) {
    const payload =
      this.verifyMfaPendingToken(
        token,
        'setup',
      );

    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            id: payload.sub,
          },

          select: {
            id: true,
            nombre: true,
            email: true,
            rolGlobal: true,
            mfaActivado: true,
          },
        },
      );

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado',
      );
    }

    if (
      usuario.rolGlobal !==
      'MASTER'
    ) {
      throw new ForbiddenException(
        'Solo los usuarios MASTER pueden configurar MFA',
      );
    }

    if (usuario.mfaActivado) {
      throw new ConflictException(
        'El MFA de esta cuenta ya está activado. Inicia sesión nuevamente.',
      );
    }

    // ----------------------------------------------------------
    // GENERAR NUEVO SECRETO
    // ----------------------------------------------------------

    const secret =
      generateSecret();

    // ----------------------------------------------------------
    // CIFRAR SECRETO
    // ----------------------------------------------------------

    const encryptedSecret =
      this.encryptMfaSecret(
        secret,
      );

    // ----------------------------------------------------------
    // GUARDAR SECRETO
    // ----------------------------------------------------------

    await this.prisma.usuario.update(
      {
        where: {
          id: usuario.id,
        },

        data: {
          mfaSecret:
            encryptedSecret,

          mfaActivado:
            false,

          mfaActivadoEn:
            null,

          // El paso guardado pertenece al secreto anterior.
          mfaUltimoPaso:
            null,
        },
      },
    );

    // ----------------------------------------------------------
    // GENERAR URI TOTP
    // ----------------------------------------------------------

    const otpauthUrl =
      generateURI({
        issuer:
          MFA_ISSUER,

        label:
          usuario.email,

        secret,
      });

    // ----------------------------------------------------------
    // RESPUESTA
    // ----------------------------------------------------------

    return {
      requiresMfa: true,

      mfaRequiredAction:
        'verify-activation' as const,

      /**
       * Se devuelve el secreto en texto plano
       * únicamente durante la configuración.
       *
       * Esto permite introducirlo manualmente si
       * el QR no puede escanearse.
       */
      secret,

      /**
       * URI utilizada para generar el QR.
       */
      otpauthUrl,

      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rolGlobal:
          usuario.rolGlobal,
      },
    };
  }

  // ============================================================
  // MFA — VERIFICAR ACTIVACIÓN
  // ============================================================

  /**
   * Verifica el primer código generado por la aplicación
   * autenticadora.
   *
   * Si es correcto:
   *
   * - MFA queda activado.
   * - Se registra mfaActivadoEn.
   * - Se devuelve el JWT definitivo.
   */
  async verificarActivacionMfa(
    token: string,
    codigo: string,
  ): Promise<AuthenticatedUserResponse> {
    const payload =
      this.verifyMfaPendingToken(
        token,
        'setup',
      );

    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            id: payload.sub,
          },

          select: {
            id: true,
            nombre: true,
            email: true,
            rolGlobal: true,
            mfaActivado: true,
            mfaSecret: true,
            negocios: true,
          },
        },
      );

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado',
      );
    }

    if (
      usuario.rolGlobal !==
      'MASTER'
    ) {
      throw new ForbiddenException(
        'Solo los usuarios MASTER pueden activar MFA',
      );
    }

    if (usuario.mfaActivado) {
      throw new ConflictException(
        'El MFA de esta cuenta ya está activado',
      );
    }

    if (!usuario.mfaSecret) {
      throw new BadRequestException(
        'Primero debes iniciar la configuración de MFA',
      );
    }

    // Valida el código y, en la misma escritura, activa el MFA.
    await this.comprobarCodigoMfa(
      usuario.id,
      usuario.mfaSecret,
      codigo,
      { activar: true },
    );

    const usuarioNegocio =
      usuario.negocios[0];

    // ----------------------------------------------------------
    // JWT DEFINITIVO
    // ----------------------------------------------------------

    return this.buildAuthResponse(
      usuario.id,
      usuario.nombre,
      usuarioNegocio?.negocioId ??
        null,
      usuarioNegocio?.role ??
        null,
      usuario.rolGlobal,
    );
  }

  // ============================================================
  // MFA — VERIFICAR LOGIN
  // ============================================================

  /**
   * Completa el segundo factor de un login MASTER.
   *
   * El token recibido aquí es exclusivamente el token temporal
   * generado después de comprobar la primera credencial.
   *
   * Solo después de verificar correctamente el TOTP se genera
   * el JWT de sesión.
   */
  async verificarMfa(
    token: string,
    codigo: string,
  ): Promise<AuthenticatedUserResponse> {
    const payload =
      this.verifyMfaPendingToken(
        token,
        'login',
      );

    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            id: payload.sub,
          },

          select: {
            id: true,
            nombre: true,
            email: true,
            rolGlobal: true,
            mfaActivado: true,
            mfaSecret: true,
            negocios: true,
          },
        },
      );

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado',
      );
    }

    if (
      usuario.rolGlobal !==
      'MASTER'
    ) {
      throw new ForbiddenException(
        'Este flujo de MFA solo está disponible para usuarios MASTER',
      );
    }

    if (!usuario.mfaActivado) {
      throw new UnauthorizedException(
        'El MFA de esta cuenta todavía no está activado. Debes completar la configuración.',
      );
    }

    if (!usuario.mfaSecret) {
      throw new UnauthorizedException(
        'La configuración MFA de esta cuenta no está disponible',
      );
    }

    await this.comprobarCodigoMfa(
      usuario.id,
      usuario.mfaSecret,
      codigo,
    );

    const usuarioNegocio =
      usuario.negocios[0];

    /**
     * ESTE es el primer punto del flujo MASTER en el que
     * se genera el token definitivo de sesión.
     */
    return this.buildAuthResponse(
      usuario.id,
      usuario.nombre,
      usuarioNegocio?.negocioId ??
        null,
      usuarioNegocio?.role ??
        null,
      usuario.rolGlobal,
    );
  }

  // ============================================================
  // MFA — COMPROBAR CÓDIGO
  // ============================================================

  /**
   * Verifica un código TOTP y, si es correcto, lo consume.
   *
   * - Cada intento reserva su turno con un incremento atómico ANTES de
   *   verificar. Aunque lleguen cien peticiones en paralelo, solo
   *   MFA_MAX_INTENTOS alcanzan a probar un código.
   * - Al agotar los intentos, el segundo factor queda bloqueado
   *   MFA_BLOQUEO_MINUTOS. Un login nuevo no lo desbloquea: el contador
   *   vive en el usuario, no en el mfaToken.
   * - El código aceptado se guarda por su paso de tiempo, y ese paso y los
   *   anteriores se rechazan: un código ya usado (o visto por encima del
   *   hombro) no sirve dos veces.
   *
   * Con `activar`, el mismo UPDATE que consume el código marca el MFA como
   * activado, así que dos confirmaciones simultáneas no pueden pisarse.
   */
  private async comprobarCodigoMfa(
    usuarioId: string,
    mfaSecret: string,
    codigo: string,
    opciones: { activar?: boolean } = {},
  ): Promise<void> {
    // Formato y configuración primero: un error aquí no es un intento
    // del usuario y no debe gastarle cupo.
    const normalizedCode =
      this.normalizeMfaCode(codigo);

    const secret =
      this.decryptMfaSecret(mfaSecret);

    const ahora = new Date();

    // Un bloqueo vencido se levanta y el contador vuelve a cero.
    await this.prisma.usuario.updateMany({
      where: {
        id: usuarioId,
        mfaBloqueadoHasta: { lte: ahora },
      },
      data: {
        mfaBloqueadoHasta: null,
        mfaIntentosFallidos: 0,
      },
    });

    let reserva: {
      mfaIntentosFallidos: number;
      mfaUltimoPaso: number | null;
    };

    try {
      reserva = await this.prisma.usuario.update({
        where: {
          id: usuarioId,
          mfaBloqueadoHasta: null,
        },
        data: {
          mfaIntentosFallidos: { increment: 1 },
        },
        select: {
          mfaIntentosFallidos: true,
          mfaUltimoPaso: true,
        },
      });
    } catch (error) {
      // P2025: el usuario existe (se acaba de leer), así que lo que no
      // coincidió es `mfaBloqueadoHasta: null`. Está bloqueado.
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw this.errorMfaBloqueado();
      }

      throw error;
    }

    // Solo pasa si un bloqueo anterior no llegó a escribirse.
    if (
      reserva.mfaIntentosFallidos >
      MFA_MAX_INTENTOS
    ) {
      await this.bloquearMfa(usuarioId);
      throw this.errorMfaBloqueado();
    }

    let verification:
      | { valid: false }
      | { valid: true; timeStep?: number };

    try {
      verification = await verifyTotp({
        secret,
        token: normalizedCode,
        epochTolerance:
          MFA_EPOCH_TOLERANCE_SECONDS,
        afterTimeStep:
          reserva.mfaUltimoPaso ?? undefined,
      });
    } catch {
      verification = { valid: false };
    }

    if (
      verification.valid &&
      verification.timeStep !== undefined
    ) {
      const timeStep = verification.timeStep;

      // Condicional: si otra petición consumió este mismo código un
      // instante antes, esta no escribe nada y cuenta como fallida.
      const consumido =
        await this.prisma.usuario.updateMany({
          where: {
            id: usuarioId,
            OR: [
              { mfaUltimoPaso: null },
              { mfaUltimoPaso: { lt: timeStep } },
            ],
            ...(opciones.activar
              ? { mfaActivado: false }
              : {}),
          },
          data: {
            mfaIntentosFallidos: 0,
            mfaUltimoPaso: timeStep,
            ...(opciones.activar
              ? {
                  mfaActivado: true,
                  mfaActivadoEn: new Date(),
                }
              : {}),
          },
        });

      if (consumido.count === 1) {
        return;
      }
    }

    const restantes =
      MFA_MAX_INTENTOS -
      reserva.mfaIntentosFallidos;

    if (restantes <= 0) {
      await this.bloquearMfa(usuarioId);
      throw this.errorMfaBloqueado();
    }

    throw new UnauthorizedException(
      `El código MFA es incorrecto, expiró o ya fue usado. Te ${
        restantes === 1
          ? 'queda 1 intento'
          : `quedan ${restantes} intentos`
      }.`,
    );
  }

  private async bloquearMfa(
    usuarioId: string,
  ): Promise<void> {
    await this.prisma.usuario.updateMany({
      where: { id: usuarioId },
      data: {
        mfaBloqueadoHasta: new Date(
          Date.now() +
            MFA_BLOQUEO_MINUTOS * 60_000,
        ),
        mfaIntentosFallidos: 0,
      },
    });

    this.logger.warn(
      `MFA bloqueado ${MFA_BLOQUEO_MINUTOS} min para el usuario ${usuarioId} por códigos incorrectos`,
    );
  }

  private errorMfaBloqueado(): HttpException {
    return new HttpException(
      `Demasiados códigos incorrectos. Por seguridad, la verificación quedó bloqueada ${MFA_BLOQUEO_MINUTOS} minutos. Inténtalo más tarde.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Un fallo de configuración del servidor (falta MFA_ENCRYPTION_KEY, o no
   * es la clave con la que se cifró el secreto) no es culpa de quien inicia
   * sesión: se responde 500 y se deja en el log, en vez de un 401 que le
   * haría creer que se equivocó de código.
   */
  private errorDeConfiguracionMfa(
    detalle: string,
  ): InternalServerErrorException {
    this.logger.error(
      `Configuración MFA: ${detalle}`,
    );

    return new InternalServerErrorException(
      'No fue posible completar la verificación MFA. Contacta al equipo de soporte.',
    );
  }

  // ============================================================
  // MFA — NORMALIZAR CÓDIGO
  // ============================================================

  private normalizeMfaCode(
    codigo: string,
  ): string {
    const normalized =
      (codigo ?? '')
        .trim()
        .replace(/\s+/g, '');

    if (
      !/^\d{6}$/.test(
        normalized,
      )
    ) {
      throw new BadRequestException(
        'El código MFA debe tener exactamente 6 dígitos',
      );
    }

    return normalized;
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
  ): AuthenticatedUserResponse {
    /**
     * `type` distingue este token de los tokens de:
     *
     * - verificación de email
     * - recuperación de contraseña
     * - cambio de email
     * - MFA pendiente
     *
     * JwtStrategy solo debe aceptar tokens de tipo `session`.
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
        this.jwtService.sign(
          payload,
        ),

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
      await this.prisma.usuario.findUnique(
        {
          where: {
            email:
              dto.email
                .trim()
                .toLowerCase(),
          },
        },
      );

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

  async getPerfil(
    usuarioId: string,
  ) {
    const usuario =
      await this.prisma.usuario.findUnique(
        {
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
        },
      );

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

  async buscarPorEmail(
    email?: string,
  ) {
    if (!email) {
      throw new BadRequestException(
        'Debes indicar el email que quieres buscar',
      );
    }

    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            email:
              email
                .trim()
                .toLowerCase(),
          },

          select: {
            id: true,
            nombre: true,
          },
        },
      );

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
    return this.prisma.usuario.update(
      {
        where: {
          id: usuarioId,
        },

        data: {
          nombre: dto.nombre,
          telefono:
            dto.telefono,
        },

        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
        },
      },
    );
  }

  // ============================================================
  // RECUPERAR CONTRASEÑA
  // ============================================================

  async forgotPassword(
    dto: ForgotPasswordDto,
  ) {
    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            email:
              dto.email
                .trim()
                .toLowerCase(),
          },
        },
      );

    /**
     * Se firma y se envía solo si existe,
     * pero la respuesta hacia afuera es idéntica
     * en ambos casos para evitar enumeración de cuentas.
     */
    if (usuario) {
      const resetToken =
        this.jwtService.sign(
          {
            sub: usuario.id,
            type: 'password-reset',

            /**
             * Huella de la contraseña vigente cuando se pidió el enlace.
             *
             * Es lo que hace el enlace de un solo uso: al cambiar la
             * contraseña cambia el hash, y con él la huella, así que este
             * token —y cualquier otro pedido antes— deja de coincidir. No
             * hace falta guardar los tokens usados en ninguna parte.
             */
            pwd: huellaDeContrasena(
              usuario.password,
            ),
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
      pwd?: string;
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

    if (
      payload.type !==
      'password-reset'
    ) {
      throw new UnauthorizedException(
        'Token inválido para esta operación',
      );
    }

    const usuario =
      await this.prisma.usuario.findUnique(
        {
          where: {
            id: payload.sub,
          },

          select: {
            id: true,
            password: true,
          },
        },
      );

    if (!usuario) {
      throw new NotFoundException(
        'Usuario no encontrado',
      );
    }

    /**
     * Enlace de un solo uso.
     *
     * La huella se calculó sobre la contraseña que había cuando se pidió el
     * enlace. Usarlo cambia la contraseña, así que la huella deja de
     * coincidir: el mismo correo reenviado, guardado o interceptado después
     * ya no sirve, y pedir un enlace nuevo mata al anterior.
     */
    if (
      payload.pwd !==
      huellaDeContrasena(
        usuario.password,
      )
    ) {
      throw new UnauthorizedException(
        ENLACE_YA_USADO,
      );
    }

    const hashedPassword =
      await bcrypt.hash(
        dto.newPassword,
        BCRYPT_ROUNDS,
      );

    /**
     * La contraseña vieja viaja en el WHERE: si dos peticiones con el mismo
     * enlace entran a la vez, las dos pasan la comprobación de arriba pero
     * solo una encuentra el hash que esperaba.
     */
    const cambiada =
      await this.prisma.usuario.updateMany(
        {
          where: {
            id: usuario.id,
            password:
              usuario.password,
          },

          data: {
            password:
              hashedPassword,

            /**
             * Marca del cambio: JwtStrategy la compara contra la fecha de
             * emisión de cada token de sesión, así que todo lo abierto antes
             * deja de valer.
             */
            passwordChangedAt:
              new Date(),

            // Quien cambia su contraseña recupera el acceso de una vez: dejar
            // el bloqueo puesto castigaría a la víctima de los intentos ajenos.
            intentosFallidos: 0,
            bloqueadoHasta: null,
          },
        },
      );

    if (cambiada.count === 0) {
      throw new UnauthorizedException(
        ENLACE_YA_USADO,
      );
    }

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
      await this.prisma.usuario.findUnique(
        {
          where: {
            id: usuarioId,
          },
        },
      );

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
      await this.prisma.usuario.findUnique(
        {
          where: {
            email:
              nuevoEmail,
          },
        },
      );

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

    if (
      payload.type !==
      'email-change'
    ) {
      throw new UnauthorizedException(
        'Token inválido para esta operación',
      );
    }

    const nuevoEmail =
      payload.nuevoEmail
        .trim()
        .toLowerCase();

    const emailExistente =
      await this.prisma.usuario.findUnique(
        {
          where: {
            email:
              nuevoEmail,
          },
        },
      );

    if (emailExistente) {
      throw new ConflictException(
        'Ese correo ya fue tomado por otra cuenta mientras tanto',
      );
    }

    await this.prisma.usuario.update(
      {
        where: {
          id: payload.sub,
        },

        data: {
          email:
            nuevoEmail,
        },
      },
    );

    return {
      mensaje:
        'Correo actualizado correctamente',
    };
  }
}