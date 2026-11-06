import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreatePagoNominaDto } from '../dto/nomina/create-pago-nomina.dto';
import { UpdatePagoNominaDto } from '../dto/nomina/update-pago-nomina.dto';
import { QueryPagoNominaDto } from '../dto/nomina/query-pago-nomina.dto';

@Injectable()
export class NominaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  /**
   * Registra un pago de nómina cumpliendo las reglas de negocio:
   * - Los 3 campos (nombreTrabajador, porcentajePago, montoExacto) son obligatorios.
   * - Porcentaje de pago entre 0 y 100.
   * - Monto exacto > 0.
   */
  async create(userId: string, rolGlobal: string, dto: CreatePagoNominaDto) {
    const nombre = dto.nombreTrabajador?.trim();

    // Criterio 1: Los 3 campos de la especificación son obligatorios
    if (!nombre) {
      throw new BadRequestException('El nombre del trabajador es obligatorio');
    }
    if (dto.porcentajePago === undefined || dto.porcentajePago === null) {
      throw new BadRequestException('El porcentaje de pago es obligatorio');
    }
    if (dto.montoExacto === undefined || dto.montoExacto === null) {
      throw new BadRequestException('El monto exacto es obligatorio');
    }

    // Criterio 2: Porcentaje entre 0 y 100; monto > 0
    if (
      typeof dto.porcentajePago !== 'number' ||
      isNaN(dto.porcentajePago) ||
      dto.porcentajePago < 0 ||
      dto.porcentajePago > 100
    ) {
      throw new BadRequestException(
        'El porcentaje de pago debe ser un número entre 0 y 100',
      );
    }

    if (
      typeof dto.montoExacto !== 'number' ||
      isNaN(dto.montoExacto) ||
      dto.montoExacto <= 0
    ) {
      throw new BadRequestException(
        'El monto exacto debe ser un número mayor a 0',
      );
    }

    if (!dto.sedeId) {
      throw new BadRequestException('La sede es obligatoria');
    }

    const sede = await this.prisma.sede.findUnique({
      where: { id: dto.sedeId },
    });
    if (!sede) {
      throw new NotFoundException('La sede indicada no existe');
    }

    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal, {
      escritura: true,
    });

    let fechaPago: Date | undefined;
    if (dto.fechaPago) {
      const parsed = new Date(dto.fechaPago);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('La fecha de pago no es válida');
      }
      fechaPago = parsed;
    }

    return this.prisma.pagoNomina.create({
      data: {
        nombreTrabajador: nombre,
        porcentajePago: new Prisma.Decimal(dto.porcentajePago),
        montoExacto: new Prisma.Decimal(dto.montoExacto),
        fechaPago,
        sedeId: dto.sedeId,
      },
    });
  }

  /**
   * Criterio 3: Consulta de pagos registrados por trabajador y filtros avanzados.
   */
  async findAll(
    userId: string,
    rolGlobal: string,
    query: QueryPagoNominaDto = {},
  ) {
    const visibles = await this.negociosService.filtroDeSedes(
      userId,
      rolGlobal,
      query.sedeId,
    );

    const where: Prisma.PagoNominaWhereInput = {
      sedeId: visibles,
    };

    const trabajadorTerm = (query.trabajador || query.nombreTrabajador)?.trim();
    if (trabajadorTerm) {
      where.nombreTrabajador = {
        contains: trabajadorTerm,
        mode: 'insensitive',
      };
    }

    if (query.fechaInicio || query.fechaFin) {
      where.fechaPago = {};
      if (query.fechaInicio) {
        where.fechaPago.gte = new Date(query.fechaInicio);
      }
      if (query.fechaFin) {
        where.fechaPago.lte = new Date(query.fechaFin);
      }
    }

    return this.prisma.pagoNomina.findMany({
      where,
      orderBy: { fechaPago: 'desc' },
    });
  }

  /**
   * Consulta directa del historial de pagos acumulados de un trabajador.
   */
  async findByTrabajador(
    userId: string,
    rolGlobal: string,
    nombreTrabajador: string,
    sedeId?: string,
  ) {
    const term = nombreTrabajador?.trim();
    if (!term) {
      throw new BadRequestException('Debe indicar el nombre del trabajador');
    }

    return this.findAll(userId, rolGlobal, {
      sedeId,
      trabajador: term,
    });
  }

  /**
   * Consulta de un pago individual por ID verificando acceso multitenant.
   */
  async findOne(id: string, userId: string, rolGlobal: string) {
    const pago = await this.cargar(id);
    await this.verificarAccesoAlPago(pago.sedeId, userId, rolGlobal);
    return pago;
  }

  async update(
    id: string,
    userId: string,
    rolGlobal: string,
    dto: UpdatePagoNominaDto,
  ) {
    const pago = await this.cargar(id);
    await this.verificarAccesoAlPago(pago.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    const data: Prisma.PagoNominaUpdateInput = {};

    if (dto.nombreTrabajador !== undefined) {
      const nombre = dto.nombreTrabajador.trim();
      if (!nombre) {
        throw new BadRequestException(
          'El nombre del trabajador no puede estar vacío',
        );
      }
      data.nombreTrabajador = nombre;
    }

    if (dto.porcentajePago !== undefined) {
      if (
        typeof dto.porcentajePago !== 'number' ||
        isNaN(dto.porcentajePago) ||
        dto.porcentajePago < 0 ||
        dto.porcentajePago > 100
      ) {
        throw new BadRequestException(
          'El porcentaje de pago debe ser un número entre 0 y 100',
        );
      }
      data.porcentajePago = new Prisma.Decimal(dto.porcentajePago);
    }

    if (dto.montoExacto !== undefined) {
      if (
        typeof dto.montoExacto !== 'number' ||
        isNaN(dto.montoExacto) ||
        dto.montoExacto <= 0
      ) {
        throw new BadRequestException(
          'El monto exacto debe ser un número mayor a 0',
        );
      }
      data.montoExacto = new Prisma.Decimal(dto.montoExacto);
    }

    if (dto.fechaPago !== undefined) {
      const parsed = new Date(dto.fechaPago);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('La fecha de pago no es válida');
      }
      data.fechaPago = parsed;
    }

    return this.prisma.pagoNomina.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string, rolGlobal: string) {
    const pago = await this.cargar(id);
    await this.verificarAccesoAlPago(pago.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    return this.prisma.pagoNomina.delete({ where: { id } });
  }

  private async cargar(id: string) {
    const pago = await this.prisma.pagoNomina.findUnique({
      where: { id },
    });
    if (!pago) {
      throw new NotFoundException(`Pago de nómina con id ${id} no encontrado`);
    }
    return pago;
  }

  private async verificarAccesoAlPago(
    sedeId: string,
    userId: string,
    rolGlobal: string,
    opciones: { escritura?: boolean } = {},
  ) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(
        'La sede asociada a este pago de nómina ya no existe',
      );
    }
    await this.negociosService.verificarAccesoSede(
      userId,
      sede,
      rolGlobal,
      opciones,
    );
  }
}
