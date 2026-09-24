import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreateCompraDto } from '../dto/compras/create-compra.dto';

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  async create(userId: string, rolGlobal: string, dto: CreateCompraDto) {
    const sede = await this.prisma.sede.findUnique({
      where: { id: dto.sedeId },
    });
    if (!sede) {
      throw new NotFoundException('La sede indicada no existe');
    }
    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal, {
      escritura: true,
    });

    const proveedorId = dto.proveedorId ?? null;
    const fechaVencimiento = dto.fechaVencimiento
      ? new Date(dto.fechaVencimiento)
      : null;
    if (fechaVencimiento && Number.isNaN(fechaVencimiento.getTime())) {
      throw new BadRequestException('La fecha de vencimiento no es válida');
    }
    if (fechaVencimiento && !proveedorId) {
      throw new BadRequestException(
        'Una compra a crédito requiere un proveedor',
      );
    }
    if (proveedorId) {
      const proveedor = await this.prisma.proveedor.findUnique({
        where: { id: proveedorId },
      });
      if (!proveedor) {
        throw new NotFoundException('El proveedor indicado no existe');
      }
      if (proveedor.sedeId !== dto.sedeId) {
        throw new BadRequestException(
          'El proveedor no pertenece a la sede de la compra',
        );
      }
    }

    // Dos líneas del mismo producto dejarían el precioCompra en el costo de la
    // última que se procese, escondiendo la otra.
    const productoIds = dto.detalles.map((d) => d.productoId);
    if (new Set(productoIds).size !== productoIds.length) {
      throw new BadRequestException(
        'Hay productos repetidos en el detalle: agrupa las cantidades en una sola línea',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // El filtro por sedeId evita cargarle stock al producto de otra sede.
      const productos = await tx.producto.findMany({
        where: { id: { in: productoIds }, sedeId: dto.sedeId },
      });

      if (productos.length !== productoIds.length) {
        const encontrados = new Set(productos.map((p) => p.id));
        const faltantes = productoIds.filter((id) => !encontrados.has(id));
        throw new NotFoundException(
          `Estos productos no existen en la sede indicada: ${faltantes.join(', ')}. Créalos primero con POST /productos`,
        );
      }

      const porId = new Map(productos.map((p) => [p.id, p]));
      let total = new Prisma.Decimal(0);

      const lineas = dto.detalles.map((detalle) => {
        const producto = porId.get(detalle.productoId)!;
        const costo =
          detalle.costo !== undefined
            ? new Prisma.Decimal(detalle.costo)
            : producto.precioCompra;

        total = total.add(costo.mul(detalle.cantidad));
        return {
          productoId: detalle.productoId,
          cantidad: detalle.cantidad,
          costo,
        };
      });

      if (
        dto.total !== undefined &&
        !total.equals(new Prisma.Decimal(dto.total))
      ) {
        throw new BadRequestException(
          `El total enviado (${dto.total}) no coincide con el calculado (${total.toString()})`,
        );
      }

      // Sumar stock nunca puede dejarlo negativo, así que aquí no hace falta el
      // update condicional que sí usa Ventas. El precioCompra queda en el último
      // costo pagado; el histórico de cada compra vive en DetalleCompra.costo.
      for (const linea of lineas) {
        await tx.producto.update({
          where: { id: linea.productoId },
          data: {
            stock: { increment: linea.cantidad },
            precioCompra: linea.costo,
          },
        });
      }

      return tx.compra.create({
        data: {
          total,
          sedeId: dto.sedeId,
          proveedorId,
          detalles: { create: lineas },
          ...(fechaVencimiento && proveedorId
            ? {
                cuentaPorPagar: {
                  create: {
                    proveedorId,
                    sedeId: dto.sedeId,
                    montoOriginal: total,
                    saldoPendiente: total,
                    fechaVencimiento,
                  },
                },
              }
            : {}),
        },
        include: { detalles: true, cuentaPorPagar: true },
      });
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
    return this.prisma.compra.findMany({
      where: {
        sedeId: visibles,
        ...(proveedorId ? { proveedorId } : {}),
      },
      include: { detalles: true },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(id: string, userId: string, rolGlobal: string) {
    const compra = await this.cargar(id);
    await this.verificarAccesoALaCompra(compra.sedeId, userId, rolGlobal);
    return compra;
  }

  /** Carga cruda: cada llamador decide qué permiso exige sobre la sede. */
  private async cargar(id: string) {
    const compra = await this.prisma.compra.findUnique({
      where: { id },
      include: { detalles: true },
    });
    if (!compra) {
      throw new NotFoundException(`Compra con id ${id} no encontrada`);
    }
    return compra;
  }

  private async verificarAccesoALaCompra(
    sedeId: string,
    userId: string,
    rolGlobal: string,
    opciones: { escritura?: boolean } = {},
  ) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(
        'La sede asociada a esta compra ya no existe',
      );
    }
    await this.negociosService.verificarAccesoSede(
      userId,
      sede,
      rolGlobal,
      opciones,
    );
  }

  // Sin update, igual que en Ventas: se anula y se rehace.
  async remove(id: string, userId: string, rolGlobal: string) {
    const compra = await this.cargar(id);
    await this.verificarAccesoALaCompra(compra.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    return this.prisma.$transaction(async (tx) => {
      for (const detalle of compra.detalles) {
        // Si la mercancía de esta compra ya se vendió, devolverla dejaría el stock
        // en negativo. Preferimos rechazar la anulación a corromper el inventario.
        const { count } = await tx.producto.updateMany({
          where: { id: detalle.productoId, stock: { gte: detalle.cantidad } },
          data: { stock: { decrement: detalle.cantidad } },
        });
        if (count === 0) {
          const producto = await tx.producto.findUnique({
            where: { id: detalle.productoId },
          });
          throw new ConflictException(
            `No se puede anular: de "${producto?.nombre ?? detalle.productoId}" quedan ${producto?.stock ?? 0} unidades y esta compra aportó ${detalle.cantidad}. Parte ya se vendió.`,
          );
        }
      }

      // El precioCompra no se revierte: no se guarda el costo anterior en ninguna parte.
      // Si hay que corregirlo, se hace con PATCH /productos.
      return tx.compra.delete({ where: { id } });
    });
  }
}
