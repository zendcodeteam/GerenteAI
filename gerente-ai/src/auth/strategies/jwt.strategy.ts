import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../services/prisma.service';
import { tokenEsAnteriorAlCambio } from '../password-changed-at';
import { AUDIENCIA, JWT_ISSUER } from '../jwt-claims';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
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
   * Passport ya validó la firma y la expiración. Lo que falta comprobar es para
   * QUÉ se emitió el token, y si sigue vigente.
   *
   * Los de verificación de correo, reset de contraseña y cambio de correo se
   * firman con el mismo secreto, y ahora se separan por `aud`: la librería los
   * rechaza antes de llegar aquí. La comprobación de `type` se queda como
   * segunda barrera, por si algún token viejo o mal firmado se colara.
   *
   * Además se compara contra `passwordChangedAt`: un token firmado antes del
   * último cambio de contraseña ya no vale. Sin esto, cambiar la contraseña no
   * echaba a nadie, y quien hubiera entrado con la contraseña vieja seguía
   * dentro hasta que su token expirara por su cuenta (un día).
   *
   * Eso cuesta una lectura del usuario por petición autenticada. Es el precio
   * de poder revocar una sesión de inmediato: guardarlo en memoria haría que la
   * expulsión tardara, y con varias réplicas cada una expulsaría a destiempo.
   */
  async validate(payload: JwtPayload) {
    if (payload.type !== 'session') {
      throw new UnauthorizedException(
        'Este token no sirve para iniciar sesión',
      );
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { passwordChangedAt: true },
    });

    // La cuenta pudo eliminarse con la sesión abierta.
    if (!usuario) {
      throw new UnauthorizedException('La cuenta ya no existe');
    }

    if (tokenEsAnteriorAlCambio(payload.iat, usuario.passwordChangedAt)) {
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
