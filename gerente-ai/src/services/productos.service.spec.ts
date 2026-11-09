import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductosService } from './productos.service';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { PlanesService } from './planes.service';
import { CreateProductoDto } from '../dto/productos/create-producto.dto';
import { UpdateProductoDto } from '../dto/productos/update-producto.dto';

type MockFn = jest.Mock;

interface MockPrisma {
  sede: { findUnique: MockFn; findMany: MockFn };
  producto: {
    create: MockFn;
    findMany: MockFn;
    findFirst: MockFn;
    findUnique: MockFn;
    update: MockFn;
    delete: MockFn;
    fields: { stockMinimo: unknown };
  };
  detalleVenta: { count: MockFn };
  detalleCompra: { count: MockFn };
}

describe('ProductosService', () => {
  let service: ProductosService;
  let prisma: MockPrisma;
  let negociosService: {
    verificarAccesoSede: MockFn;
    filtroDeSedes: MockFn;
    sedesVisibles: MockFn;
  };
  let planes: {
    tieneFuncionalidad: MockFn;
    estado: MockFn;
  };

  const sedeMock = {
    id: 'sede-1',
    negocioId: 'negocio-1',
    nombre: 'Sede Central',
    // La comprobacion de plan lee el negocio desde la sede.
    negocio: { plan: 2, planVenceEl: null },
  };

  beforeEach(() => {
    prisma = {
      sede: {
        findUnique: jest.fn().mockResolvedValue(sedeMock),
        // Lo que usa el listado sin sede concreta para saber que negocios
        // tienen inventario en su plan.
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'sede-1', negocio: { plan: 2, planVenceEl: null } },
          ]),
      },
      producto: {
        create: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Prisma.ProductoUncheckedCreateInput }) =>
              Promise.resolve({
                id: 'prod-1',
                ...data,
                createdAt: new Date('2026-11-04T12:00:00Z'),
                updatedAt: new Date('2026-11-04T12:00:00Z'),
              }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
        // Por defecto el nombre esta libre y el producto no tiene historial:
        // el caso corriente. Cada prueba que va de duplicados o de historial
        // lo cambia a proposito.
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        // Prisma expone las columnas aqui para poder comparar dos campos de la
        // misma fila. Un centinela reconocible: si el filtro de reposicion
        // apuntara a otra columna, la prueba lo cantaria.
        fields: { stockMinimo: 'CAMPO:stockMinimo' },
      },
      detalleVenta: { count: jest.fn().mockResolvedValue(0) },
      detalleCompra: { count: jest.fn().mockResolvedValue(0) },
    };

    negociosService = {
      verificarAccesoSede: jest.fn().mockResolvedValue(undefined),
      filtroDeSedes: jest.fn().mockResolvedValue({ in: ['sede-1'] }),
      sedesVisibles: jest.fn().mockResolvedValue(['sede-1']),
    };

    // Por defecto, un negocio con plan de pago: es el caso corriente y el que
    // recorren casi todas estas pruebas. Las del plan gratuito lo cambian.
    planes = {
      tieneFuncionalidad: jest.fn().mockReturnValue(true),
      estado: jest.fn().mockReturnValue({
        vigente: { id: 2, nombre: 'Gerente' },
        contratado: { id: 2, nombre: 'Gerente' },
        vencido: false,
      }),
    };

    service = new ProductosService(
      prisma as unknown as PrismaService,
      negociosService as unknown as NegociosService,
      planes as unknown as PlanesService,
    );
  });

  /**
   * Lo que la sede ya tiene guardado, como lo lee la comprobacion de
   * duplicados: se trae el catalogo de la sede y se compara en memoria.
   */
  function laSedeTiene(...productos: { nombre: string; alias?: string[] }[]) {
    prisma.producto.findMany.mockResolvedValue(
      productos.map((p) => ({ nombre: p.nombre, alias: p.alias ?? [] })),
    );
  }

  describe('Criterio 1: Los 4 campos son obligatorios; no se guarda un producto incompleto', () => {
    it('debe registrar un producto cuando los 4 campos están presentes y completos', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Arroz Diana 1kg',
        categoria: 'Abarrotes',
        precioCompra: 3500,
        precioVenta: 4200,
        stock: 10,
        sedeId: 'sede-1',
      };

      const resultado = await service.create('user-1', 'CLIENTE', dto);

      expect(resultado).toBeDefined();
      expect(resultado.nombre).toBe('Arroz Diana 1kg');
      expect(resultado.categoria).toBe('Abarrotes');
      expect(prisma.producto.create).toHaveBeenCalled();
      const callData = (
        prisma.producto.create.mock.calls[0] as [
          { data: Prisma.ProductoUncheckedCreateInput },
        ]
      )[0].data;
      expect(callData.nombre).toBe('Arroz Diana 1kg');
      expect(callData.categoria).toBe('Abarrotes');
      expect(callData.stock).toBe(10);
      expect(callData.sedeId).toBe('sede-1');
    });

    it('debe rechazar la creación si falta el nombre', async () => {
      const dto = {
        categoria: 'Abarrotes',
        precioCompra: 3500,
        precioVenta: 4200,
        sedeId: 'sede-1',
      } as unknown as CreateProductoDto;

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar la creación si el nombre contiene solo espacios', async () => {
      const dto: CreateProductoDto = {
        nombre: '    ',
        categoria: 'Abarrotes',
        precioCompra: 3500,
        precioVenta: 4200,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar la creación si falta la categoría', async () => {
      const dto = {
        nombre: 'Arroz Diana',
        precioCompra: 3500,
        precioVenta: 4200,
        sedeId: 'sede-1',
      } as unknown as CreateProductoDto;

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar la creación si falta el costo de compra', async () => {
      const dto = {
        nombre: 'Arroz Diana',
        categoria: 'Abarrotes',
        precioVenta: 4200,
        sedeId: 'sede-1',
      } as unknown as CreateProductoDto;

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar la creación si falta el precio de venta', async () => {
      const dto = {
        nombre: 'Arroz Diana',
        categoria: 'Abarrotes',
        precioCompra: 3500,
        sedeId: 'sede-1',
      } as unknown as CreateProductoDto;

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Criterio 2: Cantidad entera >= 0; costo y precio numéricos > 0', () => {
    it('debe aceptar cantidad / stock igual a 0 por defecto si no se especifica', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Azúcar Manuelita 1kg',
        categoria: 'Abarrotes',
        precioCompra: 4000,
        precioVenta: 4800,
        sedeId: 'sede-1',
      };

      const resultado = await service.create('user-1', 'CLIENTE', dto);
      expect(resultado.stock).toBe(0);
    });

    it('debe rechazar si la cantidad es negativa', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Azúcar Manuelita',
        categoria: 'Abarrotes',
        precioCompra: 4000,
        precioVenta: 4800,
        stock: -1,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar si la cantidad no es un número entero', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Azúcar Manuelita',
        categoria: 'Abarrotes',
        precioCompra: 4000,
        precioVenta: 4800,
        stock: 5.5,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar costo de compra igual a 0', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Azúcar Manuelita',
        categoria: 'Abarrotes',
        precioCompra: 0,
        precioVenta: 4800,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar costo de compra menor a 0', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Azúcar Manuelita',
        categoria: 'Abarrotes',
        precioCompra: -100,
        precioVenta: 4800,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar precio de venta igual a 0', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Azúcar Manuelita',
        categoria: 'Abarrotes',
        precioCompra: 3000,
        precioVenta: 0,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar precio de venta menor a 0', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Azúcar Manuelita',
        categoria: 'Abarrotes',
        precioCompra: 3000,
        precioVenta: -50,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe mapear correctamente costoCompra y cantidad si se usan como alias', async () => {
      const dto: CreateProductoDto = {
        nombre: 'Café Sello Rojo 500g',
        categoria: 'Bebidas',
        costoCompra: 12000,
        precioVenta: 14500,
        cantidad: 25,
        precioCompra: undefined as unknown as number,
        sedeId: 'sede-1',
      };

      await service.create('user-1', 'CLIENTE', dto);

      expect(prisma.producto.create).toHaveBeenCalled();
      const callData = (
        prisma.producto.create.mock.calls[0] as [
          { data: Prisma.ProductoUncheckedCreateInput },
        ]
      )[0].data;
      expect(callData.nombre).toBe('Café Sello Rojo 500g');
      expect(callData.categoria).toBe('Bebidas');
      expect(callData.stock).toBe(25);
    });
  });

  describe('Criterio 3: Servicio/API de creación y consulta de producto', () => {
    it('debe consultar todos los productos respetando el filtro de visibilidad de sedes', async () => {
      const productosMock = [
        {
          id: 'prod-1',
          nombre: 'Producto 1',
          categoria: 'General',
          stock: 5,
          precioCompra: new Prisma.Decimal(100),
          precioVenta: new Prisma.Decimal(150),
          createdAt: new Date(),
        },
      ];
      prisma.producto.findMany.mockResolvedValue(productosMock);

      const res = await service.findAll('user-1', 'CLIENTE', {
        sedeId: 'sede-1',
      });

      expect(res).toEqual(productosMock);
      expect(negociosService.filtroDeSedes).toHaveBeenCalledWith(
        'user-1',
        'CLIENTE',
        'sede-1',
      );
      expect(prisma.producto.findMany).toHaveBeenCalledWith({
        where: { sedeId: { in: ['sede-1'] } },
        orderBy: { createdAt: 'desc' },
      });
    });

    // Listar sin filtros es el caso mas comun del panel: el catalogo entero
    // de las sedes que el usuario puede ver.
    it('lista el catalogo completo cuando no se pasa ningun filtro', async () => {
      await service.findAll('user-1', 'CLIENTE');

      const [{ where }] = prisma.producto.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(where).toEqual({ sedeId: { in: ['sede-1'] } });
    });

    it('debe filtrar productos por categoría y término de búsqueda en findAll', async () => {
      await service.findAll('user-1', 'CLIENTE', {
        sedeId: 'sede-1',
        categoria: 'Lácteos',
        search: 'leche',
      });

      expect(prisma.producto.findMany).toHaveBeenCalled();
    });

    it('debe consultar un producto por id y verificar acceso a la sede', async () => {
      const productoMock = {
        id: 'prod-1',
        nombre: 'Yogurt Alpina',
        categoria: 'Lácteos',
        sedeId: 'sede-1',
      };
      prisma.producto.findUnique.mockResolvedValue(productoMock);

      const res = await service.findOne('prod-1', 'user-1', 'CLIENTE');

      expect(res).toEqual(productoMock);
      expect(negociosService.verificarAccesoSede).toHaveBeenCalledWith(
        'user-1',
        sedeMock,
        'CLIENTE',
        {},
      );
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      prisma.producto.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('prod-inexistente', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar NotFoundException si la sede asociada al producto no existe', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-huerfana',
      });
      prisma.sede.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(NotFoundException);
    });
  });
  describe('Aislamiento por sede al registrar', () => {
    /**
     * El `sedeId` viaja en el cuerpo de la peticion, asi que es el cliente
     * quien lo elige: si el servicio no comprobara el permiso de escritura,
     * cualquier usuario autenticado podria sembrar productos en la sede de
     * otro negocio con solo cambiar un campo del JSON.
     */
    const dtoValido = (): CreateProductoDto => ({
      nombre: 'Arroz Diana 1kg',
      categoria: 'Abarrotes',
      precioCompra: 3500,
      precioVenta: 4200,
      stock: 10,
      sedeId: 'sede-ajena',
    });

    it('no registra nada si el usuario no tiene escritura sobre la sede', async () => {
      negociosService.verificarAccesoSede.mockRejectedValue(
        new ForbiddenException('Sin acceso a esta sede'),
      );

      await expect(
        service.create('user-1', 'CLIENTE', dtoValido()),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.producto.create).not.toHaveBeenCalled();
    });

    it('pide permiso de ESCRITURA, no solo de lectura', async () => {
      await service.create('user-1', 'CLIENTE', dtoValido());

      expect(negociosService.verificarAccesoSede).toHaveBeenCalledWith(
        'user-1',
        sedeMock,
        'CLIENTE',
        { escritura: true },
      );
    });

    it('rechaza una sede que no existe', async () => {
      prisma.sede.findUnique.mockResolvedValue(null);

      await expect(
        service.create('user-1', 'CLIENTE', dtoValido()),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.producto.create).not.toHaveBeenCalled();
    });
  });

  describe('Editar no puede dejar el producto incompleto o invalido', () => {
    /**
     * Los criterios 1 y 2 no valen solo en el alta: un PATCH que dejara el
     * nombre vacio o el precio en 0 romperia las mismas reglas por la puerta
     * de atras, y el producto ya estaria guardado.
     */
    beforeEach(() => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
        categoria: 'Abarrotes',
        // Las dos columnas son Decimal obligatorias en la base: un producto
        // guardado SIEMPRE tiene los dos precios. El mock tiene que parecerse
        // a eso o la regla del margen se mide contra un NaN.
        precioCompra: new Prisma.Decimal(3500),
        precioVenta: new Prisma.Decimal(4200),
      });
      prisma.producto.update.mockImplementation(
        ({ data }: { data: Prisma.ProductoUpdateInput }) =>
          Promise.resolve({ id: 'prod-1', ...data }),
      );
    });

    const rechaza = async (dto: UpdateProductoDto) => {
      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', dto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.producto.update).not.toHaveBeenCalled();
    };

    it('rechaza dejar el nombre vacio', () => rechaza({ nombre: '   ' }));

    it('rechaza dejar la categoria vacia', () => rechaza({ categoria: '  ' }));

    it('rechaza poner el costo de compra en 0', () =>
      rechaza({ precioCompra: 0 }));

    it('rechaza poner el precio de venta en 0', () =>
      rechaza({ precioVenta: 0 }));

    it('rechaza una cantidad negativa', () => rechaza({ stock: -1 }));

    it('rechaza una cantidad con decimales', () => rechaza({ stock: 2.5 }));

    it('rechaza el alias costoCompra en 0, igual que precioCompra', () =>
      rechaza({ costoCompra: 0 }));

    it('deja pasar un cambio valido y guarda solo lo enviado', async () => {
      await service.update('prod-1', 'user-1', 'CLIENTE', {
        precioVenta: 5000,
      });

      const [{ data }] = prisma.producto.update.mock.calls[0] as [
        { data: Prisma.ProductoUpdateInput },
      ];
      expect(data.precioVenta).toEqual(new Prisma.Decimal(5000));
      // Lo que no se envio no se toca: un PATCH no puede borrar el nombre.
      expect(data.nombre).toBeUndefined();
      expect(data.categoria).toBeUndefined();
    });

    it('exige escritura sobre la sede del producto', async () => {
      negociosService.verificarAccesoSede.mockRejectedValue(
        new ForbiddenException('Sin acceso a esta sede'),
      );

      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', { precioVenta: 5000 }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.producto.update).not.toHaveBeenCalled();
    });
  });
  /**
   * El `sedeId` no lo valida el DTO porque es opcional en el cuerpo: lo exige
   * el servicio. Sin esta comprobacion, un producto podria quedar guardado sin
   * sede y no aparecer en el inventario de nadie.
   */
  describe('Un producto sin sede no se guarda', () => {
    it('rechaza crear sin sedeId', async () => {
      const dto = {
        nombre: 'Arroz Diana 1kg',
        categoria: 'Abarrotes',
        precioCompra: 3500,
        precioVenta: 4200,
      } as CreateProductoDto;

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.producto.create).not.toHaveBeenCalled();
    });
  });

  /**
   * Las pruebas de edicion que ya habia comprueban lo que se RECHAZA. Estas
   * comprueban lo contrario: que un cambio valido llegue entero a la base, con
   * el valor y el tipo correctos. Un PATCH que valida bien pero guarda otra
   * cosa pasaria desapercibido.
   */
  describe('Editar guarda de verdad lo que se envia', () => {
    beforeEach(() => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
        categoria: 'Abarrotes',
        // Las dos columnas son Decimal obligatorias en la base: un producto
        // guardado SIEMPRE tiene los dos precios. El mock tiene que parecerse
        // a eso o la regla del margen se mide contra un NaN.
        precioCompra: new Prisma.Decimal(3500),
        precioVenta: new Prisma.Decimal(4200),
      });
      prisma.producto.update.mockImplementation(
        ({ data }: { data: Prisma.ProductoUpdateInput }) =>
          Promise.resolve({ id: 'prod-1', ...data }),
      );
    });

    const datosGuardados = async (dto: UpdateProductoDto) => {
      await service.update('prod-1', 'user-1', 'CLIENTE', dto);
      const [{ data }] = prisma.producto.update.mock.calls[0] as [
        { data: Prisma.ProductoUpdateInput },
      ];
      return data;
    };

    it('guarda el nombre nuevo, sin los espacios de los extremos', async () => {
      expect(await datosGuardados({ nombre: '  Arroz Roa 500g  ' })).toEqual({
        nombre: 'Arroz Roa 500g',
      });
    });

    it('guarda la categoria nueva, sin espacios', async () => {
      expect(await datosGuardados({ categoria: '  Granos  ' })).toEqual({
        categoria: 'Granos',
      });
    });

    it('guarda la cantidad nueva, incluido el 0', async () => {
      expect(await datosGuardados({ stock: 0 })).toEqual({ stock: 0 });
    });

    it('acepta el alias cantidad igual que stock', async () => {
      expect(await datosGuardados({ cantidad: 7 })).toEqual({ stock: 7 });
    });

    // Los precios son Decimal en la base: guardarlos como number perderia
    // precision en los montos grandes, que en pesos colombianos son todos.
    it('guarda el costo de compra como Decimal', async () => {
      const data = await datosGuardados({ precioCompra: 3800 });
      expect(data.precioCompra).toEqual(new Prisma.Decimal(3800));
    });

    it('acepta el alias costoCompra igual que precioCompra', async () => {
      const data = await datosGuardados({ costoCompra: 3900 });
      expect(data.precioCompra).toEqual(new Prisma.Decimal(3900));
    });

    it('guarda el stock minimo, incluido el 0', async () => {
      expect(await datosGuardados({ stockMinimo: 0 })).toEqual({
        stockMinimo: 0,
      });
    });

    it('guarda los alias del producto', async () => {
      expect(await datosGuardados({ alias: ['arroz', 'arrocito'] })).toEqual({
        alias: ['arroz', 'arrocito'],
      });
    });

    it('un PATCH vacio no cambia nada', async () => {
      expect(await datosGuardados({})).toEqual({});
    });
  });

  /**
   * Borrar es la operacion mas destructiva del modulo y era la unica sin una
   * sola prueba. Un producto borrado se lleva por delante el historial de
   * compras y ventas que lo referencian, asi que quien no tenga escritura
   * sobre la sede no puede ni rozarlo.
   */
  describe('Borrar un producto', () => {
    beforeEach(() => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
      });
      prisma.producto.delete.mockResolvedValue({
        id: 'prod-1',
        nombre: 'Arroz Diana 1kg',
      });
    });

    it('borra el producto que se pide, y solo ese', async () => {
      const borrado = await service.remove('prod-1', 'user-1', 'CLIENTE');

      expect(prisma.producto.delete).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
      });
      expect(borrado).toMatchObject({ id: 'prod-1' });
    });

    it('exige permiso de ESCRITURA sobre la sede del producto', async () => {
      await service.remove('prod-1', 'user-1', 'CLIENTE');

      expect(negociosService.verificarAccesoSede).toHaveBeenCalledWith(
        'user-1',
        sedeMock,
        'CLIENTE',
        { escritura: true },
      );
    });

    // El caso que de verdad importa: alguien de otro negocio borrando
    // inventario ajeno. Si el guardia fallara, el borrado ya estaria hecho.
    it('no borra nada si el usuario no tiene acceso a la sede', async () => {
      negociosService.verificarAccesoSede.mockRejectedValue(
        new ForbiddenException('Sin acceso a esta sede'),
      );

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.producto.delete).not.toHaveBeenCalled();
    });

    it('un producto que no existe es 404, no un borrado silencioso', async () => {
      prisma.producto.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('fantasma', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.producto.delete).not.toHaveBeenCalled();
    });

    it('si la sede del producto ya no existe, tampoco borra', async () => {
      prisma.sede.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.producto.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // Arreglos de inventario (SCRUM-30)
  // ---------------------------------------------------------------------

  /**
   * Borrar un producto que ya se vendio reventaba con un 500 pelado: las
   * relaciones de DetalleVenta y DetalleCompra no declaran onDelete, Prisma
   * aplica Restrict y nadie capturaba el P2003. El tendero le daba a borrar y
   * recibia "error interno del servidor".
   */
  describe('Un producto con historial no se borra, y se dice por que', () => {
    beforeEach(() => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
      });
      prisma.producto.delete.mockResolvedValue({ id: 'prod-1' });
    });

    it('un producto con ventas no se borra: es 409, no 500', async () => {
      prisma.detalleVenta.count.mockResolvedValue(3);

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.producto.delete).not.toHaveBeenCalled();
    });

    it('un producto solo comprado tampoco se borra', async () => {
      prisma.detalleCompra.count.mockResolvedValue(1);

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(ConflictException);

      expect(prisma.producto.delete).not.toHaveBeenCalled();
    });

    // El mensaje es el arreglo: si no dice que paso ni que hacer, seguimos
    // igual que con el 500.
    it('el mensaje nombra el producto, cuenta los movimientos y propone una salida', async () => {
      prisma.detalleVenta.count.mockResolvedValue(2);
      prisma.detalleCompra.count.mockResolvedValue(1);

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(
        'No se puede eliminar "Arroz Diana 1kg": ya tiene movimientos registrados (2 ventas y 1 compra). Si dejaste de venderlo, pon su cantidad en 0.',
      );
    });

    it('con un solo movimiento habla en singular', async () => {
      prisma.detalleVenta.count.mockResolvedValue(1);

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(/\(1 venta\)/);
    });

    it('y en plural cuando son varias compras', async () => {
      prisma.detalleCompra.count.mockResolvedValue(4);

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(/\(4 compras\)/);
    });

    it('cuenta el historial de ESE producto, no del catalogo entero', async () => {
      await service.remove('prod-1', 'user-1', 'CLIENTE');

      expect(prisma.detalleVenta.count).toHaveBeenCalledWith({
        where: { productoId: 'prod-1' },
      });
      expect(prisma.detalleCompra.count).toHaveBeenCalledWith({
        where: { productoId: 'prod-1' },
      });
    });

    it('un producto sin movimientos si se borra', async () => {
      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).resolves.toMatchObject({ id: 'prod-1' });
    });

    // Entre el conteo y el borrado cabe una venta. La base la frena; lo que no
    // puede volver a pasar es que eso salga como un 500.
    it('si la venta entra justo entre el conteo y el borrado, sigue siendo 409', async () => {
      prisma.producto.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Foreign key constraint', {
          code: 'P2003',
          clientVersion: 'prueba',
        }),
      );

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(ConflictException);
    });

    // El catch es para el P2003 y nada mas: tragarse el resto esconderia
    // fallos de verdad detras de un mensaje de negocio que no aplica.
    it('cualquier otro fallo de la base se propaga tal cual', async () => {
      const caida = new Prisma.PrismaClientKnownRequestError('Base caida', {
        code: 'P1001',
        clientVersion: 'prueba',
      });
      prisma.producto.delete.mockRejectedValue(caida);

      await expect(service.remove('prod-1', 'user-1', 'CLIENTE')).rejects.toBe(
        caida,
      );
    });
  });

  /**
   * Dos productos con el mismo nombre en una sede dejan al bot sin salida: al
   * decir "vendi 2 arroz" encuentra dos candidatos, pide el nombre exacto, y
   * el nombre exacto es el mismo para los dos.
   *
   * El flujo de WhatsApp (SCRUM-28) ya lo impedia; el panel no, y esa
   * asimetria era el agujero.
   */
  /**
   * Dos productos que el BOT ve iguales lo dejan sin salida: al decir "vendi 2
   * arroz" encuentra dos candidatos, responde "indica el nombre exacto", y el
   * nombre exacto es el mismo para los dos.
   *
   * Por eso la comprobacion usa el mismo normalizador que el bot al resolver
   * —sin acentos, sin mayusculas, un solo espacio— y mira nombre Y alias: el
   * bot resuelve por los dos.
   */
  describe('No hay dos productos que el bot veria como el mismo', () => {
    const dto = {
      nombre: 'Arroz Diana 1kg',
      categoria: 'Abarrotes',
      precioCompra: 3500,
      precioVenta: 4200,
      sedeId: 'sede-1',
    } as CreateProductoDto;

    it('no registra un nombre que ya existe en la sede', async () => {
      laSedeTiene({ nombre: 'Arroz Diana 1kg' });

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        ConflictException,
      );

      expect(prisma.producto.create).not.toHaveBeenCalled();
    });

    it('tampoco cambiando las mayusculas', async () => {
      laSedeTiene({ nombre: 'ARROZ DIANA 1KG' });

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    /*
     * El caso que se colaba antes. Con `mode: 'insensitive'`, Postgres ve
     * "Arroz" y "Arróz" como distintos y los dejaba entrar; el bot los ve como
     * el mismo producto y se queda sin poder resolver ninguno de los dos.
     */
    it('ni poniendo o quitando acentos', async () => {
      laSedeTiene({ nombre: 'Arróz Diana 1kg' });

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('ni con espacios de sobra entre palabras', async () => {
      laSedeTiene({ nombre: 'Arroz Diana 1kg' });

      await expect(
        service.create('user-1', 'CLIENTE', {
          ...dto,
          nombre: 'Arroz   Diana   1kg',
        }),
      ).rejects.toThrow(ConflictException);
    });

    // Para que el tendero reconozca cual es: el que ya tiene guardado, con su
    // escritura, no la que acaba de teclear.
    it('el mensaje usa el nombre tal como esta guardado', async () => {
      laSedeTiene({ nombre: 'ARROZ DIANA 1KG' });

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        'Ya tienes un producto llamado "ARROZ DIANA 1KG" en esta sede',
      );
    });

    // Un alias repetido deja el producto igual de inservible que un nombre
    // repetido, porque el bot resuelve por los dos.
    it('el nombre nuevo no puede ser el alias de otro producto', async () => {
      laSedeTiene({ nombre: 'Gaseosa', alias: ['arroz diana 1kg'] });

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        '"Arroz Diana 1kg" ya es un alias del producto "Gaseosa" en esta sede',
      );
    });

    it('un alias nuevo no puede ser el nombre de otro producto', async () => {
      laSedeTiene({ nombre: 'Panela' });

      await expect(
        service.create('user-1', 'CLIENTE', {
          ...dto,
          alias: ['panela'],
        }),
      ).rejects.toThrow(
        'El alias "panela" es el nombre del producto "Panela" en esta sede',
      );
    });

    it('ni el alias de otro producto', async () => {
      laSedeTiene({ nombre: 'Panela', alias: ['panelita'] });

      await expect(
        service.create('user-1', 'CLIENTE', {
          ...dto,
          alias: ['Panelita'],
        }),
      ).rejects.toThrow(
        'El alias "Panelita" ya lo usa el producto "Panela" en esta sede',
      );
    });

    it('se consulta el catalogo de esa sede, no de todas', async () => {
      await service.create('user-1', 'CLIENTE', dto);

      expect(prisma.producto.findMany).toHaveBeenCalledWith({
        where: { sedeId: 'sede-1' },
        select: { nombre: true, alias: true },
      });
    });

    it('con todo libre, el producto se registra', async () => {
      laSedeTiene({ nombre: 'Panela', alias: ['panelita'] });

      await expect(
        service.create('user-1', 'CLIENTE', { ...dto, alias: ['arrocito'] }),
      ).resolves.toMatchObject({ nombre: 'Arroz Diana 1kg' });
    });

    /*
     * Datos heredados: dos productos que YA comparten un alias, de cuando esto
     * no se validaba. La comprobacion no puede reventar por eso; tiene que
     * seguir dando un 409 que se entienda, nombrando al primero que lo tiene.
     */
    it('aguanta un catalogo que ya traia un choque de antes', async () => {
      laSedeTiene(
        { nombre: 'Panela', alias: ['dulce'] },
        { nombre: 'Bocadillo', alias: ['dulce'] },
      );

      await expect(
        service.create('user-1', 'CLIENTE', { ...dto, alias: ['Dulce'] }),
      ).rejects.toThrow(
        'El alias "Dulce" ya lo usa el producto "Panela" en esta sede',
      );
    });
  });

  describe('Los alias se guardan en limpio', () => {
    const dto = {
      nombre: 'Arroz Diana 1kg',
      categoria: 'Abarrotes',
      precioCompra: 3500,
      precioVenta: 4200,
      sedeId: 'sede-1',
    } as CreateProductoDto;

    /** Los alias con los que se llamo a la base. */
    async function aliasGuardados(alias: string[] | undefined) {
      await service.create('user-1', 'CLIENTE', { ...dto, alias });
      const llamadas = prisma.producto.create.mock.calls as unknown as [
        { data: { alias: string[] } },
      ][];
      return llamadas[0][0].data.alias;
    }

    it('sin alias, se guarda una lista vacia', async () => {
      expect(await aliasGuardados(undefined)).toEqual([]);
    });

    it('se recortan los espacios', async () => {
      expect(await aliasGuardados(['  arrocito  '])).toEqual(['arrocito']);
    });

    it('se quitan los vacios', async () => {
      expect(await aliasGuardados(['arrocito', '   ', ''])).toEqual([
        'arrocito',
      ]);
    });

    // Repetirlo no añade ninguna forma nueva de llegar al producto, y ensucia
    // los mensajes de choque con cosas que el tendero no escribio.
    it('se quitan los repetidos, comparando como compara el bot', async () => {
      expect(
        await aliasGuardados(['arrocito', 'Arrocito', 'arrócito']),
      ).toEqual(['arrocito']);
    });

    it('y se quita el que es igual al nombre del propio producto', async () => {
      expect(await aliasGuardados(['arroz diana 1kg', 'arrocito'])).toEqual([
        'arrocito',
      ]);
    });
  });

  describe('Renombrar o cambiar los alias tampoco crea un duplicado', () => {
    beforeEach(() => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
        precioCompra: new Prisma.Decimal(3500),
        precioVenta: new Prisma.Decimal(4200),
      });
      prisma.producto.update.mockImplementation(
        ({ data }: { data: Prisma.ProductoUpdateInput }) =>
          Promise.resolve({ id: 'prod-1', ...data }),
      );
    });

    it('no renombra a un nombre que ya tiene otro producto', async () => {
      laSedeTiene({ nombre: 'Panela' });

      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', {
          nombre: 'Panela',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.producto.update).not.toHaveBeenCalled();
    });

    it('ni a algo que ya es alias de otro', async () => {
      laSedeTiene({ nombre: 'Gaseosa', alias: ['panela'] });

      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', { nombre: 'Panela' }),
      ).rejects.toThrow(ConflictException);
    });

    it('cambiar solo los alias tambien se comprueba', async () => {
      laSedeTiene({ nombre: 'Panela' });

      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', { alias: ['panela'] }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.producto.update).not.toHaveBeenCalled();
    });

    // Sin excluir su propio id, guardar el formulario sin cambiar el nombre
    // chocaria consigo mismo y no se podria editar nada mas.
    it('se excluye a si mismo: reenviar su propio nombre no falla', async () => {
      await service.update('prod-1', 'user-1', 'CLIENTE', {
        nombre: 'Arroz Diana 1kg',
        precioVenta: 5000,
      });

      expect(prisma.producto.findMany).toHaveBeenCalledWith({
        where: { sedeId: 'sede-1', id: { not: 'prod-1' } },
        select: { nombre: true, alias: true },
      });
      expect(prisma.producto.update).toHaveBeenCalled();
    });

    it('busca en la sede del producto, no en la que venga de fuera', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-B',
        nombre: 'Arroz',
        alias: [] as string[],
        precioCompra: new Prisma.Decimal(3500),
        precioVenta: new Prisma.Decimal(4200),
      });

      await service.update('prod-1', 'user-1', 'CLIENTE', {
        nombre: 'Arroz Nuevo',
      });

      expect(prisma.producto.findMany).toHaveBeenCalledWith({
        where: { sedeId: 'sede-B', id: { not: 'prod-1' } },
        select: { nombre: true, alias: true },
      });
    });

    it('editar sin tocar el nombre ni los alias no consulta duplicados', async () => {
      await service.update('prod-1', 'user-1', 'CLIENTE', {
        precioVenta: 5000,
      });

      expect(prisma.producto.findMany).not.toHaveBeenCalled();
      expect(prisma.producto.update).toHaveBeenCalled();
    });

    /*
     * Un producto que arrastre un choque de antes —de cuando esto no se
     * validaba— no puede quedar bloqueado para cualquier edicion, porque
     * entonces no habria forma de arreglarlo.
     */
    it('un producto que ya choca con otro se puede seguir editando', async () => {
      laSedeTiene({ nombre: 'Arroz Diana 1kg' });

      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', { stock: 7 }),
      ).resolves.toBeDefined();
    });
  });

  /**
   * Vender por debajo del costo: permitido, pero nunca por accidente.
   *
   * La regla vivia solo en el navegador (un window.confirm en InventoryPanel),
   * asi que cualquiera que llamara al API directo registraba la perdida en
   * silencio y el margen entraba al reves sin que nadie se enterara.
   */
  describe('Registrar a perdida exige un visto bueno explicito', () => {
    const aPerdida = {
      nombre: 'Arroz Diana 1kg',
      categoria: 'Abarrotes',
      precioCompra: 3500,
      precioVenta: 3000,
      sedeId: 'sede-1',
    } as CreateProductoDto;

    it('no registra un producto a perdida sin el visto bueno', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', aPerdida),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.producto.create).not.toHaveBeenCalled();
    });

    it('el mensaje dice los dos precios y como seguir', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', aPerdida),
      ).rejects.toThrow(/3.000.*3.500.*aceptoVenderConPerdida/s);
    });

    // No se bloquea: hay quien vende a perdida a proposito, para sacar lo que
    // esta por vencerse o como gancho.
    it('con el visto bueno si se registra', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', {
          ...aPerdida,
          aceptoVenderConPerdida: true,
        }),
      ).resolves.toMatchObject({ nombre: 'Arroz Diana 1kg' });
    });

    // Vender al costo no deja ganancia, pero tampoco es una perdida, y el
    // criterio del issue es "precio menor que costo".
    it('vender justo al costo no necesita visto bueno', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', {
          ...aPerdida,
          precioVenta: 3500,
        }),
      ).resolves.toBeDefined();
    });

    it('un producto con ganancia no pide nada', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', {
          ...aPerdida,
          precioVenta: 4200,
        }),
      ).resolves.toBeDefined();
    });

    // El visto bueno es una decision del momento, no un dato del producto: si
    // se colara en el INSERT, Prisma reventaria por una columna inexistente.
    it('el visto bueno no se guarda en la base', async () => {
      await service.create('user-1', 'CLIENTE', {
        ...aPerdida,
        aceptoVenderConPerdida: true,
      });

      const llamadas = prisma.producto.create.mock.calls as unknown as [
        { data: Record<string, unknown> },
      ][];
      expect(llamadas[0][0].data).not.toHaveProperty('aceptoVenderConPerdida');
    });

    it('tambien aplica con el alias costoCompra', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', {
          nombre: 'Arroz',
          categoria: 'Abarrotes',
          costoCompra: 3500,
          precioVenta: 3000,
          sedeId: 'sede-1',
        } as CreateProductoDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Editar tampoco deja caer el precio por debajo del costo sin querer', () => {
    // El producto guardado: cuesta 3.500 y se vende en 4.200.
    beforeEach(() => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
        precioCompra: new Prisma.Decimal(3500),
        precioVenta: new Prisma.Decimal(4200),
      });
      prisma.producto.update.mockImplementation(
        ({ data }: { data: Prisma.ProductoUpdateInput }) =>
          Promise.resolve({ id: 'prod-1', ...data }),
      );
    });

    // Lo que hace falta comparar es el par que QUEDA, no lo que viene en el
    // cuerpo: aqui solo llega el precio de venta y el costo sale de la base.
    it('bajar solo el precio de venta por debajo del costo guardado se frena', async () => {
      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', { precioVenta: 3000 }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.producto.update).not.toHaveBeenCalled();
    });

    it('subir solo el costo por encima del precio de venta guardado tambien', async () => {
      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', { precioCompra: 5000 }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.producto.update).not.toHaveBeenCalled();
    });

    it('con el visto bueno pasa', async () => {
      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', {
          precioVenta: 3000,
          aceptoVenderConPerdida: true,
        }),
      ).resolves.toBeDefined();
    });

    it('cambiar los dos a la vez de forma coherente pasa', async () => {
      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', {
          precioCompra: 1000,
          precioVenta: 1500,
        }),
      ).resolves.toBeDefined();
    });

    /*
     * El caso que mas facil se rompe al escribir esta regla: un producto que
     * YA se vendia a perdida —con su visto bueno en su momento— no puede
     * quedar bloqueado para siempre. Si la comprobacion corriera en toda
     * edicion, no se le podria ni corregir el stock.
     */
    it('a un producto que ya estaba a perdida se le puede editar el stock', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
        precioCompra: new Prisma.Decimal(3500),
        precioVenta: new Prisma.Decimal(3000),
      });

      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', { stock: 20 }),
      ).resolves.toBeDefined();
    });

    it('y renombrarlo, y cambiarle la categoria', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
        precioCompra: new Prisma.Decimal(3500),
        precioVenta: new Prisma.Decimal(3000),
      });

      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', {
          nombre: 'Arroz Diana 500g',
          categoria: 'Granos',
        }),
      ).resolves.toBeDefined();
    });
  });

  /**
   * `stockMinimo` llevaba desde SCRUM-27 siendo una columna decorativa: el DTO
   * la aceptaba, el servicio la escribia y ni una linea del backend la leia.
   * La cuenta de que reponer la hacia el panel en el navegador, asi que el bot
   * no podia avisar de nada.
   */
  describe('Lo que hay que reponer sale del backend, no del navegador', () => {
    /** El `where` con el que se consulto el catalogo. */
    function whereUsado(): Record<string, unknown> {
      const llamadas = prisma.producto.findMany.mock.calls as unknown as [
        { where: Record<string, unknown> },
      ][];
      return llamadas[0][0].where;
    }

    it('compara el stock contra el minimo de la MISMA fila', async () => {
      await service.findAll('user-1', 'CLIENTE', { stockBajo: true });

      expect(whereUsado().stock).toEqual({ lte: 'CAMPO:stockMinimo' });
    });

    it('sin pedirlo, el catalogo no filtra por stock', async () => {
      await service.findAll('user-1', 'CLIENTE', {});

      expect(whereUsado()).not.toHaveProperty('stock');
    });

    // El filtro no puede saltarse el aislamiento por sede: eso dejaria ver que
    // le falta en el estante a un negocio ajeno.
    it('sigue limitado a las sedes visibles', async () => {
      await service.findAll('user-1', 'CLIENTE', { stockBajo: true });

      expect(whereUsado().sedeId).toEqual({ in: ['sede-1'] });
    });

    it('se combina con el filtro de categoria', async () => {
      await service.findAll('user-1', 'CLIENTE', {
        stockBajo: true,
        categoria: 'Abarrotes',
      });

      expect(whereUsado()).toMatchObject({
        stock: { lte: 'CAMPO:stockMinimo' },
        categoria: { equals: 'Abarrotes', mode: 'insensitive' },
      });
    });
  });

  /**
   * La categoria es texto libre en la base, y el catalogo de SCRUM-29 se armo
   * en el frontend leyendo las categorias que ya existen. Asi, "Abarrotes" y
   * "abarrotes" eran dos categorias distintas y el filtro las separaba.
   */
  describe('La categoria no se multiplica por una mayuscula', () => {
    const dto = {
      nombre: 'Lentejas',
      categoria: 'abarrotes',
      precioCompra: 3000,
      precioVenta: 4000,
      sedeId: 'sede-1',
    } as CreateProductoDto;

    /** El nombre esta libre, pero la sede ya usa "Abarrotes". */
    function laSedeYaUsa(categoria: string) {
      prisma.producto.findFirst.mockImplementation(
        ({ where }: { where: { categoria?: unknown } }) =>
          Promise.resolve(where.categoria ? { categoria } : null),
      );
    }

    it('reutiliza la escritura que ya tiene la sede', async () => {
      laSedeYaUsa('Abarrotes');

      const creado = (await service.create('user-1', 'CLIENTE', dto)) as {
        categoria: string;
      };

      expect(creado.categoria).toBe('Abarrotes');
    });

    it('busca sin mayusculas y solo en esa sede', async () => {
      await service.create('user-1', 'CLIENTE', dto);

      expect(prisma.producto.findFirst).toHaveBeenCalledWith({
        where: {
          sedeId: 'sede-1',
          categoria: { equals: 'abarrotes', mode: 'insensitive' },
        },
        select: { categoria: true },
      });
    });

    // La primera vez que una categoria entra, entra como la escribio el
    // tendero: no hay con que compararla.
    it('una categoria nueva entra tal cual', async () => {
      const creado = (await service.create('user-1', 'CLIENTE', {
        ...dto,
        categoria: 'Mascotas',
      })) as { categoria: string };

      expect(creado.categoria).toBe('Mascotas');
    });

    it('al editar tambien se unifica', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Lentejas',
        alias: [] as string[],
        precioCompra: new Prisma.Decimal(3000),
        precioVenta: new Prisma.Decimal(4000),
      });
      prisma.producto.update.mockImplementation(
        ({ data }: { data: Prisma.ProductoUpdateInput }) =>
          Promise.resolve({ id: 'prod-1', ...data }),
      );
      laSedeYaUsa('Abarrotes');

      const editado = (await service.update('prod-1', 'user-1', 'CLIENTE', {
        categoria: 'ABARROTES',
      })) as { categoria: string };

      expect(editado.categoria).toBe('Abarrotes');
    });
  });

  /**
   * Sin normalizar los espacios, "Arroz  Diana" y "Arroz Diana" son dos
   * productos distintos para la base y para el bot, y la comprobacion de
   * duplicados no los ve iguales.
   */
  describe('Los espacios de sobra no crean productos distintos', () => {
    const dto = {
      nombre: 'Arroz   Diana   1kg',
      categoria: 'Abarrotes',
      precioCompra: 3000,
      precioVenta: 4000,
      sedeId: 'sede-1',
    } as CreateProductoDto;

    it('el nombre se guarda con un solo espacio entre palabras', async () => {
      const creado = (await service.create('user-1', 'CLIENTE', dto)) as {
        nombre: string;
      };

      expect(creado.nombre).toBe('Arroz Diana 1kg');
    });

    it('y por eso el duplicado con espacios de sobra se detecta', async () => {
      laSedeTiene({ nombre: 'Arroz Diana 1kg' });

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('la categoria tambien', async () => {
      const creado = (await service.create('user-1', 'CLIENTE', {
        ...dto,
        categoria: 'Granos  y  cereales',
      })) as { categoria: string };

      expect(creado.categoria).toBe('Granos y cereales');
    });

    it('al renombrar, igual', async () => {
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz',
        alias: [] as string[],
        precioCompra: new Prisma.Decimal(3000),
        precioVenta: new Prisma.Decimal(4000),
      });
      prisma.producto.update.mockImplementation(
        ({ data }: { data: Prisma.ProductoUpdateInput }) =>
          Promise.resolve({ id: 'prod-1', ...data }),
      );

      const editado = (await service.update('prod-1', 'user-1', 'CLIENTE', {
        nombre: 'Arroz   Diana',
      })) as { nombre: string };

      expect(editado.nombre).toBe('Arroz Diana');
    });

    // Un nombre de solo espacios sigue siendo un nombre vacio.
    it('un nombre de puros espacios se rechaza igual', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', {
          ...dto,
          nombre: '     ',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /**
   * El inventario es de planes pagos.
   *
   * Lo que importa aqui es DONDE se comprueba: en el backend. Si viviera solo
   * en el frontend, cualquiera con la URL del API seguiria registrando
   * productos en un negocio gratuito, que es justo como se colaron los que ya
   * estan en la base.
   */
  describe('El inventario solo esta en los planes pagos', () => {
    const dto = {
      nombre: 'Arroz Diana 1kg',
      categoria: 'Abarrotes',
      precioCompra: 3500,
      precioVenta: 4200,
      sedeId: 'sede-1',
    } as CreateProductoDto;

    /** Un negocio con plan Asistente (gratuito). */
    function conPlanGratuito() {
      planes.tieneFuncionalidad.mockReturnValue(false);
      planes.estado.mockReturnValue({
        vigente: { id: 1, nombre: 'Asistente' },
        contratado: { id: 1, nombre: 'Asistente' },
        vencido: false,
      });
    }

    /** Un plan de pago que caduco: cae a Asistente y pierde el acceso. */
    function conPlanVencido() {
      planes.tieneFuncionalidad.mockReturnValue(false);
      planes.estado.mockReturnValue({
        vigente: { id: 1, nombre: 'Asistente' },
        contratado: { id: 3, nombre: 'Administrador' },
        vencido: true,
      });
    }

    beforeEach(() => {
      prisma.sede.findUnique.mockResolvedValue(sedeMock);
      prisma.producto.findUnique.mockResolvedValue({
        id: 'prod-1',
        sedeId: 'sede-1',
        nombre: 'Arroz Diana 1kg',
        alias: [] as string[],
        precioCompra: new Prisma.Decimal(3500),
        precioVenta: new Prisma.Decimal(4200),
      });
    });

    it('un negocio gratuito no puede registrar productos', async () => {
      conPlanGratuito();

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prisma.producto.create).not.toHaveBeenCalled();
    });

    /*
     * Leer NO depende del plan, y es una regla que el repositorio ya tenia
     * escrita (aislamiento.e2e-spec): "un negocio con el plan vencido conserva
     * el historico de todas sus sedes". Si vencer la suscripcion escondiera lo
     * que el tendero registro, el castigo por dejar de pagar seria perder de
     * vista su propia contabilidad.
     */
    it('pero SI puede seguir viendo lo que ya tiene registrado', async () => {
      conPlanGratuito();

      await expect(
        service.findAll('user-1', 'CLIENTE', { sedeId: 'sede-1' }),
      ).resolves.toBeDefined();
    });

    it('y consultar un producto suelto tampoco se bloquea', async () => {
      conPlanGratuito();

      await expect(
        service.findOne('prod-1', 'user-1', 'CLIENTE'),
      ).resolves.toMatchObject({ id: 'prod-1' });
    });

    it('ni editarlos', async () => {
      conPlanGratuito();

      await expect(
        service.update('prod-1', 'user-1', 'CLIENTE', { precioVenta: 5000 }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.producto.update).not.toHaveBeenCalled();
    });

    it('ni borrarlos', async () => {
      conPlanGratuito();

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.producto.delete).not.toHaveBeenCalled();
    });

    // Lo que ya registraron durante las pruebas NO se borra. El bloqueo es de
    // acceso, no de datos.
    it('el bloqueo no borra nada de lo que ya estaba', async () => {
      conPlanGratuito();

      await expect(
        service.remove('prod-1', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.producto.delete).not.toHaveBeenCalled();
      expect(prisma.producto.update).not.toHaveBeenCalled();
    });

    it('se comprueba contra el plan VIGENTE, no el contratado', async () => {
      conPlanVencido();

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        ForbiddenException,
      );

      // No hay logica propia de vencimiento: se delega en PlanesService, que
      // ya hace caer un plan caducado a Asistente.
      expect(planes.tieneFuncionalidad).toHaveBeenCalledWith(
        2,
        null,
        'inventario',
      );
    });

    // Quien deja vencer su plan tiene que entender que no perdio nada.
    it('a un plan vencido se le dice que sus productos siguen ahi', async () => {
      conPlanVencido();

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        /los recuperas al renovar/i,
      );
    });

    it('al gratuito se le explica que si puede registrar ventas y gastos', async () => {
      conPlanGratuito();

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        /ventas y gastos/i,
      );
    });

    it('con un plan de pago, todo sigue funcionando', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', dto),
      ).resolves.toMatchObject({ nombre: 'Arroz Diana 1kg' });
    });

    // MASTER es soporte, no un cliente con plan: pasa igual que en la
    // comprobacion de permisos.
    it('MASTER no pasa por la comprobacion de plan', async () => {
      conPlanGratuito();

      await expect(
        service.create('user-1', 'MASTER', dto),
      ).resolves.toBeDefined();
      expect(planes.tieneFuncionalidad).not.toHaveBeenCalled();
    });
  });
});
