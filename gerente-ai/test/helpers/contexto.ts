import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/services/prisma.service';
import { NegociosService } from '../../src/services/negocios.service';
import { PlanesService } from '../../src/services/planes.service';
import { ProductosService } from '../../src/services/productos.service';
import { VentasService } from '../../src/services/ventas.service';
import { ComprasService } from '../../src/services/compras.service';
import { AbonosService } from '../../src/services/abonos.service';
import { UsuarioSedesService } from '../../src/services/usuario-sedes.service';
import { SedesService } from '../../src/services/sedes.service';
import { ReportesService } from '../../src/services/reportes.service';
import { ClientesService } from '../../src/services/clientes.service';
import { ProveedoresService } from '../../src/services/proveedores.service';
import { CuentasProveedoresService } from '../../src/services/cuentas-proveedores.service';
import { GastosService } from '../../src/services/gastos.service';
import { PagosService } from '../../src/services/pagos.service';

export interface Contexto {
  moduleRef: TestingModule;
  prisma: PrismaService;
  negocios: NegociosService;
  productos: ProductosService;
  ventas: VentasService;
  compras: ComprasService;
  abonos: AbonosService;
  usuarioSedes: UsuarioSedesService;
  sedes: SedesService;
  reportes: ReportesService;
  clientes: ClientesService;
  proveedores: ProveedoresService;
  cuentasProveedores: CuentasProveedoresService;
  gastos: GastosService;
  pagos: PagosService;
}

// Se instancian los servicios sueltos en vez de levantar AppModule entero:
// la lógica que interesa probar (transacciones, stock, permisos) vive aquí,
// y así las pruebas no dependen de JWT ni del servidor HTTP.
export async function crearContexto(): Promise<Contexto> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      PrismaService,
      NegociosService,
      PlanesService,
      ProductosService,
      VentasService,
      ComprasService,
      AbonosService,
      UsuarioSedesService,
      SedesService,
      ReportesService,
      ClientesService,
      ProveedoresService,
      CuentasProveedoresService,
      GastosService,
      PagosService,
    ],
  }).compile();

  const prisma = moduleRef.get(PrismaService);
  await prisma.$connect();

  return {
    moduleRef,
    prisma,
    negocios: moduleRef.get(NegociosService),
    productos: moduleRef.get(ProductosService),
    ventas: moduleRef.get(VentasService),
    compras: moduleRef.get(ComprasService),
    abonos: moduleRef.get(AbonosService),
    usuarioSedes: moduleRef.get(UsuarioSedesService),
    sedes: moduleRef.get(SedesService),
    reportes: moduleRef.get(ReportesService),
    clientes: moduleRef.get(ClientesService),
    proveedores: moduleRef.get(ProveedoresService),
    cuentasProveedores: moduleRef.get(CuentasProveedoresService),
    gastos: moduleRef.get(GastosService),
    pagos: moduleRef.get(PagosService),
  };
}

export async function cerrarContexto(ctx: Contexto) {
  await ctx.prisma.$disconnect();
  await ctx.moduleRef.close();
}

// El orden importa: DetalleVenta y DetalleCompra apuntan a Producto con
// onDelete: Restrict, así que hay que borrarlos antes que los productos.
export async function limpiar(prisma: PrismaService) {
  await prisma.detalleVenta.deleteMany();
  await prisma.detalleCompra.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.compra.deleteMany();
  await prisma.abono.deleteMany();
  await prisma.gasto.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.usuarioSede.deleteMany();
  await prisma.usuarioNegocio.deleteMany();
  await prisma.mensaje.deleteMany();
  await prisma.reporte.deleteMany();
  await prisma.consumoIa.deleteMany();
  await prisma.notificacionPlan.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.sede.deleteMany();
  await prisma.negocio.deleteMany();
  await prisma.usuario.deleteMany();
}

export interface Semilla {
  duenoId: string;
  adminSedeAId: string;
  ajenoId: string;
  masterId: string;
  negocioId: string;
  sedeAId: string;
  sedeBId: string;
  gaseosaId: string; // sede A, stock 10, precioCompra 1000, precioVenta 1500.50
  panId: string; // sede A, stock 5,  precioCompra 200,  precioVenta 500
  arrozId: string; // sede B, stock 10, precioCompra 2000, precioVenta 3000
  clienteAId: string;
  clienteBId: string;
  proveedorAId: string;
}

// Un negocio con dos sedes: el dueño manda en ambas, el admin de sede solo en la A.
export async function sembrar(prisma: PrismaService): Promise<Semilla> {
  const dueno = await prisma.usuario.create({
    data: { nombre: 'Dueño', email: 'dueno@test.local', password: 'hash' },
  });
  const adminSedeA = await prisma.usuario.create({
    data: {
      nombre: 'Admin Sede A',
      email: 'admin-a@test.local',
      password: 'hash',
    },
  });
  const ajeno = await prisma.usuario.create({
    data: { nombre: 'Ajeno', email: 'ajeno@test.local', password: 'hash' },
  });
  const master = await prisma.usuario.create({
    data: {
      nombre: 'Master',
      email: 'master@test.local',
      password: 'hash',
      rolGlobal: 'MASTER',
    },
  });

  // Plan Corporativo vigente, que no tiene tope de sedes.
  //
  // Se elige el ilimitado a propósito: la semilla es un punto de partida para
  // pruebas que no van de planes, y con un tope concreto cualquier cambio en el
  // catálogo comercial las rompe de rebote —como pasó al bajar el Gerente de 4
  // sedes a 1—. Los límites se prueban donde corresponde, en planes.e2e-spec,
  // que fija el plan explícitamente en cada caso.
  const negocio = await prisma.negocio.create({
    data: {
      nombre: 'Tienda Don José',
      telefonoContacto: '+573001112233',
      plan: 5,
      planVenceEl: new Date(Date.now() + 365 * 86_400_000),
    },
  });
  // Cada sede tiene su propia línea de WhatsApp: es la llave de enrutamiento del bot.
  const sedeA = await prisma.sede.create({
    data: {
      nombre: 'Sede Centro',
      telefono: '+573001110001',
      negocioId: negocio.id,
    },
  });
  const sedeB = await prisma.sede.create({
    data: {
      nombre: 'Sede Norte',
      telefono: '+573001110002',
      negocioId: negocio.id,
    },
  });

  await prisma.usuarioNegocio.create({
    data: { usuarioId: dueno.id, negocioId: negocio.id },
  });
  await prisma.usuarioSede.create({
    data: { usuarioId: adminSedeA.id, sedeId: sedeA.id },
  });

  const gaseosa = await prisma.producto.create({
    data: {
      nombre: 'Gaseosa',
      categoria: 'Bebidas',
      stock: 10,
      precioCompra: 1000,
      precioVenta: 1500.5,
      sedeId: sedeA.id,
    },
  });
  const pan = await prisma.producto.create({
    data: {
      nombre: 'Pan',
      categoria: 'Panaderia',
      stock: 5,
      precioCompra: 200,
      precioVenta: 500,
      sedeId: sedeA.id,
    },
  });
  const arroz = await prisma.producto.create({
    data: {
      nombre: 'Arroz',
      categoria: 'Abarrotes',
      stock: 10,
      precioCompra: 2000,
      precioVenta: 3000,
      sedeId: sedeB.id,
    },
  });

  const clienteA = await prisma.cliente.create({
    data: { nombre: 'Doña María', sedeId: sedeA.id },
  });
  const clienteB = await prisma.cliente.create({
    data: { nombre: 'Cliente Norte', sedeId: sedeB.id },
  });
  const proveedorA = await prisma.proveedor.create({
    data: { nombre: 'Distribuidora', sedeId: sedeA.id },
  });

  return {
    duenoId: dueno.id,
    adminSedeAId: adminSedeA.id,
    ajenoId: ajeno.id,
    masterId: master.id,
    negocioId: negocio.id,
    sedeAId: sedeA.id,
    sedeBId: sedeB.id,
    gaseosaId: gaseosa.id,
    panId: pan.id,
    arrozId: arroz.id,
    clienteAId: clienteA.id,
    clienteBId: clienteB.id,
    proveedorAId: proveedorA.id,
  };
}

export async function stockDe(prisma: PrismaService, productoId: string) {
  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
  });
  return producto!.stock;
}

export async function saldoDe(prisma: PrismaService, clienteId: string) {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  return cliente!.saldoPendiente.toNumber();
}
