import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { MailService } from '../src/auth/mail/mail.service';
import { AUDIENCIA, JWT_ISSUER } from '../src/auth/jwt-claims';
import { NegociosService } from '../src/services/negocios.service';
import { PlanesService } from '../src/services/planes.service';
import { PrismaService } from '../src/services/prisma.service';
import { limpiar } from './helpers/contexto';

/**
 * Cada token vale solo para lo suyo.
 *
 * Antes, todos se firmaban igual y lo único que los separaba era el campo
 * `type`, o sea una comprobación que hay que acordarse de escribir en cada
 * flujo nuevo. Ahora el emisor y la audiencia viajan en el token y los
 * comprueba la librería al verificar la firma: el que no corresponde ni
 * siquiera llega al código que mira `type`.
 */

const PASSWORD = 'Secreta123';
const EMAIL = 'tendera@test.local';

const enlaces: Record<string, string> = {};

const mailFalso = {
  sendVerificationEmail: (_e: string, _n: string, token: string) => {
    enlaces.verificacion = token;
    return Promise.resolve();
  },
  sendPasswordResetEmail: (_e: string, _n: string, token: string) => {
    enlaces.reset = token;
    return Promise.resolve();
  },
  sendEmailChangeConfirmation: (_e: string, _n: string, token: string) => {
    enlaces.cambioEmail = token;
    return Promise.resolve();
  },
};

describe('Emisor y audiencia por tipo de token (contra Postgres real)', () => {
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

  async function tokenDeSesion() {
    const sesion = await auth.login({ email: EMAIL, password: PASSWORD });
    if (!('access_token' in sesion)) throw new Error('no hubo sesión');
    return sesion.access_token;
  }

  async function tokenDeReset() {
    await auth.forgotPassword({ email: EMAIL });
    return enlaces.reset;
  }

  async function tokenDeCambioDeEmail() {
    await auth.cambiarEmail(usuarioId, {
      nuevoEmail: 'otro@test.local',
      password: PASSWORD,
    });
    return enlaces.cambioEmail;
  }

  // Lo que hace la API con el token de la cabecera Authorization.
  const comoSesion = (token: string): { sub: string } =>
    jwt.verify<{ sub: string }>(token, {
      issuer: JWT_ISSUER,
      audience: AUDIENCIA.session,
    });

  describe('cada token lleva su emisor y su audiencia', () => {
    it('el de sesión', async () => {
      expect(jwt.decode(await tokenDeSesion())).toMatchObject({
        iss: JWT_ISSUER,
        aud: AUDIENCIA.session,
      });
    });

    it('el de recuperación de contraseña', async () => {
      expect(jwt.decode(await tokenDeReset())).toMatchObject({
        iss: JWT_ISSUER,
        aud: AUDIENCIA['password-reset'],
      });
    });

    it('el de cambio de correo', async () => {
      expect(jwt.decode(await tokenDeCambioDeEmail())).toMatchObject({
        iss: JWT_ISSUER,
        aud: AUDIENCIA['email-change'],
      });
    });
  });

  describe('un token no sirve para otra cosa', () => {
    // El caso grave: ese token viaja dentro de un correo.
    it('el de recuperación no abre sesión', async () => {
      const reset = await tokenDeReset();

      expect(() => comoSesion(reset)).toThrow();
    });

    it('el de cambio de correo no abre sesión', async () => {
      const cambio = await tokenDeCambioDeEmail();

      expect(() => comoSesion(cambio)).toThrow();
    });

    it('el de sesión no sirve para cambiar la contraseña', async () => {
      const sesion = await tokenDeSesion();

      await expect(
        auth.resetPassword({ token: sesion, newPassword: 'OtraClave123*' }),
      ).rejects.toThrow();
    });

    it('el de recuperación no confirma un cambio de correo', async () => {
      const reset = await tokenDeReset();

      await expect(
        auth.confirmarCambioEmail({ token: reset }),
      ).rejects.toThrow();
    });

    it('el de cambio de correo no sirve para cambiar la contraseña', async () => {
      const cambio = await tokenDeCambioDeEmail();

      await expect(
        auth.resetPassword({ token: cambio, newPassword: 'OtraClave123*' }),
      ).rejects.toThrow();
    });
  });

  /**
   * Las demás pruebas llaman a los servicios directamente. Estas pasan por
   * HTTP porque la comprobación del emisor y la audiencia de sesión la hace
   * Passport al recibir la petición, antes de cualquier código nuestro: si
   * esos valores no cuadraran, toda la API autenticada respondería 401 y
   * ninguna otra prueba se enteraría.
   */
  describe('la API real, con el token en la cabecera', () => {
    let app: INestApplication;

    beforeAll(async () => {
      process.env.N8N_API_KEY = 'clave-n8n-de-prueba';
      const { AppModule } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('./../src/app.module') as typeof import('./../src/app.module');

      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(async () => {
      await app?.close();
    });

    const perfil = (token: string) =>
      request(app.getHttpServer())
        .get('/auth/usuarios/me')
        .set('Authorization', `Bearer ${token}`);

    it('un token de sesión abre la API', async () => {
      const respuesta = await perfil(await tokenDeSesion());

      expect(respuesta.status).toBe(200);
    });

    it('un token de recuperación no abre la API', async () => {
      const respuesta = await perfil(await tokenDeReset());

      expect(respuesta.status).toBe(401);
    });

    it('un token de sesión sin emisor ni audiencia no abre la API', async () => {
      const viejo = jwt.sign({
        sub: usuarioId,
        type: 'session',
        negocioId: null,
        role: null,
        rolGlobal: 'CLIENTE',
      });

      const respuesta = await perfil(viejo);

      expect(respuesta.status).toBe(401);
    });
  });

  describe('tokens que no emitió Luka', () => {
    // Mismo secreto, otro emisor: el caso de un servicio que comparta la
    // variable de entorno por error.
    it('un token de otro emisor no abre sesión', () => {
      const ajeno = jwt.sign(
        { sub: usuarioId, type: 'session' },
        { issuer: 'otro-sistema', audience: AUDIENCIA.session },
      );

      expect(() => comoSesion(ajeno)).toThrow();
    });

    // Los tokens anteriores a este cambio no llevan `iss` ni `aud`. Que dejen
    // de valer es intencional: obliga a iniciar sesión una vez.
    it('un token viejo sin emisor ni audiencia no abre sesión', () => {
      const viejo = jwt.sign({ sub: usuarioId, type: 'session' });

      expect(() => comoSesion(viejo)).toThrow();
    });

    it('un enlace de recuperación viejo tampoco sirve', async () => {
      const viejo = jwt.sign({ sub: usuarioId, type: 'password-reset' });

      await expect(
        auth.resetPassword({ token: viejo, newPassword: 'OtraClave123*' }),
      ).rejects.toThrow();
    });
  });
});
