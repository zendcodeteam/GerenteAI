import { PrismaService } from './prisma.service';

describe('PrismaService - Pool de conexiones', () => {
  const envOriginal = process.env;

  beforeEach(() => {
    process.env = { ...envOriginal };
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  describe('buildPoolUrl', () => {
    it('debe aplicar parámetros de pool por defecto si la URL no los tiene', () => {
      const rawUrl = 'postgresql://user:pass@localhost:5432/mydb?schema=public';
      const { url, config } = PrismaService.buildPoolUrl(rawUrl);

      expect(url).toBeDefined();
      expect(url).toContain('connection_limit=15');
      expect(url).toContain('pool_timeout=20');
      expect(url).toContain('connect_timeout=15');
      expect(config.connectionLimit).toBe(15);
      expect(config.poolTimeout).toBe(20);
      expect(config.connectTimeout).toBe(15);
      expect(config.isPgbouncer).toBe(false);
    });

    it('debe respetar las variables de entorno de pool personalizadas', () => {
      process.env.DATABASE_POOL_SIZE = '25';
      process.env.DB_POOL_TIMEOUT = '30';
      process.env.DB_CONNECT_TIMEOUT = '10';

      const rawUrl = 'postgresql://user:pass@localhost:5432/mydb';
      const { url, config } = PrismaService.buildPoolUrl(rawUrl);

      expect(url).toContain('connection_limit=25');
      expect(url).toContain('pool_timeout=30');
      expect(url).toContain('connect_timeout=10');
      expect(config.connectionLimit).toBe(25);
      expect(config.poolTimeout).toBe(30);
      expect(config.connectTimeout).toBe(10);
    });

    it('debe respetar los parámetros ya presentes en la URL si existen', () => {
      const rawUrl =
        'postgresql://user:pass@localhost:5432/mydb?connection_limit=8&pool_timeout=45';
      const { url, config } = PrismaService.buildPoolUrl(rawUrl);

      expect(url).toContain('connection_limit=8');
      expect(url).toContain('pool_timeout=45');
      expect(config.connectionLimit).toBe(8);
      expect(config.poolTimeout).toBe(45);
    });

    it('debe habilitar pgbouncer=true cuando detecta un host de Neon con pooler', () => {
      const rawUrl =
        'postgresql://user:pass@ep-odd-violet-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';
      const { url, config } = PrismaService.buildPoolUrl(rawUrl);

      expect(url).toContain('pgbouncer=true');
      expect(config.isPgbouncer).toBe(true);
    });

    it('debe habilitar pgbouncer=true cuando el puerto es 6543 (PgBouncer)', () => {
      const rawUrl =
        'postgresql://user:pass@ep-odd-violet.neon.tech:6543/neondb';
      const { url, config } = PrismaService.buildPoolUrl(rawUrl);

      expect(url).toContain('pgbouncer=true');
      expect(config.isPgbouncer).toBe(true);
    });

    it('debe manejar gracefully URLs nulas o indefinidas', () => {
      const { url, config } = PrismaService.buildPoolUrl(undefined);
      expect(url).toBeUndefined();
      expect(config.connectionLimit).toBe(15);
    });
  });

  describe('Instancia de PrismaService', () => {
    it('debe instanciarse correctamente y exponer getPoolConfig', () => {
      const service = new PrismaService();
      const config = service.getPoolConfig();

      expect(config).toBeDefined();
      expect(typeof config.connectionLimit).toBe('number');
      expect(typeof config.poolTimeout).toBe('number');
      expect(typeof config.connectTimeout).toBe('number');
    });
  });
});
