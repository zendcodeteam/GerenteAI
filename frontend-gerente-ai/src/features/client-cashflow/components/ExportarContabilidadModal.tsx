import { useState } from "react";
import { Link } from "react-router";
import {
  X,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Lock,
  Check,
  ArrowRight,
} from "lucide-react";
import { contabilidadApi } from "../api/contabilidadApi";
import type { RangoFechas } from "../export/libroContable";

/**
 * Elige el periodo y descarga el libro contable.
 *
 * Los presets cubren lo que se pide el 95% de las veces (cierre de mes, del año,
 * histórico completo); el rango a medida queda para el contador que necesita
 * exactamente del 1 al 15. Poner solo el rango a medida obliga a todo el mundo a
 * elegir dos fechas para algo tan común como "este mes".
 */

interface Props {
  negocioId: string;
  negocioNombre: string;
  /** false = plan gratuito: en vez del selector se muestra qué trae el Excel. */
  esPago: boolean;
  planNombre: string;
  /** Si el plan contratado caduco, y como se llamaba. Ver EstadoPlan. */
  planVencido?: boolean;
  planContratadoNombre?: string | null;
  onClose: () => void;
}

/**
 * Lo que incluye el libro. Se lista tal cual en el panel de los planes pagos:
 * "exporta a Excel" no le dice nada a nadie; ver las seis hojas, sí.
 */
const CONTENIDO = [
  ["Estado de resultados", "Ingresos, costos, gastos y utilidad del periodo"],
  ["Libro de movimientos", "Cada venta, compra, gasto y abono con su fecha"],
  ["Balance", "Inventario y cartera valorizados a la fecha"],
  ["Cuentas por cobrar", "Cuánto te debe cada cliente, de mayor a menor"],
  ["Inventario", "Stock, costo y valor, con alertas de reposición"],
  ["Gastos por categoría", "En qué se te va la plata, en porcentaje"],
];

type Preset = "mes" | "trimestre" | "anio" | "todo" | "personalizado";

const inicioDeMes = (): Date => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const haceMeses = (meses: number): Date => {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
};

const inicioDeAnio = (): Date => new Date(new Date().getFullYear(), 0, 1);

/** Fin del día: si no, un movimiento de hoy a las 3 p. m. queda fuera. */
const finDelDia = (fecha: Date): Date => {
  const d = new Date(fecha);
  d.setHours(23, 59, 59, 999);
  return d;
};

const FORMATO_LARGO = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function ExportarContabilidadModal({
  negocioId,
  negocioNombre,
  esPago,
  planNombre,
  planVencido = false,
  planContratadoNombre = null,
  onClose,
}: Props) {
  const [preset, setPreset] = useState<Preset>("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const construirRango = (): RangoFechas => {
    const hoy = finDelDia(new Date());

    switch (preset) {
      case "mes":
        return {
          desde: inicioDeMes(),
          hasta: hoy,
          etiqueta: `${FORMATO_LARGO.format(inicioDeMes())} al ${FORMATO_LARGO.format(hoy)}`,
        };
      case "trimestre":
        return {
          desde: haceMeses(3),
          hasta: hoy,
          etiqueta: `Últimos 3 meses (al ${FORMATO_LARGO.format(hoy)})`,
        };
      case "anio":
        return {
          desde: inicioDeAnio(),
          hasta: hoy,
          etiqueta: `Año ${new Date().getFullYear()} (al ${FORMATO_LARGO.format(hoy)})`,
        };
      case "todo":
        return {
          desde: null,
          hasta: null,
          etiqueta: `Histórico completo (al ${FORMATO_LARGO.format(hoy)})`,
        };
      case "personalizado": {
        const d = desde ? new Date(`${desde}T00:00:00`) : null;
        const h = hasta ? finDelDia(new Date(`${hasta}T00:00:00`)) : hoy;
        return {
          desde: d,
          hasta: h,
          etiqueta: `${d ? FORMATO_LARGO.format(d) : "Inicio"} al ${FORMATO_LARGO.format(h)}`,
        };
      }
    }
  };

  const exportar = async () => {
    if (preset === "personalizado" && !desde) {
      setError("Elige la fecha de inicio.");
      return;
    }

    setDescargando(true);
    setError(null);

    try {
      // ExcelJS pesa cerca de medio mega: se carga aqui, cuando el usuario
      // realmente pide el archivo, y no en el arranque de la aplicacion.
      const [{ descargarLibroContable }, datos] = await Promise.all([
        import("../export/libroContable"),
        contabilidadApi.obtenerTodo(negocioId),
      ]);

      if (datos.sedes.length === 0) {
        setError("Este negocio todavía no tiene sedes, así que no hay movimientos que exportar.");
        return;
      }

      await descargarLibroContable({
        negocio: negocioNombre,
        rango: construirRango(),
        datos,
      });

      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos generar el archivo. Intenta de nuevo.",
      );
    } finally {
      setDescargando(false);
    }
  };

  const opciones: { value: Preset; label: string; detalle: string }[] = [
    { value: "mes", label: "Este mes", detalle: "Del 1 hasta hoy" },
    { value: "trimestre", label: "Últimos 3 meses", detalle: "Trimestre móvil" },
    { value: "anio", label: "Este año", detalle: `Enero a hoy` },
    { value: "todo", label: "Todo el histórico", detalle: "Desde el primer movimiento" },
    { value: "personalizado", label: "Elegir fechas", detalle: "Rango a medida" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Exportar contabilidad</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Excel con movimientos, cartera, inventario y estado de resultados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!esPago && (
          <div className="p-6 space-y-5">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-bold text-foreground">
                  {planVencido
                    ? planContratadoNombre
                      ? `Tu plan ${planContratadoNombre} está vencido`
                      : "Tu plan está vencido"
                    : "Incluido en los planes Gerente y Administrador"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {planVencido
                  ? "Sigues registrando tus movimientos y recibiendo resúmenes por WhatsApp, y toda tu información sigue guardada. Al renovar vuelves a poder descargar la contabilidad completa en Excel."
                  : `Tu plan ${planNombre} registra tus movimientos y te da resúmenes por WhatsApp. La contabilidad completa en Excel, lista para tu contador, viene con los planes pagos.`}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                Lo que descargas
              </p>
              <div className="space-y-2.5">
                {CONTENIDO.map(([titulo, detalle]) => (
                  <div key={titulo} className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground leading-tight">{titulo}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{detalle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Un archivo por periodo, con el formato que un contador espera recibir. Sin
              transcribir nada a mano.
            </p>
          </div>
        )}

        {esPago && (
        <>
        {/* Periodo */}
        <div className="p-6 space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Periodo
          </p>

          <div className="grid grid-cols-2 gap-2">
            {opciones.map((op) => (
              <button
                key={op.value}
                onClick={() => setPreset(op.value)}
                className={`text-left px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                  preset === op.value
                    ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                    : "border-border hover:border-emerald-500/40"
                }`}
              >
                <p className="text-sm font-bold text-foreground">{op.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{op.detalle}</p>
              </button>
            ))}
          </div>

          {preset === "personalizado" && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="block">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Desde
                </span>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Hasta
                </span>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </label>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            El periodo filtra los <strong>movimientos</strong>. El inventario y las cuentas por
            cobrar son saldos de hoy, así que siempre salen actualizados.
          </p>

          {error && (
            <div className="flex gap-2 items-start p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        </>
        )}

        {/* Acciones */}
        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            disabled={descargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-muted-foreground border border-border hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            {esPago ? "Cancelar" : "Ahora no"}
          </button>
          {esPago ? (
          <button
            onClick={() => void exportar()}
            disabled={descargando}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {descargando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando…
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                Descargar Excel
              </>
            )}
          </button>
          ) : (
            <Link
              to="/subscription"
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              Ver planes
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
