import { ForbiddenException } from '@nestjs/common';
import {
  cerrarContexto,
  crearContexto,
  limpiar,
  sembrar,
  type Contexto,
  type Semilla,
} from './helpers/contexto';

const EN_UN_ANO = new Date(Date.now() + 365 * 86_400_000);
const AYER = new Date(Date.now() - 86_400_000);

describe('Límites por plan (contra Postgres real)', () => {
  let ctx: Contexto;
  let s: Semilla;

  beforeAll(async () => {
    ctx = await crearContexto();
  });

  afterAll(async () => {
    await limpiar(ctx.prisma);
    await cerrarContexto(ctx);
  });

  beforeEach(async () => {
    await limpiar(ctx.prisma);
    s = await sembrar(ctx.prisma);
  });

  // La semilla deja el negocio en plan 2 (Gerente) con dos sedes.
  const ponerPlan = (plan: number, venceEl: Date | null) =>
    ctx.prisma.negocio.update({
      where: { id: s.negocioId },
      data: { plan, planVenceEl: venceEl },
    });

  const crearSede = (nombre: string) =>
    ctx.sedes.create(s.duenoId, 'CLIENTE', {
      nombre,
      negocioId: s.negocioId,
    });

  const venderEn = (sedeId: string, productoId: string) =>
    ctx.ventas.create(s.duenoId, 'CLIENTE', {
      sedeId,
      detalles: [{ productoId, cantidad: 1 }],
    });

  describe('tope de sedes al crearlas', () => {
    it('el plan Asistente no deja pasar de 1 sede', async () => {
      await ponerPlan(1, null);

      await expect(crearSede('Tercera')).rejects.toThrow(ForbiddenException);
    });

    // El Gerente es de una sola sede: la semilla ya trae dos, así que no cabe
    // ninguna más. Que ya esté por encima del tope no rompe nada, solo impide
    // crecer; las sedes de más quedan en solo lectura.
    it('el plan Gerente no permite pasar de 1 sede', async () => {
      await ponerPlan(2, EN_UN_ANO);

      await expect(crearSede('Tercera')).rejects.toThrow(ForbiddenException);
    });

    it('el plan Administrador permite hasta 3', async () => {
      await ponerPlan(3, EN_UN_ANO);

      // La semilla ya trae 2, así que cabe una más.
      await expect(crearSede('Tercera')).resolves.toBeDefined();
      await expect(crearSede('Cuarta')).rejects.toThrow(ForbiddenException);
    });

    it('el plan Socio permite hasta 5', async () => {
      await ponerPlan(4, EN_UN_ANO);

      for (let i = 3; i <= 5; i++) {
        await expect(crearSede(`Sede ${i}`)).resolves.toBeDefined();
      }
      await expect(crearSede('Sede 6')).rejects.toThrow(ForbiddenException);
    });

    it('el plan Corporativo no tiene tope', async () => {
      await ponerPlan(5, EN_UN_ANO);

      for (let i = 3; i <= 12; i++) {
        await expect(crearSede(`Sede ${i}`)).resolves.toBeDefined();
      }
    });

    it('con el plan vencido rige el tope del Asistente', async () => {
      await ponerPlan(3, AYER);

      await expect(crearSede('Tercera')).rejects.toThrow(ForbiddenException);
    });

    it('el mensaje de error dice cuál es el plan y cuántas sedes permite', async () => {
      await ponerPlan(1, null);

      await expect(crearSede('Tercera')).rejects.toThrow(/Asistente.*1 sede/s);
    });
  });

  describe('sedes bloqueadas cuando el plan no alcanza', () => {
    it('con plan Administrador vigente se puede escribir en ambas sedes', async () => {
      await ponerPlan(3, EN_UN_ANO);

      await expect(venderEn(s.sedeAId, s.gaseosaId)).resolves.toBeDefined();
      await expect(venderEn(s.sedeBId, s.arrozId)).resolves.toBeDefined();
    });

    // El caso central: al vencer se conserva la primera sede creada.
    it('al vencer el plan, la primera sede sigue operando y la segunda no', async () => {
      await ponerPlan(2, AYER);

      await expect(venderEn(s.sedeAId, s.gaseosaId)).resolves.toBeDefined();
      await expect(venderEn(s.sedeBId, s.arrozId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lo mismo con el plan Asistente, que nunca tuvo derecho a la segunda', async () => {
      await ponerPlan(1, null);

      await expect(venderEn(s.sedeAId, s.gaseosaId)).resolves.toBeDefined();
      await expect(venderEn(s.sedeBId, s.arrozId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('el bloqueo cubre todos los módulos operativos, no solo ventas', async () => {
      await ponerPlan(1, null);

      const enSedeBloqueada = { sedeId: s.sedeBId };

      await expect(
        ctx.productos.create(s.duenoId, 'CLIENTE', {
          nombre: 'Nuevo',
          categoria: 'General',
          precioCompra: 1,
          precioVenta: 2,
          ...enSedeBloqueada,
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        ctx.compras.create(s.duenoId, 'CLIENTE', {
          ...enSedeBloqueada,
          detalles: [{ productoId: s.arrozId, cantidad: 1 }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    // Bloquear escritura no puede llevarse por delante el histórico.
    it('la sede bloqueada se sigue pudiendo consultar', async () => {
      await ponerPlan(1, null);

      await expect(
        ctx.reportes.deSede(s.sedeBId, s.duenoId, 'CLIENTE', 'mensual'),
      ).resolves.toBeDefined();
      await expect(
        ctx.usuarioSedes.findAll(s.duenoId, 'CLIENTE', s.sedeBId),
      ).resolves.toBeDefined();
    });

    it('MASTER no queda sujeto a los topes del plan', async () => {
      await ponerPlan(1, null);

      await expect(
        ctx.ventas.create(s.masterId, 'MASTER', {
          sedeId: s.sedeBId,
          detalles: [{ productoId: s.arrozId, cantidad: 1 }],
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('reportes Premium', () => {
    it('el plan Asistente no accede al reporte por producto ni al de fiados', async () => {
      await ponerPlan(1, null);

      await expect(
        ctx.reportes.porProducto(s.sedeAId, s.duenoId, 'CLIENTE', 'mensual'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        ctx.reportes.fiados(s.sedeAId, s.duenoId, 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('el plan Gerente sí accede a ambos', async () => {
      await ponerPlan(2, EN_UN_ANO);

      await expect(
        ctx.reportes.porProducto(s.sedeAId, s.duenoId, 'CLIENTE', 'mensual'),
      ).resolves.toBeDefined();
      await expect(
        ctx.reportes.fiados(s.sedeAId, s.duenoId, 'CLIENTE'),
      ).resolves.toBeDefined();
    });

    it('un plan Gerente vencido pierde el acceso', async () => {
      await ponerPlan(2, AYER);

      await expect(
        ctx.reportes.fiados(s.sedeAId, s.duenoId, 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('el reporte general sigue disponible en todos los planes', async () => {
      await ponerPlan(1, null);

      await expect(
        ctx.reportes.deSede(s.sedeAId, s.duenoId, 'CLIENTE', 'mensual'),
      ).resolves.toBeDefined();
    });
  });

  describe('cambio de plan', () => {
    it('el dueño no puede subirse el plan por su cuenta', async () => {
      await expect(
        ctx.negocios.cambiarPlan(s.negocioId, 'CLIENTE', 3, 'anual'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('MASTER lo cambia y queda con fecha de vencimiento', async () => {
      const negocio = await ctx.negocios.cambiarPlan(
        s.negocioId,
        'MASTER',
        3,
        'anual',
      );

      expect(negocio.plan).toBe(3);
      expect(negocio.planVenceEl).not.toBeNull();

      const dias = Math.round(
        (negocio.planVenceEl!.getTime() - Date.now()) / 86_400_000,
      );
      expect(dias).toBe(365);
    });

    it('el ciclo mensual vence en 30 días', async () => {
      const negocio = await ctx.negocios.cambiarPlan(
        s.negocioId,
        'MASTER',
        2,
        'mensual',
      );

      const dias = Math.round(
        (negocio.planVenceEl!.getTime() - Date.now()) / 86_400_000,
      );
      expect(dias).toBe(30);
    });

    // El gratuito no vence: si tuviera fecha, al pasar quedaría sin ningún plan.
    it('bajar al plan Asistente deja el vencimiento en null', async () => {
      await ctx.negocios.cambiarPlan(s.negocioId, 'MASTER', 3, 'anual');
      const negocio = await ctx.negocios.cambiarPlan(
        s.negocioId,
        'MASTER',
        1,
        'mensual',
      );

      expect(negocio.plan).toBe(1);
      expect(negocio.planVenceEl).toBeNull();
    });
  });
});
