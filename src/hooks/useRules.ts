import React from "react";
import { api, ApiError } from "../lib/api";
import type { MerchantRuleItem } from "../types/finance";

export function useRules(enabled: boolean) {
  const [rules, setRules] = React.useState<MerchantRuleItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(enabled);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const refetch = React.useCallback(async () => {
    if (!enabled) {
      setRules([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.getRules();
      setRules(res.rules ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as regras aprendidas."
      );
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  const deleteRule = React.useCallback(async (merchantNorm: string) => {
    setActionError(null);
    try {
      await api.deleteRule(merchantNorm);
      setRules((prev) => prev.filter((r) => r.merchant_norm !== merchantNorm));
    } catch (err) {
      setActionError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível remover a regra."
      );
    }
  }, []);

  return {
    rules,
    loading,
    error,
    actionError,
    clearActionError: () => setActionError(null),
    refetch,
    deleteRule,
  };
}
