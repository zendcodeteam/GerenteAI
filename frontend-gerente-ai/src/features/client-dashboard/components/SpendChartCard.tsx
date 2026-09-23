import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  PieChart as PieIcon,
  Layers,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { ReporteFinanciero, PeriodoTipo, DashboardTransactionItem } from '../types';
import { formatNumber } from '../utils/formatters';

interface SpendChartCardProps {
  metrics?: ReporteFinanciero;
  transactions?: DashboardTransactionItem[];
  periodo?: PeriodoTipo;
  onPeriodoChange?: (periodo: PeriodoTipo) => void;
  isLoading?: boolean;
  sedeName?: string;
  isConsolidated?: boolean;
}

const DYNAMIC_PALETTE = [
  '#8b5cf6', // Púrpura neón (Compras/Insumos)
  '#f43f5e', // Rose / Coral (Nómina/Gastos)
  '#f59e0b', // Ámbar dorado (Arriendo)
  '#06b6d4', // Cian eléctrico (Servicios)
  '#3b82f6', // Azul índigo (Transporte)
  '#ec4899', // Magenta (Marketing)
  '#10b981', // Esmeralda (Operación)
  '#64748b', // Slate (Otros)
];

/*
 * ============================================================
 * UTILIDADES DE COMPARACIÓN ESTRICTA DE FECHAS
 * ============================================================
 */
function isSameDay(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function isWithinLast7Days(date: Date, now: Date): boolean {
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return date >= start && date <= end;
}

function isSameMonthAndYear(date: Date, now: Date): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function isWithinLast6Months(date: Date, now: Date): boolean {
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return date >= start && date <= end;
}

function isSameYear(date: Date, now: Date): boolean {
  return date.getFullYear() === now.getFullYear();
}

export function SpendChartCard({
  metrics,
  transactions = [],
  periodo = 'semanal',
  onPeriodoChange,
  isLoading = false,
  sedeName,
  isConsolidated = false,
}: SpendChartCardProps) {
  /*
   * ============================================================
   * 1. FILTRADO ESTRICTO DE TRANSACCIONES POR RANGO REAL DE FECHA
   * ============================================================
   */
  const filteredTransactions = useMemo(() => {
    const now = new Date();

    return transactions.filter((tx) => {
      if (!tx.rawDate) return false;
      const txDate = new Date(tx.rawDate);
      if (isNaN(txDate.getTime())) return false;

      if (periodo === 'diario') {
        return isSameDay(txDate, now);
      }
      if (periodo === 'semanal') {
        return isWithinLast7Days(txDate, now);
      }
      if (periodo === 'mensual') {
        return isSameMonthAndYear(txDate, now);
      }
      if (periodo === 'semestral') {
        return isWithinLast6Months(txDate, now);
      }
      if (periodo === 'anual') {
        return isSameYear(txDate, now);
      }
      return true;
    });
  }, [transactions, periodo]);

  /*
   * ============================================================
   * 2. TOTALES Y MÉTRICAS COMPUTADAS DEL PERÍODO
   * ============================================================
   */
  const computedIngresosTotal = useMemo(() => {
    if (metrics?.ingresos?.total && metrics.ingresos.total > 0) return metrics.ingresos.total;
    return filteredTransactions
      .filter((t) => t.type === 'Venta' || t.type === 'Abono')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [metrics, filteredTransactions]);

  const computedEgresosTotal = useMemo(() => {
    if (metrics?.egresos?.total && metrics.egresos.total > 0) return metrics.egresos.total;
    return filteredTransactions
      .filter((t) => t.type === 'Gasto' || t.type === 'Compra')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [metrics, filteredTransactions]);

  const ingresosTotal = computedIngresosTotal;
  const egresosTotal = computedEgresosTotal;
  const margenNeto = ingresosTotal - egresosTotal;
  const esRentable = margenNeto >= 0;

  const rentabilidadPct =
    ingresosTotal > 0
      ? ((margenNeto / ingresosTotal) * 100).toFixed(1)
      : egresosTotal > 0
      ? '-100.0'
      : '0.0';

  /*
   * ============================================================
   * 2. ADAPTADOR DE DATOS TEMPORALES (ÁREA DE FLUJO CONTINUO)
   * ============================================================
   */
  const timelineData = useMemo(() => {
    // Modo Multi-Sede Consolidado
    if (metrics?.sedes && metrics.sedes.length > 1) {
      return metrics.sedes.map((s) => ({
        name: s.sede.nombre.length > 12 ? `${s.sede.nombre.slice(0, 10)}…` : s.sede.nombre,
        fullName: s.sede.nombre,
        income: s.ingresos.total,
        outcome: s.egresos.total,
        net: s.ingresos.total - s.egresos.total,
      }));
    }

    const now = new Date();

    // Modo Diario -> 6 ranuras de 4 horas para el día de hoy
    if (periodo === 'diario') {
      const buckets = [
        { name: '00h', label: '00:00 - 04:00', minH: 0, maxH: 4, income: 0, outcome: 0 },
        { name: '04h', label: '04:00 - 08:00', minH: 4, maxH: 8, income: 0, outcome: 0 },
        { name: '08h', label: '08:00 - 12:00', minH: 8, maxH: 12, income: 0, outcome: 0 },
        { name: '12h', label: '12:00 - 16:00', minH: 12, maxH: 16, income: 0, outcome: 0 },
        { name: '16h', label: '16:00 - 20:00', minH: 16, maxH: 20, income: 0, outcome: 0 },
        { name: '20h', label: '20:00 - 24:00', minH: 20, maxH: 24, income: 0, outcome: 0 },
      ];

      filteredTransactions.forEach((tx) => {
        const hour = new Date(tx.rawDate).getHours();
        const bucket = buckets.find((b) => hour >= b.minH && hour < b.maxH) || buckets[buckets.length - 1];
        if (tx.type === 'Gasto' || tx.type === 'Compra') {
          bucket.outcome += tx.amount;
        } else {
          bucket.income += tx.amount;
        }
      });

      return buckets.map((b) => ({
        name: b.name,
        fullName: b.label,
        income: b.income,
        outcome: b.outcome,
        net: b.income - b.outcome,
      }));
    }

    // Modo Semanal -> 7 Días reales continuos (Últimos 7 días)
    if (periodo === 'semanal') {
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const weekBuckets: Record<string, { income: number; outcome: number; full: string; dateObj: Date }> = {};

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayKey = `${days[d.getDay()]} ${d.getDate()}`;
        weekBuckets[dayKey] = {
          income: 0,
          outcome: 0,
          full: `${days[d.getDay()]}, ${d.getDate()} de ${d.toLocaleString('es-CO', { month: 'short' })}`,
          dateObj: d,
        };
      }

      filteredTransactions.forEach((tx) => {
        const d = new Date(tx.rawDate);
        const dayKey = `${days[d.getDay()]} ${d.getDate()}`;
        if (weekBuckets[dayKey]) {
          if (tx.type === 'Gasto' || tx.type === 'Compra') {
            weekBuckets[dayKey].outcome += tx.amount;
          } else {
            weekBuckets[dayKey].income += tx.amount;
          }
        }
      });

      return Object.entries(weekBuckets).map(([name, val]) => ({
        name,
        fullName: val.full,
        income: val.income,
        outcome: val.outcome,
        net: val.income - val.outcome,
      }));
    }

    // Modo Mensual -> 4 Semanas del Mes actual
    if (periodo === 'mensual') {
      const weeks = [
        { name: 'Sem 1', label: 'Días 1 al 7', minD: 1, maxD: 7, income: 0, outcome: 0 },
        { name: 'Sem 2', label: 'Días 8 al 14', minD: 8, maxD: 14, income: 0, outcome: 0 },
        { name: 'Sem 3', label: 'Días 15 al 21', minD: 15, maxD: 21, income: 0, outcome: 0 },
        { name: 'Sem 4', label: 'Días 22 al 31', minD: 22, maxD: 31, income: 0, outcome: 0 },
      ];

      filteredTransactions.forEach((tx) => {
        const dayOfMonth = new Date(tx.rawDate).getDate();
        const week = weeks.find((w) => dayOfMonth >= w.minD && dayOfMonth <= w.maxD) || weeks[weeks.length - 1];
        if (tx.type === 'Gasto' || tx.type === 'Compra') {
          week.outcome += tx.amount;
        } else {
          week.income += tx.amount;
        }
      });

      return weeks.map((w) => ({
        name: w.name,
        fullName: `${w.name} (${w.label})`,
        income: w.income,
        outcome: w.outcome,
        net: w.income - w.outcome,
      }));
    }

    // Modo Semestral -> Últimos 6 meses reales en orden cronológico
    if (periodo === 'semestral') {
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const fullMonthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const sixMonthBuckets = [];

      for (let i = 5; i >= 0; i--) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = targetDate.getMonth();
        const y = targetDate.getFullYear();
        sixMonthBuckets.push({
          key: `${y}-${m}`,
          name: monthNames[m],
          fullName: `${fullMonthNames[m]} ${y}`,
          income: 0,
          outcome: 0,
        });
      }

      filteredTransactions.forEach((tx) => {
        const d = new Date(tx.rawDate);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const bucket = sixMonthBuckets.find((b) => b.key === key);
        if (bucket) {
          if (tx.type === 'Gasto' || tx.type === 'Compra') {
            bucket.outcome += tx.amount;
          } else {
            bucket.income += tx.amount;
          }
        }
      });

      return sixMonthBuckets.map((b) => ({
        name: b.name,
        fullName: b.fullName,
        income: b.income,
        outcome: b.outcome,
        net: b.income - b.outcome,
      }));
    }

    // Modo Anual -> 12 Meses del año calendario (Ene a Dic)
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const fullMonthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const currentYear = now.getFullYear();

    const monthBuckets = monthNames.map((name, idx) => ({
      name,
      fullName: `${fullMonthNames[idx]} ${currentYear}`,
      income: 0,
      outcome: 0,
    }));

    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.rawDate);
      const m = d.getMonth();
      if (monthBuckets[m]) {
        if (tx.type === 'Gasto' || tx.type === 'Compra') {
          monthBuckets[m].outcome += tx.amount;
        } else {
          monthBuckets[m].income += tx.amount;
        }
      }
    });

    return monthBuckets.map((b) => ({
      name: b.name,
      fullName: b.fullName,
      income: b.income,
      outcome: b.outcome,
      net: b.income - b.outcome,
    }));
  }, [metrics, filteredTransactions, periodo]);

  /*
   * ============================================================
   * 3. DONUT 1: CATEGORÍAS DE EGRESO DINÁMICAS (100% ADAPTATIVO)
   * ============================================================
   */
  const expenseDonutData = useMemo(() => {
    const expenseTx = filteredTransactions.filter(
      (t) => t.type === 'Gasto' || t.type === 'Compra'
    );

    const categoryMap = new Map<string, number>();

    expenseTx.forEach((tx) => {
      let rawCat =
        tx.type === 'Compra'
          ? 'Compras e Insumos'
          : tx.paymentMethod || tx.activity || 'Otros gastos';

      if (rawCat.toUpperCase() === 'GASTO') {
        rawCat =
          tx.activity && tx.activity !== 'Gasto registrado'
            ? tx.activity
            : 'Otros gastos';
      }

      // Title Case limpio
      const cleanName = rawCat
        .toLowerCase()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      categoryMap.set(
        cleanName,
        (categoryMap.get(cleanName) || 0) + (Number(tx.amount) || 0)
      );
    });

    // Si métricas tiene compras del período pero no hay ítems individuales
    if (
      (metrics?.egresos?.compras ?? 0) > 0 &&
      !categoryMap.has('Compras E Insumos') &&
      !categoryMap.has('Compras')
    ) {
      categoryMap.set('Compras e Insumos', metrics!.egresos.compras);
    }

    let categories = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    // Top 4 + Otros
    if (categories.length > 4) {
      const top4 = categories.slice(0, 4);
      const othersTotal = categories
        .slice(4)
        .reduce((sum, item) => sum + item.value, 0);

      if (othersTotal > 0) {
        top4.push({ name: 'Otros gastos', value: othersTotal });
      }
      categories = top4;
    }

    // Si no hay transacciones pero egresosTotal > 0 en el reporte del período
    if (categories.length === 0 && egresosTotal > 0) {
      if ((metrics?.egresos?.gastos ?? 0) > 0) {
        categories.push({
          name: 'Gastos Operativos',
          value: metrics!.egresos.gastos,
        });
      }
      if ((metrics?.egresos?.compras ?? 0) > 0) {
        categories.push({
          name: 'Compras de Stock',
          value: metrics!.egresos.compras,
        });
      }
    }

    return categories.map((cat, idx) => ({
      ...cat,
      color:
        cat.name.toLowerCase().includes('otro')
          ? '#64748b'
          : DYNAMIC_PALETTE[idx % DYNAMIC_PALETTE.length],
    }));
  }, [filteredTransactions, metrics, egresosTotal]);

  const totalExpenseDonut = useMemo(() => {
    return expenseDonutData.reduce((sum, item) => sum + item.value, 0);
  }, [expenseDonutData]);

  /*
   * ============================================================
   * 4. DONUT 2: COMPOSICIÓN DE FLUJO 360° (ENTRADAS VS SALIDAS)
   * ============================================================
   */
  const flowDonutData = useMemo(() => {
    let ventasContado = metrics?.ingresos?.ventasContado ?? 0;
    let abonos = metrics?.ingresos?.abonos ?? 0;
    let gastos = metrics?.egresos?.gastos ?? 0;
    let compras = metrics?.egresos?.compras ?? 0;

    if (
      ventasContado === 0 &&
      abonos === 0 &&
      gastos === 0 &&
      compras === 0 &&
      filteredTransactions.length > 0
    ) {
      filteredTransactions.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'Venta') ventasContado += amt;
        else if (tx.type === 'Abono') abonos += amt;
        else if (tx.type === 'Gasto') gastos += amt;
        else if (tx.type === 'Compra') compras += amt;
      });
    }

    const flows = [
      {
        name: 'Ventas Contado',
        value: ventasContado,
        color: '#10b981',
      },
      {
        name: 'Abonos Cartera',
        value: abonos,
        color: '#14b8a6',
      },
      {
        name: 'Gastos Operativos',
        value: gastos,
        color: '#f43f5e',
      },
      {
        name: 'Compras Stock',
        value: compras,
        color: '#8b5cf6',
      },
    ].filter((f) => f.value > 0);

    return flows;
  }, [metrics, filteredTransactions]);

  const totalFlowDonut = useMemo(() => {
    return flowDonutData.reduce((sum, item) => sum + item.value, 0);
  }, [flowDonutData]);

  /*
   * ============================================================
   * 5. SKELETON LOADER CON SILUETA BENTO TRIPLE
   * ============================================================
   */
  if (isLoading) {
    return (
      <div className="bg-card/70 border border-border/80 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between h-full min-h-[440px] animate-in fade-in duration-300">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="space-y-1.5">
              <Skeleton width={260} height={20} />
              <Skeleton width={180} height={14} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <Skeleton height={68} className="rounded-2xl" />
            <Skeleton height={68} className="rounded-2xl" />
            <Skeleton height={68} className="rounded-2xl" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-6 h-48 flex items-end justify-between gap-3 px-2">
              <Skeleton className="h-28 flex-1 rounded-xl" />
              <Skeleton className="h-40 flex-1 rounded-xl" />
              <Skeleton className="h-20 flex-1 rounded-xl" />
              <Skeleton className="h-36 flex-1 rounded-xl" />
            </div>
            <div className="lg:col-span-3 flex flex-col items-center justify-center gap-2">
              <Skeleton width={96} height={96} className="rounded-full" />
              <Skeleton width={100} height={12} />
            </div>
            <div className="lg:col-span-3 flex flex-col items-center justify-center gap-2">
              <Skeleton width={96} height={96} className="rounded-full" />
              <Skeleton width={100} height={12} />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border/50 flex justify-between items-center">
          <Skeleton width={320} height={14} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between h-full min-h-[440px] relative overflow-hidden transition-all duration-300">
      {/* Resplandor decorativo de fondo */}
      <div className="absolute -top-16 -right-16 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div>
        {/* Cabecera Principal con Selector Integrado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <Activity className="h-4 w-4" />
                </span>
                Rendimiento Financiero
              </h2>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                  esRentable
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                }`}
              >
                {esRentable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {rentabilidadPct}% Margen
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.sedes && metrics.sedes.length > 1
                ? 'Flujo transaccional comparativo entre sucursales activas'
                : `Flujo transaccional y distribución real para ${sedeName || 'la sede activa'}`}
            </p>
          </div>

          {/* In-Card Period Selector (Control Segmentado Pro Adaptable a Móvil) */}
          {onPeriodoChange && (
            <div className="w-full md:w-auto grid grid-cols-3 md:flex items-center bg-muted/40 dark:bg-muted/20 border border-border/70 rounded-xl p-1 shadow-2xs self-stretch md:self-center">
              {(
                [
                  { id: 'diario', short: 'Hoy', full: 'Hoy' },
                  { id: 'semanal', short: 'Semana', full: 'Esta semana' },
                  { id: 'mensual', short: 'Mes', full: 'Mes' },
                ] as const
              ).map((opt) => {
                const isActive = periodo === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onPeriodoChange(opt.id)}
                    className={`relative px-2 sm:px-3 py-1.5 sm:py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer text-center justify-center flex items-center w-full md:w-auto whitespace-nowrap ${
                      isActive
                        ? 'text-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-period-pill"
                        className="absolute inset-0 bg-foreground rounded-lg shadow-xs"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 hidden sm:inline">{opt.full}</span>
                    <span className="relative z-10 inline sm:hidden">{opt.short}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* 3 MINI KPIS SUPERIORES (Ingresos, Egresos, Margen Neto)       */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* Ingresos */}
          <div className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Ingresos
              </span>
            </div>
            <p className="text-lg font-black text-foreground tracking-tight">
              {formatNumber(ingresosTotal)}{' '}
              <span className="text-[11px] font-bold text-muted-foreground">COP</span>
            </p>
          </div>

          {/* Egresos */}
          <div className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 flex flex-col justify-between hover:border-rose-500/30 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Egresos
              </span>
            </div>
            <p className="text-lg font-black text-foreground tracking-tight">
              {formatNumber(egresosTotal)}{' '}
              <span className="text-[11px] font-bold text-muted-foreground">COP</span>
            </p>
          </div>

          {/* Margen Neto */}
          <div
            className={`border rounded-2xl p-3.5 flex flex-col justify-between transition-all ${
              esRentable
                ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                : 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                {esRentable ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                )}
                Margen Neto
              </span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${
                  esRentable
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                }`}
              >
                {esRentable ? `+${rentabilidadPct}%` : `${rentabilidadPct}%`}
              </span>
            </div>
            <p
              className={`text-lg font-black tracking-tight ${
                esRentable
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {esRentable ? '+' : ''}
              {formatNumber(margenNeto)}{' '}
              <span className="text-[11px] font-bold text-muted-foreground">COP</span>
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PANEL BENTO TRIPLE: ÁREA (44%) + DONUT 1 (28%) + DONUT 2 (28%) */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* PANEL 1: Área de Flujo Continuo (lg:col-span-5) */}
          <div className="lg:col-span-5 h-56 flex flex-col justify-between bg-muted/15 border border-border/40 rounded-2xl p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1 mb-1">
              <span>Evolución ({periodo})</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ingreso
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Egreso
                </span>
              </div>
            </div>

            <div className="w-full h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 8, bottom: 0, left: -14 }}
                >
                  <defs>
                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="90%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="outcomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} />
                      <stop offset="90%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 9,
                      fill: 'var(--color-muted-foreground)',
                      fontWeight: 600,
                    }}
                    dy={6}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 9,
                      fill: 'var(--color-muted-foreground)',
                      fontWeight: 600,
                    }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1_000
                        ? `${Math.round(v / 1000)}k`
                        : `${v}`
                    }
                    width={36}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card/95 backdrop-blur-md border border-border p-2.5 rounded-xl shadow-xl text-xs space-y-1 min-w-[150px] animate-in fade-in duration-200">
                          <p className="font-bold text-foreground border-b border-border/60 pb-1 text-[11px]">
                            {data.fullName || data.name}
                          </p>
                          <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 text-[11px]">
                            <span>Ingresos:</span>
                            <span className="font-black">
                              {formatNumber(data.income)} COP
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 text-[11px]">
                            <span>Egresos:</span>
                            <span className="font-black">
                              {formatNumber(data.outcome)} COP
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-foreground font-black pt-1 border-t border-border/50 text-[11px]">
                            <span>Neto:</span>
                            <span
                              className={
                                data.net >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {data.net >= 0 ? '+' : ''}
                              {formatNumber(data.net)} COP
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#incomeGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="outcome"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#outcomeGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PANEL 2: Donut 1 - Categorías de Egreso Dinámicas (lg:col-span-3) */}
          <div className="lg:col-span-3 min-h-[224px] sm:h-56 flex flex-col justify-between bg-muted/20 border border-border/50 rounded-2xl p-3.5 sm:p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1">
              <span className="flex items-center gap-1 text-foreground">
                <PieIcon className="w-3.5 h-3.5 text-rose-500" />
                Egresos por Categoría
              </span>
            </div>

            {expenseDonutData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-3">
                <Sparkles className="w-5 h-5 text-muted-foreground/40 mb-1" />
                <p className="text-[11px] font-bold text-muted-foreground">
                  Sin egresos en este período
                </p>
                <p className="text-[9px] text-muted-foreground/70">
                  Todo tu dinero disponible
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5 my-auto py-1 w-full">
                {/* Donut Chart */}
                <div className="relative w-28 h-28 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseDonutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {expenseDonutData.map((entry, index) => (
                          <Cell key={`cell-exp-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const item = payload[0].payload;
                          const pct =
                            totalExpenseDonut > 0
                              ? ((item.value / totalExpenseDonut) * 100).toFixed(1)
                              : '0';
                          return (
                            <div className="bg-card/95 backdrop-blur-md border border-border p-2 rounded-xl shadow-lg text-[10px]">
                              <p className="font-bold text-foreground">
                                {item.name}
                              </p>
                              <p className="text-muted-foreground font-semibold">
                                {formatNumber(item.value)} COP ({pct}%)
                              </p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                      Total
                    </span>
                    <span className="text-[11px] font-black text-foreground tracking-tight leading-tight">
                      {egresosTotal >= 1_000_000
                        ? `${(egresosTotal / 1_000_000).toFixed(1)}M`
                        : egresosTotal >= 1_000
                        ? `${Math.round(egresosTotal / 1000)}k`
                        : egresosTotal}
                    </span>
                  </div>
                </div>

                {/* Leyenda */}
                <div className="w-full space-y-1.5 overflow-y-auto max-h-20 pr-0.5 custom-scrollbar">
                  {expenseDonutData.map((cat, idx) => {
                    const pct =
                      totalExpenseDonut > 0
                        ? ((cat.value / totalExpenseDonut) * 100).toFixed(0)
                        : '0';
                    return (
                      <div
                        key={`legend-exp-${idx}`}
                        className="flex items-center justify-between text-[10px] gap-1"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-medium text-foreground truncate text-[9px]">
                            {cat.name}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* PANEL 3: Donut 2 - Composición de Flujo (lg:col-span-4) */}
          <div className="lg:col-span-4 min-h-[224px] sm:h-56 flex flex-col justify-between bg-muted/20 border border-border/50 rounded-2xl p-3.5 sm:p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1">
              <span className="flex items-center gap-1 text-foreground">
                <Layers className="w-3.5 h-3.5 text-emerald-500" />
                Composición de Flujo
              </span>
            </div>

            {flowDonutData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-3">
                <Sparkles className="w-5 h-5 text-muted-foreground/40 mb-1" />
                <p className="text-[11px] font-bold text-muted-foreground">
                  Sin movimientos registrados
                </p>
                <p className="text-[9px] text-muted-foreground/70">
                  Registra ventas o gastos para ver el balance
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5 my-auto py-1 w-full">
                {/* Donut Chart */}
                <div className="relative w-28 h-28 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={flowDonutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={45}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {flowDonutData.map((entry, index) => (
                          <Cell key={`cell-flow-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const item = payload[0].payload;
                          const pct =
                            totalFlowDonut > 0
                              ? ((item.value / totalFlowDonut) * 100).toFixed(1)
                              : '0';
                          return (
                            <div className="bg-card/95 backdrop-blur-md border border-border p-2 rounded-xl shadow-lg text-[10px]">
                              <p className="font-bold text-foreground">
                                {item.name}
                              </p>
                              <p className="text-muted-foreground font-semibold">
                                {formatNumber(item.value)} COP ({pct}%)
                              </p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                      Margen
                    </span>
                    <span
                      className={`text-[11px] font-black tracking-tight leading-tight ${
                        esRentable
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {esRentable ? `+${rentabilidadPct}%` : `${rentabilidadPct}%`}
                    </span>
                  </div>
                </div>

                {/* Leyenda */}
                <div className="w-full space-y-1.5 overflow-y-auto max-h-20 pr-0.5 custom-scrollbar">
                  {flowDonutData.map((flow, idx) => {
                    const pct =
                      totalFlowDonut > 0
                        ? ((flow.value / totalFlowDonut) * 100).toFixed(0)
                        : '0';
                    return (
                      <div
                        key={`legend-flow-${idx}`}
                        className="flex items-center justify-between text-[10px] gap-1"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: flow.color }}
                          />
                          <span className="font-medium text-foreground truncate text-[9px]">
                            {flow.name}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


