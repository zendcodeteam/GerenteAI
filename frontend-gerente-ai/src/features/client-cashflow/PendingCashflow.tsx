import {
  useMemo,
  useState,
} from "react";

import {
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Lock,
  Check,
  MessageCircle,
} from "lucide-react";

import { fmt } from "@/shared/components/ui/ChartTooltip";

import {
  ClienteFiado,
  VentaFiada,
} from "@/features/client-dashboard/types";

export interface PendingCashflowProps {
  fiados: {
    sede: {
      id: string;
      nombre: string;
    };

    generadoEl: string;

    totales: {
      porCobrar: number;
      vencido: number;
      clientesConDeuda: number;
      ventasPendientes: number;
    };

    clientes: ClienteFiado[];
  } | null;

  isLoading?: boolean;

  onRegisterPayment: (
    clienteId: string,
    ventaId: string,
    monto: number,
  ) => Promise<void>;

  puedeVerFiados?: boolean;

  onUpgradePlan?: () => void;
}

interface PendingRow {
  id: string;

  ventaId: string;

  clienteId: string;

  fecha: string;

  fechaVencimiento: string | null;

  cliente: string;

  telefono: string | null;

  monto: number;

  diasRetraso: number;

  estado:
    | "critico"
    | "vencido"
    | "al_dia"
    | "proximo";

  venta: VentaFiada;
}

/**
 * Formatea una fecha para mostrarla
 * de forma corta en la tabla.
 */
const formatShortDate = (
  fecha: string | null,
) => {
  if (!fecha) {
    return "Sin vencimiento";
  }

  const date = new Date(fecha);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return date.toLocaleDateString(
    "es-CO",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
};

const getWhatsappUrl = (telefono: string, cliente: string, monto: number) => {
  const numero = telefono.replace(/\D/g, "");
  const mensaje = `Hola ${cliente}, te escribo para recordarte que tienes un saldo pendiente de ${fmt(monto)}. ¿Cuándo podrías realizar el abono?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
};

/**
 * Determina el estado de una venta
 * utilizando la información real del backend.
 */
const getEstado = (
  venta: VentaFiada,
): Pick<
  PendingRow,
  "estado" | "diasRetraso"
> => {
  /*
   * El backend ya informa si la venta
   * está vencida y cuántos días lleva
   * de atraso.
   */
  if (venta.vencida) {
    if (venta.diasDeAtraso >= 8) {
      return {
        estado: "critico",
        diasRetraso:
          venta.diasDeAtraso,
      };
    }

    return {
      estado: "vencido",
      diasRetraso:
        venta.diasDeAtraso,
    };
  }

  /*
   * Una venta sin fecha de vencimiento
   * no puede clasificarse como próxima.
   */
  if (!venta.fechaVencimiento) {
    return {
      estado: "al_dia",
      diasRetraso: 0,
    };
  }

  const ahora = new Date();

  const vencimiento =
    new Date(
      venta.fechaVencimiento,
    );

  if (
    Number.isNaN(
      vencimiento.getTime(),
    )
  ) {
    return {
      estado: "al_dia",
      diasRetraso: 0,
    };
  }

  const diferencia =
    vencimiento.getTime() -
    ahora.getTime();

  const dias = Math.ceil(
    diferencia / 86_400_000,
  );

  /*
   * Si la diferencia es 0 o negativa,
   * visualmente la tratamos como "vence hoy".
   */
  if (dias <= 0) {
    return {
      estado: "al_dia",
      diasRetraso: 0,
    };
  }

  return {
    estado: "proximo",
    diasRetraso: -dias,
  };
};

export function PendingCashflow({
  fiados,
  isLoading = false,
  onRegisterPayment,
  puedeVerFiados = true,
  onUpgradePlan,
}: PendingCashflowProps) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    payingId,
    setPayingId,
  ] = useState<string | null>(
    null,
  );

  const [
    paymentError,
    setPaymentError,
  ] = useState<string | null>(
    null,
  );

  /*
   * Convertimos:
   *
   * clientes[]
   *    └── ventas[]
   *
   * en una lista plana para la tabla.
   *
   * NO se crean datos ficticios.
   */
  const rows = useMemo(
    (): PendingRow[] => {
      if (!fiados || !Array.isArray(fiados.clientes)) {
        return [];
      }

      const result: PendingRow[] =
        [];

      for (const cliente of fiados.clientes) {
        if (!cliente || !Array.isArray(cliente.ventas)) {
          continue;
        }

        for (const venta of cliente.ventas) {
          /*
           * Protección adicional:
           * solamente mostramos deudas reales.
           */
          const saldo = Number(venta.saldoPendiente) || 0;
          if (
            saldo <= 0
          ) {
            continue;
          }

          const estado =
            getEstado(venta);

          result.push({
            id: `${cliente.id}-${venta.id}`,

            ventaId: venta.id,

            clienteId: cliente.id,

            fecha: formatShortDate(
              venta.fecha,
            ),

            fechaVencimiento:
              venta.fechaVencimiento,

            cliente:
              cliente.nombre,

            telefono:
              cliente.telefono,

            monto:
              saldo,

            diasRetraso:
              estado.diasRetraso,

            estado:
              estado.estado,

            /*
             * Conservamos la venta real.
             */
            venta,
          });
        }
      }

      /*
       * Orden:
       *
       * 1. Críticas
       * 2. Vencidas
       * 3. Próximas / al día
       *
       * Dentro de cada grupo,
       * mayor deuda primero.
       */
      return result.sort(
        (a, b) => {
          const priority = {
            critico: 0,
            vencido: 1,
            al_dia: 2,
            proximo: 3,
          };

          const priorityDifference =
            priority[a.estado] -
            priority[b.estado];

          if (
            priorityDifference !== 0
          ) {
            return priorityDifference;
          }

          return (
            b.monto -
            a.monto
          );
        },
      );
    },
    [fiados],
  );

  /*
   * ============================================================
   * PAYWALL GATING CUANDO EL PLAN NO INCLUYE FIADOS (PLAN 1)
   * ============================================================
   */
  if (puedeVerFiados === false) {
    return (
      <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-7 shadow-xs relative overflow-hidden flex flex-col justify-between h-full min-h-[460px] animate-in fade-in duration-300">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold mb-4 shadow-xs">
            <Lock className="w-3.5 h-3.5" />
            Disponible desde Plan Gerente ($39.900/mes)
          </div>

          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">
                Cuentas por Cobrar (Fiados)
              </h2>
              <p className="text-xs text-muted-foreground">
                Control de cartera y seguimiento a deudores
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mt-2 mb-6">
            Monitorea el dinero que tienes en la calle, antigüedad de las deudas de tus clientes, alertas automáticas de cobro y registro de abonos en tiempo real.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-xs font-medium text-foreground">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <span>Total por cobrar consolidado y cartera vencida</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-medium text-foreground">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <span>Registro de abonos parciales y totales al instante</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-medium text-foreground">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Check className="w-3 h-3" />
              </div>
              <span>Sincronización automática de abonos con tus ingresos de caja</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onUpgradePlan}
            className="w-full py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-slate-950 font-black text-sm rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            Mejorar a Plan Gerente
          </button>
        </div>
      </div>
    );
  }

  /*
   * Filtro de búsqueda.
   */
  const filteredRows =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return rows;
      }

      return rows.filter(
        (row) =>
          row.cliente
            .toLowerCase()
            .includes(term) ||
          (row.telefono &&
            row.telefono
              .toLowerCase()
              .includes(term)),
      );
    }, [rows, search]);

  /**
   * Registra un pago.
   *
   * El método se utiliza únicamente
   * para confirmación visual porque el
   * backend actual todavía no almacena
   * método de pago.
   */
  const handlePayment = async (
    row: PendingRow,
    method: string,
  ) => {
    if (!method) {
      return;
    }

    const confirmar =
      window.confirm(
        `¿Registrar pago de ${fmt(
          row.monto,
        )} para ${row.cliente}?\n\nMétodo seleccionado: ${method}`,
      );

    if (!confirmar) {
      return;
    }

    setPaymentError(null);

    setPayingId(row.id);

    try {
      /*
       * Enviamos la deuda REAL seleccionada.
       *
       * El backend se encargará de:
       *
       * Cliente.saldoPendiente
       * Venta.saldoPendiente
       * Abono
       */
      await onRegisterPayment(
        row.clienteId,
        row.ventaId,
        row.monto,
      );
    } catch (error: any) {
      console.error(
        "Error al registrar el pago:",
        error,
      );

      setPaymentError(
        error?.message ||
          "No se pudo registrar el pago.",
      );
    } finally {
      setPayingId(null);
    }
  };

  const totalCobrar =
    Number(fiados?.totales?.porCobrar) || 0;

  const totalVencido =
    Number(fiados?.totales?.vencido) || 0;

  const clientePrioritario = rows[0];
  const deudasVencidas = rows.filter(
    (row) => row.estado === "critico" || row.estado === "vencido",
  ).length;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* =========================================================
          RESUMEN
      ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
        {/* Total por cobrar */}
        <div className="bg-card border border-border rounded-2xl shadow-sm px-6 py-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Clock className="w-24 h-24" />
          </div>

          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Total por Cobrar
          </p>

          <p className="text-3xl font-black tracking-tight text-foreground">
            {fmt(totalCobrar)}
          </p>
        </div>

        {/* Cartera vencida */}
        <div className="bg-card border border-rose-500/20 rounded-2xl shadow-sm px-6 py-5 bg-rose-500/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <AlertTriangle className="w-24 h-24 text-rose-500" />
          </div>

          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-500 uppercase tracking-widest mb-3">
            Cartera Vencida
          </p>

          <div className="flex items-center gap-3">
            <p className="text-3xl font-black tracking-tight text-rose-600 dark:text-rose-500">
              {fmt(totalVencido)}
            </p>

            <AlertTriangle
              className="w-6 h-6 text-rose-500"
              strokeWidth={2.5}
            />
          </div>
        </div>
      </div>

      <div className="max-w-5xl rounded-2xl border border-amber-500/25 bg-amber-500/5 px-5 py-4 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Próxima acción recomendada
            </p>
            {clientePrioritario ? (
              <p className="mt-1 text-sm font-bold text-foreground">
                Prioriza el cobro a {clientePrioritario.cliente} por {fmt(clientePrioritario.monto)}.
              </p>
            ) : (
              <p className="mt-1 text-sm font-bold text-foreground">
                No hay clientes pendientes de cobro.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {deudasVencidas > 0
                ? `${deudasVencidas} ${deudasVencidas === 1 ? "deuda vencida requiere" : "deudas vencidas requieren"} seguimiento.`
                : "La cartera no tiene deudas vencidas en este momento."}
            </p>
          </div>
          {clientePrioritario?.telefono && (
            <a
              href={getWhatsappUrl(clientePrioritario.telefono, clientePrioritario.cliente, clientePrioritario.monto)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-[#20bd5a]"
            >
              <MessageCircle className="h-4 w-4" />
              Contactar por WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* =========================================================
          ERROR DE PAGO
      ========================================================== */}
      {paymentError && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 max-w-5xl">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />

          <div>
            <p className="font-bold">
              No se pudo registrar el pago
            </p>

            <p className="mt-1">
              {paymentError}
            </p>
          </div>
        </div>
      )}

      {/* =========================================================
          TABLA
      ========================================================== */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden max-w-5xl">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20 gap-4">
          <div className="relative group">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Buscar cliente o teléfono..."
              className="pl-9 pr-4 py-2 w-72 max-w-full bg-card border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
            />
          </div>

          <div className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
            {filteredRows.length}{" "}
            {filteredRows.length === 1
              ? "deuda"
              : "deudas"}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-x-auto">
          {isLoading && !fiados ? (
            <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />

              Cargando cartera...
            </div>
          ) : filteredRows.length ===
            0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>

              <p className="text-sm font-bold text-foreground">
                No hay cuentas pendientes
              </p>

              <p className="text-sm text-muted-foreground mt-1">
                No encontramos ventas fiadas
                con saldo pendiente.
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest w-36 whitespace-nowrap">
                    Fecha Venc.
                  </th>

                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    Cliente / Deudor
                  </th>

                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest w-40">
                    Estado
                  </th>

                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right w-32">
                    Saldo
                  </th>

                  <th className="px-6 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right w-40">
                    Acción
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {filteredRows.map(
                  (row) => {
                    const isPaying =
                      payingId ===
                      row.id;

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        {/* Fecha */}
                        <td className="px-6 py-4 text-sm text-muted-foreground font-medium whitespace-nowrap">
                          <div>
                            {formatShortDate(
                              row.fechaVencimiento,
                            )}
                          </div>

                          <div className="text-[10px] mt-0.5 opacity-70">
                            Venta{" "}
                            {row.fecha}
                          </div>
                        </td>

                        {/* Cliente */}
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-foreground">
                            {row.cliente}
                          </div>

                          {row.telefono && (
                            <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                              {row.telefono}
                            </div>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="px-6 py-4">
                          {row.estado ===
                            "critico" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 whitespace-nowrap border border-rose-200 dark:border-rose-800">
                              <Clock className="w-3 h-3" />

                              {row.diasRetraso}{" "}
                              días mora
                            </span>
                          )}

                          {row.estado ===
                            "vencido" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 whitespace-nowrap border border-amber-200 dark:border-amber-800">
                              <Clock className="w-3 h-3" />

                              {row.diasRetraso}{" "}
                              días mora
                            </span>
                          )}

                          {row.estado ===
                            "al_dia" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 whitespace-nowrap border border-emerald-200 dark:border-emerald-800">
                              Vence hoy
                            </span>
                          )}

                          {row.estado ===
                            "proximo" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 whitespace-nowrap border border-cyan-200 dark:border-cyan-800">
                              En{" "}
                              {Math.abs(
                                row.diasRetraso,
                              )}{" "}
                              días
                            </span>
                          )}
                        </td>

                        {/* Saldo */}
                        <td className="px-6 py-4 text-right tabular-nums">
                          <span className="text-sm font-black text-foreground">
                            {fmt(
                              row.monto,
                            )}
                          </span>
                        </td>

                        {/* Acción */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {row.telefono && (
                              <a
                                href={getWhatsappUrl(row.telefono, row.cliente, row.monto)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Escribir a ${row.cliente} por WhatsApp`}
                                aria-label={`Escribir a ${row.cliente} por WhatsApp`}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#128C7E] transition hover:bg-[#25D366]/30 dark:text-[#25D366]"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                            )}

                            <select
                              defaultValue=""
                              disabled={
                                isPaying
                              }
                              onChange={(
                                event,
                              ) => {
                                const method =
                                  event
                                    .target
                                    .value;

                                event.target.value =
                                  "";

                                void handlePayment(
                                  row,
                                  method,
                                );
                              }}
                              className="w-full bg-card border border-border text-foreground text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option
                                value=""
                                disabled
                              >
                                {isPaying
                                  ? "Registrando..."
                                  : "Marcar pago..."}
                              </option>

                              <option value="Transferencia">
                                Transferencia
                              </option>

                              <option value="Efectivo">
                                Efectivo
                              </option>

                              <option value="Tarjeta">
                                Tarjeta
                              </option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}