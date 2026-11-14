import React from "react";
import { ArrowLeft, Edit3, Trash2, Check, X, Image as ImageIcon } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { updateExpenseSchema, type UpdateExpenseInput } from "../lib/schemas";
import type { ExpenseCategory, ExpenseItem, ExpenseStatus } from "../types/finance";
import {
  CATEGORY_META,
  EXPENSE_CATEGORIES,
  centavosToReaisInput,
  formatCentavos,
  formatDateBR,
  reaisInputToCentavos,
} from "../utils/formatters";
import { CardSkeleton, ErrorState } from "./StateNotice";

interface ExpenseDetailViewProps {
  expenseId: string;
  onClose: () => void;
  onUpdate: (id: string, input: UpdateExpenseInput) => Promise<ExpenseItem>;
  onDelete: (id: string) => Promise<void>;
}

export const ExpenseDetailView: React.FC<ExpenseDetailViewProps> = ({
  expenseId,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [item, setItem] = React.useState<ExpenseItem | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [merchant, setMerchant] = React.useState("");
  const [rawAmount, setRawAmount] = React.useState("");
  const [txType, setTxType] = React.useState<"expense" | "income">("expense");
  const [expenseDate, setExpenseDate] = React.useState("");
  const [category, setCategory] = React.useState<ExpenseCategory>("Outros");
  const [note, setNote] = React.useState("");
  const [status, setStatus] = React.useState<ExpenseStatus>("confirmed");

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getExpenseById(expenseId);
      setItem(res.item);
      setMerchant(res.item.merchant ?? "");
      setRawAmount(centavosToReaisInput(res.item.amount_cents));
      setTxType(res.item.amount_cents >= 0 ? "income" : "expense");
      setExpenseDate(res.item.expense_date);
      setCategory(res.item.category);
      setNote(res.item.note ?? "");
      setStatus(res.item.status);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar os detalhes da despesa."
      );
    } finally {
      setLoading(false);
    }
  }, [expenseId]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setFormError(null);

    const absCents = reaisInputToCentavos(rawAmount);
    if (absCents === null) {
      setFormError("Informe um valor monetário válido maior que zero.");
      return;
    }

    const signedCents = txType === "expense" ? -absCents : absCents;
    const parsed = updateExpenseSchema.safeParse({
      merchant,
      amountCents: signedCents,
      expenseDate,
      category,
      note,
      status,
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Verifique os campos preenchidos."
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await onUpdate(item.id, parsed.data);
      setItem(updated);
      setEditing(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Erro ao salvar alterações."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await onDelete(item.id);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <CardSkeleton lines={6} />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#c6c5d5] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
        <ErrorState
          title="Despesa indisponível"
          message={error ?? "Lançamento não encontrado."}
          onRetry={() => void loadDetail()}
        />
      </div>
    );
  }

  const meta = CATEGORY_META[item.category];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-3 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-[#c6c5d5] hover:border-[#6366F1] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <div className="flex items-center gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-9 px-3.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] text-[#0F172A] dark:text-[#dfe2f1] hover:border-[#6366F1] cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-9 px-3.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/25 hover:bg-[#F43F5E]/15 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir</span>
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-labelledby="confirm-del-detail"
          className="rounded-xl p-4 bg-[#F43F5E]/10 border border-[#F43F5E]/30 flex flex-wrap items-center justify-between gap-3"
        >
          <p
            id="confirm-del-detail"
            className="text-xs font-medium text-[#93000a] dark:text-[#ffb4ab]"
          >
            Tem certeza que deseja excluir permanentemente este lançamento?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="h-8 px-3 rounded-md text-xs font-medium bg-white dark:bg-[#171b26] text-slate-700 dark:text-[#c6c5d5] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleConfirmDelete()}
              className="h-8 px-3 rounded-md text-xs font-semibold bg-[#F43F5E] text-white hover:bg-[#E11D48] disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Excluindo..." : "Confirmar Exclusão"}
            </button>
          </div>
        </div>
      )}

      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
        {editing ? (
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                Editar Lançamento
              </h2>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Cancelar edição"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-lg px-3 py-2 text-xs bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#93000a] dark:text-[#ffb4ab]"
              >
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-100 dark:bg-[#171b26]">
              <button
                type="button"
                onClick={() => setTxType("expense")}
                className={`h-9 rounded-md text-xs font-semibold cursor-pointer ${
                  txType === "expense"
                    ? "bg-white text-[#F43F5E] dark:bg-[#262a35] dark:text-[#ffb4ab]"
                    : "text-slate-600 dark:text-[#908f9e]"
                }`}
              >
                Despesa
              </button>
              <button
                type="button"
                onClick={() => setTxType("income")}
                className={`h-9 rounded-md text-xs font-semibold cursor-pointer ${
                  txType === "income"
                    ? "bg-white text-[#10B981] dark:bg-[#262a35] dark:text-[#4edea3]"
                    : "text-slate-600 dark:text-[#908f9e]"
                }`}
              >
                Entrada
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                  Estabelecimento
                </label>
                <input
                  type="text"
                  required
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                  Valor (BRL)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={rawAmount}
                  onChange={(e) => setRawAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-sm font-mono text-[#0F172A] dark:text-[#dfe2f1]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                  Data
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-xs text-[#0F172A] dark:text-[#dfe2f1]"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                  Observação
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                  className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-xs text-[#0F172A] dark:text-[#dfe2f1]"
                >
                  <option value="confirmed">Confirmado</option>
                  <option value="needs_review">Revisão pendente</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-9 px-4 rounded-lg text-xs font-medium text-slate-600 dark:text-[#c6c5d5] hover:bg-slate-100 dark:hover:bg-[#1e293b] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:text-[#0b0f19] disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? "Salvando..." : "Salvar Alterações"}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-[#908f9e]">
                  <span
                    className="w-2.5 h-2.5 rounded-xs"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span>{item.category}</span>
                </span>
                <h2 className="font-display text-2xl font-bold text-[#0F172A] dark:text-[#dfe2f1] mt-1">
                  {item.merchant || "Lançamento"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-1">
                  Registrado em {formatDateBR(item.expense_date)}
                </p>
              </div>

              <div className="text-right">
                <div
                  className={`font-display text-2xl font-bold font-mono tabular-nums ${
                    item.amount_cents >= 0
                      ? "text-[#10B981] dark:text-[#4edea3]"
                      : "text-[#0F172A] dark:text-[#dfe2f1]"
                  }`}
                >
                  {formatCentavos(item.amount_cents, { signed: true })}
                </div>
                <span
                  className={`inline-block mt-1 text-xs font-medium ${
                    item.status === "confirmed"
                      ? "text-[#10B981]"
                      : "text-[#D97706] dark:text-[#f59e0b]"
                  }`}
                >
                  {item.status === "confirmed"
                    ? "Confirmado"
                    : "Revisão pendente"}
                </span>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg p-3.5 bg-slate-50/70 dark:bg-[#171b26] border border-slate-200/70 dark:border-white/[0.06]">
                <dt className="text-slate-500 dark:text-[#908f9e]">Origem</dt>
                <dd className="font-medium text-[#0F172A] dark:text-[#dfe2f1] mt-1">
                  {item.source === "image"
                    ? "Foto / Comprovante IA"
                    : item.source === "text"
                    ? "Texto Rápido IA"
                    : "Lançamento Manual"}
                </dd>
              </div>
              <div className="rounded-lg p-3.5 bg-slate-50/70 dark:bg-[#171b26] border border-slate-200/70 dark:border-white/[0.06]">
                <dt className="text-slate-500 dark:text-[#908f9e]">Observação</dt>
                <dd className="font-medium text-[#0F172A] dark:text-[#dfe2f1] mt-1">
                  {item.note || "Sem observação"}
                </dd>
              </div>
            </dl>

            {item.image_id && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#c6c5d5]">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Comprovante anexado</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#171b26] max-h-96 flex items-center justify-center">
                  <img
                    src={`/api/images/${encodeURIComponent(item.image_id)}`}
                    alt={`Comprovante de ${item.merchant ?? "despesa"}`}
                    className="max-h-96 w-auto object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
