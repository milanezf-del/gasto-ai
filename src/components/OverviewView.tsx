import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import type {
  DashboardData,
  FinancialInsightItem,
  WorkspaceView,
} from "../types/finance";
import {
  CATEGORY_META,
  formatCentavos,
  formatDateBR,
  formatMonthLabelPT,
} from "../utils/formatters";
import { CategoryDonutCard, DailyTrendChart } from "./CashFlowChart";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "./StateNotice";

interface OverviewViewProps {
  month: string;
  onChangeMonth: (month: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  dashboard: DashboardData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  insights: FinancialInsightItem[];
  insightsEmpty: boolean;
  insightsLoading: boolean;
  isCategorizing: boolean;
  onCategorizePending: () => void;
  onOpenNewEntry: () => void;
  onSelectExpense: (id: string) => void;
  onNavigate: (view: WorkspaceView) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  month,
  onChangeMonth,
  onPrevMonth,
  onNextMonth,
  dashboard,
  loading,
  error,
  onRetry,
  insights,
  insightsEmpty,
  insightsLoading,
  isCategorizing,
  onCategorizePending,
  onOpenNewEntry,
  onSelectExpense,
  onNavigate,
}) => {
  const sparklinePoints = React.useMemo(() => {
    const series = dashboard?.dailySeries ?? [];
    if (series.length === 0) return "";
    const maxVal = Math.max(...series.map((p) => p.spentCents), 100);
    return series
      .map((p, idx) => {
        const x =
          series.length > 1 ? (idx / (series.length - 1)) * 120 : 60;
        const y = 28 - (p.spentCents / maxVal) * 24;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [dashboard?.dailySeries]);

  const activeBudgets = React.useMemo(() => {
    return (dashboard?.budgets ?? [])
      .filter((b) => b.configured || b.spentCents > 0)
      .sort((a, b) => b.usagePct - a.usagePct);
  }, [dashboard?.budgets]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <CardSkeleton lines={6} className="lg:col-span-7" />
          <CardSkeleton lines={6} className="lg:col-span-5" />
        </div>
        <TableSkeleton rows={5} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Erro ao carregar o painel financeiro"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (!dashboard) {
    return (
      <EmptyState
        title="Nenhum dado disponível"
        description="Registre sua primeira despesa para acompanhar o resumo do mês."
        actionLabel="Novo Lançamento"
        onAction={onOpenNewEntry}
      />
    );
  }

  const varPct = dashboard.variationPct;
  const totalBudgetPct =
    dashboard.totalBudgetLimitCents > 0
      ? Math.round(
          (dashboard.totalMonthCents / dashboard.totalBudgetLimitCents) * 100
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Seletor de Mês */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
            Resumo de {formatMonthLabelPT(dashboard.month)}
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#908f9e]">
            Consolidado em tempo real · Fuso America/Sao_Paulo
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] rounded-lg p-1">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Mês anterior"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#c6c5d5] dark:hover:bg-[#1e293b] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) onChangeMonth(e.target.value);
            }}
            aria-label="Selecionar mês de referência"
            className="h-8 px-2 bg-transparent text-xs font-medium text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none cursor-pointer"
          />
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Próximo mês"
            className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#c6c5d5] dark:hover:bg-[#1e293b] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-[#908f9e]">
            <span>Total Gasto no Mês</span>
            {varPct !== null ? (
              <span
                className={`inline-flex items-center gap-0.5 font-mono tabular-nums font-semibold ${
                  varPct > 0
                    ? "text-[#F43F5E]"
                    : varPct < 0
                    ? "text-[#10B981]"
                    : "text-slate-500 dark:text-[#908f9e]"
                }`}
              >
                {varPct > 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : varPct < 0 ? (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                ) : null}
                {varPct > 0 ? `+${varPct}%` : `${varPct}%`}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 dark:text-[#767586]">
                Sem base anterior
              </span>
            )}
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="font-display text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#dfe2f1] tabular-nums whitespace-nowrap">
              {formatCentavos(dashboard.totalMonthCents)}
            </div>
            {sparklinePoints && (
              <svg
                viewBox="0 0 120 32"
                className="w-20 h-7 shrink-0"
                aria-hidden="true"
              >
                <polyline
                  fill="none"
                  stroke="#6366F1"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparklinePoints}
                />
              </svg>
            )}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-[#908f9e]">
            Mês anterior: {formatCentavos(dashboard.totalPreviousMonthCents)}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-[#908f9e]">
            <span>Teto Orçamentário</span>
            <span className="font-mono tabular-nums">
              {totalBudgetPct !== null ? `${totalBudgetPct}% usado` : "—"}
            </span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#dfe2f1] tabular-nums whitespace-nowrap">
            {formatCentavos(dashboard.totalBudgetLimitCents)}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-[#908f9e]">
            {dashboard.totalBudgetLimitCents > 0
              ? `Restam ${formatCentavos(
                  Math.max(
                    dashboard.totalBudgetLimitCents - dashboard.totalMonthCents,
                    0
                  )
                )}`
              : "Defina limites em Orçamentos"}
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-[#908f9e]">
            <span>Entradas e Saldo</span>
            <span className="font-mono tabular-nums text-[#10B981]">
              +{formatCentavos(dashboard.monthlyInflowCents, { compact: true })}
            </span>
          </div>
          <div
            className={`mt-2 font-display text-2xl font-bold tracking-tight tabular-nums whitespace-nowrap ${
              dashboard.netSurplusCents >= 0
                ? "text-[#10B981] dark:text-[#4edea3]"
                : "text-[#F43F5E] dark:text-[#ffb4ab]"
            }`}
          >
            {formatCentavos(dashboard.netSurplusCents, { signed: true })}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-[#908f9e]">
            Receitas menos despesas do mês
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-[#908f9e]">
            <span>Pendentes de Revisão</span>
            <span
              className={`font-mono font-semibold ${
                dashboard.pendingCount > 0
                  ? "text-[#D97706] dark:text-[#f59e0b]"
                  : "text-[#10B981]"
              }`}
            >
              {dashboard.pendingCount > 0 ? "Atenção" : "Em dia"}
            </span>
          </div>
          <div className="mt-2 font-display text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#dfe2f1] tabular-nums">
            {dashboard.pendingCount}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-[#908f9e]">
            {dashboard.pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => onNavigate("transactions")}
                className="text-[#4338CA] dark:text-[#bdc2ff] hover:underline font-medium cursor-pointer"
              >
                Revisar na aba Despesas →
              </button>
            ) : (
              "Todos os lançamentos confirmados"
            )}
          </div>
        </div>
      </div>

      {/* Tendência Diária + Donut por Categoria */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7">
          <DailyTrendChart
            month={dashboard.month}
            dailySeries={dashboard.dailySeries}
            totalMonthCents={dashboard.totalMonthCents}
          />
        </div>
        <div className="lg:col-span-5">
          <CategoryDonutCard
            byCategory={dashboard.byCategory}
            totalMonthCents={dashboard.totalMonthCents}
          />
        </div>
      </div>

      {/* Insights da IA + Barras de Orçamento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-[#6366F1] dark:text-[#818cf8]" />
              <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                Insights da IA
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400 dark:text-[#767586]">
              {formatMonthLabelPT(dashboard.month)}
            </span>
          </div>

          {insightsLoading ? (
            <div className="pt-4 space-y-3">
              <div className="h-14 w-full rounded-lg ai-shimmer" />
              <div className="h-14 w-full rounded-lg ai-shimmer" />
            </div>
          ) : insightsEmpty || insights.length === 0 ? (
            <div className="pt-6 pb-2 my-auto text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-[#c6c5d5]">
                Insights aparecerão após você registrar despesas
              </p>
              <p className="text-xs text-slate-400 dark:text-[#767586] mt-1">
                Comparativos mensais, alertas de orçamento e gastos recorrentes serão calculados automaticamente.
              </p>
            </div>
          ) : (
            <div className="pt-4 space-y-3">
              {insights.map((ins) => {
                const badgeStyle =
                  ins.severity === "alert"
                    ? "bg-[#F43F5E]/10 text-[#F43F5E] border-[#F43F5E]/25"
                    : ins.severity === "warning"
                    ? "bg-[#F59E0B]/10 text-[#D97706] dark:text-[#f59e0b] border-[#F59E0B]/25"
                    : "bg-[#6366F1]/10 text-[#4338CA] dark:text-[#bdc2ff] border-[#6366F1]/25";

                return (
                  <div
                    key={ins.id}
                    className="rounded-lg p-3.5 bg-slate-50/70 dark:bg-[#171b26] border border-slate-200/70 dark:border-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                        {ins.title}
                      </h3>
                      {ins.metricLabel && (
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-mono tabular-nums font-semibold shrink-0 ${badgeStyle}`}
                        >
                          {ins.metricLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-[#908f9e] mt-1">
                      {ins.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-6 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                  Orçamento x Gasto por Categoria
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
                  Acompanhamento de limites e alertas
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

            {activeBudgets.length === 0 ? (
              <div className="pt-5">
                <EmptyState
                  title="Nenhum orçamento configurado"
                  description="Defina limites e percentuais de alerta para cada categoria."
                  actionLabel="Configurar Orçamentos"
                  onAction={() => onNavigate("budgets")}
                />
              </div>
            ) : (
              <div className="pt-4 space-y-4">
                {activeBudgets.map((item) => {
                  const meta = CATEGORY_META[item.category];
                  const isOver = item.status === "exceeded";
                  const isAlert = item.status === "alert";
                  const barColor = isOver
                    ? "#F43F5E"
                    : isAlert
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
                          <span className="text-[#0F172A] dark:text-[#dfe2f1] font-medium">
                            {formatCentavos(item.spentCents)}
                          </span>
                          <span className="text-slate-400 dark:text-[#767586]">
                            / {formatCentavos(item.limitCents)}
                          </span>
                        </div>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1e293b] overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(item.usagePct, 100)}%`,
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
                              : isAlert
                              ? "text-[#D97706] dark:text-[#f59e0b]"
                              : "text-slate-500 dark:text-[#908f9e]"
                          }`}
                        >
                          {isOver || isAlert ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                          )}
                          <span>
                            {item.limitCents === 0
                              ? "Sem teto definido"
                              : isOver
                              ? "Estourado"
                              : isAlert
                              ? `Alerta (>= ${item.alertPercent}%)`
                              : "Dentro do limite"}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-[#908f9e]">
                          {item.limitCents > 0 ? `${item.usagePct.toFixed(0)}%` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 5 Despesas Recentes */}
      {dashboard.recentExpenses.length === 0 ? (
        <EmptyState
          title="Nenhuma despesa neste mês"
          description="Adicione manualmente, descreva em texto ou fotografe um comprovante para registrar seus gastos."
          actionLabel="Adicionar Despesa"
          onAction={onOpenNewEntry}
        />
      ) : (
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                5 Despesas Recentes ({formatMonthLabelPT(dashboard.month)})
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
                Clique em qualquer linha para ver detalhes, editar ou excluir
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {dashboard.pendingCount > 0 && (
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
                      : `Categorizar ${dashboard.pendingCount} pendentes`}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate("transactions")}
                className="h-9 px-3 rounded-lg text-xs font-medium text-slate-700 dark:text-[#c6c5d5] bg-slate-100 hover:bg-slate-200/70 dark:bg-[#1e293b] dark:hover:bg-[#262a35] transition-colors cursor-pointer whitespace-nowrap"
              >
                Ver Todas
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
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 pr-6 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05] text-sm">
                {dashboard.recentExpenses.map((tx) => {
                  const meta = CATEGORY_META[tx.category];
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onSelectExpense(tx.id)}
                      className="h-11 hover:bg-slate-50/80 dark:hover:bg-[#171b26]/70 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 pl-6 pr-3 font-mono text-xs tabular-nums text-slate-500 dark:text-[#908f9e] whitespace-nowrap">
                        {formatDateBR(tx.expense_date)}
                      </td>
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <div className="font-medium text-[#0F172A] dark:text-[#dfe2f1] truncate">
                          {tx.merchant || "Lançamento"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#908f9e] truncate">
                          {tx.note || "Sem observação"}
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
                        <span
                          className={`text-xs font-medium ${
                            tx.status === "confirmed"
                              ? "text-[#10B981]"
                              : "text-[#D97706] dark:text-[#f59e0b]"
                          }`}
                        >
                          {tx.status === "confirmed"
                            ? "Confirmado"
                            : "Revisão pendente"}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 pl-3 pr-6 text-right font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                          tx.amount_cents >= 0
                            ? "text-[#10B981] dark:text-[#4edea3]"
                            : "text-[#0F172A] dark:text-[#dfe2f1]"
                        }`}
                      >
                        {formatCentavos(tx.amount_cents, { signed: true })}
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
