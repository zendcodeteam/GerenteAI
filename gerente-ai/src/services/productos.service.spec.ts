import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductosService } from './productos.service';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreateProductoDto } from '../dto/productos/create-producto.dto';
import { UpdateProductoDto } from '../dto/productos/update-producto.dto';

type MockFn = jest.Mock;

interface MockPrisma {
  sede: { findUnique: MockFn };
  producto: {
    create: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    update: MockFn;
    delete: MockFn;
  };
}

describe('ProductosService', () => {
  let service: ProductosService;
  let prisma: MockPrisma;
  let negociosService: {
    verificarAccesoSede: MockFn;
    filtroDeSedes: MockFn;
  };

  const sedeMock = {
    id: 'sede-1',
    negocioId: 'negocio-1',
    nombre: 'Sede Central',
  };

  beforeEach(() => {
    prisma = {
      sede: {
        findUnique: jest.fn().mockResolvedValue(sedeMock),
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
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    negociosService = {
      verificarAccesoSede: jest.fn().mockResolvedValue(undefined),
      filtroDeSedes: jest.fn().mockResolvedValue({ in: ['sede-1'] }),
    };

    service = new ProductosService(
      prisma as unknown as PrismaService,
      negociosService as unknown as NegociosService,
    );
  });

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
        categoria: 'Abarrotes',
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
});
