import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

export interface PoolConfig {
  connectionLimit: number;
  poolTimeout: number;
  connectTimeout: number;
  slowQueryThresholdMs: number;
  isPgbouncer: boolean;
}

@Injectable()
export class PrismaService
  extends PrismaClient<
    Prisma.PrismaClientOptions,
    'query' | 'error' | 'warn' | 'info'
  >
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly poolConfig: PoolConfig;

  constructor() {
    const { url, config } = PrismaService.buildPoolUrl(
      process.env.DATABASE_URL,
    );

    super({
      datasources: url ? { db: { url } } : undefined,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });

    this.poolConfig = config;
    this.configurarMonitoreo();
  }

  /**
   * Construye una URL de conexión de base de datos optimizada para el pool de conexiones.
   * Configura connection_limit, pool_timeout y connect_timeout respetando la configuración
   * del entorno y detectando soporte para endpoints serverless/PgBouncer (Neon).
   */
  static buildPoolUrl(rawUrl?: string): { url?: string; config: PoolConfig } {
    const connectionLimit = parseInt(
      process.env.DATABASE_POOL_SIZE || process.env.DB_CONNECTION_LIMIT || '15',
      10,
    );
    const poolTimeout = parseInt(process.env.DB_POOL_TIMEOUT || '20', 10);
    const connectTimeout = parseInt(process.env.DB_CONNECT_TIMEOUT || '15', 10);
    const slowQueryThresholdMs = parseInt(
      process.env.SLOW_QUERY_THRESHOLD_MS || '250',
      10,
    );

    if (!rawUrl) {
      return {
        url: undefined,
        config: {
          connectionLimit,
          poolTimeout,
          connectTimeout,
          slowQueryThresholdMs,
          isPgbouncer: false,
        },
      };
    }

    try {
      // Usar URL parser nativo para manipular parámetros de búsqueda
      const parsedUrl = new URL(rawUrl);
      const isNeonPooler =
        parsedUrl.hostname.includes('-pooler') || parsedUrl.port === '6543';

      if (!parsedUrl.searchParams.has('connection_limit')) {
        parsedUrl.searchParams.set(
          'connection_limit',
          connectionLimit.toString(),
        );
      }
      if (!parsedUrl.searchParams.has('pool_timeout')) {
        parsedUrl.searchParams.set('pool_timeout', poolTimeout.toString());
      }
      if (!parsedUrl.searchParams.has('connect_timeout')) {
        parsedUrl.searchParams.set(
          'connect_timeout',
          connectTimeout.toString(),
        );
      }
      if (isNeonPooler && !parsedUrl.searchParams.has('pgbouncer')) {
        parsedUrl.searchParams.set('pgbouncer', 'true');
      }

      const activeConnectionLimit = parseInt(
        parsedUrl.searchParams.get('connection_limit') ||
          connectionLimit.toString(),
        10,
      );
      const activePoolTimeout = parseInt(
        parsedUrl.searchParams.get('pool_timeout') || poolTimeout.toString(),
        10,
      );
      const activeConnectTimeout = parseInt(
        parsedUrl.searchParams.get('connect_timeout') ||
          connectTimeout.toString(),
        10,
      );
      const isPgbouncer = parsedUrl.searchParams.get('pgbouncer') === 'true';

      return {
        url: parsedUrl.toString(),
        config: {
          connectionLimit: activeConnectionLimit,
          poolTimeout: activePoolTimeout,
          connectTimeout: activeConnectTimeout,
          slowQueryThresholdMs,
          isPgbouncer,
        },
      };
    } catch {
      // Si la URL no es válida para el parser de URL estándar, devolver rawUrl con defaults
      return {
        url: rawUrl,
        config: {
          connectionLimit,
          poolTimeout,
          connectTimeout,
          slowQueryThresholdMs,
          isPgbouncer: false,
        },
      };
    }
  }

  private configurarMonitoreo() {
    // Escuchar eventos de consultas para detectar consultas lentas (slow queries)
    this.$on('query', (e: Prisma.QueryEvent) => {
      if (e.duration >= this.poolConfig.slowQueryThresholdMs) {
        this.logger.warn(
          `[Slow Query] ${e.duration}ms | Target: ${e.target} | Query: ${e.query.slice(0, 150)}...`,
        );
      }
    });
  }

  async onModuleInit() {
    this.logger.log(
      `Inicializando pool de conexiones Prisma (límite: ${this.poolConfig.connectionLimit}, timeout: ${this.poolConfig.poolTimeout}s, connectTimeout: ${this.poolConfig.connectTimeout}s)`,
    );
    await this.$connect();
  }

  async onModuleDestroy() {
    this.logger.log('Cerrando ordenadamente conexiones del pool Prisma...');
    await this.$disconnect();
  }

  /**
   * Obtiene la configuración activa del pool de conexiones.
   */
  getPoolConfig(): PoolConfig {
    return { ...this.poolConfig };
  }

  /**
   * Health check de conectividad y latencia hacia el pool de la base de datos.
   */
  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
      this.logger.error('Error en health check del pool:', error);
      return { ok: false, latencyMs: Date.now() - start };
    }
  }
}
