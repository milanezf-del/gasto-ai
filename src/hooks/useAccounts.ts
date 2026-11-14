import React from "react";
import { api, ApiError } from "../lib/api";
import type { TransferAccountsInput } from "../lib/schemas";
import type { FinancialAccount } from "../types/finance";

export function useAccounts() {
  const [accounts, setAccounts] = React.useState<FinancialAccount[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [syncing, setSyncing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAccounts();
      setAccounts(res.accounts ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as contas vinculadas."
      );
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const syncAccounts = React.useCallback(async () => {
    setSyncing(true);
    setActionError(null);
    try {
      const res = await api.syncAccounts();
      setAccounts(res.accounts ?? []);
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível sincronizar as instituições."
      );
    } finally {
      setSyncing(false);
    }
  }, []);

  const transferAccounts = React.useCallback(
    async (input: TransferAccountsInput) => {
      setActionError(null);
      try {
        const res = await api.transferAccounts(input);
        setAccounts(res.accounts ?? []);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Não foi possível concluir a transferência.";
        setActionError(msg);
        throw new Error(msg);
      }
    },
    []
  );

  return {
    accounts,
    loading,
    syncing,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    refetch,
    syncAccounts,
    transferAccounts,
  };
}
