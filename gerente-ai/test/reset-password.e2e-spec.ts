import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { MailService } from '../src/auth/mail/mail.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import type { JwtPayload } from '../src/auth/interfaces/jwt-payload.interface';
import { NegociosService } from '../src/services/negocios.service';
import { PlanesService } from '../src/services/planes.service';
import { PrismaService } from '../src/services/prisma.service';
import { limpiar } from './helpers/contexto';

/**
 * Enlaces de recuperación de un solo uso y sesiones que se cierran al cambiar
 * la contraseña.
 *
 * Antes, el enlace del correo servía las veces que uno quisiera durante una
 * hora, y cambiar la contraseña no echaba a nadie: quien hubiera entrado con la
 * contraseña vieja seguía dentro todo el día.
 */

const PASSWORD = 'Secreta123';
const NUEVA = 'NuevaClave123*';
const EMAIL = 'tendera@test.local';

const correosEnviados: string[] = [];

const mailFalso = {
  sendVerificationEmail: () => Promise.resolve(),
  sendPasswordResetEmail: (_email: string, _nombre: string, token: string) => {
    correosEnviados.push(token);
    return Promise.resolve();
  },
  sendEmailChangeConfirmation: () => Promise.resolve(),
};

describe('Reseteo de contraseña y sesiones (contra Postgres real)', () => {
  let prisma: PrismaService;
  let auth: AuthService;
  let jwt: JwtService;
  let estrategia: JwtStrategy;
  let cerrar: () => Promise<void>;
  let usuarioId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        PrismaService,
        NegociosService,
        PlanesService,
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: '1h' },
          }),
        },
        { provide: MailService, useValue: mailFalso },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    auth = moduleRef.get(AuthService);
    jwt = moduleRef.get(JwtService);
    await prisma.$connect();
    estrategia = new JwtStrategy(prisma);
    cerrar = async () => {
      await prisma.$disconnect();
      await moduleRef.close();
    };
  });

  afterAll(() => cerrar());

  beforeEach(async () => {
    correosEnviados.length = 0;
    await limpiar(prisma);
    const usuario = await prisma.usuario.create({
      data: {
        nombre: 'Tendera',
        email: EMAIL,
        password: await bcrypt.hash(PASSWORD, 4),
        emailVerificado: true,
      },
    });
    usuarioId = usuario.id;
  });

  // El enlace tal como le llega a la persona por correo.
  async function pedirEnlace() {
    await auth.forgotPassword({ email: EMAIL });
    return correosEnviados[correosEnviados.length - 1];
  }

  // Lo que hace la API en cada petición autenticada.
  const usarSesion = (token: string) =>
    estrategia.validate(jwt.verify<JwtPayload>(token));

  async function iniciarSesion(password: string) {
    const sesion = await auth.login({ email: EMAIL, password });
    if (!('access_token' in sesion)) throw new Error('no hubo sesión');
    return sesion.access_token;
  }

  describe('el enlace de recuperación sirve una sola vez', () => {
    it('el segundo intento con el mismo enlace se rechaza', async () => {
      const enlace = await pedirEnlace();

      await auth.resetPassword({ token: enlace, newPassword: NUEVA });

      await expect(
        auth.resetPassword({ token: enlace, newPassword: 'OtraMas123*' }),
      ).rejects.toThrow(/ya fue usado/);

      // Y la contraseña sigue siendo la del primer cambio.
      await expect(iniciarSesion(NUEVA)).resolves.toBeDefined();
    });

    it('pedir un enlace nuevo invalida el anterior', async () => {
      const viejo = await pedirEnlace();
      const nuevo = await pedirEnlace();

      await auth.resetPassword({ token: nuevo, newPassword: NUEVA });

      await expect(
        auth.resetPassword({ token: viejo, newPassword: 'OtraMas123*' }),
      ).rejects.toThrow(/ya fue usado/);
    });

    // Sin la condición dentro del UPDATE, dos peticiones simultáneas pasaban
    // ambas la comprobación previa y las dos cambiaban la contraseña.
    it('dos usos simultáneos: solo uno cambia la contraseña', async () => {
      const enlace = await pedirEnlace();

      const resultados = await Promise.allSettled([
        auth.resetPassword({ token: enlace, newPassword: NUEVA }),
        auth.resetPassword({ token: enlace, newPassword: 'OtraMas123*' }),
      ]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
    });

    it('un enlace anterior a un cambio hecho por otra vía tampoco sirve', async () => {
      const enlace = await pedirEnlace();

      // Como si la contraseña se hubiera cambiado por cualquier otro camino.
      await prisma.usuario.update({
        where: { id: usuarioId },
        data: { password: await bcrypt.hash('CambiadaAparte1*', 4) },
      });

      await expect(
        auth.resetPassword({ token: enlace, newPassword: NUEVA }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('cambiar la contraseña cierra las sesiones abiertas', () => {
    it('la sesión abierta antes del cambio deja de servir', async () => {
      // Una sesión de hace diez minutos, como la de alguien que dejó la
      // pestaña abierta (o la de un intruso que entró con la clave vieja).
      const sesion = jwt.sign({
        sub: usuarioId,
        type: 'session',
        negocioId: null,
        role: null,
        rolGlobal: 'CLIENTE',
        iat: Math.floor(Date.now() / 1000) - 600,
      });
      await expect(usarSesion(sesion)).resolves.toMatchObject({
        userId: usuarioId,
      });

      const enlace = await pedirEnlace();
      await auth.resetPassword({ token: enlace, newPassword: NUEVA });

      await expect(usarSesion(sesion)).rejects.toThrow(/contraseña cambió/);
    });

    it('la sesión abierta después del cambio sí sirve', async () => {
      const enlace = await pedirEnlace();
      await auth.resetPassword({ token: enlace, newPassword: NUEVA });

      const sesion = await iniciarSesion(NUEVA);

      await expect(usarSesion(sesion)).resolves.toMatchObject({
        userId: usuarioId,
      });
    });

    // Nadie debe quedar fuera solo porque se despliegue esta comprobación.
    it('quien nunca cambió su contraseña conserva su sesión', async () => {
      const sesion = await iniciarSesion(PASSWORD);

      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
      });
      expect(usuario.passwordChangedAt).toBeNull();

      await expect(usarSesion(sesion)).resolves.toMatchObject({
        userId: usuarioId,
      });
    });
  });
});
