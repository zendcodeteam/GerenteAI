import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreateClienteDto } from '../dto/clientes/create-cliente.dto';
import { UpdateClienteDto } from '../dto/clientes/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  async create(userId: string, rolGlobal: string, dto: CreateClienteDto) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: dto.sedeId },
    });
    if (!sede) {
      throw new NotFoundException('La sede indicada no existe');
    }
    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal, {
      escritura: true,
    });

    return this.prisma.cliente.create({ data: dto });
  }

  async findAll(userId: string, rolGlobal: string, sedeId?: string) {
    const visibles = await this.negociosService.filtroDeSedes(
      userId,
      rolGlobal,
      sedeId,
    );
    return this.prisma.cliente.findMany({ where: { sedeId: visibles } });
  }

  async findOne(id: string, userId: string, rolGlobal: string) {
    const cliente = await this.cargar(id);
    await this.verificarAccesoAlCliente(cliente.sedeId, userId, rolGlobal);
    return cliente;
  }

  /** Carga cruda: cada llamador decide qué permiso exige sobre la sede. */
  private async cargar(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }
    return cliente;
  }

  async update(
    id: string,
    userId: string,
    rolGlobal: string,
    dto: UpdateClienteDto,
  ) {
    const cliente = await this.cargar(id);
    await this.verificarAccesoAlCliente(cliente.sedeId, userId, rolGlobal, {
      escritura: true,
    });
    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string, rolGlobal: string) {
    const cliente = await this.cargar(id);
    await this.verificarAccesoAlCliente(cliente.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    await this.prisma.$transaction(async (tx) => {
      // Se conservan los movimientos contables, pero se separan del tercero
      // antes de borrar sus datos identificables.
      await tx.venta.updateMany({
        where: { clienteId: id },
        data: { clienteId: null },
      });
      await tx.abono.updateMany({
        where: { clienteId: id },
        data: { clienteId: null },
      });
      await tx.cliente.delete({ where: { id } });
    });

    return {
      id,
      suprimido: true,
      mensaje:
        'El cliente fue suprimido. Los movimientos contables se conservaron sin datos identificables.',
    };
  }

  private async verificarAccesoAlCliente(
    sedeId: string,
    userId: string,
    rolGlobal: string,
    opciones: { escritura?: boolean } = {},
  ) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(
        'La sede asociada a este cliente ya no existe',
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
