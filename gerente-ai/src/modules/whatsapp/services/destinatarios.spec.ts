import type { PrismaService } from '../../../services/prisma.service';
import { DestinatariosService } from './destinatarios.service';

/**
 * Doble de Prisma con solo lo que este servicio consulta.
 *
 * Se arma a mano en vez de usar la base real porque lo que hay que verificar es
 * una REGLA DE NEGOCIO —a quien se le puede escribir— y esa regla no necesita
 * PostgreSQL para probarse.
 */
function fakePrisma(datos: {
  sedes?: unknown[];
  gastos?: { sedeId: string }[];
  ventas?: { sedeId: string }[];
  compras?: { sedeId: string }[];
  abonos?: { sedeId: string }[];
  ventasFiadas?: unknown[];
}) {
  const creados: unknown[] = [];

  return {
    creados,
    prisma: {
      sede: { findMany: () => Promise.resolve(datos.sedes ?? []) },
      gasto: { findMany: () => Promise.resolve(datos.gastos ?? []) },
      venta: {
        findMany: (args?: { where?: { tipo?: string } }) =>
          Promise.resolve(
            args?.where?.tipo === 'FIADO'
              ? (datos.ventasFiadas ?? [])
              : (datos.ventas ?? []),
          ),
      },
      compra: { findMany: () => Promise.resolve(datos.compras ?? []) },
      abono: { findMany: () => Promise.resolve(datos.abonos ?? []) },
      recordatorioFiado: {
        createMany: (args: { data: unknown[] }) => {
          creados.push(...args.data);
          return Promise.resolve({ count: args.data.length });
        },
      },
    } as unknown as PrismaService,
  };
}

/** Una sede con la forma que devuelve el include del servicio. */
function sede(parcial: Record<string, unknown>) {
  return {
    id: 's1',
    nombre: 'Principal',
    telefono: null,
    whatsappUserId: null,
    negocio: { nombre: 'El Virrey', usuariosNegocio: [] },
    usuariosSede: [],
    ...parcial,
  };
}

function usuario(nombre: string, telefono: string | null) {
  return { usuario: { nombre, telefono } };
}

describe('DestinatariosService - a quien se le puede escribir', () => {
  it('usa la linea propia de la sede cuando existe', async () => {
    const { prisma } = fakePrisma({
      sedes: [sede({ telefono: '573001234567' })],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos).toHaveLength(1);
    expect(destinos[0].destinatario).toBe('573001234567');
    expect(destinos[0].via).toBe('sede_telefono');
  });

  it('usa el BSUID cuando la sede oculta su numero', async () => {
    const { prisma } = fakePrisma({
      sedes: [sede({ whatsappUserId: 'CO.1710763673557397' })],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos[0].destinatario).toBe('CO.1710763673557397');
    expect(destinos[0].via).toBe('sede_identidad');
  });

  it('cae al telefono personal del duenno si la sede no tiene linea', async () => {
    // ESTE es el caso que faltaba y por el que no llegaban los recordatorios:
    // el duenno escribe desde su celular, la sede no tiene linea propia, y el
    // SQL viejo solo miraba Sede.telefono.
    const { prisma } = fakePrisma({
      sedes: [
        sede({
          negocio: {
            nombre: 'El Virrey',
            usuariosNegocio: [usuario('Beto Cuellar', '573009998888')],
          },
        }),
      ],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos).toHaveLength(1);
    expect(destinos[0].destinatario).toBe('573009998888');
    expect(destinos[0].via).toBe('usuario_telefono');
    expect(destinos[0].contacto).toBe('Beto');
  });

  it('prefiere a quien esta asignado a la sede antes que al duenno', async () => {
    const { prisma } = fakePrisma({
      sedes: [
        sede({
          usuariosSede: [usuario('Maria Empleada', '573001111111')],
          negocio: {
            nombre: 'El Virrey',
            usuariosNegocio: [usuario('Beto Duenno', '573002222222')],
          },
        }),
      ],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos[0].destinatario).toBe('573001111111');
  });

  it('omite las sedes sin ningun contacto, sin romperse', async () => {
    const { prisma } = fakePrisma({ sedes: [sede({})] });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos).toHaveLength(0);
  });

  it('limpia el telefono a digitos, como exige Meta', async () => {
    const { prisma } = fakePrisma({
      sedes: [sede({ telefono: '+57 300 123 4567' })],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos[0].destinatario).toBe('573001234567');
  });
});

describe('DestinatariosService - recordatorio nocturno', () => {
  const conLinea = [
    sede({ id: 's1', telefono: '573001111111' }),
    sede({ id: 's2', nombre: 'Sucursal', telefono: '573002222222' }),
  ];

  it('avisa solo a quien no registro nada hoy', async () => {
    const { prisma } = fakePrisma({
      sedes: conLinea,
      ventas: [{ sedeId: 's1' }],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos.map((d) => d.sedeId)).toEqual(['s2']);
  });

  it('un gasto tambien cuenta como movimiento del dia', async () => {
    const { prisma } = fakePrisma({
      sedes: conLinea,
      gastos: [{ sedeId: 's1' }],
      compras: [{ sedeId: 's2' }],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos).toHaveLength(0);
  });

  it('incluye una sede sin mensajes si no tiene movimientos', async () => {
    const { prisma } = fakePrisma({
      sedes: [sede({ telefono: '573001111111' })],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos).toHaveLength(1);
  });

  it('no avisa si hoy se registró un abono', async () => {
    const { prisma } = fakePrisma({
      sedes: [sede({ telefono: '573001111111' })],
      abonos: [{ sedeId: 's1' }],
    });

    const destinos = await new DestinatariosService(
      prisma,
    ).sedesSinMovimientosHoy();

    expect(destinos).toHaveLength(0);
  });
});
