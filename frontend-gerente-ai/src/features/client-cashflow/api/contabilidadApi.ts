import { apiClient } from '@/lib/apiClient';

/**
 * Trae de la base todo lo que necesita el libro contable.
 *
 * No hay un endpoint de "contabilidad": se arma juntando los listados que ya
 * existen, uno por sede. El negocio puede tener varias sedes y la contabilidad
 * es del negocio, así que se consultan todas y se unifican.
 */

export interface Sede {
  id: string;
  nombre: string;
  negocioId: string;
}

export interface Venta {
  id: string;
  total: number | string;
  tipo: 'CONTADO' | 'FIADO';
  fecha: string;
  clienteId: string | null;
  sedeId: string;
  detalles?: DetalleVenta[];
}

export interface DetalleVenta {
  id: string;
  cantidad: number;
  precio: number | string;
  productoId: string;
}

export interface Compra {
  id: string;
  total: number | string;
  fecha: string;
  proveedorId: string | null;
  sedeId: string;
  detalles?: DetalleCompra[];
}

export interface DetalleCompra {
  id: string;
  cantidad: number;
  costo: number | string;
  productoId: string;
}

export interface Gasto {
  id: string;
  descripcion: string;
  monto: number | string;
  categoria: string;
  fecha: string;
  sedeId: string;
}

export interface Abono {
  id: string;
  monto: number | string;
  fecha: string;
  clienteId: string | null;
  sedeId: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  saldoPendiente: number | string;
  sedeId: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  telefono: string | null;
  sedeId: string;
}

export interface Producto {
  id: string;
  nombre: string;
  stock: number;
  stockMinimo: number;
  precioCompra: number | string;
  precioVenta: number | string;
  sedeId: string;
}

export interface DatosContables {
  sedes: Sede[];
  ventas: Venta[];
  compras: Compra[];
  gastos: Gasto[];
  abonos: Abono[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  productos: Producto[];
}

/** Une los resultados de todas las sedes en una sola lista. */
async function porSede<T>(recurso: string, sedeIds: string[]): Promise<T[]> {
  const respuestas = await Promise.allSettled(
    sedeIds.map((sedeId) => apiClient<T[]>(`/${recurso}?sedeId=${sedeId}`)),
  );

  return respuestas.flatMap((r) =>
    r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [],
  );
}

export const contabilidadApi = {
  /**
   * Descarga todo lo del negocio activo.
   *
   * Se usa `allSettled` a propósito: si un listado falla (permisos de una sede,
   * un timeout), el libro sale con el resto en vez de no salir. Un contador
   * prefiere un reporte incompleto y avisado antes que ninguno.
   */
  async obtenerTodo(negocioId: string): Promise<DatosContables> {
    const sedes = await apiClient<Sede[]>(`/sedes?negocioId=${negocioId}`);
    const ids = sedes.map((s) => s.id);

    if (ids.length === 0) {
      return {
        sedes: [],
        ventas: [],
        compras: [],
        gastos: [],
        abonos: [],
        clientes: [],
        proveedores: [],
        productos: [],
      };
    }

    const [ventas, compras, gastos, abonos, clientes, proveedores, productos] =
      await Promise.all([
        porSede<Venta>('ventas', ids),
        porSede<Compra>('compras', ids),
        porSede<Gasto>('gastos', ids),
        porSede<Abono>('abonos', ids),
        porSede<Cliente>('clientes', ids),
        porSede<Proveedor>('proveedores', ids),
        porSede<Producto>('productos', ids),
      ]);

    return {
      sedes,
      ventas,
      compras,
      gastos,
      abonos,
      clientes,
      proveedores,
      productos,
    };
  },
};
