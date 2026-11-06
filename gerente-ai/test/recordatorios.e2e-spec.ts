import { Test, TestingModule } from '@nestjs/testing';
import { createHash } from 'crypto';
import { PrismaService } from '../src/services/prisma.service';
import { NegociosService } from '../src/services/negocios.service';
import { UserContextCacheService } from '../src/services/user-context-cache.service';
import { PlanesService } from '../src/services/planes.service';
import { PagosService } from '../src/services/pagos.service';
import { RecordatoriosService } from '../src/services/recordatorios.service';
import { MailService } from '../src/auth/mail/mail.service';
import { limpiar } from './helpers/contexto';
import {
  PLAN_ADMINISTRADOR,
  PLAN_ASISTENTE,
  PLAN_GERENTE,
} from '../src/services/planes.service';

const DIA = 86_400_000;

/**
 * Doble del servicio de correo: anota a quién se le escribió y con qué asunto,
 * sin salir a la red. El envío real se comprueba aparte, con un script manual
 * contra Brevo; aquí lo que se prueba es a quién hay que escribirle y cuándo.
 */
class MailEspia {
  enviados: { tipo: string; destinatario: string; dias?: number }[] = [];

  sendAvisoDeVencimiento(
    destinatario: string,
    _nombre: string,
    _negocio: string,
    _plan: string,
    dias: number,
  ) {
    this.enviados.push({ tipo: 'previo', destinatario, dias });
    return Promise.resolve();
  }

  sendPlanVencido(destinatario: string) {
    this.enviados.push({ tipo: 'vencido', destinatario });
    return Promise.resolve();
  }

  sendSeguimientoDeVencimiento(destinatario: string) {
    this.enviados.push({ tipo: 'seguimiento', destinatario });
    return Promise.resolve();
  }

  limpiar() {
    this.enviados = [];
  }
}

describe('Recordatorios de vencimiento (contra Postgres real)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let recordatorios: RecordatoriosService;
  let negocios: NegociosService;
  let pagos: PagosService;
  const mail = new MailEspia();

  let duenoId: string;
  let negocioId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        PlanesService,
        NegociosService,
        UserContextCacheService,
        PagosService,
        RecordatoriosService,
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
    recordatorios = moduleRef.get(RecordatoriosService);
    negocios = moduleRef.get(NegociosService);
    pagos = moduleRef.get(PagosService);
  });

  afterAll(async () => {
    await limpiar(prisma);
    await prisma.$disconnect();
    await moduleRef.close();
  });

  beforeEach(async () => {
    await limpiar(prisma);
    mail.limpiar();

    const dueno = await prisma.usuario.create({
      data: {
        nombre: 'Doña Rosa',
        email: 'rosa@test.local',
        password: 'hash',
      },
    });
    const negocio = await prisma.negocio.create({
      data: { nombre: 'Tienda La Esquina', plan: PLAN_GERENTE },
    });
    await prisma.usuarioNegocio.create({
      data: { usuarioId: dueno.id, negocioId: negocio.id },
    });

    duenoId = dueno.id;
    negocioId = negocio.id;
  });

  /** Coloca el vencimiento del negocio donde haga falta para la prueba. */
  const venceEn = (milisegundos: number) =>
    prisma.negocio.update({
      where: { id: negocioId },
      data: { planVenceEl: new Date(Date.now() + milisegundos) },
    });

  const negocioActual = () =>
    prisma.negocio.findUniqueOrThrow({ where: { id: negocioId } });

  describe('aviso previo', () => {
    it('avisa cuando faltan menos de 3 días', async () => {
      await venceEn(2 * DIA);

      const resumen = await recordatorios.ejecutar();

      expect(resumen.previo).toBe(1);
      expect(mail.enviados).toEqual([
        { tipo: 'previo', destinatario: 'rosa@test.local', dias: 2 },
      ]);
    });

    it('no avisa si aún falta más de la ventana', async () => {
      await venceEn(10 * DIA);

      expect(await recordatorios.ejecutar()).toMatchObject({ previo: 0 });
      expect(mail.enviados).toHaveLength(0);
    });

    /**
     * El caso que justifica la tabla de notificaciones. El job puede correr
     * muchas veces al día, o dos veces a la vez: el aviso sale una sola vez.
     */
    it('no repite el aviso aunque el job corra varias veces', async () => {
      await venceEn(2 * DIA);

      await recordatorios.ejecutar();
      await recordatorios.ejecutar();
      await recordatorios.ejecutar();

      expect(mail.enviados).toHaveLength(1);
    });

    // La llave incluye el vencimiento: al renovar cambia la fecha, así que el
    // aviso del ciclo nuevo sí debe salir.
    it('vuelve a avisar tras renovar, para el vencimiento nuevo', async () => {
      await venceEn(2 * DIA);
      await recordatorios.ejecutar();

      await venceEn(32 * DIA); // renovó
      expect(await recordatorios.ejecutar()).toMatchObject({ previo: 0 });

      await venceEn(2 * DIA); // el ciclo nuevo también se acerca
      expect(await recordatorios.ejecutar()).toMatchObject({ previo: 1 });
      expect(mail.enviados).toHaveLength(2);
    });

    // El plan gratuito no vence, así que no hay nada que recordarle.
    it('ignora los negocios en plan Asistente', async () => {
      await prisma.negocio.update({
        where: { id: negocioId },
        data: { plan: PLAN_ASISTENTE, planVenceEl: new Date(Date.now() + DIA) },
      });

      expect(await recordatorios.ejecutar()).toMatchObject({ previo: 0 });
    });
  });

  describe('plan vencido', () => {
    it('avisa el día después de vencer', async () => {
      await venceEn(-1 * DIA);

      const resumen = await recordatorios.ejecutar();

      expect(resumen.vencido).toBe(1);
      expect(mail.enviados).toEqual([
        { tipo: 'vencido', destinatario: 'rosa@test.local' },
      ]);
    });

    it('manda el seguimiento a la semana', async () => {
      await venceEn(-8 * DIA);

      const resumen = await recordatorios.ejecutar();

      expect(resumen.vencido_seguimiento).toBe(1);
      expect(mail.enviados).toEqual([
        { tipo: 'seguimiento', destinatario: 'rosa@test.local' },
      ]);
    });

    /**
     * Sin acotar la ventana por abajo, la primera ejecución del job en
     * producción le escribiría a todos los que vencieron alguna vez.
     */
    it('no le escribe a quien venció hace meses', async () => {
      await venceEn(-120 * DIA);

      expect(await recordatorios.ejecutar()).toEqual({
        previo: 0,
        vencido: 0,
        vencido_seguimiento: 0,
      });
      expect(mail.enviados).toHaveLength(0);
    });

    // Tres avisos y se acabó: insistir más acaba en la carpeta de spam, y eso
    // perjudica también a los correos de verificación.
    it('no insiste más allá del seguimiento', async () => {
      await venceEn(-1 * DIA);
      await recordatorios.ejecutar();

      await venceEn(-8 * DIA);
      await recordatorios.ejecutar();

      await venceEn(-20 * DIA);
      await recordatorios.ejecutar();

      expect(mail.enviados.map((e) => e.tipo)).toEqual([
        'vencido',
        'seguimiento',
      ]);
    });
  });

  describe('escribe a todos los dueños', () => {
    it('incluye a los socios, no solo a quien abrió la cuenta', async () => {
      const socio = await prisma.usuario.create({
        data: { nombre: 'Socio', email: 'socio@test.local', password: 'hash' },
      });
      await prisma.usuarioNegocio.create({
        data: { usuarioId: socio.id, negocioId },
      });
      await venceEn(2 * DIA);

      await recordatorios.ejecutar();

      expect(mail.enviados.map((e) => e.destinatario).sort()).toEqual([
        'rosa@test.local',
        'socio@test.local',
      ]);
    });
  });

  /**
   * El recorrido completo tal como lo vive un tendero: paga y sube, se le vence
   * y cae, vuelve a pagar y recupera.
   */
  describe('ciclo de vida del plan', () => {
    const pagarPlan = async (plan: number) => {
      const checkout = await pagos.crearCheckout(duenoId, 'CLIENTE', {
        negocioId,
        plan,
        ciclo: 'mensual',
      });

      const timestamp = 1_700_000_000;
      const transaccionId = `tx-${checkout.referencia}`;
      const checksum = createHash('sha256')
        .update(
          `${transaccionId}APPROVED${checkout.montoEnCentavos}${timestamp}${process.env.WOMPI_EVENTS_SECRET}`,
          'utf8',
        )
        .digest('hex');

      await pagos.procesarEvento({
        data: {
          transaction: {
            id: transaccionId,
            reference: checkout.referencia,
            status: 'APPROVED',
            amount_in_cents: checkout.montoEnCentavos,
            currency: 'COP',
          },
        },
        timestamp,
        signature: {
          properties: [
            'transaction.id',
            'transaction.status',
            'transaction.amount_in_cents',
          ],
          checksum,
        },
      });
    };

    it('paga y sube, vence y cae a Asistente, vuelve a pagar y recupera', async () => {
      const planes = moduleRef.get(PlanesService);

      // 1. Paga el plan Administrador.
      await pagarPlan(PLAN_ADMINISTRADOR);
      let negocio = await negocioActual();
      expect(negocio.plan).toBe(PLAN_ADMINISTRADOR);
      expect(planes.estado(negocio.plan, negocio.planVenceEl).vigente.id).toBe(
        PLAN_ADMINISTRADOR,
      );
      expect(planes.maxSedes(negocio.plan, negocio.planVenceEl)).toBe(3);

      // 2. Se le vence: opera como Asistente aunque el contratado siga siendo el
      //    Administrador. No se toca ningún campo; se deriva de la fecha.
      await venceEn(-1 * DIA);
      negocio = await negocioActual();
      const vencido = planes.estado(negocio.plan, negocio.planVenceEl);
      expect(negocio.plan).toBe(PLAN_ADMINISTRADOR);
      expect(vencido.vencido).toBe(true);
      expect(vencido.vigente.id).toBe(PLAN_ASISTENTE);
      expect(planes.maxSedes(negocio.plan, negocio.planVenceEl)).toBe(1);

      // 3. Le llega el aviso de vencido.
      expect(await recordatorios.ejecutar()).toMatchObject({ vencido: 1 });

      // 4. Vuelve a pagar y recupera de inmediato.
      await pagarPlan(PLAN_ADMINISTRADOR);
      negocio = await negocioActual();
      const recuperado = planes.estado(negocio.plan, negocio.planVenceEl);
      expect(recuperado.vencido).toBe(false);
      expect(recuperado.vigente.id).toBe(PLAN_ADMINISTRADOR);
      expect(planes.maxSedes(negocio.plan, negocio.planVenceEl)).toBe(3);
      expect(negocio.planVenceEl!.getTime()).toBeGreaterThan(Date.now());
    });

    // Cambiar de plan no arrastra el vencimiento del anterior: es otro producto.
    it('MASTER puede fijar un vencimiento exacto, que es como se ensaya', async () => {
      const dentroDeDosDias = new Date(Date.now() + 2 * DIA);

      await negocios.cambiarPlan(
        negocioId,
        'MASTER',
        PLAN_GERENTE,
        'mensual',
        dentroDeDosDias,
      );

      const negocio = await negocioActual();
      expect(negocio.planVenceEl!.getTime()).toBe(dentroDeDosDias.getTime());

      // Y con eso el aviso previo sale de inmediato, sin esperar 27 días.
      expect(await recordatorios.ejecutar()).toMatchObject({ previo: 1 });
    });
  });
});
