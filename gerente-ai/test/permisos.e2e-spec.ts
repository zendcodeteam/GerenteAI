import { ForbiddenException } from '@nestjs/common';
import {
  cerrarContexto,
  crearContexto,
  limpiar,
  sembrar,
  type Contexto,
  type Semilla,
} from './helpers/contexto';

describe('Modelo de permisos por sede (contra Postgres real)', () => {
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

  const venderEn = (
    usuarioId: string,
    rolGlobal: string,
    sedeId: string,
    productoId: string,
  ) =>
    ctx.ventas.create(usuarioId, rolGlobal, {
      sedeId,
      detalles: [{ productoId, cantidad: 1 }],
    });

  describe('dueño del negocio', () => {
    it('opera en todas las sedes de su negocio', async () => {
      await expect(
        venderEn(s.duenoId, 'CLIENTE', s.sedeAId, s.gaseosaId),
      ).resolves.toBeDefined();
      await expect(
        venderEn(s.duenoId, 'CLIENTE', s.sedeBId, s.arrozId),
      ).resolves.toBeDefined();
    });
  });

  describe('administrador de una sede', () => {
    it('opera en la sede que tiene asignada', async () => {
      await expect(
        venderEn(s.adminSedeAId, 'CLIENTE', s.sedeAId, s.gaseosaId),
      ).resolves.toBeDefined();
    });

    // El caso central del modelo multi-sede.
    it('NO puede operar en una sede ajena del mismo negocio', async () => {
      await expect(
        venderEn(s.adminSedeAId, 'CLIENTE', s.sedeBId, s.arrozId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('tampoco puede crear productos en la sede ajena', async () => {
      await expect(
        ctx.productos.create(s.adminSedeAId, 'CLIENTE', {
          nombre: 'Intruso',
          categoria: 'General',
          precioCompra: 1,
          precioVenta: 2,
          sedeId: s.sedeBId,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        await ctx.prisma.producto.count({ where: { sedeId: s.sedeBId } }),
      ).toBe(1);
    });

    it('puede crear productos en su propia sede', async () => {
      await expect(
        ctx.productos.create(s.adminSedeAId, 'CLIENTE', {
          nombre: 'Café',
          categoria: 'Bebidas',
          precioCompra: 800,
          precioVenta: 1200,
          sedeId: s.sedeAId,
        }),
      ).resolves.toBeDefined();
    });

    // Vincular personal es potestad del dueño: si no, un admin podría meter gente.
    it('no puede vincular usuarios a su propia sede', async () => {
      await expect(
        ctx.usuarioSedes.create(s.adminSedeAId, 'CLIENTE', {
          usuarioId: s.ajenoId,
          sedeId: s.sedeAId,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sí puede consultar quién más está en su sede', async () => {
      const miembros = await ctx.usuarioSedes.findAll(
        s.adminSedeAId,
        'CLIENTE',
        s.sedeAId,
      );
      expect(miembros).toHaveLength(1);
    });

    it('no puede consultar los miembros de la sede ajena', async () => {
      await expect(
        ctx.usuarioSedes.findAll(s.adminSedeAId, 'CLIENTE', s.sedeBId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('usuario sin ninguna relación', () => {
    it('no puede operar en ninguna sede', async () => {
      await expect(
        venderEn(s.ajenoId, 'CLIENTE', s.sedeAId, s.gaseosaId),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        venderEn(s.ajenoId, 'CLIENTE', s.sedeBId, s.arrozId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('no puede registrar abonos de clientes ajenos', async () => {
      await expect(
        ctx.abonos.create(s.ajenoId, 'CLIENTE', {
          clienteId: s.clienteAId,
          monto: 100,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('usuario MASTER', () => {
    it('pasa por encima de cualquier sede sin tener relación registrada', async () => {
      await expect(
        venderEn(s.masterId, 'MASTER', s.sedeAId, s.gaseosaId),
      ).resolves.toBeDefined();
      await expect(
        venderEn(s.masterId, 'MASTER', s.sedeBId, s.arrozId),
      ).resolves.toBeDefined();
    });

    it('puede vincular usuarios a cualquier sede', async () => {
      await expect(
        ctx.usuarioSedes.create(s.masterId, 'MASTER', {
          usuarioId: s.ajenoId,
          sedeId: s.sedeBId,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('vinculación de un admin nuevo', () => {
    it('el dueño vincula a un usuario y este queda habilitado solo en esa sede', async () => {
      await ctx.usuarioSedes.create(s.duenoId, 'CLIENTE', {
        usuarioId: s.ajenoId,
        sedeId: s.sedeBId,
      });

      await expect(
        venderEn(s.ajenoId, 'CLIENTE', s.sedeBId, s.arrozId),
      ).resolves.toBeDefined();
      await expect(
        venderEn(s.ajenoId, 'CLIENTE', s.sedeAId, s.gaseosaId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
