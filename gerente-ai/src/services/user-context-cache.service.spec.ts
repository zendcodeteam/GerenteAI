import { UserContextCacheService } from './user-context-cache.service';

describe('UserContextCacheService', () => {
  let cache: UserContextCacheService;

  beforeEach(() => {
    cache = new UserContextCacheService();
  });

  afterEach(() => {
    cache.onModuleDestroy();
  });

  describe('Caché de sesión de usuario', () => {
    it('debe almacenar y recuperar la sesión de un usuario', () => {
      const fecha = new Date('2026-11-04T12:00:00Z');
      cache.setUserSession('user-1', {
        passwordChangedAt: fecha,
        email: 'test@example.com',
        rolGlobal: 'CLIENTE',
      });

      const session = cache.getUserSession('user-1');
      expect(session).toBeDefined();
      expect(session?.userId).toBe('user-1');
      expect(session?.passwordChangedAt).toEqual(fecha);
      expect(session?.email).toBe('test@example.com');
      expect(session?.rolGlobal).toBe('CLIENTE');
    });

    it('debe retornar null cuando la sesión no existe en caché', () => {
      const session = cache.getUserSession('user-inexistente');
      expect(session).toBeNull();
    });

    it('debe retornar null cuando la sesión ha expirado su TTL', () => {
      // Guardar con TTL negativo para simular expiración inmediata
      cache.setUserSession('user-expirado', { passwordChangedAt: null }, -1000);

      const session = cache.getUserSession('user-expirado');
      expect(session).toBeNull();
    });
  });

  describe('Caché de sedes visibles', () => {
    it('debe almacenar y recuperar la lista de sedes visibles', () => {
      cache.setSedesVisibles('user-1', 'CLIENTE', ['sede-1', 'sede-2']);

      const sedes = cache.getSedesVisibles('user-1', 'CLIENTE');
      expect(sedes).toEqual(['sede-1', 'sede-2']);
    });

    it('debe soportar null para roles MASTER', () => {
      cache.setSedesVisibles('user-master', 'MASTER', null);

      const sedes = cache.getSedesVisibles('user-master', 'MASTER');
      expect(sedes).toBeNull();
    });

    it('debe retornar undefined si no hay entrada en caché o si expiró', () => {
      expect(cache.getSedesVisibles('user-nuevo', 'CLIENTE')).toBeUndefined();

      cache.setSedesVisibles('user-exp', 'CLIENTE', ['sede-1'], -100);
      expect(cache.getSedesVisibles('user-exp', 'CLIENTE')).toBeUndefined();
    });
  });

  describe('Caché de permisos sobre sede', () => {
    it('debe almacenar y recuperar permisos de dueño o miembro', () => {
      cache.setSedePermission('user-1', 'sede-1', {
        esDueno: true,
        esMiembro: false,
      });

      const perm = cache.getSedePermission('user-1', 'sede-1');
      expect(perm).toBeDefined();
      expect(perm?.esDueno).toBe(true);
      expect(perm?.esMiembro).toBe(false);
    });

    it('debe retornar undefined si no existen permisos en caché', () => {
      expect(cache.getSedePermission('user-x', 'sede-y')).toBeUndefined();
    });
  });

  describe('Invalidación granular', () => {
    it('debe invalidar toda la información de un usuario al invocar invalidateUser', () => {
      cache.setUserSession('user-1', { passwordChangedAt: new Date() });
      cache.setSedesVisibles('user-1', 'CLIENTE', ['sede-1']);
      cache.setSedePermission('user-1', 'sede-1', {
        esDueno: true,
        esMiembro: false,
      });

      cache.invalidateUser('user-1');

      expect(cache.getUserSession('user-1')).toBeNull();
      expect(cache.getSedesVisibles('user-1', 'CLIENTE')).toBeUndefined();
      expect(cache.getSedePermission('user-1', 'sede-1')).toBeUndefined();
    });

    it('debe invalidar permisos al invocar invalidateSede', () => {
      cache.setSedePermission('user-1', 'sede-1', {
        esDueno: true,
        esMiembro: false,
      });
      cache.setSedePermission('user-2', 'sede-2', {
        esDueno: false,
        esMiembro: true,
      });

      cache.invalidateSede('sede-1');

      expect(cache.getSedePermission('user-1', 'sede-1')).toBeUndefined();
      expect(cache.getSedePermission('user-2', 'sede-2')).toBeDefined();
    });
  });

  describe('Métricas y estadísticas de caché', () => {
    it('debe registrar hits y misses y calcular el ratio correctamente', () => {
      cache.setUserSession('user-1', { passwordChangedAt: null });

      cache.getUserSession('user-1'); // hit
      cache.getUserSession('user-1'); // hit
      cache.getUserSession('user-2'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRatio).toBeCloseTo(0.6667, 3);
      expect(stats.sessionEntries).toBe(1);
    });

    it('debe reiniciar estadísticas al limpiar la caché', () => {
      cache.setUserSession('user-1', { passwordChangedAt: null });
      cache.getUserSession('user-1');
      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sessionEntries).toBe(0);
    });
  });
});
