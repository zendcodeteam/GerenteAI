import { useMemo, useState } from "react";
import { Calculator, CircleDollarSign, Minus, Plus, RotateCcw, WalletCards } from "lucide-react";
import { ReporteFinanciero, ReporteFiados } from "../types";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

export function FinancialSimulator({
  metrics,
  fiados,
}: {
  metrics: ReporteFinanciero;
  fiados: ReporteFiados | null;
}) {
  const [salesIncrease, setSalesIncrease] = useState(0);
  const [newExpense, setNewExpense] = useState(0);
  const [recoveryPercentage, setRecoveryPercentage] = useState(0);

  const scenario = useMemo(() => {
    const income = metrics.ingresos?.total ?? 0;
    const expenses = metrics.egresos?.total ?? 0;
    const pendingReceivables = fiados?.totales?.porCobrar ?? 0;
    const currentBalance = metrics.balance ?? income - expenses;
    const additionalSales = income * (salesIncrease / 100);
    const recoveredReceivables = pendingReceivables * (recoveryPercentage / 100);
    const projectedIncome = income + additionalSales + recoveredReceivables;
    const projectedExpenses = expenses + newExpense;
    const projectedBalance = projectedIncome - projectedExpenses;

    return {
      currentBalance,
      projectedBalance,
      change: projectedBalance - currentBalance,
      additionalSales,
      recoveredReceivables,
    };
  }, [fiados, metrics, newExpense, recoveryPercentage, salesIncrease]);

  const reset = () => {
    setSalesIncrease(0);
    setNewExpense(0);
    setRecoveryPercentage(0);
  };

  return (
    <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground sm:text-lg">Simulador financiero</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Prueba escenarios sobre tus cifras actuales sin modificar tus registros.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restablecer
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SimulatorControl
          label="Aumentar ventas"
          description="Incremento sobre tus ingresos actuales"
          value={salesIncrease}
          min={0}
          max={100}
          step={5}
          suffix="%"
          onChange={setSalesIncrease}
          icon={<Plus className="h-4 w-4" />}
        />
        <SimulatorControl
          label="Nuevo gasto"
          description="Salida adicional que quieres evaluar"
          value={newExpense}
          min={0}
          max={10000000}
          step={50000}
          suffix=" COP"
          onChange={setNewExpense}
          icon={<Minus className="h-4 w-4" />}
        />
        <SimulatorControl
          label="Recuperar cartera"
          description={`Porcentaje de ${formatCurrency(fiados?.totales?.porCobrar ?? 0)} pendiente`}
          value={recoveryPercentage}
          min={0}
          max={100}
          step={5}
          suffix="%"
          onChange={setRecoveryPercentage}
          icon={<WalletCards className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-3">
        <ResultCard label="Balance actual" value={scenario.currentBalance} />
        <ResultCard label="Balance simulado" value={scenario.projectedBalance} highlighted />
        <ResultCard label="Cambio del escenario" value={scenario.change} showSign />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CircleDollarSign className="h-3.5 w-3.5 text-emerald-500" />Ventas adicionales: {formatCurrency(scenario.additionalSales)}</span>
        <span className="inline-flex items-center gap-1.5"><WalletCards className="h-3.5 w-3.5 text-sky-500" />Cartera recuperada: {formatCurrency(scenario.recoveredReceivables)}</span>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Simulación orientativa basada en el periodo seleccionado. No representa una predicción garantizada ni registra movimientos automáticamente.
      </p>
    </section>
  );
}

function SimulatorControl({
  label,
  description,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-background text-fuchsia-600 dark:text-fuchsia-400">{icon}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 accent-fuchsia-600"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))}
          className="h-9 w-28 rounded-lg border border-border bg-background px-2 text-right text-xs font-bold text-foreground outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20"
          aria-label={label}
        />
        <span className="w-10 text-xs font-bold text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  highlighted = false,
  showSign = false,
}: {
  label: string;
  value: number;
  highlighted?: boolean;
  showSign?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${highlighted ? "border-fuchsia-500/30 bg-fuchsia-500/5" : "border-border bg-muted/30"}`}>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-black ${value >= 0 ? "text-foreground" : "text-destructive"}`}>
        {showSign && value > 0 ? "+" : ""}{formatCurrency(value)}
      </p>
    </div>
  );
}