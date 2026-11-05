import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoDeudaProveedor,
  ModalidadDeudaProveedor,
  Prisma,
} from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreateDeudaProveedorDto } from '../dto/deudas-proveedores/create-deuda-proveedor.dto';
import { UpdateDeudaProveedorDto } from '../dto/deudas-proveedores/update-deuda-proveedor.dto';

@Injectable()
export class DeudasProveedoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  async create(
    userId: string,
    rolGlobal: string,
    dto: CreateDeudaProveedorDto,
  ) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: dto.sedeId },
    });
    if (!sede) {
      throw new NotFoundException('La sede indicada no existe');
    }

    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal, {
      escritura: true,
    });

    const proveedor = await this.prisma.proveedor.findUnique({
      where: { id: dto.proveedorId },
    });
    if (!proveedor) {
      throw new NotFoundException('El proveedor indicado no existe');
    }
    if (proveedor.sedeId !== dto.sedeId) {
      throw new BadRequestException(
        'El proveedor no pertenece a la sede especificada',
      );
    }

    // Criterios de aceptación
    this.validarReglasDeuda(
      dto.modalidad,
      dto.numeroCuotas,
      dto.aplicaInteres,
      dto.porcentajeInteres,
    );

    return this.prisma.deudaProveedor.create({
      data: {
        proveedorId: dto.proveedorId,
        sedeId: dto.sedeId,
        suministro: dto.suministro.trim(),
        montoTotal: new Prisma.Decimal(dto.montoTotal),
        fechaLimite: new Date(dto.fechaLimite),
        modalidad: dto.modalidad,
        numeroCuotas:
          dto.modalidad === ModalidadDeudaProveedor.CUOTAS
            ? dto.numeroCuotas
            : null,
        aplicaInteres: dto.aplicaInteres,
        porcentajeInteres: dto.aplicaInteres
          ? new Prisma.Decimal(dto.porcentajeInteres!)
          : null,
        estado: dto.estado ?? EstadoDeudaProveedor.PENDIENTE,
      },
      include: {
        proveedor: true,
      },
    });
  }

  async findAll(
    userId: string,
    rolGlobal: string,
    sedeId?: string,
    proveedorId?: string,
  ) {
    const visibles = await this.negociosService.filtroDeSedes(
      userId,
      rolGlobal,
      sedeId,
    );

    return this.prisma.deudaProveedor.findMany({
      where: {
        sedeId: visibles,
        ...(proveedorId ? { proveedorId } : {}),
      },
      include: {
        proveedor: true,
      },
      orderBy: { fechaLimite: 'asc' },
    });
  }

  async findOne(id: string, userId: string, rolGlobal: string) {
    const deuda = await this.cargar(id);
    await this.verificarAccesoADeuda(deuda.sedeId, userId, rolGlobal);
    return deuda;
  }

  async update(
    id: string,
    userId: string,
    rolGlobal: string,
    dto: UpdateDeudaProveedorDto,
  ) {
    const deuda = await this.cargar(id);
    await this.verificarAccesoADeuda(deuda.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    if (dto.proveedorId && dto.proveedorId !== deuda.proveedorId) {
      const proveedor = await this.prisma.proveedor.findUnique({
        where: { id: dto.proveedorId },
      });
      if (!proveedor) {
        throw new NotFoundException('El proveedor indicado no existe');
      }
      if (proveedor.sedeId !== deuda.sedeId) {
        throw new BadRequestException(
          'El proveedor no pertenece a la sede de la deuda',
        );
      }
    }

    const modalidadFinal = dto.modalidad ?? deuda.modalidad;
    const cuotasFinal =
      dto.numeroCuotas !== undefined ? dto.numeroCuotas : deuda.numeroCuotas;
    const aplicaInteresFinal =
      dto.aplicaInteres !== undefined ? dto.aplicaInteres : deuda.aplicaInteres;
    const porcentajeFinal =
      dto.porcentajeInteres !== undefined
        ? dto.porcentajeInteres
        : deuda.porcentajeInteres
          ? Number(deuda.porcentajeInteres)
          : undefined;

    this.validarReglasDeuda(
      modalidadFinal,
      cuotasFinal ?? undefined,
      aplicaInteresFinal,
      porcentajeFinal,
    );

    return this.prisma.deudaProveedor.update({
      where: { id },
      data: {
        ...(dto.proveedorId ? { proveedorId: dto.proveedorId } : {}),
        ...(dto.suministro ? { suministro: dto.suministro.trim() } : {}),
        ...(dto.montoTotal !== undefined
          ? { montoTotal: new Prisma.Decimal(dto.montoTotal) }
          : {}),
        ...(dto.fechaLimite ? { fechaLimite: new Date(dto.fechaLimite) } : {}),
        ...(dto.modalidad ? { modalidad: dto.modalidad } : {}),
        numeroCuotas:
          modalidadFinal === ModalidadDeudaProveedor.CUOTAS
            ? (cuotasFinal ?? null)
            : null,
        aplicaInteres: aplicaInteresFinal,
        porcentajeInteres: aplicaInteresFinal
          ? new Prisma.Decimal(porcentajeFinal!)
          : null,
        ...(dto.estado ? { estado: dto.estado } : {}),
      },
      include: {
        proveedor: true,
      },
    });
  }

  async remove(id: string, userId: string, rolGlobal: string) {
    const deuda = await this.cargar(id);
    await this.verificarAccesoADeuda(deuda.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    return this.prisma.deudaProveedor.delete({ where: { id } });
  }

  private validarReglasDeuda(
    modalidad: ModalidadDeudaProveedor,
    numeroCuotas?: number | null,
    aplicaInteres?: boolean,
    porcentajeInteres?: number | null,
  ) {
    if (
      aplicaInteres &&
      (porcentajeInteres === undefined || porcentajeInteres === null)
    ) {
      throw new BadRequestException(
        'Si aplica interés, el porcentaje es obligatorio.',
      );
    }

    if (
      modalidad === ModalidadDeudaProveedor.CUOTAS &&
      (numeroCuotas === undefined || numeroCuotas === null || numeroCuotas < 2)
    ) {
      throw new BadRequestException(
        'Si es en cuotas, el número de cuotas es obligatorio (>= 2).',
      );
    }
  }

  private async cargar(id: string) {
    const deuda = await this.prisma.deudaProveedor.findUnique({
      where: { id },
      include: { proveedor: true },
    });
    if (!deuda) {
      throw new NotFoundException(`Deuda con proveedor ${id} no encontrada`);
    }
    return deuda;
  }

  private async verificarAccesoADeuda(
    sedeId: string,
    userId: string,
    rolGlobal: string,
    opciones: { escritura?: boolean } = {},
  ) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException('La sede asociada a esta deuda ya no existe');
    }
    await this.negociosService.verificarAccesoSede(
      userId,
      sede,
      rolGlobal,
      opciones,
    );
  }
}
