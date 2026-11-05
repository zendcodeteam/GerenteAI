import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../services/prisma.service';
import { UserContextCacheService } from '../../services/user-context-cache.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

describe('JwtStrategy con Caché de Sesión', () => {
  let strategy: JwtStrategy;
  let prismaMock: { usuario: { findUnique: jest.Mock } };
  let cache: UserContextCacheService;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-super-secure';
    prismaMock = {
      usuario: {
        findUnique: jest.fn(),
      },
    };
    cache = new UserContextCacheService();

    strategy = new JwtStrategy(prismaMock as unknown as PrismaService, cache);
  });

  afterEach(() => {
    cache.onModuleDestroy();
  });

  const basePayload: JwtPayload = {
    sub: 'user-uuid-1',
    negocioId: 'negocio-uuid-1',
    role: 'ADMIN',
    rolGlobal: 'CLIENTE',
    type: 'session',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  it('debe rechazar tokens que no son de tipo session', async () => {
    const invalidPayload = { ...basePayload, type: 'password-reset' as const };
    await expect(strategy.validate(invalidPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe consultar la BD en la primera llamada y cachear la sesión', async () => {
    const usuarioMock = {
      passwordChangedAt: null,
      email: 'user@example.com',
      rolGlobal: 'CLIENTE',
    };
    prismaMock.usuario.findUnique.mockResolvedValue(usuarioMock);

    const user = await strategy.validate(basePayload);

    expect(user).toBeDefined();
    expect(user.userId).toBe('user-uuid-1');
    expect(prismaMock.usuario.findUnique).toHaveBeenCalledTimes(1);

    // Segunda llamada inmediata: debe responder desde la caché sin consultar la BD
    const user2 = await strategy.validate(basePayload);
    expect(user2).toEqual(user);
    expect(prismaMock.usuario.findUnique).toHaveBeenCalledTimes(1); // Sigue en 1
  });

  it('debe invalidar la sesión y rechazar token si la contraseña fue cambiada después de emitirlo', async () => {
    // Token emitido hace 100 segundos
    const oldPayload: JwtPayload = {
      ...basePayload,
      iat: Math.floor(Date.now() / 1000) - 100,
    };

    // Contraseña cambiada hace 10 segundos
    prismaMock.usuario.findUnique.mockResolvedValue({
      passwordChangedAt: new Date(Date.now() - 10000),
    });

    await expect(strategy.validate(oldPayload)).rejects.toThrow(
      'Tu contraseña cambió: inicia sesión de nuevo',
    );
  });

  it('debe lanzar UnauthorizedException si la cuenta ya no existe en BD', async () => {
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      'La cuenta ya no existe',
    );
  });
});
