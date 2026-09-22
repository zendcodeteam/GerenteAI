import { useMemo, useState } from "react";
import { BarChart3, Check, Target, TrendingDown, TrendingUp } from "lucide-react";
import { DashboardTransactionItem } from "../types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

type PeriodSummary = {
  income: number;
  expenses: number;
  balance: number;
};

function summarizeTransactions(
  transactions: DashboardTransactionItem[],
  start: number,
  end: number,
): PeriodSummary {
  return transactions.reduce(
    (summary, transaction) => {
      const timestamp = new Date(transaction.rawDate).getTime();
      if (!Number.isFinite(timestamp) || timestamp < start || timestamp >= end) {
        return summary;
      }

      if (transaction.type === "Convertida") return summary;

      const isIncome = transaction.type === "Venta" || transaction.type === "Abono";
      if (isIncome) {
        summary.income += transaction.amount;
      } else {
        summary.expenses += transaction.amount;
      }

      summary.balance = summary.income - summary.expenses;
      return summary;
    },
    { income: 0, expenses: 0, balance: 0 },
  );
}

const getProgress = (value: number, target: number) =>
  target > 0 ? Math.min(100, Math.max(0, Math.round((value / target) * 100))) : 0;

export function GoalsAndComparison({
  transactions,
}: {
  transactions: DashboardTransactionItem[];
}) {
  const storageKey = `luka-goals-${localStorage.getItem("active_business_id") || "business"}`;
  const [incomeGoal, setIncomeGoal] = useState(() => localStorage.getItem(`${storageKey}-income`) || "");
  const [balanceGoal, setBalanceGoal] = useState(() => localStorage.getItem(`${storageKey}-balance`) || "");
  const [isEditing, setIsEditing] = useState(false);

  const comparison = useMemo(() => {
    const now = Date.now();
    const current = summarizeTransactions(transactions, now - 30 * DAY_IN_MS, now);
    const previous = summarizeTransactions(transactions, now - 60 * DAY_IN_MS, now - 30 * DAY_IN_MS);

    return {
      current,
      previous,
      incomeChange: previous.income > 0 ? (current.income - previous.income) / previous.income : null,
      expenseChange: previous.expenses > 0 ? (current.expenses - previous.expenses) / previous.expenses : null,
      balanceChange: previous.balance !== 0 ? (current.balance - previous.balance) / Math.abs(previous.balance) : null,
    };
  }, [transactions]);

  const saveGoals = () => {
    if (incomeGoal) localStorage.setItem(`${storageKey}-income`, incomeGoal);
    else localStorage.removeItem(`${storageKey}-income`);

    if (balanceGoal) localStorage.setItem(`${storageKey}-balance`, balanceGoal);
    else localStorage.removeItem(`${storageKey}-balance`);

    setIsEditing(false);
  };

  const renderChange = (value: number | null, inverse = false) => {
    if (value === null) return <span className="text-muted-foreground">Sin referencia</span>;

    const isPositive = inverse ? value <= 0 : value >= 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    return (
      <span className={`inline-flex items-center gap-1 font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
        <Icon className="h-3.5 w-3.5" />
        {value >= 0 ? "+" : ""}{Math.round(value * 100)}%
      </span>
    );
  };

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground sm:text-lg">Evolución y metas</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Últimos 30 días frente a los 30 días anteriores.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:bg-muted"
        >
          <Target className="h-4 w-4" />
          {isEditing ? "Cerrar metas" : "Configurar metas"}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold text-muted-foreground">Ingresos</p>
          <p className="mt-2 text-lg font-black text-foreground">{formatCurrency(comparison.current.income)}</p>
          <p className="mt-1 text-xs">{renderChange(comparison.incomeChange)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold text-muted-foreground">Gastos</p>
          <p className="mt-2 text-lg font-black text-foreground">{formatCurrency(comparison.current.expenses)}</p>
          <p className="mt-1 text-xs">{renderChange(comparison.expenseChange, true)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold text-muted-foreground">Balance</p>
          <p className={`mt-2 text-lg font-black ${comparison.current.balance >= 0 ? "text-foreground" : "text-destructive"}`}>
            {formatCurrency(comparison.current.balance)}
          </p>
          <p className="mt-1 text-xs">{renderChange(comparison.balanceChange)}</p>
        </div>
      </div>

      {isEditing && (
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-5 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-xs font-bold text-foreground">Meta de ingresos mensuales</span>
            <input
              type="number"
              min="0"
              value={incomeGoal}
              onChange={(event) => setIncomeGoal(event.target.value)}
              placeholder="Ej. 5000000"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {incomeGoal && <ProgressBar value={comparison.current.income} target={Number(incomeGoal)} />}
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold text-foreground">Meta de balance mensual</span>
            <input
              type="number"
              min="0"
              value={balanceGoal}
              onChange={(event) => setBalanceGoal(event.target.value)}
              placeholder="Ej. 1500000"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {balanceGoal && <ProgressBar value={comparison.current.balance} target={Number(balanceGoal)} />}
          </label>
          <button
            type="button"
            onClick={saveGoals}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition hover:bg-blue-700 md:col-span-2"
          >
            <Check className="h-4 w-4" />
            Guardar metas
          </button>
        </div>
      )}
    </section>
  );
}

function ProgressBar({ value, target }: { value: number; target: number }) {
  const progress = getProgress(value, target);
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-[11px] font-bold text-muted-foreground">
        <span>{progress}% cumplido</span>
        <span>{formatCurrency(target)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}