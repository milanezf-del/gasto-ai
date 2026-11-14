import React from "react";
import { X, Sparkles } from "lucide-react";
import type { FinancialAccount, TransactionCategory } from "../types/finance";
import { createExpenseSchema, type CreateExpenseInput } from "../lib/schemas";
import {
  ALL_CATEGORIES,
  getTodayIsoSaoPaulo,
  reaisInputToCentavos,
} from "../utils/formatters";

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  submitting: boolean;
  onSubmitExpense: (input: CreateExpenseInput) => Promise<void>;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  open,
  onClose,
  accounts,
  submitting,
  onSubmitExpense,
}) => {
  const [merchant, setMerchant] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [rawAmount, setRawAmount] = React.useState("");
  const [txType, setTxType] = React.useState<"expense" | "income">("expense");
  const [category, setCategory] =
    React.useState<TransactionCategory>("Sem categoria");
  const [accountId, setAccountId] = React.useState("");
  const [date, setDate] = React.useState(getTodayIsoSaoPaulo);
  const [taxDeductible, setTaxDeductible] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const centavos = reaisInputToCentavos(rawAmount);
    if (centavos === null) {
      setFormError("Informe um valor monetário válido maior que zero.");
      return;
    }

    const signedCents = txType === "expense" ? -centavos : centavos;
    const selectedCategory =
      txType === "income" ? "Receitas & Rendimentos" : category;
    const autoClassify =
      txType === "expense" && selectedCategory === "Sem categoria";

    const parsed = createExpenseSchema.safeParse({
      merchant,
      description,
      amountCents: signedCents,
      date,
      category: selectedCategory,
      accountId,
      taxDeductible,
      autoClassify,
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Verifique os dados informados."
      );
      return;
    }

    try {
      await onSubmitExpense(parsed.data);
      setMerchant("");
      setDescription("");
      setRawAmount("");
      setCategory("Sem categoria");
      setTaxDeductible(false);
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o lançamento."
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-entry-title"
    >
      <div
        className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.12] shadow-[0_20px_25px_-5px_rgba(15,23,42,0.15)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08]">
          <h2
            id="new-entry-title"
            className="font-display text-lg font-semibold text-[#0F172A] dark:text-[#dfe2f1]"
          >
            Novo Lançamento
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:text-[#908f9e] dark:hover:text-[#dfe2f1] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="pt-5 space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-lg px-3 py-2 text-xs bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#93000a] dark:text-[#ffb4ab]"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-100 dark:bg-[#111827] border border-slate-200/70 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setTxType("expense")}
              className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                txType === "expense"
                  ? "bg-white text-[#F43F5E] shadow-xs dark:bg-[#262a35] dark:text-[#ffb4ab]"
                  : "text-slate-600 dark:text-[#908f9e]"
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setTxType("income")}
              className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                txType === "income"
                  ? "bg-white text-[#10B981] shadow-xs dark:bg-[#262a35] dark:text-[#4edea3]"
                  : "text-slate-600 dark:text-[#908f9e]"
              }`}
            >
              Receita / Rendimento
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
              Valor (BRL)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm font-mono text-slate-400 dark:text-[#767586] select-none">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                required
                value={rawAmount}
                onChange={(e) => setRawAmount(e.target.value)}
                placeholder="0,00"
                className="w-full h-11 pl-10 pr-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm font-mono tabular-nums text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8] focus:ring-2 focus:ring-[#6366F1]/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
              Estabelecimento ou Contraparte
            </label>
            <input
              type="text"
              required
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Ex.: Mercado, Uber, Salário"
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8] focus:ring-2 focus:ring-[#6366F1]/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
              Observação
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8] focus:ring-2 focus:ring-[#6366F1]/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                Conta
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={accounts.length === 0}
                className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-xs text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1] disabled:opacity-60"
              >
                {accounts.length === 0 ? (
                  <option value="">Nenhuma conta disponível</option>
                ) : (
                  accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
              />
            </div>
          </div>

          {txType === "expense" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as TransactionCategory)
                }
                className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-xs text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
              >
                {ALL_CATEGORIES.filter(
                  (c) => c !== "Receitas & Rendimentos"
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "Sem categoria"
                      ? "Classificar automaticamente com IA"
                      : cat}
                  </option>
                ))}
              </select>
              {category === "Sem categoria" && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#4338CA] dark:text-[#bdc2ff]">
                  <Sparkles className="w-3 h-3 shrink-0" />
                  <span>
                    A API do Gastô classificará este lançamento automaticamente.
                  </span>
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={taxDeductible}
              onChange={(e) => setTaxDeductible(e.target.checked)}
              className="w-4 h-4 rounded-xs accent-[#6366F1] dark:accent-[#818cf8]"
            />
            <span className="text-xs text-slate-600 dark:text-[#c6c5d5]">
              Marcar como despesa dedutível
            </span>
          </label>

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#c6c5d5] dark:hover:bg-[#1e293b] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || accounts.length === 0}
              className="h-10 px-5 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? "Salvando..." : "Salvar Lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
