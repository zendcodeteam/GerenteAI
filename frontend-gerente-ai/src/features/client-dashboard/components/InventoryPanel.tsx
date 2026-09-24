import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Package, RefreshCw } from "lucide-react";
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
  }>;
}

const money = (value: number | string) =>
  Number(value).toLocaleString("es-CO", {
    maximumFractionDigits: 0,
  });

export function InventoryPanel({ sedeId, transactions }: InventoryPanelProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <button
          type="button"
          onClick={() => void cargar()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Actualizar
        </button>
      </div>

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
