import React from "react";
import { Search, Sparkles, Trash2, Plus } from "lucide-react";
import type {
  ExpenseItem,
  FinancialAccount,
  TransactionCategory,
} from "../types/finance";
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  formatCentavos,
  formatDateBR,
} from "../utils/formatters";
import { EmptyState, ErrorState, TableSkeleton } from "./StateNotice";

interface TransactionsViewProps {
  expenses: ExpenseItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  accounts: FinancialAccount[];
  isCategorizing: boolean;
  onCategorizePending: () => void;
  onUpdateCategory: (id: string, category: TransactionCategory) => void;
  onDeleteExpense: (id: string) => void;
  onOpenNewEntry: () => void;
}

type TypeFilter = "all" | "income" | "expenses" | "pending";

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  expenses,
  loading,
  error,
  onRetry,
  accounts,
  isCategorizing,
  onCategorizePending,
  onUpdateCategory,
  onDeleteExpense,
  onOpenNewEntry,
}) => {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  const accountMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const acc of accounts) {
      map[acc.id] = acc.name;
    }
    return map;
  }, [accounts]);

  const pendingCount = expenses.filter(
    (t) => t.category === "Sem categoria" || t.status === "Revisão pendente"
  ).length;

  const filtered = React.useMemo(() => {
    return expenses.filter((tx) => {
      if (typeFilter === "income" && tx.amountCents <= 0) return false;
      if (typeFilter === "expenses" && tx.amountCents >= 0) return false;
      if (
        typeFilter === "pending" &&
        tx.category !== "Sem categoria" &&
        tx.status !== "Revisão pendente"
      ) {
        return false;
      }
      if (categoryFilter !== "all" && tx.category !== categoryFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          tx.merchant.toLowerCase().includes(q) ||
          tx.description.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, typeFilter, categoryFilter, search]);

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
        <div className="rounded-xl bg-[#6366F1]/[0.06] dark:bg-[#818cf8]/[0.08] border border-[#6366F1]/25 dark:border-[#818cf8]/25 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            <Sparkles className="w-4 h-4 text-[#6366F1] dark:text-[#818cf8] shrink-0" />
            <span className="font-medium text-[#0F172A] dark:text-[#dfe2f1]">
              {pendingCount}{" "}
              {pendingCount === 1
                ? "lançamento aguardando classificação"
                : "lançamentos aguardando classificação"}
            </span>
          </div>
          <button
            type="button"
            disabled={isCategorizing}
            onClick={onCategorizePending}
            className="h-9 px-4 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
          >
            {isCategorizing
              ? "Classificando com IA..."
              : "Categorizar Pendentes com IA"}
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-[#767586] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar estabelecimento ou nota..."
              className="h-10 w-64 pl-9 pr-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.08] text-xs text-[#0F172A] dark:text-[#dfe2f1] placeholder:text-slate-400 dark:placeholder:text-[#767586] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8]"
            />
          </div>

          <div className="flex items-center p-1 rounded-lg bg-slate-200/70 dark:bg-[#171b26] border border-slate-200/70 dark:border-white/[0.08]">
            {(
              [
                { id: "all", label: "Todos" },
                { id: "expenses", label: "Despesas" },
                { id: "income", label: "Receitas" },
                { id: "pending", label: `Pendentes (${pendingCount})` },
              ] as Array<{ id: TypeFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  typeFilter === tab.id
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                    : "text-slate-600 hover:text-slate-900 dark:text-[#908f9e] dark:hover:text-[#dfe2f1]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por categoria"
            className="h-10 px-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.08] text-xs text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
          >
            <option value="all">Todas as categorias</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

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

      {/* High-Density Flat Data Table */}
      {expenses.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento cadastrado"
          description="Você ainda não possui despesas ou receitas registradas. Crie o primeiro lançamento para iniciar seu controle financeiro."
          actionLabel="Registrar Primeiro Lançamento"
          onAction={onOpenNewEntry}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento corresponde aos filtros"
          description="Ajuste a busca ou limpe os filtros selecionados para visualizar seus registros."
          actionLabel="Limpar Filtros"
          onAction={() => {
            setSearch("");
            setTypeFilter("all");
            setCategoryFilter("all");
          }}
        />
      ) : (
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/70 dark:bg-[#171b26]/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#908f9e]">
                  <th className="py-3 pl-5 pr-3">Data</th>
                  <th className="py-3 px-3">Estabelecimento e Detalhes</th>
                  <th className="py-3 px-3">Conta</th>
                  <th className="py-3 px-3">Categoria</th>
                  <th className="py-3 px-3">Status / IA</th>
                  <th className="py-3 px-3 text-right">Valor</th>
                  <th className="py-3 pl-2 pr-5 text-right w-10">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05] text-sm">
                {filtered.map((tx) => {
                  const meta = CATEGORY_META[tx.category];
                  const isPending =
                    tx.category === "Sem categoria" ||
                    tx.status === "Revisão pendente";

                  return (
                    <tr
                      key={tx.id}
                      className={`group hover:bg-slate-50/80 dark:hover:bg-[#171b26]/70 transition-colors ${
                        isCategorizing && isPending ? "ai-shimmer" : ""
                      }`}
                    >
                      <td className="py-2.5 pl-5 pr-3 font-mono text-xs tabular-nums text-slate-500 dark:text-[#908f9e] whitespace-nowrap">
                        {formatDateBR(tx.date)}
                      </td>
                      <td className="py-2.5 px-3 min-w-[220px]">
                        <div className="font-medium text-[#0F172A] dark:text-[#dfe2f1]">
                          {tx.merchant}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#908f9e]">
                          {tx.aiRationale
                            ? tx.aiRationale
                            : tx.description || "Sem observação"}
                          {tx.taxDeductible && " · Dedutível"}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-600 dark:text-[#c6c5d5] whitespace-nowrap">
                        {accountMap[tx.accountId] ?? tx.accountId}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <select
                            value={tx.category}
                            onChange={(e) =>
                              onUpdateCategory(
                                tx.id,
                                e.target.value as TransactionCategory
                              )
                            }
                            aria-label={`Categoria de ${tx.merchant}`}
                            className="bg-transparent text-xs font-medium text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:underline cursor-pointer pr-1"
                          >
                            {ALL_CATEGORIES.map((c) => (
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
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={
                              tx.status === "Confirmado"
                                ? "text-[#10B981] font-medium"
                                : "text-[#D97706] dark:text-[#f59e0b] font-medium"
                            }
                          >
                            {tx.status}
                          </span>
                          {tx.aiConfidence && (
                            <>
                              <span
                                aria-hidden="true"
                                className="text-slate-300 dark:text-[#454653]"
                              >
                                ·
                              </span>
                              <span className="font-mono tabular-nums text-[#4338CA] dark:text-[#bdc2ff]">
                                {tx.aiConfidence}% IA
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                          tx.amountCents >= 0
                            ? "text-[#10B981] dark:text-[#4edea3]"
                            : "text-[#0F172A] dark:text-[#dfe2f1]"
                        }`}
                      >
                        {formatCentavos(tx.amountCents, { signed: true })}
                      </td>
                      <td className="py-2.5 pl-2 pr-5 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(tx.id)}
                          aria-label={`Excluir ${tx.merchant}`}
                          className="p-1.5 rounded-md text-slate-400 hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 opacity-70 group-hover:opacity-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
