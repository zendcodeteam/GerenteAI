import { CuentasProveedoresService } from './cuentas-proveedores.service';
import type { PrismaService } from './prisma.service';
import type { NegociosService } from './negocios.service';

/**
 * Los recordatorios de cuentas por pagar.
 *
 * Se prueba contra un Prisma de mentira y no contra la base: lo que importa
 * aqui es la decision de cuando avisar y cuando callar, y esa es aritmetica de
 * fechas y banderas.
 */

const UN_DIA = 86_400_000;

/** Una cuenta con todo lo que el servicio necesita leer. */
function cuenta(parcial: Record<string, unknown> = {}) {
  return {
    id: 'cuenta-1',
    sedeId: 'sede-1',
    saldoPendiente: 500_000,
    estado: 'PENDIENTE',
    recordatorioCincoDiasAt: null,
    recordatorioVencimientoAt: null,
    fechaVencimiento: new Date(Date.now() + 5 * UN_DIA),
    proveedor: { nombre: 'Distribuidora Cali' },
    sede: {
      nombre: 'Sede principal',
      telefono: '573001234567',
      whatsappUserId: null,
      usuariosSede: [],
      negocio: { usuariosNegocio: [] },
    },
    ...parcial,
  };
}

/** Vencimiento dentro de `dias` dias, contando desde hoy. */
function venceEn(dias: number): Date {
  const hoy = new Date();
  return new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) +
      dias * UN_DIA,
  );
}

function servicio(cuentas: ReturnType<typeof cuenta>[]) {
  const actualizaciones: { id: string; data: Record<string, unknown> }[] = [];

  const prisma = {
    cuentaPorPagarProveedor: {
      findMany: () => Promise.resolve(cuentas),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        actualizaciones.push({ id: where.id, data });
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaService;

  return {
    servicio: new CuentasProveedoresService(
      prisma,
      {} as unknown as NegociosService,
    ),
    actualizaciones,
  };
}

describe('CuentasProveedoresService · recordatorios', () => {
  it('avisa cuando faltan exactamente cinco días', async () => {
    const { servicio: s } = servicio([
      cuenta({ fechaVencimiento: venceEn(5) }),
    ]);

    const avisos = await s.recordatorios();

    expect(avisos).toHaveLength(1);
    expect(avisos[0].tipo).toBe('cinco_dias');
  });

  it('también avisa si el workflow no corrió ese día', async () => {
    // Esta es la regresión. Con la condición exacta `dias === 5`, una ejecución
    // perdida —n8n caído, Render dormido— hacía que el aviso previo no se
    // mandara nunca: al día siguiente ya faltaban cuatro.
    const { servicio: s } = servicio([
      cuenta({ fechaVencimiento: venceEn(3) }),
    ]);

    const avisos = await s.recordatorios();

    expect(avisos).toHaveLength(1);
    expect(avisos[0].tipo).toBe('cinco_dias');
    expect(avisos[0].estadoTexto).toBe('vence en 3 días');
  });

  it('el texto del estado dice los días reales, no "5" siempre', async () => {
    const { servicio: s } = servicio([
      cuenta({ fechaVencimiento: venceEn(1) }),
    ]);

    const avisos = await s.recordatorios();

    expect(avisos[0].estadoTexto).toBe('vence mañana');
  });

  it('no avisa antes de los cinco días', async () => {
    const { servicio: s } = servicio([
      cuenta({ fechaVencimiento: venceEn(9) }),
    ]);

    expect(await s.recordatorios()).toHaveLength(0);
  });

  it('el aviso previo se manda una sola vez', async () => {
    // Lo garantiza la marca, no la fecha: por eso ampliar la ventana no
    // convierte el aviso en algo diario.
    const { servicio: s } = servicio([
      cuenta({
        fechaVencimiento: venceEn(3),
        recordatorioCincoDiasAt: new Date(),
      }),
    ]);

    expect(await s.recordatorios()).toHaveLength(0);
  });

  it('avisa el día del vencimiento', async () => {
    const { servicio: s, actualizaciones } = servicio([
      cuenta({ fechaVencimiento: venceEn(0) }),
    ]);

    const avisos = await s.recordatorios();

    expect(avisos[0].tipo).toBe('vencimiento');
    expect(avisos[0].estadoTexto).toBe('vence hoy');
    expect(actualizaciones[0].data).toHaveProperty('estado', 'VENCIDA');
  });

  it('una cuenta vencida avisa una vez, no todos los días', async () => {
    const { servicio: s } = servicio([
      cuenta({
        fechaVencimiento: venceEn(-12),
        recordatorioVencimientoAt: new Date(),
      }),
    ]);

    expect(await s.recordatorios()).toHaveLength(0);
  });

  it('una cuenta que nació vencida sí recibe su aviso', async () => {
    const { servicio: s } = servicio([
      cuenta({ fechaVencimiento: venceEn(-3) }),
    ]);

    const avisos = await s.recordatorios();

    expect(avisos[0].tipo).toBe('vencida');
    expect(avisos[0].estadoTexto).toBe('está vencida');
  });

  it('sin teléfono no se marca, para poder avisar cuando lo tenga', async () => {
    const { servicio: s, actualizaciones } = servicio([
      cuenta({
        fechaVencimiento: venceEn(5),
        sede: {
          nombre: 'Sede sin línea',
          telefono: null,
          whatsappUserId: null,
          usuariosSede: [],
          negocio: { usuariosNegocio: [] },
        },
      }),
    ]);

    await s.recordatorios();

    expect(actualizaciones).toHaveLength(0);
  });

  it('cae al teléfono del dueño cuando la sede no tiene línea', async () => {
    const { servicio: s } = servicio([
      cuenta({
        fechaVencimiento: venceEn(5),
        sede: {
          nombre: 'Sede sin línea',
          telefono: null,
          whatsappUserId: null,
          usuariosSede: [],
          negocio: {
            usuariosNegocio: [{ usuario: { telefono: '573009998877' } }],
          },
        },
      }),
    ]);

    const avisos = await s.recordatorios();

    expect(avisos[0].telefono).toBe('573009998877');
  });
});
