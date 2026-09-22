import {
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { generate } from 'otplib';
import {
  AuthService,
  type AuthResponse,
  type AuthenticatedUserResponse,
} from '../src/auth/auth.service';
import { MailService } from '../src/auth/mail/mail.service';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { JwtPayload } from '../src/auth/interfaces/jwt-payload.interface';
import { NegociosService } from '../src/services/negocios.service';
import { PlanesService } from '../src/services/planes.service';
import { PrismaService } from '../src/services/prisma.service';
import { limpiar } from './helpers/contexto';

const CLAVE_DE_PRUEBA = 'a'.repeat(64);
const PASSWORD = 'Secreta123';

const mailFalso = {
  sendVerificationEmail: () => Promise.resolve(),
  sendPasswordResetEmail: () => Promise.resolve(),
  sendEmailChangeConfirmation: () => Promise.resolve(),
};

function codigoActual(secret: string) {
  return generate({ secret });
}

// Un código que no coincide con ninguno de los pasos que acepta la
// tolerancia de ±30 s, para que "incorrecto" lo sea siempre.
async function codigoIncorrecto(secret: string) {
  const ahora = Math.floor(Date.now() / 1000);
  const validos = await Promise.all(
    [-30, 0, 30].map((d) => generate({ secret, epoch: ahora + d })),
  );
  for (let n = 0; ; n++) {
    const candidato = String(n).padStart(6, '0');
    if (!validos.includes(candidato)) return candidato;
  }
}

async function estado(promesa: Promise<unknown>) {
  try {
    await promesa;
    return 200;
  } catch (e) {
    if (e instanceof HttpException) return e.getStatus();
    throw e;
  }
}

describe('MFA obligatorio para MASTER (contra Postgres real)', () => {
  let prisma: PrismaService;
  let auth: AuthService;
  let jwt: JwtService;
  let cerrar: () => Promise<void>;
  let masterId: string;

  beforeAll(async () => {
    process.env.MFA_ENCRYPTION_KEY = CLAVE_DE_PRUEBA;

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
    process.env.MFA_ENCRYPTION_KEY = CLAVE_DE_PRUEBA;
    await limpiar(prisma);

    const master = await prisma.usuario.create({
      data: {
        nombre: 'Master',
        email: 'master@test.local',
        password: await bcrypt.hash(PASSWORD, 4),
        emailVerificado: true,
        rolGlobal: 'MASTER',
      },
    });
    masterId = master.id;
  });

  const login = () =>
    auth.login({ email: 'master@test.local', password: PASSWORD });

  function mfaToken(respuesta: AuthResponse) {
    expect('mfaToken' in respuesta).toBe(true);
    return (respuesta as { mfaToken: string }).mfaToken;
  }

  // Deja al MASTER con MFA activo y devuelve el secreto de su autenticador.
  async function activar() {
    const token = mfaToken(await login());
    const { secret } = await auth.activarMfa(token);
    await auth.verificarActivacionMfa(token, await codigoActual(secret));
    // El código de activación consumió el paso actual; se libera para que
    // la prueba pueda iniciar sesión sin esperar 30 s al siguiente código.
    await prisma.usuario.update({
      where: { id: masterId },
      data: { mfaUltimoPaso: null },
    });
    return secret;
  }

  describe('el login nunca entrega sesión a un MASTER', () => {
    it('sin MFA configurado pide activarlo', async () => {
      const respuesta = await login();

      expect(respuesta).toMatchObject({
        requiresMfa: true,
        mfaRequiredAction: 'setup',
      });
      expect('access_token' in respuesta).toBe(false);
    });

    it('con MFA activo pide el código', async () => {
      await activar();
      const respuesta = await login();

      expect(respuesta).toMatchObject({
        requiresMfa: true,
        mfaRequiredAction: 'verify',
      });
      expect('access_token' in respuesta).toBe(false);
    });

    it('el mfaToken no sirve como sesión en la API', async () => {
      const token = mfaToken(await login());
      const payload = jwt.verify<JwtPayload>(token);

      await expect(
        new JwtStrategy(prisma).validate(payload),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('el token de activación no sirve para el paso de login', async () => {
      const secret = await activar();
      const tokenDeSetup = jwt.sign({
        sub: masterId,
        type: 'mfa-pending',
        purpose: 'setup',
      });

      await expect(
        auth.verificarMfa(tokenDeSetup, await codigoActual(secret)),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('activación y verificación', () => {
    it('activa con el primer código correcto y entrega una sesión', async () => {
      const token = mfaToken(await login());
      const { secret, otpauthUrl } = await auth.activarMfa(token);

      expect(otpauthUrl).toMatch(/^otpauth:\/\/totp\//);

      const sesion = await auth.verificarActivacionMfa(
        token,
        await codigoActual(secret),
      );
      const payload = jwt.verify<JwtPayload>(sesion.access_token);
      expect(payload.type).toBe('session');

      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: masterId },
      });
      expect(usuario.mfaActivado).toBe(true);
      // El secreto se guarda cifrado, nunca tal cual.
      expect(usuario.mfaSecret).not.toContain(secret);
    });

    it('verifica el login con el código correcto', async () => {
      const secret = await activar();
      const token = mfaToken(await login());

      const sesion: AuthenticatedUserResponse = await auth.verificarMfa(
        token,
        await codigoActual(secret),
      );

      expect(jwt.verify<JwtPayload>(sesion.access_token)).toMatchObject({
        sub: masterId,
        type: 'session',
        rolGlobal: 'MASTER',
      });
    });

    it('un código ya usado no sirve dos veces', async () => {
      const secret = await activar();
      const codigo = await codigoActual(secret);

      await auth.verificarMfa(mfaToken(await login()), codigo);

      await expect(
        auth.verificarMfa(mfaToken(await login()), codigo),
      ).rejects.toThrow(/ya fue usado/);
    });

    it('dos activaciones simultáneas con el mismo código: solo una entra', async () => {
      const token = mfaToken(await login());
      const { secret } = await auth.activarMfa(token);
      const codigo = await codigoActual(secret);

      const estados = await Promise.all([
        estado(auth.verificarActivacionMfa(token, codigo)),
        estado(auth.verificarActivacionMfa(token, codigo)),
      ]);

      expect(estados.filter((s) => s === 200)).toHaveLength(1);
    });
  });

  describe('límite de intentos', () => {
    it('avisa cuántos intentos quedan', async () => {
      const secret = await activar();
      const token = mfaToken(await login());

      await expect(
        auth.verificarMfa(token, await codigoIncorrecto(secret)),
      ).rejects.toThrow(/quedan 4 intentos/);
    });

    it('bloquea al quinto código incorrecto, aun con el código correcto después', async () => {
      const secret = await activar();
      const token = mfaToken(await login());
      const incorrecto = await codigoIncorrecto(secret);

      for (let i = 0; i < 4; i++) {
        expect(await estado(auth.verificarMfa(token, incorrecto))).toBe(
          HttpStatus.UNAUTHORIZED,
        );
      }
      expect(await estado(auth.verificarMfa(token, incorrecto))).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );

      // Ni el código correcto ni un login nuevo levantan el bloqueo.
      const otroToken = mfaToken(await login());
      expect(
        await estado(auth.verificarMfa(otroToken, await codigoActual(secret))),
      ).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('en paralelo tampoco se prueban más de cinco códigos', async () => {
      const secret = await activar();
      const token = mfaToken(await login());
      const incorrecto = await codigoIncorrecto(secret);

      const estados = await Promise.all(
        Array.from({ length: 20 }, () =>
          estado(auth.verificarMfa(token, incorrecto)),
        ),
      );

      expect(
        estados.filter((s) => s === HttpStatus.UNAUTHORIZED).length,
      ).toBeLessThanOrEqual(4);
      expect(estados.every((s) => s !== 200)).toBe(true);

      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: masterId },
      });
      expect(usuario.mfaBloqueadoHasta!.getTime()).toBeGreaterThan(Date.now());
    });

    it('el bloqueo vencido se levanta solo', async () => {
      const secret = await activar();
      await prisma.usuario.update({
        where: { id: masterId },
        data: {
          mfaBloqueadoHasta: new Date(Date.now() - 1000),
          mfaIntentosFallidos: 0,
        },
      });

      const sesion = await auth.verificarMfa(
        mfaToken(await login()),
        await codigoActual(secret),
      );
      expect(sesion.access_token).toBeDefined();
    });

    it('un acierto reinicia el contador', async () => {
      const secret = await activar();
      const incorrecto = await codigoIncorrecto(secret);

      for (let i = 0; i < 3; i++) {
        await estado(auth.verificarMfa(mfaToken(await login()), incorrecto));
      }
      await auth.verificarMfa(
        mfaToken(await login()),
        await codigoActual(secret),
      );

      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: masterId },
      });
      expect(usuario.mfaIntentosFallidos).toBe(0);
    });
  });

  describe('configuración del servidor', () => {
    it('sin MFA_ENCRYPTION_KEY responde 500, no 401', async () => {
      const token = mfaToken(await login());
      delete process.env.MFA_ENCRYPTION_KEY;

      await expect(auth.activarMfa(token)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('un error de configuración no gasta intentos', async () => {
      const secret = await activar();
      const token = mfaToken(await login());
      process.env.MFA_ENCRYPTION_KEY = 'b'.repeat(64);

      await expect(
        auth.verificarMfa(token, await codigoActual(secret)),
      ).rejects.toThrow(InternalServerErrorException);

      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: masterId },
      });
      expect(usuario.mfaIntentosFallidos).toBe(0);
    });
  });
});
