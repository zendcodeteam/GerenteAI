import { RetencionMensajesService } from './retencion-mensajes.service';
import { PrismaService } from './prisma.service';

describe('RetencionMensajesService', () => {
  let service: RetencionMensajesService;
  let prismaMock: {
    mensaje: {
      deleteMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      mensaje: {
        deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
    };

    service = new RetencionMensajesService(prismaMock as unknown as PrismaService);
  });

  describe('calcularFechaLimite', () => {
    it('debe restar exactamente 12 meses por defecto', () => {
      const ahora = new Date('2026-09-19T10:00:00.000Z');
      const limite = service.calcularFechaLimite(12, ahora);

      expect(limite.toISOString()).toBe('2025-09-19T10:00:00.000Z');
    });

    it('debe permitir un plazo personalizado en meses', () => {
      const ahora = new Date('2026-09-19T10:00:00.000Z');
      const limite = service.calcularFechaLimite(6, ahora);

      expect(limite.toISOString()).toBe('2026-03-19T10:00:00.000Z');
    });
  });

  describe('purgarMensajes', () => {
    it('debe invocar deleteMany con el filtro lt sobre fecha', async () => {
      const ahora = new Date('2026-09-19T10:00:00.000Z');
      const resultado = await service.purgarMensajes(12, ahora);

      expect(resultado.eliminados).toBe(5);
      expect(resultado.mesesRetencion).toBe(12);
      expect(resultado.fechaLimite.toISOString()).toBe('2025-09-19T10:00:00.000Z');

      expect(prismaMock.mensaje.deleteMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.mensaje.deleteMany).toHaveBeenCalledWith({
        where: {
          fecha: {
            lt: new Date('2025-09-19T10:00:00.000Z'),
          },
        },
      });
    });
  });

  describe('porCron', () => {
    it('debe ejecutar la purga correctamente dentro del cron', async () => {
      const spy = jest.spyOn(service, 'purgarMensajes');
      await service.porCron();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
