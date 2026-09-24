import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { CreatePagoProveedorDto } from '../dto/compras/create-pago-proveedor.dto';
import { fechaColombiana } from '../modules/finance-ai/domain/dia-colombia';

const DIA_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CuentasProveedoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
  ) {}

  async findAll(userId: string, rolGlobal: string, sedeId?: string) {
    const visibles = await this.negociosService.filtroDeSedes(
      userId,
      rolGlobal,
      sedeId,
    );

    return this.prisma.cuentaPorPagarProveedor.findMany({
      where: { sedeId: visibles },
      include: {
        proveedor: true,
        compra: { include: { detalles: true } },
        pagos: { orderBy: { fecha: 'desc' } },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });
  }

  async pagar(
    id: string,
    userId: string,
    rolGlobal: string,
    dto: CreatePagoProveedorDto,
  ) {
    const cuenta = await this.prisma.cuentaPorPagarProveedor.findUnique({
      where: { id },
    });
    if (!cuenta) throw new NotFoundException('La cuenta por pagar no existe');

    const sede = await this.prisma.sede.findUnique({ where: { id: cuenta.sedeId } });
    if (!sede) throw new NotFoundException('La sede indicada no existe');
    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal, {
      escritura: true,
    });

    const monto = new Prisma.Decimal(dto.monto);
    if (monto.greaterThan(cuenta.saldoPendiente)) {
      throw new BadRequestException(
        'El pago no puede superar el saldo pendiente de la cuenta',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cuentaPorPagarProveedor.updateMany({
        where: { id, saldoPendiente: { gte: monto } },
        data: {
          saldoPendiente: { decrement: monto },
          estado: monto.equals(cuenta.saldoPendiente) ? 'PAGADA' : 'PENDIENTE',
        },
      });
      if (!updated.count) {
        throw new BadRequestException(
          'El saldo cambió mientras se registraba el pago. Intenta de nuevo.',
        );
      }

      return tx.pagoProveedor.create({
        data: { cuentaPorPagarId: id, monto },
      });
    });
  }

  async recordatorios(ahora = new Date()) {
    const cuentas = await this.prisma.cuentaPorPagarProveedor.findMany({
      where: {
        saldoPendiente: { gt: 0 },
        estado: { not: 'PAGADA' },
      },
      include: {
        proveedor: true,
        sede: {
          include: {
            usuariosSede: { include: { usuario: true }, orderBy: { id: 'asc' } },
            negocio: {
              include: {
                usuariosNegocio: {
                  include: { usuario: true },
                  orderBy: { id: 'asc' },
                },
              },
            },
          },
        },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });

    const resultados: {
      id: string;
      tipo: 'cinco_dias' | 'vencimiento' | 'vencida';
      telefono: string | null;
      proveedor: string;
      sedeId: string;
      sede: string;
      saldoPendiente: number;
      fechaVencimiento: string;
      mensaje: string;
    }[] = [];

    for (const cuenta of cuentas) {
      const dias = diferenciaEntreFechas(
        fechaColombiana(ahora),
        fechaCalendarioVencimiento(cuenta.fechaVencimiento),
      );
      let tipo: 'cinco_dias' | 'vencimiento' | 'vencida' | null = null;

      if (dias === 5 && !cuenta.recordatorioCincoDiasAt) {
        tipo = 'cinco_dias';
      } else if (dias === 0 && !cuenta.recordatorioVencimientoAt) {
        tipo = 'vencimiento';
      } else if (dias < 0 && !cuenta.recordatorioVencimientoAt) {
        tipo = 'vencida';
      }
      if (!tipo) continue;

      const saldo = Number(cuenta.saldoPendiente);
      const personas = [
        ...cuenta.sede.usuariosSede.map((vinculo) => vinculo.usuario),
        ...cuenta.sede.negocio.usuariosNegocio.map((vinculo) => vinculo.usuario),
      ];
      const telefono =
        cuenta.sede.telefono?.trim() ||
        cuenta.sede.whatsappUserId ||
        personas.find((persona) => persona.telefono?.trim())?.telefono?.trim() ||
        null;
      resultados.push({
        id: cuenta.id,
        tipo,
        telefono: telefono ? soloDigitos(telefono) : null,
        proveedor: cuenta.proveedor.nombre,
        sedeId: cuenta.sedeId,
        sede: cuenta.sede.nombre,
        saldoPendiente: saldo,
        fechaVencimiento: cuenta.fechaVencimiento.toISOString(),
        mensaje:
          tipo === 'cinco_dias'
            ? `Recordatorio: tienes ${saldo.toLocaleString('es-CO')} pendientes con ${cuenta.proveedor.nombre}. La cuenta vence en 5 días.`
            : tipo === 'vencimiento'
              ? `Hoy vence la cuenta de ${saldo.toLocaleString('es-CO')} con ${cuenta.proveedor.nombre}.`
              : `La cuenta de ${saldo.toLocaleString('es-CO')} con ${cuenta.proveedor.nombre} está vencida.`,
      });

      if (
        telefono &&
        (tipo === 'cinco_dias' || tipo === 'vencimiento' || tipo === 'vencida')
      ) {
        await this.prisma.cuentaPorPagarProveedor.update({
          where: { id: cuenta.id },
          data:
            tipo === 'cinco_dias'
              ? { recordatorioCincoDiasAt: ahora }
              : { recordatorioVencimientoAt: ahora, estado: 'VENCIDA' },
        });
      }
    }

    return resultados;
  }
}

function diferenciaEntreFechas(desde: string, hasta: string): number {
  const inicio = new Date(`${desde}T00:00:00.000Z`).getTime();
  const fin = new Date(`${hasta}T00:00:00.000Z`).getTime();
  return Math.round((fin - inicio) / DIA_MS);
}

function fechaCalendarioVencimiento(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}
