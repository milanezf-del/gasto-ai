import React from "react";
import { api, ApiError } from "../lib/api";
import type {
  BudgetEnvelope,
  ExpenseCategory,
  SubscriptionItem,
} from "../types/finance";

export function useBudgets() {
  const [budgets, setBudgets] = React.useState<BudgetEnvelope[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<SubscriptionItem[]>(
    []
  );
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getBudgets();
      setBudgets(res.budgets ?? []);
      setSubscriptions(res.subscriptions ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os orçamentos e assinaturas."
      );
      setBudgets([]);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const updateBudgetLimit = React.useCallback(
    async (category: ExpenseCategory, monthlyLimitCents: number) => {
      setActionError(null);
      try {
        const res = await api.updateBudgetLimit(category, monthlyLimitCents);
        setBudgets((prev) =>
          prev.map((b) => (b.category === category ? res.budget : b))
        );
      } catch (err) {
        setActionError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível atualizar o limite do orçamento."
        );
      }
    },
    []
  );

  const toggleSubscription = React.useCallback(async (id: string) => {
    setActionError(null);
    try {
      const res = await api.toggleSubscription(id);
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? res.subscription : s))
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível alterar o status da assinatura."
      );
    }
  }, []);

  return {
    budgets,
    subscriptions,
    loading,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    refetch,
    updateBudgetLimit,
    toggleSubscription,
  };
}
