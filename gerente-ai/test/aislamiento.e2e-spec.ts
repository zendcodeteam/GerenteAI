import { ForbiddenException } from '@nestjs/common';
import {
  cerrarContexto,
  crearContexto,
  limpiar,
  sembrar,
  type Contexto,
  type Semilla,
} from './helpers/contexto';

/**
 * Aislamiento entre negocios en los listados.
 *
 * Los GET no pedían usuario: `findAll()` sin filtro devolvía la tabla completa,
 * así que cualquiera podía leer las ventas, los clientes y los márgenes de todos
 * los negocios del sistema. Estas pruebas fijan que un listado solo alcance las
 * sedes del que pregunta.
 *
 * La semilla trae un negocio con dos sedes; aquí se agrega un segundo negocio,
 * ajeno, porque el caso que importa es justamente el cruce entre negocios.
 */
describe('Aislamiento de datos entre negocios (contra Postgres real)', () => {
  let ctx: Contexto;
  let s: Semilla;

  // Segundo negocio, sin relación alguna con el de la semilla.
  let negocioAjenoId: string;
  let sedeAjenaId: string;
  let productoAjenoId: string;
  let clienteAjenoId: string;

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

    const negocio = await ctx.prisma.negocio.create({
      data: { nombre: 'Tienda de la competencia' },
    });
    const sede = await ctx.prisma.sede.create({
      data: { nombre: 'Sede Rival', negocioId: negocio.id },
    });
    await ctx.prisma.usuarioNegocio.create({
      data: { usuarioId: s.ajenoId, negocioId: negocio.id },
    });
    const producto = await ctx.prisma.producto.create({
      data: {
        nombre: 'Secreto comercial',
        categoria: 'General',
        stock: 3,
        precioCompra: 100,
        precioVenta: 999,
        sedeId: sede.id,
      },
    });
    const cliente = await ctx.prisma.cliente.create({
      data: { nombre: 'Cliente rival', sedeId: sede.id },
    });

    negocioAjenoId = negocio.id;
    sedeAjenaId = sede.id;
    productoAjenoId = producto.id;
    clienteAjenoId = cliente.id;
  });

  describe('listados sin filtro', () => {
    // El caso que originó todo: sin sedeId, findAll devolvía la tabla entera.
    it('el dueño solo ve los productos de su negocio', async () => {
      const productos = await ctx.productos.findAll(s.duenoId, 'CLIENTE');
      const ids = productos.map((producto) => producto.id);

      expect(ids).toEqual(
        expect.arrayContaining([s.gaseosaId, s.panId, s.arrozId]),
      );
      expect(ids).not.toContain(productoAjenoId);
    });

    it('el dueño del otro negocio solo ve el suyo', async () => {
      const productos = await ctx.productos.findAll(s.ajenoId, 'CLIENTE');

      expect(productos.map((producto) => producto.id)).toEqual([
        productoAjenoId,
      ]);
    });

    // Un admin de sede no es dueño: su alcance es la sede, no el negocio entero.
    it('el admin de sede solo ve lo de su sede, no lo de la sede hermana', async () => {
      const productos = await ctx.productos.findAll(s.adminSedeAId, 'CLIENTE');
      const ids = productos.map((producto) => producto.id);

      expect(ids).toEqual(expect.arrayContaining([s.gaseosaId, s.panId]));
      expect(ids).not.toContain(s.arrozId);
    });

    /**
     * El caso que un `[]` mal interpretado convertiría en agujero: si "sin sedes"
     * se tratara igual que "sin restricción", este usuario vería todo el sistema.
     */
    it('un usuario sin negocio ni sede no ve absolutamente nada', async () => {
      const huerfano = await ctx.prisma.usuario.create({
        data: {
          nombre: 'Recién registrado',
          email: 'huerfano@test.local',
          password: 'hash',
        },
      });

      await expect(
        ctx.productos.findAll(huerfano.id, 'CLIENTE'),
      ).resolves.toEqual([]);
      await expect(ctx.ventas.findAll(huerfano.id, 'CLIENTE')).resolves.toEqual(
        [],
      );
      await expect(
        ctx.clientes.findAll(huerfano.id, 'CLIENTE'),
      ).resolves.toEqual([]);
      await expect(
        ctx.negocios.findAll(huerfano.id, 'CLIENTE'),
      ).resolves.toEqual([]);
      await expect(ctx.sedes.findAll(huerfano.id, 'CLIENTE')).resolves.toEqual(
        [],
      );
    });

    it('MASTER sí ve todo', async () => {
      const productos = await ctx.productos.findAll(s.masterId, 'MASTER');

      expect(productos.map((producto) => producto.id)).toEqual(
        expect.arrayContaining([s.gaseosaId, s.arrozId, productoAjenoId]),
      );
    });
  });

  describe('listados con sedeId ajeno', () => {
    it('rechaza pedir el inventario de una sede de otro negocio', async () => {
      await expect(
        ctx.productos.findAll(s.duenoId, 'CLIENTE', { sedeId: sedeAjenaId }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza pedir las ventas de una sede de otro negocio', async () => {
      await expect(
        ctx.ventas.findAll(s.duenoId, 'CLIENTE', sedeAjenaId),
      ).rejects.toThrow(ForbiddenException);
    });

    // Dentro del mismo negocio también hay frontera: la sede hermana es ajena.
    it('rechaza que el admin de sede pida el inventario de la sede hermana', async () => {
      await expect(
        ctx.productos.findAll(s.adminSedeAId, 'CLIENTE', { sedeId: s.sedeBId }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('consulta de un registro concreto', () => {
    it('rechaza leer un producto de otro negocio', async () => {
      await expect(
        ctx.productos.findOne(productoAjenoId, s.duenoId, 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza leer un cliente de otro negocio, con su deuda', async () => {
      await expect(
        ctx.clientes.findOne(clienteAjenoId, s.duenoId, 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza leer una sede de otro negocio', async () => {
      await expect(
        ctx.sedes.findOne(sedeAjenaId, s.duenoId, 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza leer un negocio ajeno', async () => {
      await expect(
        ctx.negocios.findOne(negocioAjenoId, s.duenoId, 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deja leer lo propio', async () => {
      await expect(
        ctx.productos.findOne(s.gaseosaId, s.duenoId, 'CLIENTE'),
      ).resolves.toMatchObject({ id: s.gaseosaId });
      await expect(
        ctx.negocios.findOne(s.negocioId, s.duenoId, 'CLIENTE'),
      ).resolves.toMatchObject({ id: s.negocioId });
    });
  });

  /**
   * Leer nunca depende del plan. Un negocio con el plan vencido conserva el
   * histórico de todas sus sedes; lo que pierde es la escritura en las que
   * exceden el tope. Si la lectura exigiera `escritura: true`, vencer el plan
   * borraría la contabilidad de la vista, que es justo lo contrario.
   */
  describe('lectura y plan vencido', () => {
    beforeEach(async () => {
      await ctx.prisma.negocio.update({
        where: { id: s.negocioId },
        data: { plan: 1, planVenceEl: new Date(Date.now() - 86_400_000) },
      });
    });

    it('sigue listando el inventario de la sede que quedó en solo lectura', async () => {
      const productos = await ctx.productos.findAll(s.duenoId, 'CLIENTE', {
        sedeId: s.sedeBId,
      });

      expect(productos.map((producto) => producto.id)).toEqual([s.arrozId]);
    });

    it('pero no deja escribir en ella', async () => {
      await expect(
        ctx.productos.update(s.arrozId, s.duenoId, 'CLIENTE', { stock: 99 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
