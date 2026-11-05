import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NominaService } from './nomina.service';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreatePagoNominaDto } from '../dto/nomina/create-pago-nomina.dto';

type MockFn = jest.Mock;

interface MockPrisma {
  sede: { findUnique: MockFn };
  pagoNomina: {
    create: MockFn;
    findMany: MockFn;
    findUnique: MockFn;
    update: MockFn;
    delete: MockFn;
  };
}

describe('NominaService', () => {
  let service: NominaService;
  let prisma: MockPrisma;
  let negociosService: {
    verificarAccesoSede: MockFn;
    filtroDeSedes: MockFn;
  };

  const sedeMock = {
    id: 'sede-1',
    negocioId: 'negocio-1',
    nombre: 'Sede Principal',
  };

  beforeEach(() => {
    prisma = {
      sede: {
        findUnique: jest.fn().mockResolvedValue(sedeMock),
      },
      pagoNomina: {
        create: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Prisma.PagoNominaUncheckedCreateInput }) =>
              Promise.resolve({
                id: 'pago-1',
                ...data,
                fechaPago: data.fechaPago || new Date('2026-11-04T12:00:00Z'),
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

    service = new NominaService(
      prisma as unknown as PrismaService,
      negociosService as unknown as NegociosService,
    );
  });

  describe('Criterio 1: Los 3 campos de la especificación son obligatorios', () => {
    it('debe registrar un pago de nómina cuando los 3 campos son válidos', async () => {
      const dto: CreatePagoNominaDto = {
        nombreTrabajador: 'María Gómez',
        porcentajePago: 75,
        montoExacto: 1800000,
        sedeId: 'sede-1',
      };

      const resultado = await service.create('user-1', 'CLIENTE', dto);

      expect(resultado).toBeDefined();
      expect(resultado.nombreTrabajador).toBe('María Gómez');
      expect(prisma.pagoNomina.create).toHaveBeenCalled();
      const callData = (
        prisma.pagoNomina.create.mock.calls[0] as [
          { data: Prisma.PagoNominaUncheckedCreateInput },
        ]
      )[0].data;
      expect(callData.nombreTrabajador).toBe('María Gómez');
      expect(callData.sedeId).toBe('sede-1');
      expect(negociosService.verificarAccesoSede).toHaveBeenCalledWith(
        'user-1',
        sedeMock,
        'CLIENTE',
        { escritura: true },
      );
    });

    it('debe rechazar la creación si falta el nombre del trabajador', async () => {
      const dto = {
        porcentajePago: 75,
        montoExacto: 1800000,
        sedeId: 'sede-1',
      } as unknown as CreatePagoNominaDto;

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar la creación si el nombre del trabajador está compuesto solo de espacios', async () => {
      const dto: CreatePagoNominaDto = {
        nombreTrabajador: '    ',
        porcentajePago: 75,
        montoExacto: 1800000,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar la creación si falta el porcentaje de pago', async () => {
      const dto = {
        nombreTrabajador: 'María Gómez',
        montoExacto: 1800000,
        sedeId: 'sede-1',
      } as unknown as CreatePagoNominaDto;

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('debe rechazar la creación si falta el monto exacto', async () => {
      const dto = {
        nombreTrabajador: 'María Gómez',
        porcentajePago: 75,
        sedeId: 'sede-1',
      } as unknown as CreatePagoNominaDto;

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Criterio 2: Porcentaje entre 0 y 100; monto > 0', () => {
    it('debe aceptar porcentaje de pago 0 y 100', async () => {
      const dto1: CreatePagoNominaDto = {
        nombreTrabajador: 'Juan',
        porcentajePago: 0,
        montoExacto: 500000,
        sedeId: 'sede-1',
      };
      const dto2: CreatePagoNominaDto = {
        nombreTrabajador: 'Juan',
        porcentajePago: 100,
        montoExacto: 500000,
        sedeId: 'sede-1',
      };

      await expect(
        service.create('user-1', 'CLIENTE', dto1),
      ).resolves.toBeDefined();
      await expect(
        service.create('user-1', 'CLIENTE', dto2),
      ).resolves.toBeDefined();
    });

    it('debe rechazar porcentaje de pago menor a 0', async () => {
      const dto: CreatePagoNominaDto = {
        nombreTrabajador: 'Juan',
        porcentajePago: -1,
        montoExacto: 500000,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        'El porcentaje de pago debe ser un número entre 0 y 100',
      );
    });

    it('debe rechazar porcentaje de pago mayor a 100', async () => {
      const dto: CreatePagoNominaDto = {
        nombreTrabajador: 'Juan',
        porcentajePago: 100.5,
        montoExacto: 500000,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        'El porcentaje de pago debe ser un número entre 0 y 100',
      );
    });

    it('debe rechazar monto exacto igual a 0', async () => {
      const dto: CreatePagoNominaDto = {
        nombreTrabajador: 'Juan',
        porcentajePago: 50,
        montoExacto: 0,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        'El monto exacto debe ser un número mayor a 0',
      );
    });

    it('debe rechazar monto exacto menor a 0', async () => {
      const dto: CreatePagoNominaDto = {
        nombreTrabajador: 'Juan',
        porcentajePago: 50,
        montoExacto: -1000,
        sedeId: 'sede-1',
      };

      await expect(service.create('user-1', 'CLIENTE', dto)).rejects.toThrow(
        'El monto exacto debe ser un número mayor a 0',
      );
    });
  });

  describe('Criterio 3: Consulta de pagos registrados por trabajador', () => {
    it('debe consultar todos los pagos con filtro de sedes visibles', async () => {
      const mockPagos = [
        {
          id: 'pago-1',
          nombreTrabajador: 'Carlos Pérez',
          porcentajePago: new Prisma.Decimal(50),
          montoExacto: new Prisma.Decimal(1000000),
          fechaPago: new Date(),
        },
      ];
      prisma.pagoNomina.findMany.mockResolvedValue(mockPagos);

      const res = await service.findAll('user-1', 'CLIENTE', {
        sedeId: 'sede-1',
      });

      expect(res).toEqual(mockPagos);
      expect(negociosService.filtroDeSedes).toHaveBeenCalledWith(
        'user-1',
        'CLIENTE',
        'sede-1',
      );
      expect(prisma.pagoNomina.findMany).toHaveBeenCalledWith({
        where: { sedeId: { in: ['sede-1'] } },
        orderBy: { fechaPago: 'desc' },
      });
    });

    it('debe filtrar los pagos por nombre del trabajador', async () => {
      await service.findAll('user-1', 'CLIENTE', {
        sedeId: 'sede-1',
        trabajador: 'Carlos',
      });

      expect(prisma.pagoNomina.findMany).toHaveBeenCalledWith({
        where: {
          sedeId: { in: ['sede-1'] },
          nombreTrabajador: { contains: 'Carlos', mode: 'insensitive' },
        },
        orderBy: { fechaPago: 'desc' },
      });
    });

    it('debe permitir consultar directamente mediante findByTrabajador', async () => {
      await service.findByTrabajador(
        'user-1',
        'CLIENTE',
        'Ana Torres',
        'sede-1',
      );

      expect(prisma.pagoNomina.findMany).toHaveBeenCalledWith({
        where: {
          sedeId: { in: ['sede-1'] },
          nombreTrabajador: { contains: 'Ana Torres', mode: 'insensitive' },
        },
        orderBy: { fechaPago: 'desc' },
      });
    });

    it('debe consultar un pago individual por id', async () => {
      const mockPago = {
        id: 'pago-1',
        nombreTrabajador: 'Carlos',
        sedeId: 'sede-1',
      };
      prisma.pagoNomina.findUnique.mockResolvedValue(mockPago);

      const res = await service.findOne('pago-1', 'user-1', 'CLIENTE');

      expect(res).toEqual(mockPago);
      expect(negociosService.verificarAccesoSede).toHaveBeenCalledWith(
        'user-1',
        sedeMock,
        'CLIENTE',
        {},
      );
    });

    it('debe lanzar NotFoundException si el pago no existe', async () => {
      prisma.pagoNomina.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('pago-inexistente', 'user-1', 'CLIENTE'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
