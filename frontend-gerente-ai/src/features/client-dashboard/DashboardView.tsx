import { Link } from "react-router";
import { Sparkles, RefreshCw, AlertTriangle, Building2, MapPin, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BalanceCard } from "./components/BalanceCard";
import { SpendChartCard } from "./components/SpendChartCard";
import { TransactionTable } from "./components/TransactionTable";
import { NoBusinessState } from "./components/NoBusinessState";
import { useDashboardMetrics } from "./hooks/useDashboardMetrics";
import { usePlanPermissions } from "@/shared/hooks/usePlanPermissions";
import { PlanLimitPaywallModal } from "@/shared/components/modals/PlanLimitPaywallModal";
import { LiveStatusBadge } from "@/shared/components/ui/LiveStatusBadge";
import { GoalsAndComparison } from "./components/GoalsAndComparison";

export function DashboardView() {
  const {
    isPaywallOpen,
    paywallMotivo,
    paywallPlanRecomendadoId,
    catalogo,
    cerrarPaywall,
  } = usePlanPermissions();

  const {
    metrics,
    generalMetrics,
    transactions,
    isLoading,
    isChartLoading,
    isRefreshing,
    lastUpdated,
    error,
    hasNoBusiness,
    refreshMetrics,
    periodo,
    setPeriodo,
    businessName,
    sedeName,
    sedeId,
    isConsolidated,
  } = useDashboardMetrics();

  return (
    <div className="pb-8">
      <AnimatePresence mode="wait">
        {hasNoBusiness && !isLoading ? (
          <motion.div
            key="no-business-onboarding"
            initial={{ opacity: 0, y: 15, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <NoBusinessState onBusinessCreated={() => refreshMetrics()} />
          </motion.div>
        ) : (
          <motion.div
            key="financial-dashboard-view"
            initial={{ opacity: 0, y: 25, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
            >
              <div>
                <h1 className="text-3xl font-black text-foreground tracking-tight">
                  Detalles de saldo
                </h1>
              </div>
              
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {/* 1. Estado En Vivo */}
                <LiveStatusBadge
                  lastUpdated={lastUpdated}
                  isRefreshing={isRefreshing}
                  onManualRefresh={refreshMetrics}
                />

                {/* 2. Sede / Negocio Badge */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 dark:bg-muted/30 px-3 py-1.5 rounded-xl border border-border/80 shadow-2xs">
                  <span className="inline-flex items-center gap-1.5 text-foreground font-bold">
                    <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{businessName}</span>
                  </span>
                  <span className="text-muted-foreground/40">/</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                    {sedeId && sedeId !== 'all' ? (
                      <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    <span>{sedeName}</span>
                  </span>
                </div>

                {/* 3. Mejora tu plan */}
                <Link
                  to="/subscription"
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 shadow-xs hover:from-emerald-500/20 hover:to-emerald-500/10 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  Mejora tu plan
                </Link>
              </div>
            </motion.div>

            {/* Error Alert Banner */}
            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-between gap-4 text-destructive shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold">No se pudieron cargar los datos del Panel Financiero</p>
                    <p className="text-xs opacity-90">{error}</p>
                  </div>
                </div>
                <button
                  onClick={refreshMetrics}
                  className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3 h-3" /> Reintentar
                </button>
              </div>
            )}

            {/* Main Grid */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              <div className="lg:col-span-4 xl:col-span-4">
                <BalanceCard metrics={generalMetrics} isLoading={isLoading} />
              </div>
              <div className="lg:col-span-8 xl:col-span-8">
                <SpendChartCard 
                  metrics={metrics} 
                  transactions={transactions}
                  periodo={periodo}
                  onPeriodoChange={setPeriodo}
                  isLoading={isLoading || isChartLoading} 
                  sedeName={sedeName}
                  isConsolidated={isConsolidated}
                />
              </div>
            </motion.div>

            {transactions.length > 0 && (
              <GoalsAndComparison transactions={transactions} />
            )}

            {/* Transactions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
            >
              <TransactionTable
                transactions={transactions}
                isLoading={isLoading}
                error={null}
                businessName={businessName}
                onRetry={refreshMetrics}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Paywall para cuando se alcanza el límite de comercios del plan */}
      <PlanLimitPaywallModal
        isOpen={isPaywallOpen}
        onClose={cerrarPaywall}
        motivo={paywallMotivo}
        planRecomendadoId={paywallPlanRecomendadoId}
        catalogo={catalogo}
        negocioNombre={businessName}
        onUpgradeSuccess={() => {
          refreshMetrics();
        }}
      />
    </div>
  );
}
