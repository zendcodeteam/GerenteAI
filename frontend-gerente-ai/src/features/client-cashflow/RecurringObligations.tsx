import { useEffect, useMemo, useState } from "react";
import { BellRing, CalendarDays, Plus, Trash2, WalletCards, X } from "lucide-react";
import { dashboardConfigApi } from "@/shared/api/dashboardConfigApi";

type Frequency = "semanal" | "mensual" | "anual";

type Obligation = {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  dueDay: number;
  active: boolean;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

const getStorageKey = () =>
  `luka-obligations-${localStorage.getItem("active_business_id") || "business"}-${localStorage.getItem("active_sede_id") || "all"}`;

export function RecurringObligations() {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("mensual");
  const [dueDay, setDueDay] = useState("1");

  const storageKey = getStorageKey();

  useEffect(() => {
    const sedeId = localStorage.getItem("active_sede_id") || undefined;
    const load = async () => {
      try {
        if (sedeId && sedeId !== "all") {
          const configs = await dashboardConfigApi.get(sedeId);
          const remote = configs.find((config) => config.clave === "obligations")?.valor.obligations;
          if (Array.isArray(remote)) {
            setObligations(remote as Obligation[]);
            return;
          }
        }
      } catch {
        // Conserva el fallback local si el backend aún no está desplegado.
      }

      try {
        const saved = localStorage.getItem(storageKey);
        setObligations(saved ? JSON.parse(saved) : []);
      } catch {
        setObligations([]);
      }
    };
    void load();
  }, [storageKey]);

  const activeObligations = useMemo(
    () => obligations.filter((obligation) => obligation.active),
    [obligations],
  );

  const monthlyCommitment = activeObligations.reduce((total, obligation) => {
    if (obligation.frequency === "semanal") return total + obligation.amount * 4.33;
    if (obligation.frequency === "anual") return total + obligation.amount / 12;
    return total + obligation.amount;
  }, 0);

  const persist = (next: Obligation[]) => {
    setObligations(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    const sedeId = localStorage.getItem("active_sede_id") || undefined;
    if (sedeId && sedeId !== "all") {
      void dashboardConfigApi.save("obligations", { obligations: next }, sedeId).catch(() => undefined);
    }
  };

  const addObligation = () => {
    const parsedAmount = Number(amount);
    const parsedDueDay = Number(dueDay);
    if (!name.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;

    persist([
      ...obligations,
      {
        id: `${Date.now()}-${name.trim()}`,
        name: name.trim(),
        amount: parsedAmount,
        frequency,
        dueDay: Math.min(31, Math.max(1, parsedDueDay || 1)),
        active: true,
      },
    ]);
    setName("");
    setAmount("");
    setFrequency("mensual");
    setDueDay("1");
    setIsAdding(false);
  };

  const toggleObligation = (id: string) => {
    persist(obligations.map((obligation) =>
      obligation.id === id ? { ...obligation, active: !obligation.active } : obligation,
    ));
  };

  const removeObligation = (id: string) => {
    persist(obligations.filter((obligation) => obligation.id !== id));
  };

  return (
    <section className="mb-8 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground sm:text-lg">Gastos recurrentes y obligaciones</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Registra salidas habituales para anticiparlas en tu flujo de caja.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          Añadir obligación
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-teal-500/20 bg-teal-500/5 px-4 py-3">
        <WalletCards className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
        <div>
          <p className="text-xs font-bold text-foreground">Compromiso mensual estimado</p>
          <p className="mt-1 text-lg font-black text-teal-700 dark:text-teal-300">{formatCurrency(monthlyCommitment)}</p>
        </div>
        <span className="ml-auto text-right text-xs text-muted-foreground">
          {activeObligations.length} activa{activeObligations.length === 1 ? "" : "s"}
        </span>
      </div>

      {isAdding && (
        <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">Nueva obligación</p>
            <button type="button" onClick={() => setIsAdding(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar formulario">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Arriendo" className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-teal-500 md:col-span-2" />
            <input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Monto" className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-teal-500" />
            <select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-teal-500">
              <option value="semanal">Semanal</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
            <label className="text-xs font-semibold text-muted-foreground md:col-span-2">
              Día de pago
              <input type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-teal-500" />
            </label>
            <button type="button" onClick={addObligation} disabled={!name.trim() || !amount} className="h-10 rounded-xl bg-teal-600 px-4 text-xs font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2">Guardar obligación</button>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        {obligations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            Aún no has registrado obligaciones recurrentes.
          </div>
        ) : obligations.map((obligation) => (
          <div key={obligation.id} className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center ${obligation.active ? "border-border" : "border-border/60 opacity-60"}`}>
            <CalendarDays className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{obligation.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{obligation.frequency} · día {obligation.dueDay} · {formatCurrency(obligation.amount)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => toggleObligation(obligation.id)} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${obligation.active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                {obligation.active ? "Activa" : "Pausada"}
              </button>
              <button type="button" onClick={() => removeObligation(obligation.id)} className="rounded-lg p-2 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600" aria-label={`Eliminar ${obligation.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Estas obligaciones son una planificación y no crean gastos contables. Más adelante podrán alimentar el pronóstico y los recordatorios automáticos.
      </p>
    </section>
  );
}