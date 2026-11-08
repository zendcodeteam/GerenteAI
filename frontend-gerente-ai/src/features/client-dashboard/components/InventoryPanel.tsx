import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ClipboardList,
  Package,
  PackagePlus,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface Producto {
  id: string;
  nombre: string;
  categoria?: string | null;
  stock: number;
  stockMinimo: number;
  alias?: string[];
  precioCompra: number | string;
  precioVenta: number | string;
  sedeId: string;
}

interface InventoryPanelProps {
  sedeId: string;
  /**
   * Si el plan VIGENTE del negocio incluye inventario.
   *
   * Llega como prop y no se consulta aqui a proposito: `usePlanPermissions`
   * es un hook con `useState`, no un contexto, asi que cada componente que lo
   * llama se queda con su propio estado aislado.
   */
  puedeGestionarInventario: boolean;
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

export function InventoryPanel({
  sedeId,
  transactions,
  puedeGestionarInventario,
}: InventoryPanelProps) {
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
  const [stockMinimo, setStockMinimo] = useState("0");
  const [alias, setAlias] = useState("");

  /** Producto que se está editando. null = el formulario crea uno nuevo. */
  const [editandoId, setEditandoId] = useState<string | null>(null);

  /**
   * Producto cuyo inventario se está ajustando.
   *
   * El stock NO se edita como un campo más del formulario: se cambia aquí,
   * enseñando de cuánto a cuánto va. Sobrescribir existencias en un formulario
   * cambia el mundo físico sin dejar rastro y sin preguntar nada, y es el
   * mismo criterio que sigue Luka por WhatsApp.
   */
  const [ajustando, setAjustando] = useState<Producto | null>(null);
  const [unidadesReales, setUnidadesReales] = useState("");

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre("");
    setCategoria("");
    setNuevaCategoria("");
    setPrecioCompra("");
    setPrecioVenta("");
    setStock("0");
    setStockMinimo("0");
    setAlias("");
  };

  const empezarEdicion = (producto: Producto) => {
    setEditandoId(producto.id);
    setNombre(producto.nombre);
    setCategoria(producto.categoria || "");
    setNuevaCategoria("");
    setPrecioCompra(String(producto.precioCompra));
    setPrecioVenta(String(producto.precioVenta));
    setStockMinimo(String(producto.stockMinimo));
    setAlias((producto.alias ?? []).join(", "));
    setAjustando(null);
    setError(null);
    setShowForm(true);
  };

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
    // Sin plan no se pide el catálogo: el backend responde 403 y lo único que
    // se consigue es un error en consola y una petición que nadie va a usar.
    if (!puedeGestionarInventario) return;
    void cargar();
  }, [sedeId, puedeGestionarInventario]);

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

    // El aviso se queda, pero ya no es la única guarda: el servidor rechaza un
    // producto a pérdida que no traiga este visto bueno explícito, así que la
    // respuesta del tendero hay que mandársela.
    const aPerdida = venta < costo;
    if (aPerdida) {
      const confirmar = window.confirm(
        `Luka: el precio de venta ($${money(venta)}) es menor que el costo ($${money(costo)}). ¿Quieres ${editandoId ? "dejarlo" : "registrarlo"} con pérdida?`,
      );
      if (!confirmar) return;
    }

    setSaving(true);
    setError(null);

    /*
     * Lo editable NO incluye las existencias.
     *
     * Cambiar el stock es un ajuste de conteo, no un dato del producto, y se
     * hace aparte enseñando de cuánto a cuánto va. Aquí solo van los datos
     * que describen al producto.
     */
    const datos = {
      nombre: nombre.trim(),
      categoria: categoriaFinal,
      precioCompra: costo,
      precioVenta: venta,
      stockMinimo: Number(stockMinimo) || 0,
      alias: alias
        .split(",")
        .map((valor) => valor.trim())
        .filter(Boolean),
      ...(aPerdida ? { aceptoVenderConPerdida: true } : {}),
    };

    try {
      if (editandoId) {
        await apiClient<Producto>(`/productos/${editandoId}`, {
          method: "PATCH",
          body: JSON.stringify(datos),
        });
      } else {
        await apiClient<Producto>("/productos", {
          method: "POST",
          body: JSON.stringify({
            ...datos,
            stock: Number(stock),
            sedeId,
          }),
        });
      }

      limpiarFormulario();
      setShowForm(false);
      await cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Corrige las existencias de un producto.
   *
   * Pide confirmación enseñando el antes y el después, igual que Luka por
   * WhatsApp. Y dice explícitamente que no mueve dinero: es la duda razonable
   * de quien corrige un conteo, y dejarla sin responder hace que no se use.
   */
  const confirmarAjuste = async () => {
    if (!ajustando) return;

    const unidades = Number(unidadesReales);
    if (!Number.isInteger(unidades) || unidades < 0) {
      setError("Las unidades deben ser un número entero de 0 en adelante.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiClient<Producto>(`/productos/${ajustando.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: unidades }),
      });
      setAjustando(null);
      setUnidadesReales("");
      await cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo ajustar el inventario.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Saca un producto del catálogo.
   *
   * Si ya tiene ventas o compras, el backend lo impide y explica por qué. Ese
   * mensaje se enseña tal cual: dice cuántos movimientos tiene y qué hacer en
   * su lugar, que es más útil que "no se pudo eliminar".
   */
  const borrarProducto = async (producto: Producto) => {
    const seguro = window.confirm(
      `¿Sacar ${producto.nombre} del catálogo? Esto no borra las ventas ni las compras que ya registraste.`,
    );
    if (!seguro) return;

    setSaving(true);
    setError(null);
    try {
      await apiClient(`/productos/${producto.id}`, { method: "DELETE" });
      if (editandoId === producto.id) limpiarFormulario();
      await cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo eliminar el producto.");
    } finally {
      setSaving(false);
    }
  };

  /*
   * Sin plan de pago no se pinta el inventario ni se piden sus datos.
   *
   * Esto es solo la cara: el backend responde 403 a cualquier petición de
   * inventario de un negocio gratuito, así que esconder el panel no es la
   * medida de seguridad, es la cortesía de no enseñar una puerta cerrada.
   *
   * No se dice "no puedes" y punto: se explica qué sí puede hacer con su plan
   * y se le ofrece el camino para mejorarlo.
   */
  if (!puedeGestionarInventario) {
    return (
      <section className="mt-6 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-black text-foreground">Inventario básico</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Llevar catálogo de productos está disponible en los planes pagos.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Con tu plan actual puedes registrar tus ventas y gastos con normalidad.
          Si quieres además controlar existencias, precios y reposición, mejora
          tu plan y tus productos aparecerán aquí.
        </p>
        {/*
          Lleva a la página de planes y no al modal de paywall: ese modal da
          por hecho que quien llega está en plan Gerente y siempre ofrece
          Administrador. A un negocio gratuito o vencido le diría que su plan
          actual es uno que no tiene, y le vendería un plan más caro del que
          necesita —con Gerente ya hay inventario—.
        */}
        <Link
          to="/subscription"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
        >
          Ver planes
        </Link>
      </section>
    );
  }

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
            onClick={() => {
              if (showForm) {
                limpiarFormulario();
                setShowForm(false);
              } else {
                limpiarFormulario();
                setShowForm(true);
              }
            }}
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
            {/*
              Renombrar casi nunca es lo que se quiere: el nombre es la llave
              con la que Luka reconoce el producto por WhatsApp, y cambiarlo
              deja de responder al "vendí 3 gaseosas" de toda la vida. Para
              llamarlo de otra forma están los alias.
            */}
            {editandoId && (
              <span className="text-[10px] font-normal text-muted-foreground">
                Luka reconoce el producto por este nombre en WhatsApp. Si solo
                quieres llamarlo de otra forma, añádelo como alias.
              </span>
            )}
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
          {/*
            Las existencias solo se piden al dar de alta. Al editar NO
            aparecen: cambiarlas es un ajuste de conteo y va por su propio
            camino, con el antes y el después a la vista.
          */}
          {!editandoId && (
            <label className="grid gap-1.5 text-xs font-semibold text-foreground">
              Existencias iniciales
              <input required type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600" />
            </label>
          )}
          <label className="grid gap-1.5 text-xs font-semibold text-foreground">
            Avisar para reponer cuando queden
            <input type="number" min="0" step="1" value={stockMinimo} onChange={(event) => setStockMinimo(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-foreground sm:col-span-2">
            Otros nombres (alias)
            <input maxLength={240} value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="gaseosita, gaseosa grande" className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600" />
            <span className="text-[10px] font-normal text-muted-foreground">
              Separados por comas. Luka también reconoce el producto por estos
              nombres cuando le dictas una venta.
            </span>
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 sm:justify-end">
            {editandoId && (
              <button
                type="button"
                onClick={() => {
                  limpiarFormulario();
                  setShowForm(false);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
            )}
            <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60">
              {saving
                ? "Guardando…"
                : editandoId
                  ? "Guardar cambios"
                  : "Guardar producto"}
            </button>
          </div>
        </form>
      )}

      {ajustando && (
        <div className="mt-5 rounded-xl border border-border bg-background/70 p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-black text-foreground">
              Ajustar existencias de {ajustando.nombre}
            </h3>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Esto solo corrige el conteo: no registra ninguna venta ni ningún
            gasto.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-foreground">
              ¿Cuántas unidades tienes?
              <input
                autoFocus
                type="number"
                min="0"
                step="1"
                value={unidadesReales}
                onChange={(event) => setUnidadesReales(event.target.value)}
                className="w-40 rounded-lg border border-border bg-card px-3 py-2 text-sm font-normal outline-none focus:border-emerald-600"
              />
            </label>

            {unidadesReales !== "" && (
              <p className="pb-2 text-xs text-muted-foreground">
                Antes <strong className="text-foreground">{ajustando.stock}</strong>
                {" → "}
                Después{" "}
                <strong className="text-foreground">
                  {Number(unidadesReales)}
                </strong>
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving || unidadesReales === ""}
              onClick={() => void confirmarAjuste()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Ajustando…" : "Confirmar ajuste"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAjustando(null);
                setUnidadesReales("");
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
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
                <th className="pb-3 pr-4">Venta</th>
                <th className="pb-3 text-right">Acciones</th>
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
                    <td className="py-3 pr-4 font-semibold text-foreground">${money(producto.precioVenta)}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Editar producto"
                          onClick={() => empezarEdicion(producto)}
                          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Ajustar existencias"
                          onClick={() => {
                            setAjustando(producto);
                            setUnidadesReales(String(producto.stock));
                            setError(null);
                          }}
                          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Sacar del catálogo"
                          onClick={() => void borrarProducto(producto)}
                          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
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
