import React from "react";
import {
  Search,
  Sparkles,
  Trash2,
  Plus,
  Download,
  SlidersHorizontal,
  Eye,
} from "lucide-react";
import type {
  ExpenseCategory,
  ExpenseItem,
  ExpenseListFilters,
} from "../types/finance";
import { api } from "../lib/api";
import {
  CATEGORY_META,
  EXPENSE_CATEGORIES,
  formatCentavos,
  formatDateWithWeekdayBR,
  reaisInputToCentavos,
} from "../utils/formatters";
import { EmptyState, ErrorState, TableSkeleton } from "./StateNotice";

interface TransactionsViewProps {
  expenses: ExpenseItem[];
  filters: ExpenseListFilters;
  onChangeFilters: React.Dispatch<React.SetStateAction<ExpenseListFilters>>;
  onResetFilters: () => void;
  hasMore: boolean;
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  onRetry: () => void;
  onLoadMore: () => void;
  isCategorizing: boolean;
  onCategorizePending: () => void;
  onUpdateCategory: (id: string, category: ExpenseCategory) => void;
  onDeleteExpense: (id: string) => Promise<void>;
  onSelectExpense: (id: string) => void;
  onOpenNewEntry: () => void;
  onNotifyError: (msg: string) => void;
  onNotifySuccess: (msg: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  expenses,
  filters,
  onChangeFilters,
  onResetFilters,
  hasMore,
  totalCount,
  loading,
  loadingMore,
  error,
  onRetry,
  onLoadMore,
  isCategorizing,
  onCategorizePending,
  onUpdateCategory,
  onDeleteExpense,
  onSelectExpense,
  onOpenNewEntry,
  onNotifyError,
  onNotifySuccess,
}) => {
  const [searchInput, setSearchInput] = React.useState(filters.q ?? "");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [minText, setMinText] = React.useState("");
  const [maxText, setMaxText] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [pendingDeleteTx, setPendingDeleteTx] =
    React.useState<ExpenseItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Debounce da busca para evitar múltiplas chamadas à API por tecla
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      onChangeFilters((prev) => {
        if ((prev.q ?? "") === searchInput.trim()) return prev;
        return { ...prev, q: searchInput.trim() || undefined };
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, onChangeFilters]);

  const pendingCount = expenses.filter(
    (t) => t.status === "needs_review"
  ).length;

  // Agrupamento por dia com total diário
  const groupedByDay = React.useMemo(() => {
    const groups: Array<{
      date: string;
      label: string;
      totalSpentCents: number;
      netCents: number;
      items: ExpenseItem[];
    }> = [];
    const map = new Map<string, (typeof groups)[number]>();

    for (const tx of expenses) {
      let group = map.get(tx.expense_date);
      if (!group) {
        group = {
          date: tx.expense_date,
          label: formatDateWithWeekdayBR(tx.expense_date),
          totalSpentCents: 0,
          netCents: 0,
          items: [],
        };
        map.set(tx.expense_date, group);
        groups.push(group);
      }
      group.items.push(tx);
      group.netCents += tx.amount_cents;
      if (tx.amount_cents < 0) {
        group.totalSpentCents += Math.abs(tx.amount_cents);
      }
    }
    return groups;
  }, [expenses]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await api.downloadExpensesCsv(filters);
      onNotifySuccess("Exportação CSV concluída.");
    } catch (err) {
      onNotifyError(
        err instanceof Error
          ? err.message
          : "Não foi possível exportar as despesas."
      );
    } finally {
      setExporting(false);
    }
  };

  const applyAmountRange = (rawMin: string, rawMax: string) => {
    const minCents = rawMin.trim() ? reaisInputToCentavos(rawMin) : undefined;
    const maxCents = rawMax.trim() ? reaisInputToCentavos(rawMax) : undefined;
    onChangeFilters((prev) => ({
      ...prev,
      minCents: minCents ?? undefined,
      maxCents: maxCents ?? undefined,
    }));
  };

  const confirmDelete = async () => {
    if (!pendingDeleteTx) return;
    setDeleting(true);
    try {
      await onDeleteExpense(pendingDeleteTx.id);
      setPendingDeleteTx(null);
      onNotifySuccess("Despesa excluída.");
    } catch {
      // Erro já notificado via toast
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(
    filters.q ||
      filters.from ||
      filters.to ||
      (filters.category && filters.category !== "all") ||
      (filters.status && filters.status !== "all") ||
      filters.minCents ||
      filters.maxCents
  );

  if (loading) {
    return <TableSkeleton rows={7} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar os lançamentos"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-5">
      {pendingCount > 0 && (
        <div className="rounded-xl bg-[#F59E0B]/[0.08] border border-[#F59E0B]/30 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/20 text-[#D97706] dark:text-[#f59e0b] font-mono text-xs font-bold">
              {pendingCount}
            </span>
            <span className="font-medium text-[#0F172A] dark:text-[#dfe2f1]">
              {pendingCount === 1
                ? "despesa pendente de revisão"
                : "despesas pendentes de revisão"}
            </span>
          </div>
          <button
            type="button"
            disabled={isCategorizing}
            onClick={onCategorizePending}
            className="h-9 px-4 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isCategorizing
                ? "Classificando..."
                : "Categorizar Pendentes com IA"}
            </span>
          </button>
        </div>
      )}

      {/* Toolbar principal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#767586] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar estabelecimento ou nota..."
              aria-label="Buscar despesas"
              className="h-10 w-64 pl-9 pr-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.08] text-xs text-[#0F172A] dark:text-[#dfe2f1] placeholder:text-slate-400 dark:placeholder:text-[#767586] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className={`h-10 px-3 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium border transition-colors cursor-pointer ${
              showAdvanced || hasActiveFilters
                ? "bg-[#6366F1]/10 text-[#4338CA] border-[#6366F1]/30 dark:bg-[#818cf8]/15 dark:text-[#bdc2ff] dark:border-[#818cf8]/30"
                : "bg-white dark:bg-[#111827] text-slate-700 dark:text-[#c6c5d5] border-slate-200 dark:border-white/[0.08]"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros</span>
          </button>

          <select
            value={filters.sort ?? "date_desc"}
            onChange={(e) =>
              onChangeFilters((prev) => ({
                ...prev,
                sort: e.target.value as ExpenseListFilters["sort"],
              }))
            }
            aria-label="Ordenar despesas"
            className="h-10 px-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.08] text-xs text-[#0F172A] dark:text-[#dfe2f1]"
          >
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigas</option>
            <option value="amount_desc">Maior valor</option>
            <option value="amount_asc">Menor valor</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExportCsv()}
            className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#c6c5d5] hover:border-[#6366F1] disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? "Exportando..." : "Exportar CSV"}</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewEntry}
            className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Lançamento</span>
          </button>
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      {showAdvanced && (
        <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-[#908f9e] mb-1">
              De
            </label>
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  from: e.target.value || undefined,
                }))
              }
              className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-[#908f9e] mb-1">
              Até
            </label>
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  to: e.target.value || undefined,
                }))
              }
              className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-[#908f9e] mb-1">
              Categoria
            </label>
            <select
              value={filters.category ?? "all"}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  category: e.target.value,
                }))
              }
              className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.08] text-xs text-[#0F172A] dark:text-[#dfe2f1]"
            >
              <option value="all">Todas</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-[#908f9e] mb-1">
              Status
            </label>
            <select
              value={filters.status ?? "all"}
              onChange={(e) =>
                onChangeFilters((prev) => ({
                  ...prev,
                  status: e.target.value as ExpenseListFilters["status"],
                }))
              }
              className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.08] text-xs text-[#0F172A] dark:text-[#dfe2f1]"
            >
              <option value="all">Todos</option>
              <option value="confirmed">Confirmados</option>
              <option value="needs_review">Pendentes</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-[#908f9e] mb-1">
              Valor mín. (R$)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={minText}
              onChange={(e) => setMinText(e.target.value)}
              onBlur={() => applyAmountRange(minText, maxText)}
              placeholder="0,00"
              className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1]"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-[#908f9e] mb-1">
                Valor máx. (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={maxText}
                onChange={(e) => setMaxText(e.target.value)}
                onBlur={() => applyAmountRange(minText, maxText)}
                placeholder="0,00"
                className="w-full h-9 px-2.5 rounded-lg bg-slate-50 dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.08] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1]"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setMinText("");
                  setMaxText("");
                  onResetFilters();
                }}
                className="h-9 px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-[#908f9e] dark:hover:text-white cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Diálogo inline de confirmação de exclusão */}
      {pendingDeleteTx && (
        <div
          role="alertdialog"
          aria-labelledby="tx-delete-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.12] p-5 shadow-xl space-y-4">
            <div>
              <h3
                id="tx-delete-confirm"
                className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]"
              >
                Excluir lançamento?
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-1">
                Você está prestes a excluir{" "}
                <strong className="text-[#0F172A] dark:text-white">
                  {pendingDeleteTx.merchant || "este lançamento"}
                </strong>{" "}
                ({formatCentavos(pendingDeleteTx.amount_cents, { signed: true })}). Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteTx(null)}
                className="h-9 px-3.5 rounded-lg text-xs font-medium text-slate-600 dark:text-[#c6c5d5] hover:bg-slate-100 dark:hover:bg-[#1e293b] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDelete()}
                className="h-9 px-4 rounded-lg text-xs font-semibold bg-[#F43F5E] hover:bg-[#E11D48] text-white disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista agrupada por dia */}
      {expenses.length === 0 ? (
        <EmptyState
          title={
            hasActiveFilters
              ? "Nenhuma despesa corresponde aos filtros"
              : "Nenhuma despesa registrada"
          }
          description={
            hasActiveFilters
              ? "Ajuste a busca ou limpe os filtros para visualizar seus lançamentos."
              : "Crie seu primeiro lançamento manual, por texto ou foto de comprovante."
          }
          actionLabel={hasActiveFilters ? "Limpar Filtros" : "Adicionar Despesa"}
          onAction={() => {
            if (hasActiveFilters) {
              setSearchInput("");
              setMinText("");
              setMaxText("");
              onResetFilters();
            } else {
              onOpenNewEntry();
            }
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#908f9e] px-1">
            <span>
              Exibindo {expenses.length} de {totalCount} lançamentos
            </span>
          </div>

          {groupedByDay.map((group) => (
            <section
              key={group.date}
              className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none overflow-hidden"
            >
              <div className="px-5 py-3 bg-slate-50/80 dark:bg-[#171b26]/80 border-b border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                  {group.label}
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-[#908f9e]">
                  Gasto do dia:{" "}
                  <strong className="text-[#0F172A] dark:text-[#dfe2f1]">
                    {formatCentavos(group.totalSpentCents)}
                  </strong>
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {group.items.map((tx) => {
                  const meta = CATEGORY_META[tx.category];
                  const isPending = tx.status === "needs_review";

                  return (
                    <div
                      key={tx.id}
                      className={`px-5 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-[#171b26]/60 transition-colors ${
                        isCategorizing && isPending ? "ai-shimmer" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectExpense(tx.id)}
                        className="flex-1 min-w-[180px] text-left cursor-pointer focus-visible:outline-none focus-visible:underline"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-[#0F172A] dark:text-[#dfe2f1] truncate">
                            {tx.merchant || "Lançamento"}
                          </span>
                          {isPending && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F59E0B]/15 text-[#D97706] dark:text-[#f59e0b]">
                              Revisar
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#908f9e] truncate">
                          {tx.note ||
                            (tx.source === "image"
                              ? "Comprovante via foto"
                              : tx.source === "text"
                              ? "Texto rápido"
                              : "Lançamento manual")}
                        </div>
                      </button>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <select
                            value={tx.category}
                            onChange={(e) =>
                              onUpdateCategory(
                                tx.id,
                                e.target.value as ExpenseCategory
                              )
                            }
                            aria-label={`Categoria de ${tx.merchant ?? "despesa"}`}
                            className="bg-transparent text-xs font-medium text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none cursor-pointer"
                          >
                            {EXPENSE_CATEGORIES.map((c) => (
                              <option
                                key={c}
                                value={c}
                                className="bg-white dark:bg-[#171b26] text-[#0F172A] dark:text-[#dfe2f1]"
                              >
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <span
                          className={`font-mono text-sm font-semibold tabular-nums min-w-[96px] text-right ${
                            tx.amount_cents >= 0
                              ? "text-[#10B981] dark:text-[#4edea3]"
                              : "text-[#0F172A] dark:text-[#dfe2f1]"
                          }`}
                        >
                          {formatCentavos(tx.amount_cents, { signed: true })}
                        </span>

                        <button
                          type="button"
                          onClick={() => onSelectExpense(tx.id)}
                          aria-label={`Ver detalhes de ${tx.merchant ?? "despesa"}`}
                          title="Ver detalhes e editar"
                          className="p-1.5 rounded-md text-slate-400 hover:text-[#6366F1] hover:bg-[#6366F1]/10 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setPendingDeleteTx(tx)}
                          aria-label={`Excluir ${tx.merchant ?? "despesa"}`}
                          title="Excluir"
                          className="p-1.5 rounded-md text-slate-400 hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={onLoadMore}
                className="h-10 px-5 rounded-lg text-xs font-semibold bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.08] text-[#0F172A] dark:text-[#dfe2f1] hover:border-[#6366F1] disabled:opacity-50 cursor-pointer"
              >
                {loadingMore ? "Carregando..." : "Carregar mais despesas"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
