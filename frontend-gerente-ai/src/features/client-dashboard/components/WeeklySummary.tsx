import { useMemo } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { DashboardTransactionItem, ReporteFiados } from "../types";
import { lukaWhatsappUrl } from "@/lib/whatsapp";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

type Summary = {
  income: number;
  expenses: number;
  balance: number;
  sales: number;
};

function summarize(transactions: DashboardTransactionItem[], start: number, end: number): Summary {
  return transactions.reduce(
    (summary, transaction) => {
      const timestamp = new Date(transaction.rawDate).getTime();
      if (!Number.isFinite(timestamp) || timestamp < start || timestamp >= end || transaction.type === "Convertida") {
        return summary;
      }

      const isIncome = transaction.type === "Venta" || transaction.type === "Abono";
      if (isIncome) {
        summary.income += transaction.amount;
        if (transaction.type === "Venta") summary.sales += 1;
      } else {
        summary.expenses += transaction.amount;
      }
      summary.balance = summary.income - summary.expenses;
      return summary;
    },
    { income: 0, expenses: 0, balance: 0, sales: 0 },
  );
}

export function WeeklySummary({
  transactions,
  fiados,
}: {
  transactions: DashboardTransactionItem[];
  fiados: ReporteFiados | null;
}) {
  const summary = useMemo(() => {
    const now = Date.now();
    const current = summarize(transactions, now - 7 * DAY_IN_MS, now);
    const previous = summarize(transactions, now - 14 * DAY_IN_MS, now - 7 * DAY_IN_MS);
    const change = previous.balance !== 0 ? (current.balance - previous.balance) / Math.abs(previous.balance) : null;
    const actions: string[] = [];

    if ((fiados?.totales?.vencido ?? 0) > 0) {
      actions.push(`Prioriza cobrar ${formatCurrency(fiados?.totales.vencido ?? 0)} de cartera vencida.`);
    } else if ((fiados?.totales?.porCobrar ?? 0) > 0) {
      actions.push(`Haz seguimiento a ${formatCurrency(fiados?.totales?.porCobrar ?? 0)} pendiente por cobrar.`);
    }

    if (current.expenses > current.income && current.income > 0) {
      actions.push("Revisa los gastos de esta semana antes de asumir nuevos compromisos.");
    } else if (current.sales === 0) {
      actions.push("Registra las ventas pendientes para mantener el resumen actualizado.");
    }

    if (change !== null && change < -0.2) {
      actions.push("Compara tus ventas con la semana anterior y revisa qué cambió.");
    } else if (current.balance >= 0) {
      actions.push("Mantén el ritmo y revisa tus metas para la próxima semana.");
    }

    while (actions.length < 3) {
      actions.push("Consulta a Luka por el siguiente paso más importante para tu negocio.");
    }

    return { current, previous, change, actions: actions.slice(0, 3) };
  }, [fiados, transactions]);

  const isPositive = summary.current.balance >= 0;
  const hasActivity = summary.current.income > 0 || summary.current.expenses > 0 || summary.current.sales > 0;

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground sm:text-lg">Resumen de tu semana</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Resultados, alertas y próximos pasos basados en tus movimientos reales.
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {isPositive ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {isPositive ? "Balance positivo" : "Requiere atención"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryMetric label="Ingresos" value={formatCurrency(summary.current.income)} />
        <SummaryMetric label="Gastos" value={formatCurrency(summary.current.expenses)} />
        <SummaryMetric
          label="Balance"
          value={formatCurrency(summary.current.balance)}
          tone={isPositive ? "positive" : "negative"}
          footer={summary.change === null ? "Sin semana de referencia" : `${summary.change >= 0 ? "+" : ""}${Math.round(summary.change * 100)}% vs. semana anterior`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border pt-5 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Alertas</p>
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4">
            {summary.current.balance < 0 ? <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" /> : <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />}
            <p className="text-sm leading-relaxed text-foreground">
              {!hasActivity
                ? "Esta semana no se registraron movimientos. Usa Luka para registrar tus ventas, gastos o abonos y empezar a tomar decisiones con datos reales."
                : summary.current.balance < 0
                ? "Los gastos superaron los ingresos esta semana. Revisa el flujo antes de comprometer más dinero."
                : `${summary.current.sales} venta${summary.current.sales === 1 ? "" : "s"} registrada${summary.current.sales === 1 ? "" : "s"} esta semana y un balance de ${formatCurrency(summary.current.balance)}.`}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Tres acciones recomendadas</p>
          <ol className="mt-3 space-y-2">
            {summary.actions.map((action, index) => (
              <li key={`${action}-${index}`} className="flex items-start gap-2 text-sm text-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-black text-emerald-700 dark:text-emerald-400">{index + 1}</span>
                <span className="leading-relaxed">{action}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Link to="/cashflow" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-400">
        Ver flujo de caja completo
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
      {!hasActivity && (
        <a
          href={lukaWhatsappUrl("Hola Luka, quiero registrar los movimientos de mi negocio")}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-4 inline-flex items-center gap-2 text-xs font-bold text-[#128C7E] transition hover:text-[#0b6f63] dark:text-[#25D366]"
        >
          Escribirle a Luka por WhatsApp
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      )}
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "default",
  footer,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
  footer?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className={`mt-2 text-lg font-black ${tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>{value}</p>
      {footer && <p className="mt-1 text-xs text-muted-foreground">{footer}</p>}
    </div>
  );
}