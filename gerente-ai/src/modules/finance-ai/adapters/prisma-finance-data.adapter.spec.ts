import { PrismaFinanceDataAdapter } from './prisma-finance-data.adapter';
import { PrismaService } from '../../../services/prisma.service';

type MockFn = jest.Mock;

interface MockPrisma {
  venta: {
    findFirst: MockFn;
    updateMany: MockFn;
    deleteMany: MockFn;
  };
  gasto: {
    findFirst: MockFn;
    updateMany: MockFn;
    deleteMany: MockFn;
  };
  cliente: {
    update: MockFn;
  };
  bitacoraAuditoria: {
    create: MockFn;
    findMany: MockFn;
  };
  $transaction: MockFn;
}

interface AuditCreatePayload {
  data: {
    sedeId: string;
    usuarioId: string | null;
    operacion: string;
    entidad: string;
    entidadId: string;
    valorAnterior: Record<string, unknown>;
    valorNuevo?: unknown;
    motivo: string;
  };
}

describe('PrismaFinanceDataAdapter - Bitácora de Auditoría', () => {
  let adapter: PrismaFinanceDataAdapter;
  let prismaMock: MockPrisma;

  beforeEach(() => {
    prismaMock = {
      venta: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      gasto: {
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      cliente: {
        update: jest.fn().mockResolvedValue({}),
      },
      bitacoraAuditoria: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest
        .fn()
        .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    adapter = new PrismaFinanceDataAdapter(
      prismaMock as unknown as PrismaService,
    );
  });

  describe('deleteTransaction', () => {
    it('debe registrar en bitácora de auditoría el snapshot antes de borrar', async () => {
      const ventaMock = {
        id: 'tx-venta-123',
        sedeId: 'sede-1',
        total: 50000,
        descripcion: 'Venta mostrador',
        tipo: 'CONTADO',
        saldoPendiente: 0,
      };

      prismaMock.venta.findFirst.mockResolvedValue(ventaMock);
      prismaMock.gasto.findFirst.mockResolvedValue(null);

      const res = await adapter.deleteTransaction(
        'sede-1',
        'tx-venta-123',
        'usuario-admin',
      );

      expect(res).toBe(true);
      expect(prismaMock.bitacoraAuditoria.create).toHaveBeenCalledTimes(1);

      const firstCallArgs = prismaMock.bitacoraAuditoria.create.mock
        .calls[0] as [AuditCreatePayload];
      const auditData = firstCallArgs[0].data;

      expect(auditData).toMatchObject({
        sedeId: 'sede-1',
        usuarioId: 'usuario-admin',
        operacion: 'ELIMINACION',
        entidad: 'Venta',
        entidadId: 'tx-venta-123',
        valorAnterior: {
          id: 'tx-venta-123',
          total: 50000,
        },
        motivo: 'deleteTransaction',
      });
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('debe retornar false si el movimiento no existe y no registrar auditoría', async () => {
      prismaMock.venta.findFirst.mockResolvedValue(null);
      prismaMock.gasto.findFirst.mockResolvedValue(null);

      const res = await adapter.deleteTransaction('sede-1', 'no-existe');

      expect(res).toBe(false);
      expect(prismaMock.bitacoraAuditoria.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTransaction', () => {
    it('debe registrar en bitácora de auditoría el valor anterior y el nuevo al corregir', async () => {
      const gastoMock = {
        id: 'tx-gasto-123',
        sedeId: 'sede-1',
        monto: 30000,
        descripcion: 'Almuerzo',
      };

      prismaMock.venta.findFirst.mockResolvedValue(null);
      prismaMock.gasto.findFirst.mockResolvedValue(gastoMock);
      prismaMock.venta.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.gasto.updateMany.mockResolvedValue({ count: 1 });
      jest
        .spyOn(
          adapter as unknown as { findTransaction: () => Promise<unknown> },
          'findTransaction',
        )
        .mockResolvedValue({
          id: 'tx-gasto-123',
          businessId: 'sede-1',
          amount: 35000,
        });

      await adapter.updateTransaction(
        'sede-1',
        'tx-gasto-123',
        { amount: 35000, description: 'Almuerzo ejecutivo' },
        'actor-wp-57300',
      );

      expect(prismaMock.bitacoraAuditoria.create).toHaveBeenCalledTimes(1);

      const firstCallArgs = prismaMock.bitacoraAuditoria.create.mock
        .calls[0] as [AuditCreatePayload];
      const auditData = firstCallArgs[0].data;

      expect(auditData).toMatchObject({
        sedeId: 'sede-1',
        usuarioId: 'actor-wp-57300',
        operacion: 'ACTUALIZACION',
        entidad: 'Gasto',
        entidadId: 'tx-gasto-123',
        valorAnterior: {
          id: 'tx-gasto-123',
          monto: 30000,
        },
        valorNuevo: { amount: 35000, description: 'Almuerzo ejecutivo' },
        motivo: 'updateTransaction',
      });
    });
  });
});
