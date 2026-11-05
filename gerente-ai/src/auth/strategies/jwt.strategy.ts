import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../services/prisma.service';
import { UserContextCacheService } from '../../services/user-context-cache.service';
import { tokenEsAnteriorAlCambio } from '../password-changed-at';
import { AUDIENCIA, JWT_ISSUER } from '../jwt-claims';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userCache: UserContextCacheService,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'JWT_SECRET no está definido en las variables de entorno',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      // Emisor y audiencia de sesión. Un token de reseteo o de verificación de
      // correo ni siquiera llega a `validate`: lo rechaza la librería.
      issuer: JWT_ISSUER,
      audience: AUDIENCIA.session,
    });
  }

  /**
   * Passport ya validó la firma y la expiración. Comprueba tipo de token y vigencia
   * ante revocación por cambio de contraseña (`passwordChangedAt`).
   *
   * Optimización con caché de sesión (UserContextCacheService):
   * En lugar de consultar PostgreSQL en cada request HTTP autenticado, se consulta
   * la memoria caché con TTL corto (60s). Al cambiar contraseña, la caché se invalida
   * de inmediato para garantizar la seguridad.
   */
  async validate(payload: JwtPayload) {
    if (payload.type !== 'session') {
      throw new UnauthorizedException(
        'Este token no sirve para iniciar sesión',
      );
    }

    let passwordChangedAt: Date | null | undefined;
    const cachedSession = this.userCache.getUserSession(payload.sub);

    if (cachedSession) {
      passwordChangedAt = cachedSession.passwordChangedAt;
    } else {
      const usuario = await this.prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { passwordChangedAt: true },
      });

      // La cuenta pudo eliminarse con la sesión abierta.
      if (!usuario) {
        throw new UnauthorizedException('La cuenta ya no existe');
      }

      passwordChangedAt = usuario.passwordChangedAt;
      this.userCache.setUserSession(payload.sub, {
        passwordChangedAt: usuario.passwordChangedAt,
      });
    }

    if (tokenEsAnteriorAlCambio(payload.iat, passwordChangedAt)) {
      throw new UnauthorizedException(
        'Tu contraseña cambió: inicia sesión de nuevo',
      );
    }

    return {
      userId: payload.sub,
      negocioId: payload.negocioId,
      role: payload.role,
      rolGlobal: payload.rolGlobal,
    };
  }
}
