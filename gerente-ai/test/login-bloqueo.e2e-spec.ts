import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { MailService } from '../src/auth/mail/mail.service';
import { NegociosService } from '../src/services/negocios.service';
import { PlanesService } from '../src/services/planes.service';
import { PrismaService } from '../src/services/prisma.service';
import { limpiar } from './helpers/contexto';

/**
 * Bloqueo temporal de la cuenta tras varias contraseñas incorrectas.
 *
 * Lo delicado no es bloquear, es a quién se le cuenta: cualquiera puede
 * escribir el correo de otra persona, así que el bloqueo no puede convertirse
 * ni en una forma de averiguar qué correos existen ni en una de dejar a
 * alguien afuera para siempre.
 */

const PASSWORD = 'Secreta123';
const EMAIL = 'tendera@test.local';

const mailFalso = {
  sendVerificationEmail: () => Promise.resolve(),
  sendPasswordResetEmail: () => Promise.resolve(),
  sendEmailChangeConfirmation: () => Promise.resolve(),
};

describe('Bloqueo de login (contra Postgres real)', () => {
  let prisma: PrismaService;
  let auth: AuthService;
  let jwt: JwtService;
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
    cerrar = async () => {
      await prisma.$disconnect();
      await moduleRef.close();
    };
  });

  afterAll(() => cerrar());

  beforeEach(async () => {
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

  const entrar = (password: string) => auth.login({ email: EMAIL, password });

  async function mensajeDeError(password: string) {
    try {
      await entrar(password);
      return null;
    } catch (e) {
      if (e instanceof UnauthorizedException) return e.message;
      throw e;
    }
  }

  async function fallar(veces: number) {
    for (let i = 0; i < veces; i++) await mensajeDeError('mala');
  }

  const estado = () =>
    prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });

  it('bloquea a la quinta contraseña incorrecta', async () => {
    await fallar(4);
    expect((await estado()).bloqueadoHasta).toBeNull();

    await fallar(1);
    const usuario = await estado();
    expect(usuario.bloqueadoHasta!.getTime()).toBeGreaterThan(Date.now());
  });

  it('con la cuenta bloqueada, la contraseña correcta no abre sesión', async () => {
    await fallar(5);

    expect(await mensajeDeError(PASSWORD)).toMatch(/bloqueada temporalmente/);
  });

  // Si el bloqueo se anunciara a cualquiera, probar cinco contraseñas al azar
  // diría qué correos están registrados.
  it('a quien no sabe la contraseña no se le revela que la cuenta existe', async () => {
    await fallar(5);

    expect(await mensajeDeError('otra-mala')).toBe(
      'Correo o contraseña incorrectos',
    );
    const inexistente = await auth
      .login({ email: 'nadie@test.local', password: 'otra-mala' })
      .catch((e: UnauthorizedException) => e.message);
    expect(inexistente).toBe('Correo o contraseña incorrectos');
  });

  it('insistir durante el bloqueo no lo alarga', async () => {
    await fallar(5);
    const hasta = (await estado()).bloqueadoHasta!.getTime();

    await fallar(10);

    const despues = await estado();
    expect(despues.bloqueadoHasta!.getTime()).toBe(hasta);
    expect(despues.intentosFallidos).toBe(0);
  });

  it('cuando vence el bloqueo se puede entrar de nuevo', async () => {
    await fallar(5);
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { bloqueadoHasta: new Date(Date.now() - 1_000) },
    });

    const sesion = await entrar(PASSWORD);
    expect('access_token' in sesion).toBe(true);
  });

  it('un login exitoso reinicia el contador', async () => {
    await fallar(3);
    await entrar(PASSWORD);

    expect((await estado()).intentosFallidos).toBe(0);
  });

  // Sin incremento atómico, cinco intentos a la vez leían el mismo contador
  // en 0 y lo dejaban en 1: la cuenta no se bloqueaba nunca.
  it('cinco intentos simultáneos también bloquean', async () => {
    await Promise.all(Array.from({ length: 5 }, () => mensajeDeError('mala')));

    expect((await estado()).bloqueadoHasta).not.toBeNull();
  });

  // La víctima de los intentos ajenos no puede quedarse esperando 15 minutos
  // si ya recuperó su contraseña.
  it('cambiar la contraseña levanta el bloqueo', async () => {
    await fallar(5);

    const token = jwt.sign({ sub: usuarioId, type: 'password-reset' });
    await auth.resetPassword({ token, newPassword: 'NuevaClave123*' });

    const usuario = await estado();
    expect(usuario.bloqueadoHasta).toBeNull();
    expect(usuario.intentosFallidos).toBe(0);

    const sesion = await entrar('NuevaClave123*');
    expect('access_token' in sesion).toBe(true);
  });
});
