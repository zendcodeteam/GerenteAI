import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

/**
 * El rate limiting está en producción con usuarios reales: lo que más importa
 * es que no bloquee a quien no debe. Se levanta la app entera para probar el
 * guard global tal como corre, con `trust proxy` como en main.ts.
 */
describe('Rate limiting global (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    process.env.N8N_API_KEY = 'clave-n8n-de-prueba';
    // El límite global real es 600/min: mandar 601 peticiones en cada prueba
    // no aportaría nada. Se baja a 5 para probar el comportamiento, que es lo
    // que importa (a quién bloquea y a quién no).
    process.env.RATE_LIMIT_GLOBAL = '5';

    // El import va aquí a propósito: ThrottlerModule.forRoot() lee la variable
    // cuando se carga el módulo, así que fijarla después no serviría de nada.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } =
      require('./../src/app.module') as typeof import('./../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.RATE_LIMIT_DISABLED;
    delete process.env.RATE_LIMIT_GLOBAL;
    await app?.close();
  });

  const desde = (ip: string) => ({ 'X-Forwarded-For': ip });

  async function golpear(ruta: string, veces: number, headers = {}) {
    const estados: number[] = [];
    for (let i = 0; i < veces; i++) {
      const res = await request(app.getHttpServer()).get(ruta).set(headers);
      estados.push(res.status);
    }
    return estados;
  }

  it('al pasar el límite responde 429 con el mensaje en español', async () => {
    const estados = await golpear('/', 5, desde('1.1.1.1'));
    expect(estados.every((s) => s === 200)).toBe(true);

    const res = await request(app.getHttpServer())
      .get('/')
      .set(desde('1.1.1.1'));
    expect(res.status).toBe(429);
    expect((res.body as { message: string }).message).toMatch(
      /Demasiadas solicitudes/,
    );
  });

  // Es el caso que bloquearía a todo el mundo si `trust proxy` estuviera mal:
  // cada visitante tiene que llevar su propio contador.
  it('otra IP no hereda el bloqueo', async () => {
    await golpear('/', 6, desde('1.1.1.1'));

    const res = await request(app.getHttpServer())
      .get('/')
      .set(desde('2.2.2.2'));
    expect(res.status).toBe(200);
  });

  it('/health nunca se limita', async () => {
    const estados = await golpear('/health', 20, desde('1.1.1.1'));
    expect(estados.every((s) => s === 200)).toBe(true);
  });

  it('las rutas de n8n no se limitan por IP (todo WhatsApp sale de una)', async () => {
    const estados = await golpear('/ai/interpret/ping', 20, {
      ...desde('3.3.3.3'),
      'x-api-key': 'clave-n8n-de-prueba',
    });
    expect(estados.every((s) => s === 200)).toBe(true);
  });

  // Los correos salen a la dirección que elija quien llama, así que el cupo
  // es corto: protege la reputación del remitente y la cuota de Brevo.
  it('recuperar contraseña: 5 cada 15 min por IP', async () => {
    const pedir = () =>
      request(app.getHttpServer())
        .post('/auth/forgot-password')
        .set(desde('4.4.4.4'))
        .send({ email: 'nadie@test.local' });

    for (let i = 0; i < 5; i++) expect((await pedir()).status).toBe(201);
    expect((await pedir()).status).toBe(429);

    // Otra IP conserva su propio cupo.
    const otra = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .set(desde('5.5.5.5'))
      .send({ email: 'nadie@test.local' });
    expect(otra.status).toBe(201);
  });

  // 30 y no 5: en redes móviles y en el wifi de un negocio varios usuarios
  // comparten IP y se bloquearían entre sí. La fuerza bruta contra una cuenta
  // la corta el bloqueo por cuenta, que no depende de la IP.
  it('login: 30 cada 15 min por IP', async () => {
    const intentar = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .set(desde('6.6.6.6'))
        .send({ email: 'nadie@test.local', password: 'Loquesea123' });

    for (let i = 0; i < 30; i++)
      expect((await intentar()).status).not.toBe(429);
    expect((await intentar()).status).toBe(429);
  });

  // Cada llamada a estas rutas cuesta una llamada al modelo, y hoy no piden
  // sesión: el límite es lo único que hay entre un desconocido y la cuota.
  it('las rutas de IA se limitan a 20/min por IP', async () => {
    const estados = await golpear('/ai/status', 20, desde('7.7.7.7'));
    expect(estados.every((s) => s === 200)).toBe(true);

    const res = await request(app.getHttpServer())
      .get('/ai/status')
      .set(desde('7.7.7.7'));
    expect(res.status).toBe(429);
  });

  it('RATE_LIMIT_DISABLED=true apaga los límites', async () => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    const estados = await golpear('/', 20, desde('1.1.1.1'));
    expect(estados.every((s) => s === 200)).toBe(true);
  });
});
