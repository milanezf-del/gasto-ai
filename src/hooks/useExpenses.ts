import React from "react";
import { api, ApiError } from "../lib/api";
import type { ConfirmExpenseInput, CreateExpenseInput, UpdateExpenseInput } from "../lib/schemas";
import type {
  ExpenseCategory,
  ExpenseItem,
  ExpenseListFilters,
} from "../types/finance";

const DEFAULT_FILTERS: ExpenseListFilters = {
  category: "all",
  status: "all",
  sort: "date_desc",
  limit: 30,
};

export function useExpenses(
  enabled: boolean,
  onDataChanged?: () => void,
  onToastError?: (message: string) => void
) {
  const [filters, setFilters] = React.useState<ExpenseListFilters>(DEFAULT_FILTERS);
  const [expenses, setExpenses] = React.useState<ExpenseItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState<boolean>(false);
  const [totalCount, setTotalCount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(enabled);
  const [loadingMore, setLoadingMore] = React.useState<boolean>(false);
  const [mutating, setMutating] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    if (!enabled) {
      setExpenses([]);
      setNextCursor(null);
      setHasMore(false);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExpenses({ ...filters, cursor: null });
      setExpenses(res.items ?? []);
      setNextCursor(res.nextCursor ?? null);
      setHasMore(Boolean(res.hasMore));
      setTotalCount(res.totalCount ?? (res.items ?? []).length);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os lançamentos.";
      setError(msg);
      if (err instanceof ApiError && err.status === 0) {
        onToastError?.(msg);
      }
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, filters, onToastError]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const loadMore = React.useCallback(async () => {
    if (!enabled || !hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.getExpenses({ ...filters, cursor: nextCursor });
      setExpenses((prev) => [...prev, ...(res.items ?? [])]);
      setNextCursor(res.nextCursor ?? null);
      setHasMore(Boolean(res.hasMore));
      setTotalCount(res.totalCount ?? totalCount);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar mais despesas.";
      setActionError(msg);
      onToastError?.(msg);
    } finally {
      setLoadingMore(false);
    }
  }, [enabled, hasMore, nextCursor, loadingMore, filters, totalCount, onToastError]);

  const createExpense = React.useCallback(
    async (input: CreateExpenseInput) => {
      setMutating(true);
      setActionError(null);
      try {
        const res = await api.createExpense(input);
        await refetch();
        onDataChanged?.();
        return res.item;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Não foi possível registrar o lançamento.";
        setActionError(msg);
        onToastError?.(msg);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [refetch, onDataChanged, onToastError]
  );

  const confirmExpense = React.useCallback(
    async (input: ConfirmExpenseInput) => {
      setMutating(true);
      setActionError(null);
      try {
        const res = await api.confirmExpense(input);
        await refetch();
        onDataChanged?.();
        return res.item;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Não foi possível confirmar a despesa.";
        setActionError(msg);
        onToastError?.(msg);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [refetch, onDataChanged, onToastError]
  );

  const updateExpense = React.useCallback(
    async (id: string, input: UpdateExpenseInput) => {
      setMutating(true);
      setActionError(null);
      try {
        const res = await api.updateExpense(id, input);
        setExpenses((prev) =>
          prev.map((item) => (item.id === id ? res.item : item))
        );
        onDataChanged?.();
        return res.item;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Não foi possível atualizar o lançamento.";
        setActionError(msg);
        onToastError?.(msg);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [onDataChanged, onToastError]
  );

  const updateCategory = React.useCallback(
    async (id: string, category: ExpenseCategory) => {
      setActionError(null);
      try {
        const res = await api.updateExpenseCategory(id, category);
        setExpenses((prev) =>
          prev.map((item) => (item.id === id ? res.item : item))
        );
        onDataChanged?.();
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Não foi possível atualizar a categoria.";
        setActionError(msg);
        onToastError?.(msg);
      }
    },
    [onDataChanged, onToastError]
  );

  const deleteExpense = React.useCallback(
    async (id: string) => {
      setMutating(true);
      setActionError(null);
      try {
        await api.deleteExpense(id);
        setExpenses((prev) => prev.filter((item) => item.id !== id));
        setTotalCount((c) => Math.max(0, c - 1));
        onDataChanged?.();
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Não foi possível excluir o lançamento.";
        setActionError(msg);
        onToastError?.(msg);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [onDataChanged, onToastError]
  );

  const categorizePending = React.useCallback(async () => {
    const pendingIds = expenses
      .filter((e) => e.status === "needs_review")
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
            status: "confirmed",
            confidence_json: {
              confidence: match.confidence,
              rationale: match.rationale,
            },
          };
        })
      );
      onDataChanged?.();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Não foi possível categorizar os lançamentos pendentes.";
      setActionError(msg);
      onToastError?.(msg);
    } finally {
      setMutating(false);
    }
  }, [expenses, onDataChanged, onToastError]);

  return {
    expenses,
    filters,
    setFilters,
    resetFilters: () => setFilters(DEFAULT_FILTERS),
    hasMore,
    totalCount,
    loading,
    loadingMore,
    mutating,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    refetch,
    loadMore,
    createExpense,
    confirmExpense,
    updateExpense,
    updateCategory,
    deleteExpense,
    categorizePending,
  };
}
