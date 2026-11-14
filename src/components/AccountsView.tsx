import React from "react";
import { RefreshCw, ArrowRightLeft } from "lucide-react";
import type { FinancialAccount } from "../types/finance";
import { transferAccountsSchema, type TransferAccountsInput } from "../lib/schemas";
import { formatCentavos, reaisInputToCentavos } from "../utils/formatters";
import { CardSkeleton, EmptyState, ErrorState } from "./StateNotice";

interface AccountsViewProps {
  accounts: FinancialAccount[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  onRetry: () => void;
  onSyncAccounts: () => void;
  onTransfer: (input: TransferAccountsInput) => Promise<void>;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  loading,
  syncing,
  error,
  onRetry,
  onSyncAccounts,
  onTransfer,
}) => {
  const [fromId, setFromId] = React.useState("");
  const [toId, setToId] = React.useState("");
  const [transferRaw, setTransferRaw] = React.useState("");
  const [transferError, setTransferError] = React.useState<string | null>(null);
  const [transferSubmitting, setTransferSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (accounts.length > 0 && !fromId) {
      setFromId(accounts[0].id);
    }
    if (accounts.length > 1 && !toId) {
      setToId(accounts[1].id);
    }
  }, [accounts, fromId, toId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar as contas vinculadas"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        title="Nenhuma conta vinculada"
        description="Quando suas contas bancárias, reservas ou cartões forem conectados à API do Gastô, os saldos consolidados aparecerão aqui."
        actionLabel="Atualizar Contas"
        onAction={onRetry}
      />
    );
  }

  const totalAssetsCents = accounts
    .filter((a) => a.balanceCents >= 0)
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const totalLiabilitiesCents = accounts
    .filter((a) => a.balanceCents < 0)
    .reduce((sum, a) => sum + Math.abs(a.balanceCents), 0);

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);

    const amountCents = reaisInputToCentavos(transferRaw);
    if (amountCents === null) {
      setTransferError("Informe um valor válido maior que zero.");
      return;
    }

    const parsed = transferAccountsSchema.safeParse({
      fromAccountId: fromId,
      toAccountId: toId,
      amountCents,
    });

    if (!parsed.success) {
      setTransferError(
        parsed.error.issues[0]?.message ?? "Verifique os dados da transferência."
      );
      return;
    }

    setTransferSubmitting(true);
    try {
      await onTransfer(parsed.data);
      setTransferRaw("");
    } catch (err) {
      setTransferError(
        err instanceof Error
          ? err.message
          : "Não foi possível concluir a transferência."
      );
    } finally {
      setTransferSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm tabular-nums">
          <div>
            <span className="text-xs text-slate-500 dark:text-[#908f9e] block">
              Ativos Líquidos Brutos
            </span>
            <span className="font-display text-xl font-bold text-[#0F172A] dark:text-[#dfe2f1] whitespace-nowrap">
              {formatCentavos(totalAssetsCents)}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-white/[0.08]" />
          <div>
            <span className="text-xs text-slate-500 dark:text-[#908f9e] block">
              Fatura / Passivos Atuais
            </span>
            <span className="font-display text-xl font-bold text-[#F43F5E] dark:text-[#ffb4ab] whitespace-nowrap">
              {formatCentavos(-totalLiabilitiesCents)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSyncAccounts}
          disabled={syncing}
          className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg text-xs font-medium bg-white dark:bg-[#171b26] text-slate-700 dark:text-[#c6c5d5] border border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.18] cursor-pointer whitespace-nowrap disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          <span>{syncing ? "Sincronizando..." : "Sincronizar Contas"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => {
          const isNegative = acc.balanceCents < 0;
          return (
            <div
              key={acc.id}
              className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-[#908f9e]">
                    {acc.institution} · {acc.type}
                  </div>
                  <h3 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1] mt-0.5">
                    {acc.name}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-400 dark:text-[#767586] whitespace-nowrap">
                  Atualizado {acc.lastSynced}
                </span>
              </div>

              <div>
                <div
                  className={`font-display text-2xl font-bold tabular-nums whitespace-nowrap ${
                    isNegative
                      ? "text-[#F43F5E] dark:text-[#ffb4ab]"
                      : "text-[#0F172A] dark:text-[#dfe2f1]"
                  }`}
                >
                  {formatCentavos(acc.balanceCents)}
                </div>
                <div className="text-xs text-slate-500 dark:text-[#908f9e] mt-1">
                  {acc.details}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Internal Liquidity Transfer */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <ArrowRightLeft className="w-4 h-4 text-[#6366F1] dark:text-[#818cf8]" />
          <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
            Transferência entre Contas
          </h2>
        </div>

        {transferError && (
          <div
            role="alert"
            className="mt-4 rounded-lg px-3 py-2 text-xs bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#93000a] dark:text-[#ffb4ab]"
          >
            {transferError}
          </div>
        )}

        <form
          onSubmit={(e) => void handleTransferSubmit(e)}
          className="pt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
              Conta de Origem
            </label>
            <select
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.1] text-xs text-[#0F172A] dark:text-[#dfe2f1]"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
              Conta de Destino
            </label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.1] text-xs text-[#0F172A] dark:text-[#dfe2f1]"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
              Valor (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={transferRaw}
              onChange={(e) => setTransferRaw(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.1] text-xs font-mono tabular-nums text-[#0F172A] dark:text-[#dfe2f1]"
            />
          </div>

          <button
            type="submit"
            disabled={transferSubmitting || accounts.length < 2 || fromId === toId}
            className="h-10 px-4 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {transferSubmitting ? "Transferindo..." : "Executar Transferência"}
          </button>
        </form>
      </section>
    </div>
  );
};
