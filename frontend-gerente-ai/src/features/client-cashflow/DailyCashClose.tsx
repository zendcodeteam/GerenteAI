import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, Minus, Plus } from "lucide-react";
import { DashboardTransactionItem } from "@/features/client-dashboard/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const getTodayKey = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
};

export function DailyCashClose({
  transactions,
}: {
  transactions: DashboardTransactionItem[];
}) {
  const todayKey = getTodayKey();
  const storageKey = `luka-daily-close-${localStorage.getItem("active_business_id") || "business"}-${localStorage.getItem("active_sede_id") || "all"}-${todayKey}`;
  const [realAmount, setRealAmount] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedAmount = localStorage.getItem(storageKey);
    setRealAmount(savedAmount ?? "");
    setIsSaved(Boolean(savedAmount));
  }, [storageKey]);

  const summary = useMemo(() => {
    const todayTransactions = transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.rawDate);
      return Number.isFinite(transactionDate.getTime()) && transactionDate.toISOString().slice(0, 10) === todayKey;
    });

    return todayTransactions.reduce(
      (result, transaction) => {
        if (transaction.type === "Convertida") return result;

        const isIncome = transaction.type === "Venta" || transaction.type === "Abono";
        if (isIncome) {
          result.income += transaction.amount;
        } else {
          result.expenses += transaction.amount;
        }

        return result;
      },
      { income: 0, expenses: 0 },
    );
  }, [todayKey, transactions]);

  const expectedAmount = summary.income - summary.expenses;
  const parsedRealAmount = Number(realAmount);
  const difference = realAmount === "" || !Number.isFinite(parsedRealAmount)
    ? null
    : parsedRealAmount - expectedAmount;

  const saveClose = () => {
    if (realAmount === "" || !Number.isFinite(parsedRealAmount)) return;
    localStorage.setItem(storageKey, realAmount);
    setIsSaved(true);
  };

  return (
    <section className="mb-8 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground sm:text-lg">Cierre de caja de hoy</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Compara lo registrado por Luka con el total real de tu jornada.
            </p>
          </div>
        </div>

        <span className="text-xs font-bold text-muted-foreground">{todayKey}</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold text-muted-foreground">Entradas registradas</p>
          <p className="mt-2 flex items-center gap-1 text-lg font-black text-emerald-600 dark:text-emerald-400">
            <Plus className="h-4 w-4" />
            {formatCurrency(summary.income)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold text-muted-foreground">Salidas registradas</p>
          <p className="mt-2 flex items-center gap-1 text-lg font-black text-rose-600 dark:text-rose-400">
            <Minus className="h-4 w-4" />
            {formatCurrency(summary.expenses)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="text-xs font-bold text-muted-foreground">Total esperado</p>
          <p className={`mt-2 text-lg font-black ${expectedAmount >= 0 ? "text-foreground" : "text-destructive"}`}>
            {formatCurrency(expectedAmount)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-2 block text-xs font-bold text-foreground">Total real conciliado</span>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-muted-foreground">$</span>
            <input
              type="number"
              min="0"
              value={realAmount}
              onChange={(event) => {
                setRealAmount(event.target.value);
                setIsSaved(false);
              }}
              placeholder="Ej. 250000"
              className="h-11 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-sm font-semibold text-foreground outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </label>
        <button
          type="button"
          onClick={saveClose}
          disabled={realAmount === "" || !Number.isFinite(parsedRealAmount)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {isSaved ? "Cierre guardado" : "Guardar cierre"}
        </button>
      </div>

      {difference !== null && (
        <p className={`mt-3 text-xs font-bold ${difference === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
          {difference === 0
            ? "La caja coincide con los movimientos registrados."
            : `Diferencia por revisar: ${formatCurrency(difference)}`}
        </p>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Este cierre se guarda en este dispositivo. Las ventas fiadas no se cuentan como entradas de caja hasta recibir su abono.
      </p>
    </section>
  );
}