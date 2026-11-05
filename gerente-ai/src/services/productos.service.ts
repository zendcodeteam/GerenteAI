import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreateProductoDto } from '../dto/productos/create-producto.dto';
import { UpdateProductoDto } from '../dto/productos/update-producto.dto';

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  /**
   * Registra un nuevo producto cumpliendo los criterios de negocio:
   * - Los 4 campos (nombre, categoría, costo de compra y precio de venta) son obligatorios.
   * - Cantidad entera >= 0 (default 0 si no se indica).
   * - Costo de compra y precio de venta > 0.
   */
  async create(userId: string, rolGlobal: string, dto: CreateProductoDto) {
    const nombre = dto.nombre?.trim();
    const categoria = dto.categoria?.trim();
    const precioCompraNum =
      dto.costoCompra !== undefined ? dto.costoCompra : dto.precioCompra;
    const precioVentaNum = dto.precioVenta;
    const cantidadNum =
      dto.cantidad !== undefined ? dto.cantidad : (dto.stock ?? 0);

    // Criterio 1: Los 4 campos son obligatorios; no se guarda un producto incompleto.
    if (!nombre) {
      throw new BadRequestException('El nombre del producto es obligatorio');
    }
    if (!categoria) {
      throw new BadRequestException('La categoría del producto es obligatoria');
    }
    if (precioCompraNum === undefined || precioCompraNum === null) {
      throw new BadRequestException('El costo de compra es obligatorio');
    }
    if (precioVentaNum === undefined || precioVentaNum === null) {
      throw new BadRequestException('El precio de venta es obligatorio');
    }

    // Criterio 2: Cantidad entera >= 0; costo y precio numéricos > 0.
    if (
      typeof cantidadNum !== 'number' ||
      !Number.isInteger(cantidadNum) ||
      cantidadNum < 0
    ) {
      throw new BadRequestException(
        'La cantidad debe ser un número entero mayor o igual a 0',
      );
    }
    if (
      typeof precioCompraNum !== 'number' ||
      isNaN(precioCompraNum) ||
      precioCompraNum <= 0
    ) {
      throw new BadRequestException(
        'El costo de compra debe ser un número mayor a 0',
      );
    }
    if (
      typeof precioVentaNum !== 'number' ||
      isNaN(precioVentaNum) ||
      precioVentaNum <= 0
    ) {
      throw new BadRequestException(
        'El precio de venta debe ser un número mayor a 0',
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

    return this.prisma.producto.create({
      data: {
        nombre,
        categoria,
        stock: cantidadNum,
        stockMinimo: dto.stockMinimo ?? 0,
        precioCompra: new Prisma.Decimal(precioCompraNum),
        precioVenta: new Prisma.Decimal(precioVentaNum),
        alias: dto.alias ?? [],
        sedeId: dto.sedeId,
      },
    });
  }

  /**
   * Consulta el catálogo de productos con soporte para filtros por sede, categoría y búsqueda.
   */
  async findAll(
    userId: string,
    rolGlobal: string,
    filtros: { sedeId?: string; categoria?: string; search?: string } = {},
  ) {
    const visibles = await this.negociosService.filtroDeSedes(
      userId,
      rolGlobal,
      filtros.sedeId,
    );

    const where: Prisma.ProductoWhereInput = {
      sedeId: visibles,
    };

    if (filtros.categoria?.trim()) {
      where.categoria = {
        equals: filtros.categoria.trim(),
        mode: 'insensitive',
      };
    }

    if (filtros.search?.trim()) {
      const term = filtros.search.trim();
      where.OR = [
        { nombre: { contains: term, mode: 'insensitive' } },
        { alias: { has: term } },
      ];
    }

    return this.prisma.producto.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Consulta un producto específico por ID verificando permisos multitenant sobre la sede.
   */
  async findOne(id: string, userId: string, rolGlobal: string) {
    const producto = await this.cargar(id);
    await this.verificarAccesoAlProducto(producto.sedeId, userId, rolGlobal);
    return producto;
  }

  /**
   * Actualiza los datos de un producto aplicando las mismas reglas de validación numérica.
   */
  async update(
    id: string,
    userId: string,
    rolGlobal: string,
    dto: UpdateProductoDto,
  ) {
    const producto = await this.cargar(id);
    await this.verificarAccesoAlProducto(producto.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    const data: Prisma.ProductoUpdateInput = {};

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      if (!nombre) {
        throw new BadRequestException(
          'El nombre del producto no puede estar vacío',
        );
      }
      data.nombre = nombre;
    }

    if (dto.categoria !== undefined) {
      const categoria = dto.categoria.trim();
      if (!categoria) {
        throw new BadRequestException(
          'La categoría del producto no puede estar vacía',
        );
      }
      data.categoria = categoria;
    }

    const cantidadNum = dto.cantidad !== undefined ? dto.cantidad : dto.stock;
    if (cantidadNum !== undefined) {
      if (
        typeof cantidadNum !== 'number' ||
        !Number.isInteger(cantidadNum) ||
        cantidadNum < 0
      ) {
        throw new BadRequestException(
          'La cantidad debe ser un número entero mayor o igual a 0',
        );
      }
      data.stock = cantidadNum;
    }

    const costoNum =
      dto.costoCompra !== undefined ? dto.costoCompra : dto.precioCompra;
    if (costoNum !== undefined) {
      if (typeof costoNum !== 'number' || isNaN(costoNum) || costoNum <= 0) {
        throw new BadRequestException(
          'El costo de compra debe ser un número mayor a 0',
        );
      }
      data.precioCompra = new Prisma.Decimal(costoNum);
    }

    if (dto.precioVenta !== undefined) {
      if (
        typeof dto.precioVenta !== 'number' ||
        isNaN(dto.precioVenta) ||
        dto.precioVenta <= 0
      ) {
        throw new BadRequestException(
          'El precio de venta debe ser un número mayor a 0',
        );
      }
      data.precioVenta = new Prisma.Decimal(dto.precioVenta);
    }

    if (dto.stockMinimo !== undefined) {
      data.stockMinimo = dto.stockMinimo;
    }

    if (dto.alias !== undefined) {
      data.alias = dto.alias;
    }

    return this.prisma.producto.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string, rolGlobal: string) {
    const producto = await this.cargar(id);
    await this.verificarAccesoAlProducto(producto.sedeId, userId, rolGlobal, {
      escritura: true,
    });
    return this.prisma.producto.delete({ where: { id } });
  }

  /** Carga interna del producto por ID */
  private async cargar(id: string) {
    const producto = await this.prisma.producto.findUnique({ where: { id } });
    if (!producto) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }
    return producto;
  }

  private async verificarAccesoAlProducto(
    sedeId: string,
    userId: string,
    rolGlobal: string,
    opciones: { escritura?: boolean } = {},
  ) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(
        'La sede asociada a este producto ya no existe',
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
