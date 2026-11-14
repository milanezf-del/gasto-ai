import React from "react";
import { api, ApiError } from "../lib/api";
import type { LoginInput, SignupInput } from "../lib/schemas";
import type { AuthUser } from "../types/finance";

export function useAuth() {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const checkSession = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.me();
      setUser(res.user);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setError(null);
      } else {
        setUser(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "Não foi possível verificar sua sessão."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = React.useCallback(async (input: LoginInput) => {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.login(input);
      setUser(res.user);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível entrar. Verifique suas credenciais."
      );
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const signup = React.useCallback(async (input: SignupInput) => {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.signup(input);
      if (res.requiresEmailConfirmation) {
        setNotice(
          "Conta criada! Confira seu e-mail para confirmar o cadastro antes de entrar."
        );
      } else if (res.user) {
        setUser(res.user);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar sua conta."
      );
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setNotice(null);
      setError(null);
    }
  }, []);

  const deleteAccount = React.useCallback(async (confirmation: string) => {
    await api.deleteAccount(confirmation);
    setUser(null);
    setNotice("Sua conta e todos os seus dados foram excluídos.");
    setError(null);
  }, []);

  return {
    user,
    loading,
    submitting,
    error,
    notice,
    clearMessages: () => {
      setError(null);
      setNotice(null);
    },
    checkSession,
    login,
    signup,
    logout,
    deleteAccount,
  };
}
