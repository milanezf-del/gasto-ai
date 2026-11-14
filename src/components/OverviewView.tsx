import React from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import type {
  BudgetEnvelope,
  ExpenseItem,
  FinancialSummary,
  WorkspaceView,
} from "../types/finance";
import {
  CATEGORY_META,
  formatCentavos,
  formatDateBR,
} from "../utils/formatters";
import { CashFlowChart } from "./CashFlowChart";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "./StateNotice";

interface OverviewViewProps {
  summary: FinancialSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  onRetrySummary: () => void;
  expenses: ExpenseItem[];
  expensesLoading: boolean;
  expensesError: string | null;
  onRetryExpenses: () => void;
  budgets: BudgetEnvelope[];
  budgetsLoading: boolean;
  budgetsError: string | null;
  onRetryBudgets: () => void;
  isCategorizing: boolean;
  onCategorizePending: () => void;
  onOpenNewEntry: () => void;
  onNavigate: (view: WorkspaceView) => void;
  onAskAI: (prompt: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  summary,
  summaryLoading,
  summaryError,
  onRetrySummary,
  expenses,
  expensesLoading,
  expensesError,
  onRetryExpenses,
  budgets,
  budgetsLoading,
  budgetsError,
  onRetryBudgets,
  isCategorizing,
  onCategorizePending,
  onOpenNewEntry,
  onNavigate,
  onAskAI,
}) => {
  const pendingCount = expenses.filter(
    (t) => t.category === "Sem categoria" || t.status === "Revisão pendente"
  ).length;

  const budgetUsage = React.useMemo(() => {
    return budgets
      .map((b) => {
        const pct =
          b.monthlyLimitCents > 0
            ? (b.spentCents / b.monthlyLimitCents) * 100
            : 0;
        return { ...b, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets]);

  const recentExpenses = expenses.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      ) : summaryError ? (
        <ErrorState
          title="Erro ao carregar indicadores financeiros"
          message={summaryError}
          onRetry={onRetrySummary}
        />
      ) : !summary ? (
        <EmptyState
          title="Nenhum indicador consolidado ainda"
          description="Conecte uma conta ou registre seu primeiro lançamento para visualizar patrimônio e fluxo de caixa."
          actionLabel="Novo Lançamento"
          onAction={onOpenNewEntry}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-[#908f9e]">
              <span>Patrimônio Consolidado</span>
              <span className="inline-flex items-center gap-0.5 text-[#10B981] font-mono tabular-nums">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {summary.accountsCount}{" "}
                {summary.accountsCount === 1 ? "conta" : "contas"}
              </span>
            </div>
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#dfe2f1] tabular-nums whitespace-nowrap">
              {formatCentavos(summary.netWorthCents)}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-[#908f9e]">
              Saldo líquido em instituições vinculadas
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-[#908f9e]">
              <span>Entradas do Mês</span>
              <span className="inline-flex items-center gap-0.5 text-[#10B981] font-mono">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Receitas
              </span>
            </div>
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#dfe2f1] tabular-nums whitespace-nowrap">
              {formatCentavos(summary.monthlyInflowCents)}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-[#908f9e]">
              Rendimentos e créditos confirmados
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-[#908f9e]">
              <span>Saídas do Mês</span>
              <span className="inline-flex items-center gap-0.5 text-slate-600 dark:text-[#c6c5d5] font-mono tabular-nums">
                <ArrowDownRight className="w-3.5 h-3.5 text-[#F43F5E]" />
                {summary.pendingCount} pendentes
              </span>
            </div>
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#dfe2f1] tabular-nums whitespace-nowrap">
              {formatCentavos(summary.monthlyOutflowCents)}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-[#908f9e]">
              {summary.pendingCount > 0
                ? `${summary.pendingCount} lançamentos aguardando revisão`
                : "Todos os lançamentos classificados"}
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-[#908f9e]">
              <span>Saldo Líquido Mensal</span>
              <span
                className={`font-mono tabular-nums font-medium ${
                  summary.netSurplusCents >= 0
                    ? "text-[#10B981]"
                    : "text-[#F43F5E]"
                }`}
              >
                {summary.savingsRatePct.toFixed(1)}% poupado
              </span>
            </div>
            <div
              className={`mt-2 font-display text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap ${
                summary.netSurplusCents >= 0
                  ? "text-[#10B981] dark:text-[#4edea3]"
                  : "text-[#F43F5E] dark:text-[#ffb4ab]"
              }`}
            >
              {formatCentavos(summary.netSurplusCents, { signed: true })}
            </div>
            <div className="mt-1.5 text-xs text-slate-500 dark:text-[#908f9e]">
              Disponível para reserva ou aporte
            </div>
          </div>
        </div>
      )}

      {/* Main Chart + Budget Guardrails Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          {summaryLoading ? (
            <CardSkeleton lines={6} className="h-full" />
          ) : (
            <CashFlowChart
              history={summary?.cashFlowHistory ?? []}
              expenses={expenses}
            />
          )}
        </div>

        <section className="lg:col-span-5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                  Limites por Categoria
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
                  Ritmo de consumo no ciclo atual
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("budgets")}
                className="text-xs font-medium text-[#4338CA] dark:text-[#bdc2ff] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Configurar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {budgetsLoading ? (
              <div className="pt-4 space-y-4">
                <div className="h-9 w-full rounded ai-shimmer" />
                <div className="h-9 w-full rounded ai-shimmer" />
                <div className="h-9 w-full rounded ai-shimmer" />
              </div>
            ) : budgetsError ? (
              <div className="pt-4">
                <ErrorState
                  title="Orçamentos indisponíveis"
                  message={budgetsError}
                  onRetry={onRetryBudgets}
                />
              </div>
            ) : budgetUsage.length === 0 ? (
              <div className="pt-4">
                <EmptyState
                  title="Nenhum limite definido"
                  description="Configure tetos mensais por categoria para receber alertas de ritmo de gastos."
                  actionLabel="Configurar Orçamentos"
                  onAction={() => onNavigate("budgets")}
                />
              </div>
            ) : (
              <div className="pt-4 space-y-4">
                {budgetUsage.slice(0, 5).map((item) => {
                  const meta = CATEGORY_META[item.category];
                  const isOver = item.pct > 100;
                  const isWarning = item.pct >= 80 && item.pct <= 100;
                  const barColor = isOver
                    ? "#F43F5E"
                    : isWarning
                    ? "#F59E0B"
                    : meta.color;

                  return (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="font-medium text-[#0F172A] dark:text-[#dfe2f1] truncate">
                            {item.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums font-mono">
                          <span className="text-[#0F172A] dark:text-[#dfe2f1] font-medium whitespace-nowrap">
                            {formatCentavos(item.spentCents)}
                          </span>
                          <span className="text-slate-400 dark:text-[#767586] whitespace-nowrap">
                            / {formatCentavos(item.monthlyLimitCents)}
                          </span>
                        </div>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1e293b] overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(item.pct, 100)}%`,
                            backgroundColor: barColor,
                          }}
                          className="h-full rounded-full transition-all duration-300"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            isOver
                              ? "text-[#F43F5E]"
                              : isWarning
                              ? "text-[#D97706] dark:text-[#f59e0b]"
                              : "text-slate-500 dark:text-[#908f9e]"
                          }`}
                        >
                          {isOver || isWarning ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                          )}
                          <span>
                            {isOver
                              ? "Acima do limite"
                              : isWarning
                              ? "Próximo do limite"
                              : "Dentro do esperado"}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-[#908f9e]">
                          {item.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500 dark:text-[#908f9e]">
              Quer ajustar seus tetos com IA?
            </span>
            <button
              type="button"
              onClick={() =>
                onAskAI(
                  "Analise meu ritmo de gastos atual e indique qual orçamento precisa de ajuste."
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#4338CA] dark:text-[#bdc2ff] bg-[#6366F1]/10 dark:bg-[#818cf8]/15 hover:bg-[#6366F1]/15 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Consultar IA</span>
            </button>
          </div>
        </section>
      </div>

      {/* Recent Ledger Stream */}
      {expensesLoading ? (
        <TableSkeleton rows={5} />
      ) : expensesError ? (
        <ErrorState
          title="Erro ao carregar lançamentos recentes"
          message={expensesError}
          onRetry={onRetryExpenses}
        />
      ) : recentExpenses.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento registrado"
          description="Seus gastos e receitas mais recentes aparecerão aqui assim que forem sincronizados ou cadastrados."
          actionLabel="Registrar Primeiro Lançamento"
          onAction={onOpenNewEntry}
        />
      ) : (
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                Lançamentos Recentes
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
                Movimentações mais recentes confirmadas e pendentes
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {pendingCount > 0 && (
                <button
                  type="button"
                  disabled={isCategorizing}
                  onClick={onCategorizePending}
                  className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isCategorizing
                      ? "Classificando..."
                      : `Categorizar ${pendingCount} pendentes`}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate("transactions")}
                className="h-9 px-3 rounded-lg text-xs font-medium text-slate-700 dark:text-[#c6c5d5] bg-slate-100 hover:bg-slate-200/70 dark:bg-[#1e293b] dark:hover:bg-[#262a35] transition-colors cursor-pointer whitespace-nowrap"
              >
                Ver Todos
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/70 dark:bg-[#171b26]/60 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#908f9e]">
                  <th className="py-2.5 pl-6 pr-3">Data</th>
                  <th className="py-2.5 px-3">Estabelecimento</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Verificação</th>
                  <th className="py-2.5 pl-3 pr-6 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05] text-sm">
                {recentExpenses.map((tx) => {
                  const meta = CATEGORY_META[tx.category];
                  const isPending =
                    tx.category === "Sem categoria" ||
                    tx.status === "Revisão pendente";

                  return (
                    <tr
                      key={tx.id}
                      className={`h-11 hover:bg-slate-50/80 dark:hover:bg-[#171b26]/70 transition-colors ${
                        isCategorizing && isPending ? "ai-shimmer" : ""
                      }`}
                    >
                      <td className="py-2.5 pl-6 pr-3 font-mono text-xs tabular-nums text-slate-500 dark:text-[#908f9e] whitespace-nowrap">
                        {formatDateBR(tx.date)}
                      </td>
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <div className="font-medium text-[#0F172A] dark:text-[#dfe2f1] truncate">
                          {tx.merchant}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#908f9e] truncate">
                          {tx.description || "Sem observação"}
                          {tx.taxDeductible && " · Dedutível"}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-[#c6c5d5]">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span>{tx.category}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {tx.aiConfidence ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-[#4338CA] dark:text-[#bdc2ff]">
                            <Sparkles className="w-3 h-3" />
                            <span>{tx.aiConfidence}% IA</span>
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-[#D97706] dark:text-[#f59e0b]">
                            {tx.status}
                          </span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 pl-3 pr-6 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                          tx.amountCents >= 0
                            ? "text-[#10B981] dark:text-[#4edea3]"
                            : "text-[#0F172A] dark:text-[#dfe2f1]"
                        }`}
                      >
                        {formatCentavos(tx.amountCents, { signed: true })}
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
