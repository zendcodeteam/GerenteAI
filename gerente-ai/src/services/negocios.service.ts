import { UserContextCacheService } from './user-context-cache.service';
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from './prisma.service';
import { PlanesService, PLAN_ASISTENTE } from './planes.service';

import { CreateNegocioDto } from '../dto/negocios/create-negocio.dto';
import { UpdateNegocioDto } from '../dto/negocios/update-negocio.dto';

import type { Ciclo } from '../dto/negocios/cambiar-plan.dto';

import { Prisma, Sede } from '@prisma/client';

/** Lo mínimo que hace falta de una sede para resolver permisos y plan. */
export type SedeParaAcceso = Pick<Sede, 'id' | 'negocioId' | 'createdAt'>;

/**
 * Valor que se le pasa a Prisma como `where.sedeId` en un listado:
 * una sede concreta, el conjunto de las visibles,
 * o `undefined` para no filtrar (MASTER).
 */
export type FiltroDeSede = string | { in: string[] } | undefined;

/** Un ciclo mensual son 30 días y uno anual 365. */
function diasDelCiclo(ciclo: Ciclo): number {
  return ciclo === 'anual' ? 365 : 30;
}

@Injectable()
export class NegociosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planes: PlanesService,
    private readonly userCache?: UserContextCacheService,
  ) {}

  // ============================================================
  // CREAR NEGOCIO
  // ============================================================

  // Quien crea el negocio queda como dueño en la misma transacción.
  async create(userId: string, createNegocioDto: CreateNegocioDto) {
    return this.prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.create({
        data: createNegocioDto,
      });

      await tx.usuarioNegocio.create({
        data: {
          usuarioId: userId,
          negocioId: negocio.id,
        },
      });

      // Todo negocio nace con una sede.
      const duenno = await tx.usuario.findUnique({
        where: { id: userId },
        select: { telefono: true },
      });

      const telefono = await this.telefonoLibre(tx, duenno?.telefono);

      const sede = await tx.sede.create({
        data: {
          nombre: 'Sede principal',
          negocioId: negocio.id,
          telefono,
        },
      });

      // El dueño queda también como administrador de esa sede.
      await tx.usuarioSede.create({
        data: {
          usuarioId: userId,
          sedeId: sede.id,
        },
      });

      this.userCache?.invalidateUser(userId);
      return negocio;
    });
  }

  // ============================================================
  // TELÉFONO DE SEDE
  // ============================================================

  private async telefonoLibre(
    tx: Pick<PrismaService, 'sede'>,
    telefono: string | null | undefined,
  ): Promise<string | null> {
    const digitos = (telefono ?? '').replace(/\D/g, '');

    if (!digitos) {
      return null;
    }

    const normalizado = /^3\d{9}$/.test(digitos) ? `57${digitos}` : digitos;

    const ocupado = await tx.sede.findUnique({
      where: { telefono: normalizado },
      select: { id: true },
    });

    return ocupado ? null : normalizado;
  }

  // ============================================================
  // NEGOCIOS
  // ============================================================

  /** Solo los negocios del usuario. MASTER los ve todos. */
  findAll(usuarioId: string, rolGlobal: string) {
    if (rolGlobal === 'MASTER') {
      return this.prisma.negocio.findMany();
    }

    return this.prisma.negocio.findMany({
      where: {
        usuariosNegocio: {
          some: { usuarioId },
        },
      },
    });
  }

  async findOne(id: string, usuarioId: string, rolGlobal: string) {
    const negocio = await this.cargar(id);

    await this.verificarPropietario(usuarioId, id, rolGlobal);

    const estado = this.planes.estado(negocio.plan, negocio.planVenceEl);

    return {
      ...negocio,

      // Plan contratado originalmente.
      plan: negocio.plan,

      // Plan que realmente puede utilizar actualmente.
      planVigente: estado.vigente.id,

      // Indica si el plan contratado ya perdió vigencia.
      planVencido: estado.vencido,

      // Se conserva la fecha original para mostrar información
      // de vencimiento en la interfaz.
      planVenceEl: negocio.planVenceEl,
    };
  }

  /**
   * Carga sin comprobar permisos.
   */
  private async cargar(id: string) {
    const negocio = await this.prisma.negocio.findUnique({
      where: { id },
    });

    if (!negocio) {
      throw new NotFoundException(`Negocio con id ${id} no encontrado`);
    }

    return negocio;
  }

  // ============================================================
  // ACTUALIZAR NEGOCIO
  // ============================================================

  async update(
    id: string,
    userId: string,
    rolGlobal: string,
    updateNegocioDto: UpdateNegocioDto,
  ) {
    await this.cargar(id);

    await this.verificarPropietario(userId, id, rolGlobal);

    return this.prisma.negocio.update({
      where: { id },
      data: updateNegocioDto,
    });
  }

  // ============================================================
  // ELIMINAR NEGOCIO
  // ============================================================

  async remove(id: string, userId: string, rolGlobal: string) {
    await this.cargar(id);

    await this.verificarPropietario(userId, id, rolGlobal);

    return this.prisma.negocio.delete({
      where: { id },
    });
  }

  // ============================================================
  // CAMBIO ADMINISTRATIVO DE PLAN
  // ============================================================

  /**
   * Único punto administrativo donde se cambia el plan
   * a un plan determinado.
   *
   * Los cambios a planes de pago siguen reservados a MASTER.
   */
  async cambiarPlan(
    negocioId: string,
    rolGlobal: string,
    plan: number,
    ciclo: Ciclo = 'mensual',
    venceEl?: Date,
  ) {
    if (rolGlobal !== 'MASTER') {
      throw new ForbiddenException(
        'El cambio a un plan de pago se realiza al confirmarse un pago.',
      );
    }

    return this.activarPlan(negocioId, plan, ciclo, { venceEl });
  }

  // ============================================================
  // BAJAR A PLAN ASISTENTE
  // ============================================================

  /**
   * Permite al propietario bajar voluntariamente su negocio
   * al plan Asistente en cualquier momento.
   *
   * IMPORTANTE:
   *
   * Esto NO es una cancelación de suscripción.
   * NO elimina información.
   * NO elimina el negocio.
   * NO elimina ventas.
   * NO elimina productos.
   * NO elimina clientes.
   * NO elimina sedes.
   * NO realiza reembolsos.
   *
   * El cambio simplemente hace que el plan Asistente sea el plan
   * vigente desde este momento.
   *
   * Si al usuario le quedaban 29 días, 10 días o 2 horas del plan
   * anterior, la decisión es voluntaria y el cambio es inmediato.
   */
  async cambiarAAsistente(
    negocioId: string,
    usuarioId: string,
    rolGlobal: string,
  ) {
    const negocio = await this.cargar(negocioId);

    await this.verificarPropietario(usuarioId, negocioId, rolGlobal);

    // Ya está en Asistente.
    if (negocio.plan === PLAN_ASISTENTE && negocio.planVenceEl === null) {
      return negocio;
    }

    return this.prisma.negocio.update({
      where: {
        id: negocioId,
      },
      data: {
        plan: PLAN_ASISTENTE,
        planVenceEl: null,
      },
    });
  }

  // ============================================================
  // ACTIVAR PLAN
  // ============================================================

  /**
   * Escritura real del plan.
   *
   * NO comprueba permisos: quien llama ya decidió
   * que el cambio procede.
   *
   * `tx` permite que el webhook active el plan y marque el pago
   * como procesado en la misma transacción.
   */
  async activarPlan(
    negocioId: string,
    plan: number,
    ciclo: Ciclo = 'mensual',
    opciones: {
      renovacion?: boolean;
      venceEl?: Date;
      tx?: Prisma.TransactionClient;
    } = {},
  ) {
    const tx = opciones.tx ?? this.prisma;

    const negocio = await tx.negocio.findUnique({
      where: { id: negocioId },
    });

    if (!negocio) {
      throw new NotFoundException(`Negocio con id ${negocioId} no encontrado`);
    }

    return tx.negocio.update({
      where: { id: negocioId },
      data: {
        plan,
        planVenceEl:
          opciones.venceEl && plan !== PLAN_ASISTENTE
            ? opciones.venceEl
            : this.nuevoVencimiento(
                negocio,
                plan,
                ciclo,
                opciones.renovacion ?? false,
              ),
      },
    });
  }

  // ============================================================
  // VENCIMIENTO
  // ============================================================

  /**
   * Renovar el MISMO plan que sigue vigente suma días
   * a los que quedaban; todo lo demás cuenta desde hoy.
   */
  private nuevoVencimiento(
    negocio: {
      plan: number;
      planVenceEl: Date | null;
    },
    plan: number,
    ciclo: Ciclo,
    renovacion: boolean,
  ): Date | null {
    // El plan gratuito no vence.
    if (plan === PLAN_ASISTENTE) {
      return null;
    }

    const ahora = Date.now();
    const vigente = negocio.planVenceEl?.getTime() ?? 0;

    const acumula = renovacion && plan === negocio.plan && vigente > ahora;

    return new Date(
      (acumula ? vigente : ahora) + diasDelCiclo(ciclo) * 86_400_000,
    );
  }

  // ============================================================
  // ESTADO DEL PLAN
  // ============================================================

  async estadoDelPlan(negocioId: string) {
    const negocio = await this.cargar(negocioId);

    return this.planes.estado(negocio.plan, negocio.planVenceEl);
  }

  // ============================================================
  // PROPIETARIO
  // ============================================================

  async verificarPropietario(
    usuarioId: string,
    negocioId: string,
    rolGlobal: string,
  ) {
    if (rolGlobal === 'MASTER') {
      return;
    }

    const relacion = await this.prisma.usuarioNegocio.findUnique({
      where: {
        usuarioId_negocioId: {
          usuarioId,
          negocioId,
        },
      },
    });

    if (!relacion) {
      throw new ForbiddenException('No tienes permisos sobre este negocio');
    }
  }

  // ============================================================
  // SEDES VISIBLES
  // ============================================================

  async sedesVisibles(
    usuarioId: string,
    rolGlobal: string,
  ): Promise<string[] | null> {
    if (rolGlobal === 'MASTER') {
      return null;
    }

    const enCache = this.userCache?.getSedesVisibles(usuarioId, rolGlobal);
    if (enCache !== undefined) {
      return enCache;
    }

    const [porNegocio, porVinculo] = await Promise.all([
      this.prisma.sede.findMany({
        where: {
          negocio: {
            usuariosNegocio: {
              some: { usuarioId },
            },
          },
        },
        select: { id: true },
      }),

      this.prisma.usuarioSede.findMany({
        where: { usuarioId },
        select: { sedeId: true },
      }),
    ]);

    const resultado = [
      ...new Set([
        ...porNegocio.map((sede) => sede.id),
        ...porVinculo.map((vinculo) => vinculo.sedeId),
      ]),
    ];

    this.userCache?.setSedesVisibles(usuarioId, rolGlobal, resultado);
    return resultado;
  }

  // ============================================================
  // FILTRO DE SEDES
  // ============================================================

  async filtroDeSedes(
    usuarioId: string,
    rolGlobal: string,
    sedeId?: string,
  ): Promise<FiltroDeSede> {
    if (sedeId) {
      const sede = await this.prisma.sede.findUnique({
        where: { id: sedeId },
      });

      if (!sede) {
        throw new NotFoundException('La sede indicada no existe');
      }

      await this.verificarAccesoSede(usuarioId, sede, rolGlobal);

      return sedeId;
    }

    const visibles = await this.sedesVisibles(usuarioId, rolGlobal);

    return visibles === null ? undefined : { in: visibles };
  }

  // ============================================================
  // ACCESO A SEDE
  // ============================================================

  async verificarAccesoSede(
    usuarioId: string,
    sede: SedeParaAcceso,
    rolGlobal: string,
    opciones: {
      escritura?: boolean;
    } = {},
  ) {
    if (rolGlobal === 'MASTER') {
      return;
    }

    const permisosCache = this.userCache?.getSedePermission(usuarioId, sede.id);
    let esDuenoDelNegocio = permisosCache?.esDueno;
    let esMiembroDeLaSede = permisosCache?.esMiembro;

    if (permisosCache === undefined) {
      const relacionDueno = await this.prisma.usuarioNegocio.findUnique({
        where: {
          usuarioId_negocioId: {
            usuarioId,
            negocioId: sede.negocioId,
          },
        },
      });
      esDuenoDelNegocio = !!relacionDueno;

      if (esDuenoDelNegocio) {
        esMiembroDeLaSede = false;
      } else {
        const relacionMiembro = await this.prisma.usuarioSede.findUnique({
          where: {
            usuarioId_sedeId: {
              usuarioId,
              sedeId: sede.id,
            },
          },
        });
        esMiembroDeLaSede = !!relacionMiembro;
      }

      this.userCache?.setSedePermission(usuarioId, sede.id, {
        esDueno: esDuenoDelNegocio,
        esMiembro: esMiembroDeLaSede,
      });
    }

    if (!esDuenoDelNegocio && !esMiembroDeLaSede) {
      throw new ForbiddenException('No tienes permisos sobre esta sede');
    }

    if (opciones.escritura) {
      await this.verificarSedeHabilitadaPorPlan(sede);
    }
  }

  // ============================================================
  // SEDES HABILITADAS POR PLAN
  // ============================================================

  private async verificarSedeHabilitadaPorPlan(sede: SedeParaAcceso) {
    const negocio = await this.cargar(sede.negocioId);

    const estado = this.planes.estado(negocio.plan, negocio.planVenceEl);

    const tope = estado.vigente.maxSedes;

    if (tope === Number.POSITIVE_INFINITY) {
      return;
    }

    const habilitadas = await this.prisma.sede.findMany({
      where: {
        negocioId: sede.negocioId,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: tope,
      select: { id: true },
    });

    if (!habilitadas.some((habilitada) => habilitada.id === sede.id)) {
      const motivo = estado.vencido
        ? `El plan ${estado.contratado.nombre} venció, así que solo la primera sede sigue habilitada para registrar información`
        : `El plan ${estado.vigente.nombre} permite operar en ${tope} sede(s)`;

      throw new ForbiddenException(
        `${motivo}. Esta sede queda en solo lectura hasta que se active un plan superior.`,
      );
    }
  }
}
