import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, Minus, Plus } from "lucide-react";
import { DashboardTransactionItem } from "@/features/client-dashboard/types";
import { dashboardConfigApi } from "@/shared/api/dashboardConfigApi";

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
  const [realCash, setRealCash] = useState("");
  const [realTransfer, setRealTransfer] = useState("");
  const [realCard, setRealCard] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const sedeId = localStorage.getItem("active_sede_id") || undefined;
    const load = async () => {
      try {
        if (sedeId && sedeId !== "all") {
          const configs = await dashboardConfigApi.get(sedeId);
          const remote = configs.find((config) => config.clave === "daily-close")?.valor;
          if (typeof remote?.date === "string" && remote.date === todayKey) {
            setRealCash(typeof remote.cash === "number" ? String(remote.cash) : "");
            setRealTransfer(typeof remote.transfer === "number" ? String(remote.transfer) : "");
            setRealCard(typeof remote.card === "number" ? String(remote.card) : "");
            setIsSaved(true);
            return;
          }
        }
      } catch {
        // Conserva el fallback local si el backend aún no está desplegado.
      }

      const savedAmount = localStorage.getItem(storageKey);
      setRealCash(savedAmount ?? "");
      setRealTransfer("");
      setRealCard("");
      setIsSaved(Boolean(savedAmount));
    };
    void load();
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
          const method = transaction.paymentMethod.toLowerCase();
          if (method.includes("transfer")) result.transfer += transaction.amount;
          else if (method.includes("tarjeta") || method.includes("card")) result.card += transaction.amount;
          else if (transaction.type === "Venta") result.cash += transaction.amount;
        } else {
          result.expenses += transaction.amount;
        }

        return result;
      },
      { income: 0, expenses: 0, cash: 0, transfer: 0, card: 0 },
    );
  }, [todayKey, transactions]);

  const expectedAmount = summary.income - summary.expenses;
  const parsedRealCash = Number(realCash) || 0;
  const parsedRealTransfer = Number(realTransfer) || 0;
  const parsedRealCard = Number(realCard) || 0;
  const hasRealValues = realCash !== "" || realTransfer !== "" || realCard !== "";
  const realTotal = parsedRealCash + parsedRealTransfer + parsedRealCard;
  const difference = !hasRealValues
    ? null
    : realTotal - expectedAmount;

  const saveClose = () => {
    if (!hasRealValues) return;
    localStorage.setItem(storageKey, String(realTotal));
    const sedeId = localStorage.getItem("active_sede_id") || undefined;
    if (sedeId && sedeId !== "all") {
      void dashboardConfigApi.save("daily-close", {
        date: todayKey,
        cash: parsedRealCash,
        transfer: parsedRealTransfer,
        card: parsedRealCard,
        amount: realTotal,
      }, sedeId).catch(() => undefined);
    }
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

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <ExpectedCard label="Efectivo" value={summary.cash} />
        <ExpectedCard label="Transferencias" value={summary.transfer} />
        <ExpectedCard label="Tarjetas" value={summary.card} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-3">
        <RealInput label="Efectivo real" value={realCash} onChange={setRealCash} />
        <RealInput label="Transferencias reales" value={realTransfer} onChange={setRealTransfer} />
        <RealInput label="Tarjetas reales" value={realCard} onChange={setRealCard} />
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Total real conciliado: <strong className="text-foreground">{formatCurrency(realTotal)}</strong></p>
        <button
          type="button"
          onClick={saveClose}
          disabled={!hasRealValues}
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

function ExpectedCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-xs font-bold text-muted-foreground">Esperado: {label}</p>
      <p className="mt-2 text-base font-black text-foreground">{formatCurrency(value)}</p>
    </div>
  );
}

function RealInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-2 block text-xs font-bold text-foreground">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-muted-foreground">$</span>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className="h-11 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-sm font-semibold text-foreground outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
        />
      </div>
    </label>
  );
}