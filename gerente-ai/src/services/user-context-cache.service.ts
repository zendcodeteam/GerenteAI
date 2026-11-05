import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface CachedUserSession {
  userId: string;
  email?: string;
  rolGlobal?: string;
  passwordChangedAt: Date | null;
  expiresAt: number;
}

export interface CachedSedePermission {
  esDueno: boolean;
  esMiembro: boolean;
  expiresAt: number;
}

export interface CachedSedesVisibles {
  sedes: string[] | null;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  sessionEntries: number;
  permissionEntries: number;
  sedesVisiblesEntries: number;
}

@Injectable()
export class UserContextCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(UserContextCacheService.name);

  // Almacenes en memoria de alta velocidad
  private readonly sessions = new Map<string, CachedUserSession>();
  private readonly sedePermissions = new Map<string, CachedSedePermission>();
  private readonly sedesVisibles = new Map<string, CachedSedesVisibles>();

  // Configuración de TTL (en milisegundos)
  private readonly sessionTtlMs = parseInt(
    process.env.USER_SESSION_CACHE_TTL_MS || '60000',
    10,
  );
  private readonly permissionTtlMs = parseInt(
    process.env.USER_PERMISSION_CACHE_TTL_MS || '60000',
    10,
  );

  // Métricas
  private hits = 0;
  private misses = 0;

  // Temporizador de purga periódica para evitar acumulación de memoria
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.purgeExpired();
    }, 120_000);
    // Permitir que el proceso termine limpiamente si este timer es el único activo
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }

  // ============================================================
  // SESIÓN DEL USUARIO (PASSWORD_CHANGED_AT & ESTADO DE TOKEN)
  // ============================================================

  getUserSession(userId: string): CachedUserSession | null {
    const entry = this.sessions.get(userId);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(userId);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry;
  }

  setUserSession(
    userId: string,
    data: {
      passwordChangedAt: Date | null;
      email?: string;
      rolGlobal?: string;
    },
    ttlMs: number = this.sessionTtlMs,
  ): void {
    this.sessions.set(userId, {
      userId,
      email: data.email,
      rolGlobal: data.rolGlobal,
      passwordChangedAt: data.passwordChangedAt,
      expiresAt: Date.now() + ttlMs,
    });
  }

  // ============================================================
  // SEDES VISIBLES DEL USUARIO
  // ============================================================

  getSedesVisibles(
    userId: string,
    rolGlobal: string,
  ): string[] | null | undefined {
    const key = `${userId}:${rolGlobal}`;
    const entry = this.sedesVisibles.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.sedesVisibles.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.sedes;
  }

  setSedesVisibles(
    userId: string,
    rolGlobal: string,
    sedes: string[] | null,
    ttlMs: number = this.permissionTtlMs,
  ): void {
    const key = `${userId}:${rolGlobal}`;
    this.sedesVisibles.set(key, {
      sedes,
      expiresAt: Date.now() + ttlMs,
    });
  }

  // ============================================================
  // PERMISOS DE SEDE (DUEÑO / MIEMBRO)
  // ============================================================

  getSedePermission(
    userId: string,
    sedeId: string,
  ): CachedSedePermission | undefined {
    const key = `${userId}:${sedeId}`;
    const entry = this.sedePermissions.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.sedePermissions.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry;
  }

  setSedePermission(
    userId: string,
    sedeId: string,
    permissions: { esDueno: boolean; esMiembro: boolean },
    ttlMs: number = this.permissionTtlMs,
  ): void {
    const key = `${userId}:${sedeId}`;
    this.sedePermissions.set(key, {
      ...permissions,
      expiresAt: Date.now() + ttlMs,
    });
  }

  // ============================================================
  // INVALIDACIÓN DE CACHÉ
  // ============================================================

  /**
   * Invalida de inmediato todos los datos en caché de un usuario
   * (por ejemplo, al cambiar contraseña, revocar tokens o actualizar roles).
   */
  invalidateUser(userId: string): void {
    this.sessions.delete(userId);

    // Invalidar sedes visibles
    for (const key of this.sedesVisibles.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.sedesVisibles.delete(key);
      }
    }

    // Invalidar permisos de sede de este usuario
    for (const key of this.sedePermissions.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.sedePermissions.delete(key);
      }
    }
  }

  /**
   * Invalida los permisos en caché relacionados con una sede específica.
   */
  invalidateSede(sedeId: string): void {
    for (const [key] of this.sedePermissions.entries()) {
      if (key.endsWith(`:${sedeId}`)) {
        this.sedePermissions.delete(key);
      }
    }
    // Como las sedes visibles de los usuarios pudieron cambiar, se limpian
    this.sedesVisibles.clear();
  }

  /**
   * Limpia toda la memoria de caché.
   */
  clear(): void {
    this.sessions.clear();
    this.sedePermissions.clear();
    this.sedesVisibles.clear();
    this.hits = 0;
    this.misses = 0;
  }

  // ============================================================
  // DIAGNÓSTICO Y MÉTRICAS
  // ============================================================

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio: total === 0 ? 0 : Number((this.hits / total).toFixed(4)),
      sessionEntries: this.sessions.size,
      permissionEntries: this.sedePermissions.size,
      sedesVisiblesEntries: this.sedesVisibles.size,
    };
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions.entries()) {
      if (now > s.expiresAt) this.sessions.delete(id);
    }
    for (const [k, p] of this.sedePermissions.entries()) {
      if (now > p.expiresAt) this.sedePermissions.delete(k);
    }
    for (const [k, v] of this.sedesVisibles.entries()) {
      if (now > v.expiresAt) this.sedesVisibles.delete(k);
    }
  }
}
