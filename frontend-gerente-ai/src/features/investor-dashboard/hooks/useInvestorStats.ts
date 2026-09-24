import { useCallback, useEffect, useRef, useState } from "react";
import { investorApi, type InvestorStatsResponse } from "../api/investorApi";

const REFRESH_INTERVAL_MS = 30_000;

export function useInvestorStats() {
  const [data, setData] = useState<InvestorStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const hasLoadedOnce = useRef(false);

  const fetchStats = useCallback(async () => {
    if (hasLoadedOnce.current) {
      setIsRefreshing(true);
    }

    try {
      const response = await investorApi.obtenerResumen();
      setData(response);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("No se pudieron cargar las estadísticas de inversores:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las estadísticas en este momento.",
      );
    } finally {
      hasLoadedOnce.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    const interval = setInterval(fetchStats, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchStats]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh: fetchStats,
  };
}
