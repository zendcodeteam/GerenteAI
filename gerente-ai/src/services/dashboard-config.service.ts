import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { UpsertDashboardConfigDto } from '../dto/dashboard-config/upsert-dashboard-config.dto';

@Injectable()
export class DashboardConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negocios: NegociosService,
  ) {}

  async findAll(userId: string, rolGlobal: string, sedeId?: string) {
    const sedeFilter = await this.negocios.filtroDeSedes(userId, rolGlobal, sedeId);
    return this.prisma.dashboardConfig.findMany({
      where: { sedeId: sedeFilter },
      orderBy: { clave: 'asc' },
    });
  }

  async upsert(
    userId: string,
    rolGlobal: string,
    dto: UpsertDashboardConfigDto,
  ) {
    const sede = dto.sedeId
      ? await this.prisma.sede.findUnique({ where: { id: dto.sedeId } })
      : null;

    if (dto.sedeId && !sede) {
      throw new NotFoundException('La sede indicada no existe');
    }

    if (sede) {
      await this.negocios.verificarAccesoSede(userId, sede, rolGlobal, {
        escritura: true,
      });
    }

    if (!sede) {
      const visibles = await this.negocios.sedesVisibles(userId, rolGlobal);
      const firstSedeId = Array.isArray(visibles) ? visibles[0] : undefined;
      if (!firstSedeId) {
        throw new NotFoundException('No hay una sede disponible para este negocio');
      }
      const firstSede = await this.prisma.sede.findUnique({ where: { id: firstSedeId } });
      if (!firstSede) throw new NotFoundException('La sede asociada no existe');
      await this.negocios.verificarAccesoSede(userId, firstSede, rolGlobal, {
        escritura: true,
      });
      return this.save(dto, firstSede.negocioId, undefined);
    }

    return this.save(dto, sede.negocioId, sede.id);
  }

  private save(dto: UpsertDashboardConfigDto, negocioId: string, sedeId?: string) {
    const scopeId = sedeId ?? 'all';
    return this.prisma.dashboardConfig.upsert({
      where: {
        negocioId_scopeId_clave: {
          negocioId,
          scopeId,
          clave: dto.clave,
        },
      },
      create: {
        clave: dto.clave,
        scopeId,
        valor: dto.valor as Prisma.InputJsonValue,
        negocioId,
        sedeId,
      },
      update: { valor: dto.valor as Prisma.InputJsonValue },
    });
  }
}