import { InvestorNavbar } from "./components/investorNavbar";
import { InvestorHero } from "./components/investorHero";
import { InvestorKpiGrid } from "./components/investorKpiGrid";
import { InvestorGrowthChart } from "./components/investorGrowthChart";
import { InvestorRevenueChart } from "./components/investorRevenueChart";
import { InvestorUsersChart } from "./components/investorUsersChart";
import { InvestorRetention } from "./components/investorRetention";
import { InvestorBusinessMetrics } from "./components/investorBusinessMetrics";
import { InvestorActivity } from "./components/investorActivity";
import { LukaDynamicAtmosphere } from "@/features/landing-page/components/LukaDynamicAtmosphere";
import { CoworkingFooterSection } from "@/features/landing-page/components/CoworkingFooterSection";
import { useInvestorStats } from "./hooks/useInvestorStats";

export default function InvestorDashboardView() {
  const { data, isLoading, isRefreshing, error, lastUpdated, refresh } =
    useInvestorStats();

  return (
    <div
      className="
        relative
        min-h-screen
        w-full
        overflow-hidden
        bg-slate-50
        font-sans
        text-slate-900
        transition-colors
        duration-500
        selection:bg-emerald-500/30
        dark:bg-[#070B12]
        dark:text-slate-50
        luka-surface-pattern
      "
    >
      <LukaDynamicAtmosphere />
      <div className="luka-home-gradient" aria-hidden="true" />

      <div className="relative z-30">
        <InvestorNavbar
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          onRefresh={refresh}
        />

        <main>
          <InvestorHero
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
          />

          {error && (
            <section className="px-6 pb-8">
              <div className="mx-auto max-w-7xl rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm font-semibold text-destructive">
                No pudimos actualizar las estadísticas en vivo: {error}
              </div>
            </section>
          )}

          <InvestorKpiGrid stats={data} isLoading={isLoading} />

          <InvestorGrowthChart stats={data} isLoading={isLoading} />

          <InvestorRevenueChart stats={data} isLoading={isLoading} />

          <InvestorUsersChart stats={data} isLoading={isLoading} />

          <InvestorRetention stats={data} isLoading={isLoading} />

          <InvestorBusinessMetrics stats={data} isLoading={isLoading} />

          <InvestorActivity stats={data} isLoading={isLoading} />
        </main>

        <CoworkingFooterSection />
      </div>
    </div>
  );
}
