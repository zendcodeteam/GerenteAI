import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Package, PackagePlus, RefreshCw, X } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface Producto {
  id: string;
  nombre: string;
  categoria?: string | null;
  stock: number;
  stockMinimo: number;
  precioCompra: number | string;
  precioVenta: number | string;
  sedeId: string;
}

interface InventoryPanelProps {
  sedeId: string;
  transactions: Array<{
    type?: string;
    productLines?: Array<{ productId: string; quantity: number }>;
    purchaseLines?: Array<{ productId: string; quantity: number }>;
  }>;
}

const money = (value: number | string) =>
  Number(value).toLocaleString("es-CO", {
    maximumFractionDigits: 0,
  });

export function InventoryPanel({ sedeId, transactions }: InventoryPanelProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [precioCompra, setPrecioCompra] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [stock, setStock] = useState("0");

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = sedeId && sedeId !== "all" ? `?sedeId=${sedeId}` : "";
      setProductos(await apiClient<Producto[]>(`/productos${query}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el inventario.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [sedeId]);

  const vendidos = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== "Venta" || !transaction.productLines) continue;
      for (const line of transaction.productLines) {
        totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
      }
    }
    return totals;
  }, [transactions]);

  const comprados = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== "Compra" || !transaction.purchaseLines) continue;
      for (const line of transaction.purchaseLines) {
        totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
      }
    }
    return totals;
  }, [transactions]);

  const categorias = useMemo(() => {
    const existentes = new Map<string, string>();
    for (const producto of productos) {
      const valor = producto.categoria?.trim();
      if (valor) existentes.set(valor.toLocaleLowerCase("es-CO"), valor);
    }
    return Array.from(existentes.values()).sort((a, b) => a.localeCompare(b, "es-CO"));
  }, [productos]);

  const guardarProducto = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const categoriaFinal = categoria === "__nueva__" ? nuevaCategoria.trim() : categoria;
    const costo = Number(precioCompra);
    const venta = Number(precioVenta);

    if (venta < costo) {
      const confirmar = window.confirm(
        `Luka: el precio de venta ($${money(venta)}) es menor que el costo ($${money(costo)}). ¿Quieres registrar el producto con pérdida?`,
      );
      if (!confirmar) return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiClient<Producto>("/productos", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          categoria: categoriaFinal,
          precioCompra: costo,
          precioVenta: venta,
          stock: Number(stock),
          sedeId,
        }),
      });
      setNombre("");
      setCategoria("");
      setNuevaCategoria("");
      setPrecioCompra("");
      setPrecioVenta("");
      setStock("0");
      setShowForm(false);
      await cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-black text-foreground">Inventario básico</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Existencias, precios y productos que requieren reposición.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void cargar()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            disabled={sedeId === "all"}
            title={sedeId === "all" ? "Selecciona una sede para agregar productos" : "Agregar producto"}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <PackagePlus className="h-3.5 w-3.5" />}
            {showForm ? "Cerrar" : "Agregar producto"}
          </button>
        </div>
      </div>

      {sedeId === "all" && (
        <p className="mt-3 text-xs text-muted-foreground">Selecciona una sede específica para agregar productos.</p>
      )}

      {showForm && sedeId !== "all" && (
        <form onSubmit={guardarProducto} className="mt-5 grid gap-4 rounded-xl border border-border bg-background/70 p-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-foreground">
            Producto
            <input required maxLength={120} value={nombre} onChange={(event) => setNombre(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-foreground">
            Categoría
            <select required value={categoria} onChange={(event) => setCategoria(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600">
              <option value="" disabled>Selecciona una categoría</option>
              {categorias.map((item) => <option key={item} value={item}>{item}</option>)}
              <option value="__nueva__">Crear nueva categoría</option>
            </select>
          </label>
          {categoria === "__nueva__" && (
            <label className="grid gap-1.5 text-xs font-semibold text-foreground sm:col-span-2">
              Nueva categoría
              <input required maxLength={80} value={nuevaCategoria} onChange={(event) => setNuevaCategoria(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600" />
            </label>
          )}
          <label className="grid gap-1.5 text-xs font-semibold text-foreground">
            Costo de compra
            <input required type="number" min="0.01" step="0.01" value={precioCompra} onChange={(event) => setPrecioCompra(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-foreground">
            Precio de venta
            <input required type="number" min="0.01" step="0.01" value={precioVenta} onChange={(event) => setPrecioVenta(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-foreground">
            Existencias iniciales
            <input required type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600" />
          </label>
          <div className="flex items-end sm:justify-end">
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 sm:w-auto">
              {saving ? "Guardando…" : "Guardar producto"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && productos.length === 0 && (
        <p className="mt-5 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Aún no hay productos registrados en esta sede.
        </p>
      )}

      {!error && productos.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-3 pr-4">Producto</th>
                <th className="pb-3 pr-4">Categoría</th>
                <th className="pb-3 pr-4">Disponible</th>
                <th className="pb-3 pr-4">Entró</th>
                <th className="pb-3 pr-4">Vendido</th>
                <th className="pb-3 pr-4">Compra</th>
                <th className="pb-3">Venta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {productos.map((producto) => {
                const bajo = producto.stock <= producto.stockMinimo;
                return (
                  <tr key={producto.id}>
                    <td className="py-3 pr-4 font-bold text-foreground">{producto.nombre}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{producto.categoria || "Sin categoría"}</td>
                    <td className="py-3 pr-4">
                      <span className={bajo ? "font-bold text-amber-600 dark:text-amber-400" : "font-semibold text-foreground"}>
                        {producto.stock}
                      </span>
                      {bajo && <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400">Bajo</span>}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{comprados.get(producto.id) ?? 0}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{vendidos.get(producto.id) ?? 0}</td>
                    <td className="py-3 pr-4 text-muted-foreground">${money(producto.precioCompra)}</td>
                    <td className="py-3 font-semibold text-foreground">${money(producto.precioVenta)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
