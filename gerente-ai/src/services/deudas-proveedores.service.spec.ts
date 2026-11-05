import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  EstadoDeudaProveedor,
  ModalidadDeudaProveedor,
  Prisma,
} from '@prisma/client';
import { DeudasProveedoresService } from './deudas-proveedores.service';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';

type MockFn = jest.Mock;

interface MockPrisma {
  sede: { findUnique: MockFn };
  proveedor: { findUnique: MockFn };
  deudaProveedor: {
    create: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    update: MockFn;
    delete: MockFn;
  };
}

describe('DeudasProveedoresService - Modelo de datos de deuda con proveedor', () => {
  let service: DeudasProveedoresService;
  let prismaMock: MockPrisma;
  let negociosServiceMock: {
    verificarAccesoSede: MockFn;
    filtroDeSedes: MockFn;
  };

  const sedeMock = { id: 'sede-1', negocioId: 'negocio-1' };
  const proveedorMock = {
    id: 'prov-1',
    nombre: 'Distribuidora Central',
    sedeId: 'sede-1',
  };

  beforeEach(() => {
    prismaMock = {
      sede: {
        findUnique: jest.fn().mockResolvedValue(sedeMock),
      },
      proveedor: {
        findUnique: jest.fn().mockResolvedValue(proveedorMock),
      },
      deudaProveedor: {
        create: jest
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) =>
            Promise.resolve({ id: 'deuda-1', ...args.data }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(
            (args: { where: { id: string }; data: Record<string, unknown> }) =>
              Promise.resolve({ id: args.where.id, ...args.data }),
          ),
        delete: jest.fn().mockResolvedValue({ id: 'deuda-1' }),
      },
    };

    negociosServiceMock = {
      verificarAccesoSede: jest.fn().mockResolvedValue(undefined),
      filtroDeSedes: jest.fn().mockResolvedValue(['sede-1']),
    };

    service = new DeudasProveedoresService(
      prismaMock as unknown as PrismaService,
      negociosServiceMock as unknown as NegociosService,
    );
  });

  describe('create - almacenamiento estructurado y validaciones', () => {
    it('almacena todos los parámetros de la especificación de forma estructurada', async () => {
      const dto = {
        proveedorId: 'prov-1',
        sedeId: 'sede-1',
        suministro: 'Empaques biodegradables',
        montoTotal: 500000,
        fechaLimite: '2026-12-31T23:59:59.000Z',
        modalidad: ModalidadDeudaProveedor.CUOTAS,
        numeroCuotas: 3,
        aplicaInteres: true,
        porcentajeInteres: 2.5,
        estado: EstadoDeudaProveedor.PENDIENTE,
      };

      const resultado = await service.create('user-1', 'CLIENTE', dto);

      expect(negociosServiceMock.verificarAccesoSede).toHaveBeenCalledWith(
        'user-1',
        sedeMock,
        'CLIENTE',
        { escritura: true },
      );

      expect(prismaMock.deudaProveedor.create).toHaveBeenCalledWith({
        data: {
          proveedorId: 'prov-1',
          sedeId: 'sede-1',
          suministro: 'Empaques biodegradables',
          montoTotal: new Prisma.Decimal(500000),
          fechaLimite: new Date('2026-12-31T23:59:59.000Z'),
          modalidad: ModalidadDeudaProveedor.CUOTAS,
          numeroCuotas: 3,
          aplicaInteres: true,
          porcentajeInteres: new Prisma.Decimal(2.5),
          estado: EstadoDeudaProveedor.PENDIENTE,
        },
        include: {
          proveedor: true,
        },
      });

      expect(resultado).toMatchObject({
        suministro: 'Empaques biodegradables',
        modalidad: ModalidadDeudaProveedor.CUOTAS,
        numeroCuotas: 3,
        aplicaInteres: true,
      });
    });

    it('almacena correctamente una deuda de modalidad UNICO sin cuotas ni interés', async () => {
      const dto = {
        proveedorId: 'prov-1',
        sedeId: 'sede-1',
        suministro: 'Café tostado especial',
        montoTotal: 200000,
        fechaLimite: '2026-11-30T00:00:00.000Z',
        modalidad: ModalidadDeudaProveedor.UNICO,
        aplicaInteres: false,
      };

      await service.create('user-1', 'CLIENTE', dto);

      expect(prismaMock.deudaProveedor.create).toHaveBeenCalledTimes(1);
      const callArg = prismaMock.deudaProveedor.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(callArg[0].data).toMatchObject({
        modalidad: ModalidadDeudaProveedor.UNICO,
        numeroCuotas: null,
        aplicaInteres: false,
        porcentajeInteres: null,
        estado: EstadoDeudaProveedor.PENDIENTE,
      });
    });

    it('rechaza si la sede no existe', async () => {
      prismaMock.sede.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create('user-1', 'CLIENTE', {
          proveedorId: 'prov-1',
          sedeId: 'sede-inexistente',
          suministro: 'Insumos',
          montoTotal: 100000,
          fechaLimite: '2026-12-01',
          modalidad: ModalidadDeudaProveedor.UNICO,
          aplicaInteres: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza si el proveedor no pertenece a la sede indicada', async () => {
      prismaMock.proveedor.findUnique.mockResolvedValueOnce({
        id: 'prov-1',
        sedeId: 'otra-sede',
      });

      await expect(
        service.create('user-1', 'CLIENTE', {
          proveedorId: 'prov-1',
          sedeId: 'sede-1',
          suministro: 'Insumos',
          montoTotal: 100000,
          fechaLimite: '2026-12-01',
          modalidad: ModalidadDeudaProveedor.UNICO,
          aplicaInteres: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si aplica interés y el porcentaje no está presente', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', {
          proveedorId: 'prov-1',
          sedeId: 'sede-1',
          suministro: 'Insumos',
          montoTotal: 100000,
          fechaLimite: '2026-12-01',
          modalidad: ModalidadDeudaProveedor.UNICO,
          aplicaInteres: true,
          porcentajeInteres: undefined,
        }),
      ).rejects.toThrow('Si aplica interés, el porcentaje es obligatorio.');
    });

    it('rechaza si es en cuotas y el número de cuotas es menor a 2 o no se especifica', async () => {
      await expect(
        service.create('user-1', 'CLIENTE', {
          proveedorId: 'prov-1',
          sedeId: 'sede-1',
          suministro: 'Insumos',
          montoTotal: 100000,
          fechaLimite: '2026-12-01',
          modalidad: ModalidadDeudaProveedor.CUOTAS,
          numeroCuotas: 1,
          aplicaInteres: false,
        }),
      ).rejects.toThrow(
        'Si es en cuotas, el número de cuotas es obligatorio (>= 2).',
      );

      await expect(
        service.create('user-1', 'CLIENTE', {
          proveedorId: 'prov-1',
          sedeId: 'sede-1',
          suministro: 'Insumos',
          montoTotal: 100000,
          fechaLimite: '2026-12-01',
          modalidad: ModalidadDeudaProveedor.CUOTAS,
          numeroCuotas: undefined,
          aplicaInteres: false,
        }),
      ).rejects.toThrow(
        'Si es en cuotas, el número de cuotas es obligatorio (>= 2).',
      );
    });
  });

  describe('findAll, findOne y remove', () => {
    it('findAll filtra por sedes visibles para el usuario', async () => {
      await service.findAll('user-1', 'CLIENTE', 'sede-1');
      expect(negociosServiceMock.filtroDeSedes).toHaveBeenCalledWith(
        'user-1',
        'CLIENTE',
        'sede-1',
      );
      expect(prismaMock.deudaProveedor.findMany).toHaveBeenCalledWith({
        where: { sedeId: ['sede-1'] },
        include: { proveedor: true },
        orderBy: { fechaLimite: 'asc' },
      });
    });

    it('findOne retorna la deuda si pertenece a una sede accesible', async () => {
      const deudaExistente = {
        id: 'd-1',
        sedeId: 'sede-1',
        suministro: 'Leche',
      };
      prismaMock.deudaProveedor.findUnique.mockResolvedValueOnce(
        deudaExistente,
      );

      const res = await service.findOne('d-1', 'user-1', 'CLIENTE');
      expect(res).toEqual(deudaExistente);
      expect(negociosServiceMock.verificarAccesoSede).toHaveBeenCalled();
    });

    it('remove elimina la deuda verificando permiso de escritura', async () => {
      const deudaExistente = { id: 'd-1', sedeId: 'sede-1' };
      prismaMock.deudaProveedor.findUnique.mockResolvedValueOnce(
        deudaExistente,
      );

      await service.remove('d-1', 'user-1', 'CLIENTE');
      expect(prismaMock.deudaProveedor.delete).toHaveBeenCalledWith({
        where: { id: 'd-1' },
      });
    });
  });
});
