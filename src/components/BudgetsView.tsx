import React from "react";
import { AlertTriangle, CheckCircle2, Pause, Play } from "lucide-react";
import type {
  BudgetEnvelope,
  ExpenseCategory,
  FinancialSummary,
  SubscriptionItem,
} from "../types/finance";
import {
  CATEGORY_META,
  formatCentavos,
  formatDateBR,
} from "../utils/formatters";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  TableSkeleton,
} from "./StateNotice";

interface BudgetsViewProps {
  budgets: BudgetEnvelope[];
  subscriptions: SubscriptionItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  summary: FinancialSummary | null;
  onUpdateBudgetLimit: (
    category: ExpenseCategory,
    newLimitCents: number
  ) => void;
  onToggleSubscription: (id: string) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgets,
  subscriptions,
  loading,
  error,
  onRetry,
  summary,
  onUpdateBudgetLimit,
  onToggleSubscription,
}) => {
  const [monthlyContributionCents, setMonthlyContributionCents] =
    React.useState(100000); // R$ 1.000,00 padrão apenas para controle local do simulador
  const [annualYieldPct, setAnnualYieldPct] = React.useState(10.5);

  const currentNetWorthCents = summary?.netWorthCents ?? 0;

  const projection = React.useMemo(() => {
    const monthlyRate = annualYieldPct / 100 / 12;
    const projectMonths = (months: number) => {
      let balance = currentNetWorthCents;
      for (let i = 0; i < months; i++) {
        balance = Math.round(
          balance * (1 + monthlyRate) + monthlyContributionCents
        );
      }
      return balance;
    };
    return {
      oneYearCents: projectMonths(12),
      threeYearsCents: projectMonths(36),
    };
  }, [currentNetWorthCents, monthlyContributionCents, annualYieldPct]);

  const activeSubscriptionBurnCents = subscriptions
    .filter((s) => s.status !== "Pausada")
    .reduce((sum, s) => sum + s.amountCents, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar orçamentos e assinaturas"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Editable Budget Envelopes */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="pb-4 border-b border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              Tetos Mensais por Categoria
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
              Ajuste limites mensais em centavos em tempo real
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-[#908f9e]">
            Teto Total:{" "}
            <span className="font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              {formatCentavos(
                budgets.reduce((s, b) => s + b.monthlyLimitCents, 0)
              )}
            </span>
          </div>
        </div>

        {budgets.length === 0 ? (
          <div className="pt-5">
            <EmptyState
              title="Nenhum envelope de orçamento configurado"
              description="Quando os orçamentos forem criados na API, você poderá ajustar os limites por categoria aqui."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-5">
            {budgets.map((env) => {
              const pct =
                env.monthlyLimitCents > 0
                  ? (env.spentCents / env.monthlyLimitCents) * 100
                  : 0;
              const remainingCents = env.monthlyLimitCents - env.spentCents;
              const meta = CATEGORY_META[env.category];
              const isOver = pct > 100;
              const isWarn = pct >= 80 && pct <= 100;

              return (
                <div
                  key={env.category}
                  className="p-4 rounded-lg bg-slate-50/70 dark:bg-[#171b26] border border-slate-200/70 dark:border-white/[0.06] space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-sm font-semibold text-[#0F172A] dark:text-[#dfe2f1] truncate">
                        {env.category}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap ${
                        isOver
                          ? "text-[#F43F5E]"
                          : isWarn
                          ? "text-[#D97706] dark:text-[#f59e0b]"
                          : "text-[#10B981]"
                      }`}
                    >
                      {isOver || isWarn ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      <span>
                        {isOver
                          ? "Excedido"
                          : isWarn
                          ? "Alerta"
                          : "No esperado"}
                      </span>
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-[#262a35] overflow-hidden">
                    <div
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: isOver
                          ? "#F43F5E"
                          : isWarn
                          ? "#F59E0B"
                          : meta.color,
                      }}
                      className="h-full rounded-full transition-all duration-300"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="text-slate-600 dark:text-[#c6c5d5]">
                      Gasto:{" "}
                      <strong className="font-mono text-[#0F172A] dark:text-[#dfe2f1]">
                        {formatCentavos(env.spentCents)}
                      </strong>
                    </span>
                    <span
                      className={`font-mono ${
                        remainingCents < 0
                          ? "text-[#F43F5E]"
                          : "text-slate-500 dark:text-[#908f9e]"
                      }`}
                    >
                      {remainingCents >= 0
                        ? `${formatCentavos(remainingCents)} restante`
                        : `${formatCentavos(Math.abs(remainingCents))} excedido`}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between gap-2">
                    <label className="text-[11px] font-medium text-slate-500 dark:text-[#908f9e]">
                      Limite Mensal
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBudgetLimit(
                            env.category,
                            Math.max(10000, env.monthlyLimitCents - 10000)
                          )
                        }
                        className="w-7 h-7 rounded-md text-xs font-mono bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.1] hover:border-[#6366F1] cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-24 text-center text-xs font-mono tabular-nums font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                        {formatCentavos(env.monthlyLimitCents)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateBudgetLimit(
                            env.category,
                            env.monthlyLimitCents + 10000
                          )
                        }
                        className="w-7 h-7 rounded-md text-xs font-mono bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.1] hover:border-[#6366F1] cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recurring Subscriptions Monitor */}
        <section className="lg:col-span-7 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                Assinaturas Recorrentes
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
                Comprometimento mensal ativo:{" "}
                <span className="font-mono font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                  {formatCentavos(activeSubscriptionBurnCents)}/mês
                </span>
              </p>
            </div>
          </div>

          {subscriptions.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nenhuma assinatura monitorada"
                description="Assinaturas recorrentes identificadas nos seus extratos serão listadas aqui."
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {subscriptions.map((sub) => {
                const isPaused = sub.status === "Pausada";
                const isUnused = sub.status === "Pouco usada";

                return (
                  <div
                    key={sub.id}
                    className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-[#171b26]/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${
                            isPaused
                              ? "line-through text-slate-400 dark:text-[#767586]"
                              : "text-[#0F172A] dark:text-[#dfe2f1]"
                          }`}
                        >
                          {sub.name}
                        </span>
                        <span
                          className={`text-[11px] font-medium whitespace-nowrap ${
                            isPaused
                              ? "text-slate-400 dark:text-[#767586]"
                              : isUnused
                              ? "text-[#D97706] dark:text-[#f59e0b]"
                              : "text-[#10B981]"
                          }`}
                        >
                          · {sub.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
                        {sub.vendor} · Renova em {formatDateBR(sub.renewalDate)} ·
                        Último uso{" "}
                        {sub.lastUsedDaysAgo === 0
                          ? "hoje"
                          : `há ${sub.lastUsedDaysAgo}d`}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-[#dfe2f1] whitespace-nowrap">
                        {formatCentavos(sub.amountCents)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleSubscription(sub.id)}
                        className={`h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                          isPaused
                            ? "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-[#1e293b] dark:hover:bg-[#262a35] dark:text-[#c6c5d5]"
                        }`}
                      >
                        {isPaused ? (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Reativar</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3" />
                            <span>Pausar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Compounding Wealth Simulator */}
        <section className="lg:col-span-5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              Simulador de Acúmulo
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
              Projeção a partir da base atual de{" "}
              {formatCentavos(currentNetWorthCents)}
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium text-slate-600 dark:text-[#c6c5d5]">
                    Aporte Mensal Simulado
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#0F172A] dark:text-[#dfe2f1]">
                    {formatCentavos(monthlyContributionCents)}
                  </span>
                </div>
                <input
                  type="range"
                  min={25000}
                  max={2000000}
                  step={25000}
                  value={monthlyContributionCents}
                  onChange={(e) =>
                    setMonthlyContributionCents(Number(e.target.value))
                  }
                  className="w-full accent-[#6366F1] dark:accent-[#818cf8] cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium text-slate-600 dark:text-[#c6c5d5]">
                    Rentabilidade Anual Esperada
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#0F172A] dark:text-[#dfe2f1]">
                    {annualYieldPct.toFixed(1).replace(".", ",")}% a.a.
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={18}
                  step={0.5}
                  value={annualYieldPct}
                  onChange={(e) => setAnnualYieldPct(Number(e.target.value))}
                  className="w-full accent-[#6366F1] dark:accent-[#818cf8] cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/[0.06] grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-[#908f9e]">
                Projeção 12 Meses
              </div>
              <div className="mt-1 font-display text-lg font-bold tabular-nums text-[#0F172A] dark:text-[#dfe2f1] whitespace-nowrap">
                {formatCentavos(projection.oneYearCents)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-[#908f9e]">
                Projeção 36 Meses
              </div>
              <div className="mt-1 font-display text-lg font-bold tabular-nums text-[#10B981] dark:text-[#4edea3] whitespace-nowrap">
                {formatCentavos(projection.threeYearsCents)}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
