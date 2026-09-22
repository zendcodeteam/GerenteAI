import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { PrismaService } from '../../services/prisma.service';

// El constructor exige el secreto; estas pruebas no firman nada, solo ejercitan
// la validación del payload ya verificado por Passport.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secreto-de-prueba';

const AHORA = Math.floor(Date.now() / 1000);

const payload = (
  type: JwtPayload['type'],
  iat: number | undefined = AHORA,
): JwtPayload => ({
  sub: 'usuario-1',
  type,
  negocioId: 'negocio-1',
  role: 'ADMIN',
  rolGlobal: 'CLIENTE',
  iat,
});

// `passwordChangedAt` del usuario que la estrategia va a leer.
// `undefined` = el usuario ya no existe.
function conUsuario(passwordChangedAt: Date | null | undefined) {
  const prisma = {
    usuario: {
      findUnique: () =>
        Promise.resolve(
          passwordChangedAt === undefined ? null : { passwordChangedAt },
        ),
    },
  } as unknown as PrismaService;

  return new JwtStrategy(prisma);
}

describe('JwtStrategy', () => {
  const strategy = conUsuario(null);

  it('acepta un token de sesión y expone los datos del usuario', async () => {
    await expect(strategy.validate(payload('session'))).resolves.toEqual({
      userId: 'usuario-1',
      negocioId: 'negocio-1',
      role: 'ADMIN',
      rolGlobal: 'CLIENTE',
    });
  });

  // El caso grave: ese token viaja dentro de un correo. Si sirviera como
  // credencial, bastaría con leer el buzón para entrar sin saber la contraseña.
  it('rechaza el token de verificación de correo', async () => {
    await expect(
      strategy.validate(payload('email-verification')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza el token de recuperación de contraseña', async () => {
    await expect(strategy.validate(payload('password-reset'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza el token de cambio de correo', async () => {
    await expect(strategy.validate(payload('email-change'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // Los tokens emitidos antes de ese cambio no llevan `type`. Que dejen de
  // servir es intencional: obliga a volver a iniciar sesión una vez.
  it('rechaza un token antiguo sin type', async () => {
    const antiguo = { ...payload('session') } as Partial<JwtPayload>;
    delete antiguo.type;

    await expect(strategy.validate(antiguo as JwtPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  describe('sesiones y cambio de contraseña', () => {
    it('rechaza una sesión anterior al cambio de contraseña', async () => {
      const cambio = new Date((AHORA - 60) * 1000);

      await expect(
        conUsuario(cambio).validate(payload('session', AHORA - 3600)),
      ).rejects.toThrow(/contraseña cambió/);
    });

    it('acepta una sesión abierta después del cambio', async () => {
      const cambio = new Date((AHORA - 3600) * 1000);

      await expect(
        conUsuario(cambio).validate(payload('session', AHORA - 60)),
      ).resolves.toMatchObject({ userId: 'usuario-1' });
    });

    // Quien nunca ha cambiado su contraseña no debe perder la sesión solo
    // porque se despliegue esta comprobación.
    it('acepta la sesión si el usuario nunca cambió su contraseña', async () => {
      await expect(
        conUsuario(null).validate(payload('session', AHORA - 86_400)),
      ).resolves.toMatchObject({ userId: 'usuario-1' });
    });

    // `iat` viene redondeado a segundos: sin holgura, cambiar la contraseña y
    // volver a entrar en el mismo segundo dejaría fuera a la sesión nueva.
    it('acepta una sesión emitida en el mismo segundo del cambio', async () => {
      const cambio = new Date(AHORA * 1000 + 500);

      await expect(
        conUsuario(cambio).validate(payload('session', AHORA)),
      ).resolves.toMatchObject({ userId: 'usuario-1' });
    });

    it('rechaza un token de sesión sin fecha de emisión', async () => {
      const cambio = new Date((AHORA - 60) * 1000);
      const sinIat = { ...payload('session') };
      delete sinIat.iat;

      await expect(conUsuario(cambio).validate(sinIat)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rechaza la sesión si la cuenta ya no existe', async () => {
      await expect(
        conUsuario(undefined).validate(payload('session')),
      ).rejects.toThrow(/ya no existe/);
    });
  });
});
