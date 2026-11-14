import React from "react";
import { api, ApiError } from "../lib/api";
import type { BudgetEnvelope, ExpenseCategory } from "../types/finance";

export function useBudgets(enabled: boolean, onDataChanged?: () => void) {
  const [budgets, setBudgets] = React.useState<BudgetEnvelope[]>([]);
  const [loading, setLoading] = React.useState<boolean>(enabled);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    if (!enabled) {
      setBudgets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBudgets();
      setBudgets(res.budgets ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os orçamentos."
      );
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateBudgetLimit = React.useCallback(
    async (
      category: ExpenseCategory,
      limitCents: number,
      alertPercent = 80
    ) => {
      setActionError(null);
      try {
        const res = await api.updateBudgetLimit(
          category,
          limitCents,
          alertPercent
        );
        setBudgets((prev) =>
          prev.map((b) => (b.category === category ? res.budget : b))
        );
        onDataChanged?.();
      } catch (err) {
        setActionError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível atualizar o limite do orçamento."
        );
      }
    },
    [onDataChanged]
  );

  return {
    budgets,
    loading,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    refetch,
    updateBudgetLimit,
  };
}
