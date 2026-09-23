import { ClientesService } from './clientes.service';

describe('ClientesService', () => {
  it('suprime el cliente y desvincula sus movimientos contables en una transaccion', async () => {
    const tx = {
      venta: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      abono: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cliente: {
        delete: jest.fn().mockResolvedValue({ id: 'cliente-1' }),
      },
    };
    const prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cliente-1',
          sedeId: 'sede-1',
        }),
      },
      sede: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sede-1',
          negocioId: 'negocio-1',
        }),
      },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const negociosService = {
      verificarAccesoSede: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ClientesService(prisma as never, negociosService as never);

    await expect(service.remove('cliente-1', 'usuario-1', 'CLIENTE')).resolves.toEqual({
      id: 'cliente-1',
      suprimido: true,
      mensaje:
        'El cliente fue suprimido. Los movimientos contables se conservaron sin datos identificables.',
    });

    expect(tx.venta.updateMany).toHaveBeenCalledWith({
      where: { clienteId: 'cliente-1' },
      data: { clienteId: null },
    });
    expect(tx.abono.updateMany).toHaveBeenCalledWith({
      where: { clienteId: 'cliente-1' },
      data: { clienteId: null },
    });
    expect(tx.cliente.delete).toHaveBeenCalledWith({
      where: { id: 'cliente-1' },
    });
    expect(negociosService.verificarAccesoSede).toHaveBeenCalledWith(
      'usuario-1',
      { id: 'sede-1', negocioId: 'negocio-1' },
      'CLIENTE',
      { escritura: true },
    );
  });
});
