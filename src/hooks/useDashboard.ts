import React from "react";
import { api, ApiError } from "../lib/api";
import type { DashboardData, FinancialInsightItem } from "../types/finance";
import { getTodayIsoSaoPaulo, shiftYearMonth } from "../utils/formatters";

export function useDashboard(enabled: boolean) {
  const [month, setMonth] = React.useState<string>(() =>
    getTodayIsoSaoPaulo().slice(0, 7)
  );
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [insights, setInsights] = React.useState<FinancialInsightItem[]>([]);
  const [insightsEmpty, setInsightsEmpty] = React.useState<boolean>(true);
  const [loading, setLoading] = React.useState<boolean>(enabled);
  const [insightsLoading, setInsightsLoading] = React.useState<boolean>(enabled);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    if (!enabled) {
      setData(null);
      setInsights([]);
      setInsightsEmpty(true);
      setLoading(false);
      setInsightsLoading(false);
      return;
    }

    setLoading(true);
    setInsightsLoading(true);
    setError(null);

    try {
      const [dashboardRes, insightsRes] = await Promise.all([
        api.getDashboard(month),
        api.getInsights(month).catch(() => null),
      ]);

      setData(dashboardRes);
      if (insightsRes) {
        setInsights(insightsRes.insights ?? []);
        setInsightsEmpty(
          insightsRes.empty || (insightsRes.insights ?? []).length === 0
        );
      } else {
        setInsights([]);
        setInsightsEmpty(true);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os dados do painel."
      );
      setData(null);
    } finally {
      setLoading(false);
      setInsightsLoading(false);
    }
  }, [enabled, month]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const prevMonth = React.useCallback(() => {
    setMonth((m) => shiftYearMonth(m, -1));
  }, []);

  const nextMonth = React.useCallback(() => {
    setMonth((m) => shiftYearMonth(m, 1));
  }, []);

  return {
    month,
    setMonth,
    prevMonth,
    nextMonth,
    data,
    insights,
    insightsEmpty,
    loading,
    insightsLoading,
    error,
    refetch,
  };
}
