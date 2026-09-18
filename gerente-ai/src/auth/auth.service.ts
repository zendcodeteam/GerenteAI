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

import {
  generateSecret,
  generateURI,
  verify as verifyTotp,
} from 'otplib';

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
            negocios: true,
          },
        },
      );

    const passwordValida =
      usuario
        ? await bcrypt.compare(
            dto.password,
            usuario.password,
          )
        : await bcrypt.compare(
            dto.password,
            this.DUMMY_HASH,
          );

    if (
      !usuario ||
      !passwordValida
    ) {
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos',
      );
    }

    // ----------------------------------------------------------
    // RE-HASHEAR CONTRASEÑA
    // ----------------------------------------------------------

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
      throw new UnauthorizedException(
        'La configuración de seguridad MFA no está disponible en el servidor',
      );
    }

    if (
      !/^[0-9a-fA-F]{64}$/.test(
        rawKey,
      )
    ) {
      throw new UnauthorizedException(
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
      throw new UnauthorizedException(
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
      throw new UnauthorizedException(
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
      throw new UnauthorizedException(
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

    const normalizedCode =
      this.normalizeMfaCode(
        codigo,
      );

    const secret =
      this.decryptMfaSecret(
        usuario.mfaSecret,
      );

    let verification;

    try {
      verification =
        await verifyTotp({
          secret,
          token:
            normalizedCode,

          epochTolerance:
            MFA_EPOCH_TOLERANCE_SECONDS,
        });
    } catch {
      throw new UnauthorizedException(
        'No fue posible verificar el código MFA',
      );
    }

    if (!verification.valid) {
      throw new UnauthorizedException(
        'El código MFA es incorrecto o expiró. Revisa la aplicación autenticadora e inténtalo nuevamente.',
      );
    }

    // ----------------------------------------------------------
    // ACTIVAR MFA
    // ----------------------------------------------------------

    await this.prisma.usuario.update(
      {
        where: {
          id: usuario.id,
        },

        data: {
          mfaActivado:
            true,

          mfaActivadoEn:
            new Date(),
        },
      },
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

    const normalizedCode =
      this.normalizeMfaCode(
        codigo,
      );

    const secret =
      this.decryptMfaSecret(
        usuario.mfaSecret,
      );

    let verification;

    try {
      verification =
        await verifyTotp({
          secret,
          token:
            normalizedCode,

          epochTolerance:
            MFA_EPOCH_TOLERANCE_SECONDS,
        });
    } catch {
      throw new UnauthorizedException(
        'No fue posible verificar el código MFA',
      );
    }

    if (!verification.valid) {
      throw new UnauthorizedException(
        'El código MFA es incorrecto o expiró. Revisa la aplicación autenticadora e inténtalo nuevamente.',
      );
    }

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
        },
      );

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

    await this.prisma.usuario.update(
      {
        where: {
          id: usuario.id,
        },

        data: {
          password:
            hashedPassword,
        },
      },
    );

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