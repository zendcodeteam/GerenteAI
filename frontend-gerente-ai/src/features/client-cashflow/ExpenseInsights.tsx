import { useMemo } from "react";
import { AlertTriangle, CalendarRange, ReceiptText, TrendingUp } from "lucide-react";
import { DashboardTransactionItem } from "@/features/client-dashboard/types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function ExpenseInsights({
  transactions,
}: {
  transactions: DashboardTransactionItem[];
}) {
  const insights = useMemo(() => {
    const now = Date.now();
    const expenses = transactions.filter(
      (transaction) => transaction.type === "Gasto" || transaction.type === "Compra",
    );

    const recentExpenses = expenses.filter((transaction) => {
      const timestamp = new Date(transaction.rawDate).getTime();
      return Number.isFinite(timestamp) && timestamp >= now - 30 * DAY_IN_MS;
    });

    const previousExpenses = expenses.filter((transaction) => {
      const timestamp = new Date(transaction.rawDate).getTime();
      return Number.isFinite(timestamp) && timestamp >= now - 60 * DAY_IN_MS && timestamp < now - 30 * DAY_IN_MS;
    });

    const recentTotal = recentExpenses.reduce((total, transaction) => total + transaction.amount, 0);
    const previousTotal = previousExpenses.reduce((total, transaction) => total + transaction.amount, 0);
    const growth = previousTotal > 0 ? (recentTotal - previousTotal) / previousTotal : null;

    const categories = new Map<string, { total: number; count: number }>();
    for (const transaction of recentExpenses) {
      const category = transaction.paymentMethod || (transaction.type === "Compra" ? "Compras" : "Gastos generales");
      const current = categories.get(category) ?? { total: 0, count: 0 };
      categories.set(category, {
        total: current.total + transaction.amount,
        count: current.count + 1,
      });
    }

    const rankedCategories = [...categories.entries()]
      .map(([name, values]) => ({ name, ...values }))
      .sort((first, second) => second.total - first.total);

    return {
      recentTotal,
      growth,
      topCategory: rankedCategories[0] ?? null,
      recurringCandidate: rankedCategories.find((category) => category.count >= 2) ?? null,
    };
  }, [transactions]);

  if (!insights.recentTotal) return null;

  return (
    <section className="mb-8 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <ReceiptText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-black text-foreground sm:text-lg">Alertas de gastos</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Patrones de tus compras y gastos de los últimos 30 días.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold text-muted-foreground">Gasto registrado</p>
          <p className="mt-2 text-lg font-black text-foreground">{formatCurrency(insights.recentTotal)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Últimos 30 días</p>
        </div>

        <div className={`rounded-2xl border p-4 ${insights.growth !== null && insights.growth > 0.2 ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-muted/30"}`}>
          <p className="text-xs font-bold text-muted-foreground">Variación del gasto</p>
          <p className={`mt-2 flex items-center gap-1 text-lg font-black ${insights.growth !== null && insights.growth > 0.2 ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>
            <TrendingUp className="h-4 w-4" />
            {insights.growth === null ? "Sin referencia" : `${insights.growth >= 0 ? "+" : ""}${Math.round(insights.growth * 100)}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Frente a los 30 días anteriores</p>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-bold text-muted-foreground">Mayor concentración</p>
          <p className="mt-2 truncate text-lg font-black text-foreground">{insights.topCategory?.name ?? "Sin datos"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {insights.topCategory ? formatCurrency(insights.topCategory.total) : ""}
          </p>
        </div>
      </div>

      {insights.growth !== null && insights.growth > 0.2 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-orange-500/25 bg-orange-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
          <div>
            <p className="text-sm font-bold text-foreground">Tus gastos están creciendo más de lo habitual.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Revisa la categoría {insights.topCategory?.name ?? "con mayor concentración"} antes de asumir nuevos compromisos.
            </p>
          </div>
        </div>
      )}

      {insights.recurringCandidate && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/5 px-4 py-3">
          <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
          <div>
            <p className="text-sm font-bold text-foreground">Posible gasto recurrente detectado</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              “{insights.recurringCandidate.name}” aparece {insights.recurringCandidate.count} veces este mes. Confirma si corresponde a una obligación fija para tenerla en cuenta en futuras proyecciones.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}