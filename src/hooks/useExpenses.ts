import React from "react";
import { api, ApiError } from "../lib/api";
import type { CreateExpenseInput } from "../lib/schemas";
import type { ExpenseItem, TransactionCategory } from "../types/finance";

export function useExpenses() {
  const [expenses, setExpenses] = React.useState<ExpenseItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [mutating, setMutating] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExpenses();
      setExpenses(res.items ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os lançamentos."
      );
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const createExpense = React.useCallback(async (input: CreateExpenseInput) => {
    setMutating(true);
    setActionError(null);
    try {
      const res = await api.createExpense(input);
      setExpenses((prev) => [res.item, ...prev]);
      return res.item;
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Não foi possível registrar o lançamento.";
      setActionError(msg);
      throw new Error(msg);
    } finally {
      setMutating(false);
    }
  }, []);

  const updateCategory = React.useCallback(
    async (id: string, category: TransactionCategory) => {
      setActionError(null);
      try {
        const res = await api.updateExpenseCategory(id, category);
        setExpenses((prev) =>
          prev.map((item) => (item.id === id ? res.item : item))
        );
      } catch (err) {
        setActionError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível atualizar a categoria."
        );
      }
    },
    []
  );

  const deleteExpense = React.useCallback(async (id: string) => {
    setActionError(null);
    try {
      await api.deleteExpense(id);
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir o lançamento."
      );
    }
  }, []);

  const categorizePending = React.useCallback(async () => {
    const pendingIds = expenses
      .filter(
        (e) => e.category === "Sem categoria" || e.status === "Revisão pendente"
      )
      .map((e) => e.id);
    if (pendingIds.length === 0) return;

    setMutating(true);
    setActionError(null);
    try {
      const res = await api.categorizePending(pendingIds);
      const map = new Map(res.results.map((r) => [r.id, r]));
      setExpenses((prev) =>
        prev.map((item) => {
          const match = map.get(item.id);
          if (!match) return item;
          return {
            ...item,
            category: match.category,
            status: "Confirmado",
            aiConfidence: match.confidence,
            aiRationale: match.rationale,
          };
        })
      );
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível categorizar os lançamentos pendentes."
      );
    } finally {
      setMutating(false);
    }
  }, [expenses]);

  return {
    expenses,
    loading,
    mutating,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    refetch,
    createExpense,
    updateCategory,
    deleteExpense,
    categorizePending,
  };
}
