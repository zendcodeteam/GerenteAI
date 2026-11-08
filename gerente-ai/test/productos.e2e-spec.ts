import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { firmaDe } from '../src/auth/jwt-claims';
import { PrismaService } from '../src/services/prisma.service';
import { limpiar, sembrar, type Semilla } from './helpers/contexto';

/**
 * El registro de productos tal como lo usa el panel: por HTTP.
 *
 * Las pruebas unitarias del servicio y del DTO ya cubren las reglas una por
 * una. Lo que no pueden cubrir es la tuberia: que la ruta exija sesion, que el
 * ValidationPipe global corte lo invalido ANTES de llegar al servicio, que el
 * aislamiento por sede aguante cuando el `sedeId` lo elige quien llama, y que
 * los codigos HTTP sean los que el frontend espera.
 *
 * El `ValidationPipe` se monta igual que en `main.ts` a proposito: sin el, una
 * peticion con campos inventados llegaria al servicio y estas pruebas darian
 * un falso verde sobre el comportamiento real del servidor.
 */
describe('Registro de productos por HTTP (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let s: Semilla;

  /** Sesiones de los tres personajes de la semilla. */
  let dueno: string;
  let adminSedeA: string;
  let ajeno: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await limpiar(prisma);
    s = await sembrar(prisma);
    dueno = sesion(s.duenoId);
    adminSedeA = sesion(s.adminSedeAId);
    ajeno = sesion(s.ajenoId);
  });

  function sesion(usuarioId: string) {
    return jwt.sign(
      {
        sub: usuarioId,
        type: 'session',
        negocioId: null,
        role: null,
        rolGlobal: 'CLIENTE',
      },
      firmaDe('session'),
    );
  }

  const crear = (token: string, cuerpo: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/productos')
      .set('Authorization', `Bearer ${token}`)
      .send(cuerpo);

  /** El `message` que Nest pone en el cuerpo de una respuesta de error. */
  const mensajeDe = (res: { body: unknown }) =>
    (res.body as { message?: string }).message ?? '';

  const productoCompleto = (extra: Record<string, unknown> = {}) => ({
    nombre: 'Panela cuadrada',
    categoria: 'Abarrotes',
    precioCompra: 2500,
    precioVenta: 3500,
    stock: 12,
    sedeId: s.sedeAId,
    ...extra,
  });

  describe('la ruta esta cerrada sin sesion', () => {
    it('crear sin token no llega al servicio', async () => {
      const res = await request(app.getHttpServer())
        .post('/productos')
        .send(productoCompleto());

      expect(res.status).toBe(401);
      expect(
        await prisma.producto.count({ where: { nombre: 'Panela cuadrada' } }),
      ).toBe(0);
    });

    it('listar sin token tampoco', async () => {
      const res = await request(app.getHttpServer()).get('/productos');

      expect(res.status).toBe(401);
    });
  });

  describe('registro completo', () => {
    it('guarda el producto y lo devuelve con su id', async () => {
      const res = await crear(dueno, productoCompleto());

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        nombre: 'Panela cuadrada',
        categoria: 'Abarrotes',
        stock: 12,
        sedeId: s.sedeAId,
      });

      const guardado = await prisma.producto.findUnique({
        where: { id: (res.body as { id: string }).id },
      });
      expect(guardado).not.toBeNull();
      expect(Number(guardado!.precioCompra)).toBe(2500);
      expect(Number(guardado!.precioVenta)).toBe(3500);
    });

    it('sin cantidad, el producto nace en 0 y no en null', async () => {
      const { stock, ...sinStock } = productoCompleto();
      void stock;

      const res = await crear(dueno, sinStock);

      expect(res.status).toBe(201);
      expect((res.body as { stock: number }).stock).toBe(0);
    });

    it('acepta los alias cantidad y costoCompra que documenta el contrato', async () => {
      const res = await crear(dueno, {
        nombre: 'Aceite Girasol',
        categoria: 'Abarrotes',
        costoCompra: 8000,
        precioVenta: 11000,
        cantidad: 4,
        sedeId: s.sedeAId,
      });

      expect(res.status).toBe(201);
      expect((res.body as { stock: number }).stock).toBe(4);
    });

    it('queda visible al consultarlo despues', async () => {
      const creado = await crear(dueno, productoCompleto());
      const id = (creado.body as { id: string }).id;

      const res = await request(app.getHttpServer())
        .get(`/productos/${id}`)
        .set('Authorization', `Bearer ${dueno}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, nombre: 'Panela cuadrada' });
    });
  });

  describe('campos faltantes', () => {
    const sinElCampo = (campo: string) => {
      const cuerpo = productoCompleto() as Record<string, unknown>;
      delete cuerpo[campo];
      return cuerpo;
    };

    it.each(['nombre', 'categoria', 'precioCompra', 'precioVenta'])(
      'sin %s responde 400 y no guarda nada',
      async (campo) => {
        const res = await crear(dueno, sinElCampo(campo));

        expect(res.status).toBe(400);
        expect(
          await prisma.producto.count({ where: { nombre: 'Panela cuadrada' } }),
        ).toBe(0);
      },
    );

    // El sedeId no lo exige el DTO (es opcional en el cuerpo), lo exige el
    // servicio. Sin esta prueba, quitar esa comprobacion no rompia nada por
    // HTTP: el producto caia mas adelante con un error distinto.
    it('sin sedeId responde 400 y no guarda nada', async () => {
      const res = await crear(dueno, sinElCampo('sedeId'));

      expect(res.status).toBe(400);
      expect(
        await prisma.producto.count({ where: { nombre: 'Panela cuadrada' } }),
      ).toBe(0);
    });

    it('el error dice que campo falta, no un mensaje generico', async () => {
      const res = await crear(dueno, sinElCampo('categoria'));

      expect(JSON.stringify(res.body)).toMatch(/categor/i);
    });

    // El nombre en blanco es el caso que se cuela si solo se comprueba que el
    // campo venga: viene, pero no dice nada.
    it('un nombre de solo espacios cuenta como faltante', async () => {
      const res = await crear(dueno, productoCompleto({ nombre: '   ' }));

      expect(res.status).toBe(400);
    });

    it('una categoria de solo espacios tambien', async () => {
      const res = await crear(dueno, productoCompleto({ categoria: '   ' }));

      expect(res.status).toBe(400);
    });
  });

  describe('valores invalidos', () => {
    const rechaza = async (extra: Record<string, unknown>) => {
      const res = await crear(dueno, productoCompleto(extra));

      expect(res.status).toBe(400);
      expect(
        await prisma.producto.count({ where: { nombre: 'Panela cuadrada' } }),
      ).toBe(0);
    };

    it('cantidad negativa', () => rechaza({ stock: -1 }));
    it('cantidad con decimales', () => rechaza({ stock: 2.5 }));
    it('cantidad que no es numero', () => rechaza({ stock: 'tres' }));
    it('costo de compra en 0', () => rechaza({ precioCompra: 0 }));
    it('costo de compra negativo', () => rechaza({ precioCompra: -100 }));
    it('precio de venta en 0', () => rechaza({ precioVenta: 0 }));
    it('precio de venta negativo', () => rechaza({ precioVenta: -100 }));
    it('precio con mas de dos decimales', () =>
      rechaza({ precioVenta: 3500.555 }));
    it('alias costoCompra en 0, igual que precioCompra', () =>
      rechaza({ precioCompra: undefined, costoCompra: 0 }));

    // El servidor corre con forbidNonWhitelisted: un campo que no existe en el
    // contrato no se ignora en silencio, se rechaza. Es lo que evita que el
    // panel crea que guardo algo que el backend nunca recibio.
    it('un campo que no existe en el contrato se rechaza', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ precioMayorista: 3000 }),
      );

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/precioMayorista/);
    });
  });

  describe('aislamiento por sede', () => {
    /**
     * El `sedeId` viaja en el cuerpo, asi que lo elige quien llama. Si la ruta
     * no comprobara el permiso, bastaria cambiar un campo del JSON para sembrar
     * productos en el negocio de otro.
     */
    it('no deja registrar en una sede ajena', async () => {
      const res = await crear(ajeno, productoCompleto());

      expect([403, 404]).toContain(res.status);
      expect(
        await prisma.producto.count({ where: { nombre: 'Panela cuadrada' } }),
      ).toBe(0);
    });

    it('un admin de la sede A no registra en la sede B', async () => {
      const res = await crear(
        adminSedeA,
        productoCompleto({ sedeId: s.sedeBId }),
      );

      expect([403, 404]).toContain(res.status);
    });

    it('una sede que no existe es 404', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ sedeId: '00000000-0000-0000-0000-000000000000' }),
      );

      expect(res.status).toBe(404);
    });

    it('el listado solo trae los productos que el usuario puede ver', async () => {
      const res = await request(app.getHttpServer())
        .get('/productos')
        .set('Authorization', `Bearer ${adminSedeA}`);

      expect(res.status).toBe(200);
      const sedes = (res.body as { sedeId: string }[]).map((p) => p.sedeId);
      expect(sedes).not.toContain(s.sedeBId);
      expect(sedes).toContain(s.sedeAId);
    });

    it('consultar un producto de otra sede no lo devuelve', async () => {
      const res = await request(app.getHttpServer())
        .get(`/productos/${s.arrozId}`)
        .set('Authorization', `Bearer ${adminSedeA}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('consulta del catalogo', () => {
    it('filtra por categoria sin importar mayusculas', async () => {
      const res = await request(app.getHttpServer())
        .get('/productos?categoria=bebidas')
        .set('Authorization', `Bearer ${dueno}`);

      expect(res.status).toBe(200);
      const nombres = (res.body as { nombre: string }[]).map((p) => p.nombre);
      expect(nombres).toContain('Gaseosa');
      expect(nombres).not.toContain('Pan');
    });

    it('busca por nombre', async () => {
      const res = await request(app.getHttpServer())
        .get('/productos?search=gaseo')
        .set('Authorization', `Bearer ${dueno}`);

      expect(res.status).toBe(200);
      expect((res.body as { nombre: string }[]).map((p) => p.nombre)).toEqual([
        'Gaseosa',
      ]);
    });

    it('filtra por sede', async () => {
      const res = await request(app.getHttpServer())
        .get(`/productos?sedeId=${s.sedeBId}`)
        .set('Authorization', `Bearer ${dueno}`);

      expect(res.status).toBe(200);
      const sedes = (res.body as { sedeId: string }[]).map((p) => p.sedeId);
      expect(new Set(sedes)).toEqual(new Set([s.sedeBId]));
    });

    it('un producto que no existe es 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/productos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${dueno}`);

      expect(res.status).toBe(404);
    });
  });

  describe('editar', () => {
    const editar = (
      token: string,
      id: string,
      cuerpo: Record<string, unknown>,
    ) =>
      request(app.getHttpServer())
        .patch(`/productos/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo);

    it('guarda el cambio enviado y deja el resto como estaba', async () => {
      const res = await editar(dueno, s.gaseosaId, { precioVenta: 1800 });

      expect(res.status).toBe(200);
      const guardado = await prisma.producto.findUniqueOrThrow({
        where: { id: s.gaseosaId },
      });
      expect(Number(guardado.precioVenta)).toBe(1800);
      expect(guardado.nombre).toBe('Gaseosa');
    });

    it('no deja dejar el producto invalido por la puerta de atras', async () => {
      const res = await editar(dueno, s.gaseosaId, { precioVenta: 0 });

      expect(res.status).toBe(400);
      const guardado = await prisma.producto.findUniqueOrThrow({
        where: { id: s.gaseosaId },
      });
      expect(Number(guardado.precioVenta)).toBe(1500.5);
    });

    it('un usuario de otra sede no puede editar', async () => {
      const res = await editar(adminSedeA, s.arrozId, { precioVenta: 1 });

      expect([403, 404]).toContain(res.status);
      const guardado = await prisma.producto.findUniqueOrThrow({
        where: { id: s.arrozId },
      });
      expect(Number(guardado.precioVenta)).toBe(3000);
    });
  });

  describe('borrar', () => {
    const borrar = (token: string, id: string) =>
      request(app.getHttpServer())
        .delete(`/productos/${id}`)
        .set('Authorization', `Bearer ${token}`);

    it('borra el producto', async () => {
      const res = await borrar(dueno, s.panId);

      expect(res.status).toBe(200);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).toBeNull();
    });

    it('y solo ese: el resto del catalogo sigue ahi', async () => {
      await borrar(dueno, s.panId);

      expect(
        await prisma.producto.findUnique({ where: { id: s.gaseosaId } }),
      ).not.toBeNull();
      expect(
        await prisma.producto.findUnique({ where: { id: s.arrozId } }),
      ).not.toBeNull();
    });

    // Es lo mas destructivo del modulo: borrar inventario ajeno no puede
    // depender de que el frontend esconda el boton.
    it('un usuario de otra sede no puede borrar', async () => {
      const res = await borrar(adminSedeA, s.arrozId);

      expect([403, 404]).toContain(res.status);
      expect(
        await prisma.producto.findUnique({ where: { id: s.arrozId } }),
      ).not.toBeNull();
    });

    it('sin sesion tampoco', async () => {
      const res = await request(app.getHttpServer()).delete(
        `/productos/${s.panId}`,
      );

      expect(res.status).toBe(401);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).not.toBeNull();
    });

    it('un producto que no existe es 404', async () => {
      const res = await borrar(dueno, '00000000-0000-0000-0000-000000000000');

      expect(res.status).toBe(404);
    });
  });

  /**
   * El agujero que de verdad se veia desde el panel: borrar un producto que ya
   * se vendio devolvia un 500 pelado. Aqui se comprueba contra Postgres de
   * verdad, porque el que frena el borrado es el propio motor (las relaciones
   * de DetalleVenta y DetalleCompra no declaran onDelete, asi que Prisma
   * aplica Restrict) y con un mock no se veria.
   */
  describe('borrar un producto que ya tiene historial', () => {
    const borrar = (token: string, id: string) =>
      request(app.getHttpServer())
        .delete(`/productos/${id}`)
        .set('Authorization', `Bearer ${token}`);

    /** Una venta de 2 panes, como la que deja cualquier dia de trabajo. */
    async function venderPan() {
      const venta = await prisma.venta.create({
        data: { total: 1000, sedeId: s.sedeAId, descripcion: 'Venta de panes' },
      });
      await prisma.detalleVenta.create({
        data: {
          ventaId: venta.id,
          productoId: s.panId,
          cantidad: 2,
          precio: 500,
        },
      });
      return venta.id;
    }

    /** Una compra al proveedor, el otro camino que ata un producto. */
    async function comprarPan() {
      const compra = await prisma.compra.create({
        data: { total: 2000, sedeId: s.sedeAId, proveedorId: s.proveedorAId },
      });
      await prisma.detalleCompra.create({
        data: {
          compraId: compra.id,
          productoId: s.panId,
          cantidad: 10,
          costo: 200,
        },
      });
    }

    it('no revienta con un 500: responde 409', async () => {
      await venderPan();

      const res = await borrar(dueno, s.panId);

      expect(res.status).toBe(409);
    });

    it('el producto sigue en el catalogo', async () => {
      await venderPan();

      await borrar(dueno, s.panId);

      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).not.toBeNull();
    });

    // La razon de ser de la restriccion: si el borrado pasara, la venta
    // quedaria apuntando a un producto que no existe y los reportes del mes
    // dejarian de cuadrar.
    it('y la venta que lo referencia queda intacta', async () => {
      await venderPan();

      await borrar(dueno, s.panId);

      expect(
        await prisma.detalleVenta.count({ where: { productoId: s.panId } }),
      ).toBe(1);
    });

    it('el mensaje le dice al tendero que paso y que hacer', async () => {
      await venderPan();

      const res = await borrar(dueno, s.panId);

      expect(mensajeDe(res)).toContain('Pan');
      expect(mensajeDe(res)).toContain('1 venta');
      expect(mensajeDe(res)).toContain('pon su cantidad en 0');
    });

    it('un producto solo comprado tampoco se borra', async () => {
      await comprarPan();

      const res = await borrar(dueno, s.panId);

      expect(res.status).toBe(409);
      expect(mensajeDe(res)).toContain('1 compra');
    });

    it('con ventas y compras las cuenta todas', async () => {
      await venderPan();
      await comprarPan();

      const res = await borrar(dueno, s.panId);

      expect(mensajeDe(res)).toContain('1 venta y 1 compra');
    });

    // El arreglo no puede haber convertido el borrado en algo que nunca
    // funciona: un producto que nadie movio se sigue borrando.
    it('un producto sin movimientos se borra igual que antes', async () => {
      const res = await borrar(dueno, s.panId);

      expect(res.status).toBe(200);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).toBeNull();
    });

    // El permiso se comprueba ANTES del historial: a quien no es de la sede no
    // se le cuenta cuantas ventas tiene un producto que no es suyo.
    it('a un usuario de otra sede le responde por el permiso, no por el historial', async () => {
      await venderPan();

      const res = await borrar(ajeno, s.panId);

      expect([403, 404]).toContain(res.status);
    });
  });

  /**
   * Dos productos con el mismo nombre en una sede dejan al bot sin salida: al
   * decir "vendi 2 arroz" encuentra dos candidatos, pide el nombre exacto, y
   * el nombre exacto es el mismo para los dos.
   *
   * El flujo de WhatsApp (SCRUM-28) ya lo impedia. El panel no, y por ahi se
   * podia dejar un producto inservible por WhatsApp sin enterarse.
   */
  describe('el catalogo no admite dos productos con el mismo nombre en una sede', () => {
    const editar = (
      token: string,
      id: string,
      cuerpo: Record<string, unknown>,
    ) =>
      request(app.getHttpServer())
        .patch(`/productos/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo);

    it('registrar un nombre que ya existe en la sede es 409', async () => {
      const res = await crear(dueno, productoCompleto({ nombre: 'Gaseosa' }));

      expect(res.status).toBe(409);
    });

    it('y no deja un segundo producto en la base', async () => {
      await crear(dueno, productoCompleto({ nombre: 'Gaseosa' }));

      expect(
        await prisma.producto.count({
          where: { sedeId: s.sedeAId, nombre: 'Gaseosa' },
        }),
      ).toBe(1);
    });

    // Quien teclea "gaseosa" en minuscula esta hablando del mismo producto.
    it.each(['gaseosa', 'GASEOSA', 'GaSeOsA'])(
      'tampoco cambiando las mayusculas: %s',
      async (nombre) => {
        const res = await crear(dueno, productoCompleto({ nombre }));

        expect(res.status).toBe(409);
      },
    );

    it('ni con espacios de sobra alrededor', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ nombre: '  Gaseosa  ' }),
      );

      expect(res.status).toBe(409);
    });

    // El limite es la sede, no el negocio: dos locales del mismo dueno venden
    // gaseosa cada uno, y son productos distintos con su propio stock.
    it('el mismo nombre en OTRA sede si se registra', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ nombre: 'Gaseosa', sedeId: s.sedeBId }),
      );

      expect(res.status).toBe(201);
      expect(
        await prisma.producto.count({ where: { nombre: 'Gaseosa' } }),
      ).toBe(2);
    });

    it('el mensaje nombra el producto que ya estaba', async () => {
      const res = await crear(dueno, productoCompleto({ nombre: 'gaseosa' }));

      expect(mensajeDe(res)).toBe(
        'Ya tienes un producto llamado "Gaseosa" en esta sede',
      );
    });

    it('renombrar un producto encima de otro es 409', async () => {
      const res = await editar(dueno, s.panId, { nombre: 'Gaseosa' });

      expect(res.status).toBe(409);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).toMatchObject({ nombre: 'Pan' });
    });

    // Guardar el formulario del panel reenvia el nombre aunque no se haya
    // tocado. Si eso diera 409 no se podria editar el precio de nada.
    it('guardar sin cambiar el nombre no choca consigo mismo', async () => {
      const res = await editar(dueno, s.panId, {
        nombre: 'Pan',
        precioVenta: 600,
      });

      expect(res.status).toBe(200);
      expect(Number((res.body as { precioVenta: string }).precioVenta)).toBe(
        600,
      );
    });

    it('y renombrar a un nombre libre sigue funcionando', async () => {
      const res = await editar(dueno, s.panId, { nombre: 'Pan tajado' });

      expect(res.status).toBe(200);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).toMatchObject({ nombre: 'Pan tajado' });
    });
  });

  /**
   * Vender por debajo del costo: permitido, pero nunca por accidente.
   *
   * La regla vivia SOLO en el navegador —un window.confirm en InventoryPanel—,
   * asi que cualquiera que llamara al API directo registraba la perdida en
   * silencio. Estas pruebas van por HTTP justamente porque ahi era donde el
   * agujero se veia.
   */
  describe('registrar a perdida exige un visto bueno explicito', () => {
    const editar = (
      token: string,
      id: string,
      cuerpo: Record<string, unknown>,
    ) =>
      request(app.getHttpServer())
        .patch(`/productos/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo);

    it('un producto a perdida sin visto bueno es 400', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ precioCompra: 3500, precioVenta: 3000 }),
      );

      expect(res.status).toBe(400);
      expect(
        await prisma.producto.count({ where: { nombre: 'Panela cuadrada' } }),
      ).toBe(0);
    });

    it('el mensaje dice los dos precios', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ precioCompra: 3500, precioVenta: 3000 }),
      );

      expect(mensajeDe(res)).toContain('3.000');
      expect(mensajeDe(res)).toContain('3.500');
    });

    it('con el visto bueno se registra', async () => {
      const res = await crear(
        dueno,
        productoCompleto({
          precioCompra: 3500,
          precioVenta: 3000,
          aceptoVenderConPerdida: true,
        }),
      );

      expect(res.status).toBe(201);
      expect(
        await prisma.producto.findFirst({
          where: { nombre: 'Panela cuadrada' },
        }),
      ).not.toBeNull();
    });

    it('vender justo al costo no necesita nada', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ precioCompra: 3500, precioVenta: 3500 }),
      );

      expect(res.status).toBe(201);
    });

    // El campo es de entrada, no una columna: si se colara en el INSERT,
    // Prisma reventaria.
    it('el visto bueno no acaba guardado en el producto', async () => {
      const res = await crear(
        dueno,
        productoCompleto({
          precioCompra: 3500,
          precioVenta: 3000,
          aceptoVenderConPerdida: true,
        }),
      );

      expect(res.body).not.toHaveProperty('aceptoVenderConPerdida');
    });

    it('un valor que no es booleano lo corta el ValidationPipe', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ aceptoVenderConPerdida: 'claro que si' }),
      );

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/aceptoVenderConPerdida/);
    });

    // El pan cuesta 200 y se vende en 500. Al cuerpo solo llega el precio de
    // venta: el costo con el que se compara sale de la base.
    it('bajar el precio de venta por debajo del costo guardado es 400', async () => {
      const res = await editar(dueno, s.panId, { precioVenta: 150 });

      expect(res.status).toBe(400);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).toMatchObject({ nombre: 'Pan' });
      expect(
        Number(
          (
            await prisma.producto.findUniqueOrThrow({
              where: { id: s.panId },
            })
          ).precioVenta,
        ),
      ).toBe(500);
    });

    it('subir el costo por encima del precio de venta guardado tambien', async () => {
      const res = await editar(dueno, s.panId, { precioCompra: 900 });

      expect(res.status).toBe(400);
    });

    it('con el visto bueno la edicion pasa', async () => {
      const res = await editar(dueno, s.panId, {
        precioVenta: 150,
        aceptoVenderConPerdida: true,
      });

      expect(res.status).toBe(200);
    });

    /*
     * Un producto que ya se vendia a perdida no puede quedar congelado: si la
     * comprobacion corriera en toda edicion, no se le podria ni corregir el
     * stock, y eso seria un arreglo peor que el problema.
     */
    it('a un producto que ya esta a perdida se le puede editar el stock', async () => {
      await editar(dueno, s.panId, {
        precioVenta: 150,
        aceptoVenderConPerdida: true,
      });

      const res = await editar(dueno, s.panId, { stock: 40 });

      expect(res.status).toBe(200);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).toMatchObject({ stock: 40 });
    });
  });

  /**
   * El filtro de reposicion compara dos columnas de la misma fila
   * (stock <= stockMinimo). Eso lo resuelve Prisma con `fields`, y la prueba
   * unitaria solo puede comprobar que se apunta a la columna correcta con un
   * centinela. Que el SQL de verdad funcione solo se ve contra Postgres.
   */
  describe('el catalogo sabe decir que hay que reponer', () => {
    const listar = (token: string, query = '') =>
      request(app.getHttpServer())
        .get(`/productos${query}`)
        .set('Authorization', `Bearer ${token}`);

    const nombresDe = (res: { body: unknown }) =>
      (res.body as { nombre: string }[]).map((p) => p.nombre).sort();

    beforeEach(async () => {
      // Gaseosa: 10 en estante, minimo 12 -> hay que reponer.
      // Pan: 5 en estante, minimo 5 -> justo en el limite, tambien.
      // Arroz (sede B): 10 en estante, minimo 2 -> sobra.
      await prisma.producto.update({
        where: { id: s.gaseosaId },
        data: { stockMinimo: 12 },
      });
      await prisma.producto.update({
        where: { id: s.panId },
        data: { stockMinimo: 5 },
      });
      await prisma.producto.update({
        where: { id: s.arrozId },
        data: { stockMinimo: 2 },
      });
    });

    it('devuelve solo lo que esta en o por debajo del minimo', async () => {
      const res = await listar(dueno, '?stockBajo=true');

      expect(res.status).toBe(200);
      expect(nombresDe(res)).toEqual(['Gaseosa', 'Pan']);
    });

    // Justo en el minimo ya es reponer: el minimo es el punto de pedido, no el
    // punto de quedarse sin nada.
    it('el que esta justo en el minimo entra', async () => {
      const res = await listar(dueno, '?stockBajo=true');

      expect(nombresDe(res)).toContain('Pan');
    });

    it('?stockBajo=1 vale igual', async () => {
      const res = await listar(dueno, '?stockBajo=1');

      expect(nombresDe(res)).toEqual(['Gaseosa', 'Pan']);
    });

    it('sin el parametro siguen saliendo todos', async () => {
      const res = await listar(dueno);

      expect(nombresDe(res)).toEqual(['Arroz', 'Gaseosa', 'Pan']);
    });

    it('un valor cualquiera no activa el filtro', async () => {
      const res = await listar(dueno, '?stockBajo=quiza');

      expect(nombresDe(res)).toEqual(['Arroz', 'Gaseosa', 'Pan']);
    });

    // No puede saltarse el aislamiento: que le falta en el estante a otro
    // negocio no es asunto de nadie.
    it('sigue limitado a las sedes que uno ve', async () => {
      await prisma.producto.update({
        where: { id: s.arrozId },
        data: { stockMinimo: 99 },
      });

      const res = await listar(adminSedeA, '?stockBajo=true');

      expect(nombresDe(res)).not.toContain('Arroz');
    });

    it('se puede combinar con la categoria', async () => {
      const res = await listar(dueno, '?stockBajo=true&categoria=Bebidas');

      expect(nombresDe(res)).toEqual(['Gaseosa']);
    });

    it('si no hay nada que reponer, la lista viene vacia', async () => {
      await prisma.producto.updateMany({ data: { stockMinimo: 0 } });

      const res = await listar(dueno, '?stockBajo=true');

      expect(res.body).toEqual([]);
    });
  });

  /**
   * "Abarrotes", "abarrotes" y "Abarrotes " eran tres categorias distintas, y
   * el filtro por categoria las separaba. Sin tabla de catalogo no se puede
   * validar contra una lista cerrada, pero si evitar que se multipliquen.
   */
  describe('la categoria no se multiplica por una mayuscula', () => {
    it('se guarda con la escritura que ya usa la sede', async () => {
      // La semilla ya tiene "Bebidas" en la sede A, con mayuscula.
      const res = await crear(
        dueno,
        productoCompleto({ nombre: 'Jugo Hit', categoria: 'bebidas' }),
      );

      expect(res.status).toBe(201);
      expect(
        await prisma.producto.findFirst({ where: { nombre: 'Jugo Hit' } }),
      ).toMatchObject({ categoria: 'Bebidas' });
    });

    it('y entonces el filtro por categoria los devuelve juntos', async () => {
      await crear(
        dueno,
        productoCompleto({ nombre: 'Jugo Hit', categoria: 'BEBIDAS' }),
      );

      const res = await request(app.getHttpServer())
        .get('/productos?categoria=Bebidas')
        .set('Authorization', `Bearer ${dueno}`);

      expect(
        (res.body as { nombre: string }[]).map((p) => p.nombre).sort(),
      ).toEqual(['Gaseosa', 'Jugo Hit']);
    });

    // El limite es la sede: dos locales pueden organizar su catalogo distinto.
    it('la escritura de otra sede no manda', async () => {
      const res = await crear(
        dueno,
        productoCompleto({
          nombre: 'Jugo Hit',
          categoria: 'abarrotes',
          sedeId: s.sedeAId,
        }),
      );

      expect(res.status).toBe(201);
      // "Abarrotes" existe, pero en la sede B. En la A es nueva.
      expect(
        await prisma.producto.findFirst({ where: { nombre: 'Jugo Hit' } }),
      ).toMatchObject({ categoria: 'abarrotes' });
    });

    it('los espacios de sobra se recortan en el nombre y la categoria', async () => {
      const res = await crear(
        dueno,
        productoCompleto({
          nombre: 'Jugo   Hit   500ml',
          categoria: 'Jugos   naturales',
        }),
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        nombre: 'Jugo Hit 500ml',
        categoria: 'Jugos naturales',
      });
    });

    // Lo que de verdad arregla normalizar los espacios: sin esto,
    // "Jugo Hit" y "Jugo   Hit" entraban como dos productos distintos y el
    // bot se quedaba sin saber a cual descontarle el stock.
    it('y por eso "Jugo   Hit" ya no se cuela junto a "Jugo Hit"', async () => {
      const primero = await crear(
        dueno,
        productoCompleto({ nombre: 'Jugo Hit' }),
      );
      expect(primero.status).toBe(201);

      const segundo = await crear(
        dueno,
        productoCompleto({ nombre: 'Jugo   Hit' }),
      );

      expect(segundo.status).toBe(409);
      expect(
        await prisma.producto.count({ where: { nombre: 'Jugo Hit' } }),
      ).toBe(1);
    });
  });

  /**
   * El bot resuelve un producto por su nombre Y por sus alias, comparando sin
   * acentos ni mayusculas. Dos productos que el bot ve iguales lo dejan sin
   * salida: encuentra dos candidatos, pide el nombre exacto, y el nombre
   * exacto es el mismo para los dos.
   *
   * Estas van contra Postgres a proposito: el caso de los acentos es justo el
   * que se colaba antes, porque `mode: 'insensitive'` NO quita acentos y el
   * motor veia "Arroz" y "Arróz" como nombres distintos.
   */
  describe('el catalogo no admite nombres ni alias que el bot confunda', () => {
    const editar = (
      token: string,
      id: string,
      cuerpo: Record<string, unknown>,
    ) =>
      request(app.getHttpServer())
        .patch(`/productos/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo);

    it('no entra un nombre que solo difiere en los acentos', async () => {
      const res = await crear(dueno, productoCompleto({ nombre: 'Gaseósa' }));

      expect(res.status).toBe(409);
      expect(
        await prisma.producto.count({ where: { sedeId: s.sedeAId } }),
      ).toBe(2);
    });

    it('ni uno cuyo nombre es el alias de otro producto', async () => {
      await prisma.producto.update({
        where: { id: s.gaseosaId },
        data: { alias: ['gaseosita'] },
      });

      const res = await crear(dueno, productoCompleto({ nombre: 'Gaseosita' }));

      expect(res.status).toBe(409);
      expect(mensajeDe(res)).toContain('ya es un alias del producto "Gaseosa"');
    });

    it('ni un alias que es el nombre de otro producto', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ nombre: 'Jugo Hit', alias: ['Gaseosa'] }),
      );

      expect(res.status).toBe(409);
      expect(mensajeDe(res)).toContain(
        'es el nombre del producto "Gaseosa" en esta sede',
      );
    });

    it('ni un alias que ya usa otro producto', async () => {
      await prisma.producto.update({
        where: { id: s.gaseosaId },
        data: { alias: ['gaseosita'] },
      });

      const res = await crear(
        dueno,
        productoCompleto({ nombre: 'Jugo Hit', alias: ['Gaseosíta'] }),
      );

      expect(res.status).toBe(409);
      expect(mensajeDe(res)).toContain('ya lo usa el producto "Gaseosa"');
    });

    it('con nombre y alias libres, entra', async () => {
      const res = await crear(
        dueno,
        productoCompleto({ nombre: 'Jugo Hit', alias: ['jugo', 'hit 500'] }),
      );

      expect(res.status).toBe(201);
      expect(
        await prisma.producto.findFirst({ where: { nombre: 'Jugo Hit' } }),
      ).toMatchObject({ alias: ['jugo', 'hit 500'] });
    });

    it('los alias se guardan limpios: sin vacios, repetidos ni el propio nombre', async () => {
      const res = await crear(
        dueno,
        productoCompleto({
          nombre: 'Jugo Hit',
          alias: ['  jugo  ', 'Jugo', 'jugo hit', '', '   ', 'hit'],
        }),
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ alias: ['jugo', 'hit'] });
    });

    // El limite es la sede: dos locales llevan su catalogo por separado.
    it('el mismo alias en otra sede si se puede', async () => {
      await prisma.producto.update({
        where: { id: s.gaseosaId },
        data: { alias: ['gaseosita'] },
      });

      const res = await crear(
        dueno,
        productoCompleto({
          nombre: 'Jugo Hit',
          alias: ['gaseosita'],
          sedeId: s.sedeBId,
        }),
      );

      expect(res.status).toBe(201);
    });

    it('cambiar solo los alias tambien se comprueba', async () => {
      const res = await editar(dueno, s.panId, { alias: ['gaseosa'] });

      expect(res.status).toBe(409);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).toMatchObject({ alias: [] });
    });

    it('y poner alias libres funciona', async () => {
      const res = await editar(dueno, s.panId, {
        alias: ['panecito', 'pan de sal'],
      });

      expect(res.status).toBe(200);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).toMatchObject({ alias: ['panecito', 'pan de sal'] });
    });

    /*
     * Despues de todo esto, el bot tiene que poder resolver el producto: la
     * razon de ser de la regla. Si hubiera dos candidatos, "vendi 2 gaseosas"
     * acabaria en "indica el nombre exacto" sin salida posible.
     */
    it('el resultado es que en la sede no hay dos formas de llamar al mismo producto', async () => {
      await crear(
        dueno,
        productoCompleto({ nombre: 'Jugo Hit', alias: ['jugo', 'hit'] }),
      );

      const productos = await prisma.producto.findMany({
        where: { sedeId: s.sedeAId },
        select: { nombre: true, alias: true },
      });
      const llaves = productos.flatMap((p) =>
        [p.nombre, ...p.alias].map((v) =>
          v
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' '),
        ),
      );

      expect(new Set(llaves).size).toBe(llaves.length);
    });
  });

  /**
   * El inventario es de planes pagos, y la comprobacion vive en el BACKEND.
   *
   * Si viviera solo en el frontend, cualquiera con la URL del API seguiria
   * registrando productos en un negocio gratuito: es justo como se colaron los
   * que ya estan en produccion.
   */
  describe('el inventario solo esta disponible en los planes pagos', () => {
    /** Baja el negocio de la semilla al plan Asistente (gratuito). */
    async function conPlanGratuito() {
      await prisma.negocio.update({
        where: { id: s.negocioId },
        data: { plan: 1, planVenceEl: null },
      });
    }

    /** Un plan de pago que caduco: cae a Asistente por si solo. */
    async function conPlanVencido() {
      await prisma.negocio.update({
        where: { id: s.negocioId },
        data: { plan: 3, planVenceEl: new Date(Date.now() - 86_400_000) },
      });
    }

    const listar = (token: string) =>
      request(app.getHttpServer())
        .get('/productos')
        .set('Authorization', `Bearer ${token}`);

    const editar = (
      token: string,
      id: string,
      cuerpo: Record<string, unknown>,
    ) =>
      request(app.getHttpServer())
        .patch(`/productos/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(cuerpo);

    const borrar = (token: string, id: string) =>
      request(app.getHttpServer())
        .delete(`/productos/${id}`)
        .set('Authorization', `Bearer ${token}`);

    it('registrar un producto con plan gratuito es 403', async () => {
      await conPlanGratuito();

      const res = await crear(dueno, productoCompleto());

      expect(res.status).toBe(403);
      expect(
        await prisma.producto.count({ where: { nombre: 'Panela cuadrada' } }),
      ).toBe(0);
    });

    /*
     * Consultar NO se bloquea. La regla ya estaba en el repositorio
     * (aislamiento.e2e-spec): "leer nunca depende del plan; un negocio con el
     * plan vencido conserva el historico de todas sus sedes". Esconderle a
     * alguien lo que registro no vende un plan, solo le hace pensar que perdio
     * sus datos. Quien no lo ve es el panel, que no le pinta la seccion.
     */
    it('pero consultarlos SI se puede: sus datos no desaparecen', async () => {
      await conPlanGratuito();

      const res = await listar(dueno);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('editarlos tambien', async () => {
      await conPlanGratuito();

      const res = await editar(dueno, s.panId, { precioVenta: 900 });

      expect(res.status).toBe(403);
      // El precio sigue siendo el de antes: el 403 corta antes de escribir.
      expect(
        Number(
          (await prisma.producto.findUniqueOrThrow({ where: { id: s.panId } }))
            .precioVenta,
        ),
      ).toBe(500);
    });

    it('y borrarlos', async () => {
      await conPlanGratuito();

      const res = await borrar(dueno, s.panId);

      expect(res.status).toBe(403);
      expect(
        await prisma.producto.findUnique({ where: { id: s.panId } }),
      ).not.toBeNull();
    });

    /*
     * Lo mas importante de todo esto: bloquear NO es borrar. Los productos que
     * se registraron cuando la distincion no existia siguen en la base,
     * intactos, esperando a que el negocio vuelva a un plan de pago.
     */
    it('los productos que ya existian NO se borran', async () => {
      await conPlanGratuito();

      await borrar(dueno, s.panId);
      await editar(dueno, s.panId, { precioVenta: 900 });

      expect(
        await prisma.producto.count({ where: { sedeId: s.sedeAId } }),
      ).toBe(2);
    });

    it('y vuelve a poder gestionarlos en cuanto renueva', async () => {
      await conPlanGratuito();
      expect((await crear(dueno, productoCompleto())).status).toBe(403);

      await prisma.negocio.update({
        where: { id: s.negocioId },
        data: { plan: 2, planVenceEl: new Date(Date.now() + 86_400_000) },
      });

      expect((await crear(dueno, productoCompleto())).status).toBe(201);
    });

    // Un plan de pago vencido cae a Asistente por `PlanesService.estado`: no
    // hay logica de vencimiento propia del inventario que mantener aparte.
    // Un plan de pago vencido cae a Asistente por `PlanesService.estado`: no
    // hay logica de vencimiento propia del inventario que mantener aparte.
    it('un plan de pago vencido tampoco puede registrar', async () => {
      await conPlanVencido();

      const res = await crear(dueno, productoCompleto());

      expect(res.status).toBe(403);
      expect(mensajeDe(res)).toMatch(/vencido/i);
    });

    it('y se le dice que sus productos siguen ahi', async () => {
      await conPlanVencido();

      expect(mensajeDe(await crear(dueno, productoCompleto()))).toMatch(
        /recuperas al renovar/i,
      );
    });

    it('un plan vencido tampoco pierde de vista su catalogo', async () => {
      await conPlanVencido();

      const res = await listar(dueno);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('al gratuito se le explica que si puede registrar ventas y gastos', async () => {
      await conPlanGratuito();

      expect(mensajeDe(await crear(dueno, productoCompleto()))).toMatch(
        /ventas y gastos/i,
      );
    });

    it('con un plan de pago todo sigue funcionando', async () => {
      const res = await crear(dueno, productoCompleto());

      expect(res.status).toBe(201);
    });
  });
});
