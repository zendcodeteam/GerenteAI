import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreateAbonoDto } from '../dto/abonos/create-abono.dto';

@Injectable()
export class AbonosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  /**
   * Registra un pago de fiado.
   *
   * Devuelve una LISTA porque un pago puede saldar varias ventas: si el cliente
   * debe 5.000 de una venta y 8.000 de otra y abona 10.000, se generan dos
   * abonos (5.000 y 5.000), cada uno atado a su venta. Es como funciona la
   * aplicación de pagos en contabilidad, y es lo que hace que el reporte de
   * fiados pueda decir cuál venta quedó saldada y cuál sigue vencida.
   *
   * Guardar un solo abono suelto haría imposible revertirlo con exactitud:
   * al anularlo no se sabría a qué ventas devolverle el saldo.
   */
  async create(userId: string, rolGlobal: string, dto: CreateAbonoDto) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: dto.clienteId },
    });
    if (!cliente) {
      throw new NotFoundException('El cliente indicado no existe');
    }

    const sede = await this.buscarSede(cliente.sedeId, 'este cliente');
    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal, {
      escritura: true,
    });

    const monto = new Prisma.Decimal(dto.monto);

    // Un abono mayor a la deuda dejaría el saldo en negativo. Es más probable que sea
    // un error de digitación (o de interpretación de la IA) que un pago adelantado real.
    if (cliente.saldoPendiente.lessThan(monto)) {
      throw new BadRequestException(
        `El abono (${monto.toString()}) supera el saldo pendiente del cliente (${cliente.saldoPendiente.toString()})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Condicional por la misma razón que el stock en Ventas: dos abonos simultáneos
      // sobre el mismo cliente no deben poder dejar el saldo por debajo de cero.
      const { count } = await tx.cliente.updateMany({
        where: { id: dto.clienteId, saldoPendiente: { gte: monto } },
        data: { saldoPendiente: { decrement: monto } },
      });
      if (count === 0) {
        throw new ConflictException(
          'El saldo del cliente cambió mientras se registraba el abono, intenta de nuevo',
        );
      }

      const reparto = await this.repartirEntreVentas(
        tx,
        dto.clienteId,
        monto,
        dto.ventaId,
      );

      return Promise.all(
        reparto.map((parte) =>
          tx.abono.create({
            data: {
              monto: parte.monto,
              clienteId: dto.clienteId,
              sedeId: cliente.sedeId,
              ventaId: parte.ventaId,
            },
          }),
        ),
      );
    });
  }

  async findAll(
    userId: string,
    rolGlobal: string,
    sedeId?: string,
    clienteId?: string,
  ) {
    const visibles = await this.negociosService.filtroDeSedes(
      userId,
      rolGlobal,
      sedeId,
    );
    return this.prisma.abono.findMany({
      where: {
        sedeId: visibles,
        ...(clienteId ? { clienteId } : {}),
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(id: string, userId: string, rolGlobal: string) {
    const abono = await this.cargar(id);
    const sede = await this.buscarSede(abono.sedeId, 'este abono');
    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal);
    return abono;
  }

  /** Carga cruda: cada llamador decide qué permiso exige sobre la sede. */
  private async cargar(id: string) {
    const abono = await this.prisma.abono.findUnique({ where: { id } });
    if (!abono) {
      throw new NotFoundException(`Abono con id ${id} no encontrado`);
    }
    return abono;
  }

  // Sin update, por lo mismo que en Ventas: corregir un monto ya aplicado al saldo
  // se hace anulando y volviendo a registrar.
  async remove(id: string, userId: string, rolGlobal: string) {
    const abono = await this.cargar(id);
    const sede = await this.buscarSede(abono.sedeId, 'este abono');
    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal, {
      escritura: true,
    });

    return this.prisma.$transaction(async (tx) => {
      // Anular el abono devuelve la deuda al cliente...
      if (abono.clienteId) {
        await tx.cliente.update({
          where: { id: abono.clienteId },
          data: { saldoPendiente: { increment: abono.monto } },
        });
      }

      // ...y a la venta concreta que había pagado, que es lo que mantiene
      // coherente la antigüedad de la deuda en el reporte de fiados.
      if (abono.ventaId) {
        await tx.venta.update({
          where: { id: abono.ventaId },
          data: { saldoPendiente: { increment: abono.monto } },
        });
      }

      return tx.abono.delete({ where: { id } });
    });
  }

  /**
   * Decide a qué ventas se aplica el pago.
   *
   * Con `ventaId` el tendero eligió cuál saldar. Sin él se aplica a la deuda más
   * antigua primero, que es lo habitual y lo que evita que un fiado viejo quede
   * eternamente sin pagar mientras se abonan los recientes.
   */
  private async repartirEntreVentas(
    tx: Prisma.TransactionClient,
    clienteId: string,
    monto: Prisma.Decimal,
    ventaId?: string,
  ): Promise<{ ventaId: string | null; monto: Prisma.Decimal }[]> {
    if (ventaId) {
      const venta = await tx.venta.findUnique({ where: { id: ventaId } });
      if (!venta) {
        throw new NotFoundException('La venta indicada no existe');
      }
      if (venta.clienteId !== clienteId) {
        throw new BadRequestException('Esa venta no es de este cliente');
      }
      if (venta.saldoPendiente.lessThan(monto)) {
        throw new BadRequestException(
          `El abono (${monto.toString()}) supera el saldo de esa venta (${venta.saldoPendiente.toString()})`,
        );
      }

      await tx.venta.update({
        where: { id: ventaId },
        data: { saldoPendiente: { decrement: monto } },
      });
      return [{ ventaId, monto }];
    }

    const pendientes = await tx.venta.findMany({
      where: { clienteId, saldoPendiente: { gt: 0 } },
      orderBy: { fecha: 'asc' },
    });

    const partes: { ventaId: string | null; monto: Prisma.Decimal }[] = [];
    let restante = monto;

    for (const venta of pendientes) {
      if (!restante.greaterThan(0)) break;

      const aplica = restante.lessThan(venta.saldoPendiente)
        ? restante
        : venta.saldoPendiente;

      await tx.venta.update({
        where: { id: venta.id },
        data: { saldoPendiente: { decrement: aplica } },
      });

      partes.push({ ventaId: venta.id, monto: aplica });
      restante = restante.sub(aplica);
    }

    // Sobró plata sin venta a la cual aplicarla: el cliente tenía saldo pero
    // ninguna deuda abierta, cosa que pasa con datos cargados a mano. Se registra
    // el abono suelto en vez de perderlo.
    if (restante.greaterThan(0)) {
      partes.push({ ventaId: null, monto: restante });
    }

    return partes;
  }

  private async buscarSede(sedeId: string, contexto: string) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(
        `La sede asociada a ${contexto} ya no existe`,
      );
    }
    return sede;
  }
}
