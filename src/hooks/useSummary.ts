import React from "react";
import { api, ApiError } from "../lib/api";
import type { FinancialSummary } from "../types/finance";

export function useSummary() {
  const [data, setData] = React.useState<FinancialSummary | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await api.getSummary();
      setData(summary);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar o resumo financeiro."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
