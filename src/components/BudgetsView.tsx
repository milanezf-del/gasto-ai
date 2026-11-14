import React from "react";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import type {
  BudgetEnvelope,
  DashboardData,
  ExpenseCategory,
} from "../types/finance";
import {
  CATEGORY_META,
  centavosToReaisInput,
  formatCentavos,
  reaisInputToCentavos,
} from "../utils/formatters";
import { CardSkeleton, EmptyState, ErrorState } from "./StateNotice";

interface BudgetsViewProps {
  budgets: BudgetEnvelope[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  dashboard: DashboardData | null;
  onUpdateBudgetLimit: (
    category: ExpenseCategory,
    limitCents: number,
    alertPercent: number
  ) => Promise<void> | void;
  onNotifySuccess?: (message: string) => void;
  onNotifyError?: (message: string) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  budgets,
  loading,
  error,
  onRetry,
  dashboard,
  onUpdateBudgetLimit,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [monthlyContributionCents, setMonthlyContributionCents] =
    React.useState(100000);
  const [annualYieldPct, setAnnualYieldPct] = React.useState(10.5);

  const [draftLimits, setDraftLimits] = React.useState<Record<string, string>>(
    {}
  );
  const [draftAlerts, setDraftAlerts] = React.useState<Record<string, string>>(
    {}
  );
  const [savingCategory, setSavingCategory] =
    React.useState<ExpenseCategory | null>(null);

  React.useEffect(() => {
    const nextLimits: Record<string, string> = {};
    const nextAlerts: Record<string, string> = {};
    for (const b of budgets) {
      nextLimits[b.category] =
        b.limitCents > 0 ? centavosToReaisInput(b.limitCents) : "0,00";
      nextAlerts[b.category] = String(b.alertPercent ?? 80);
    }
    setDraftLimits(nextLimits);
    setDraftAlerts(nextAlerts);
  }, [budgets]);

  const baseSurplusCents = Math.max(dashboard?.netSurplusCents ?? 0, 0);

  const projection = React.useMemo(() => {
    const monthlyRate = annualYieldPct / 100 / 12;
    const projectMonths = (months: number) => {
      let balance = baseSurplusCents;
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
  }, [baseSurplusCents, monthlyContributionCents, annualYieldPct]);

  const handleSaveCategory = async (category: ExpenseCategory) => {
    const rawLimit = (draftLimits[category] ?? "0").trim();
    const limitCents =
      rawLimit === "0" || rawLimit === "0,00" || rawLimit === "0.00"
        ? 0
        : reaisInputToCentavos(rawLimit);

    if (limitCents === null) {
      onNotifyError?.("Informe um limite válido em reais (ex.: 800,00).");
      return;
    }

    const parsedAlert = Math.round(Number(draftAlerts[category] ?? "80"));
    if (!Number.isFinite(parsedAlert) || parsedAlert < 1 || parsedAlert > 100) {
      onNotifyError?.("O percentual de alerta deve ficar entre 1% e 100%.");
      return;
    }

    setSavingCategory(category);
    try {
      await onUpdateBudgetLimit(category, limitCents, parsedAlert);
      onNotifySuccess?.(`Orçamento de ${category} atualizado.`);
    } catch {
      // Erro tratado pelo hook
    } finally {
      setSavingCategory(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar os orçamentos"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="pb-4 border-b border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              Tetos Mensais e Alertas por Categoria
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
              Configure o limite em reais e o percentual de aviso (padrão 80%)
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-[#908f9e]">
            Teto Total:{" "}
            <span className="font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              {formatCentavos(
                budgets.reduce((s, b) => s + b.limitCents, 0)
              )}
            </span>
          </div>
        </div>

        {budgets.length === 0 ? (
          <div className="pt-5">
            <EmptyState
              title="Nenhum orçamento disponível"
              description="Defina limites para suas categorias de despesa."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-5">
            {budgets.map((env) => {
              const pct =
                env.limitCents > 0
                  ? (env.spentCents / env.limitCents) * 100
                  : 0;
              const remainingCents = env.limitCents - env.spentCents;
              const meta = CATEGORY_META[env.category];
              const isOver = env.limitCents > 0 && pct > 100;
              const isWarn =
                env.limitCents > 0 &&
                pct >= env.alertPercent &&
                pct <= 100;

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
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${
                        env.limitCents === 0
                          ? "text-slate-400 dark:text-[#767586]"
                          : isOver
                          ? "text-[#F43F5E]"
                          : isWarn
                          ? "text-[#D97706] dark:text-[#f59e0b]"
                          : "text-[#10B981]"
                      }`}
                    >
                      {isOver || isWarn ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                      )}
                      <span>
                        {env.limitCents === 0
                          ? "Sem teto"
                          : isOver
                          ? "Estourado"
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
                        env.limitCents > 0 && remainingCents < 0
                          ? "text-[#F43F5E]"
                          : "text-slate-500 dark:text-[#908f9e]"
                      }`}
                    >
                      {env.limitCents === 0
                        ? "Defina um teto"
                        : remainingCents >= 0
                        ? `${formatCentavos(remainingCents)} restante`
                        : `${formatCentavos(Math.abs(remainingCents))} estourado`}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.06] space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-[#908f9e] mb-1">
                          Limite (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draftLimits[env.category] ?? ""}
                          onChange={(e) =>
                            setDraftLimits((prev) => ({
                              ...prev,
                              [env.category]: e.target.value,
                            }))
                          }
                          aria-label={`Limite mensal de ${env.category}`}
                          className="w-full h-8 px-2.5 rounded-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.1] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-[#908f9e] mb-1">
                          Alerta (%)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={draftAlerts[env.category] ?? "80"}
                          onChange={(e) =>
                            setDraftAlerts((prev) => ({
                              ...prev,
                              [env.category]: e.target.value,
                            }))
                          }
                          aria-label={`Percentual de alerta de ${env.category}`}
                          className="w-full h-8 px-2 rounded-md bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.1] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateBudgetLimit(
                              env.category,
                              Math.max(0, env.limitCents - 10000),
                              env.alertPercent
                            )
                          }
                          aria-label={`Diminuir R$ 100 em ${env.category}`}
                          className="h-7 px-2 rounded-md text-[11px] font-mono bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.1] hover:border-[#6366F1] cursor-pointer"
                        >
                          -100
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateBudgetLimit(
                              env.category,
                              env.limitCents + 10000,
                              env.alertPercent
                            )
                          }
                          aria-label={`Aumentar R$ 100 em ${env.category}`}
                          className="h-7 px-2 rounded-md text-[11px] font-mono bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.1] hover:border-[#6366F1] cursor-pointer"
                        >
                          +100
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={savingCategory === env.category}
                        onClick={() => void handleSaveCategory(env.category)}
                        className="h-7 px-3 rounded-md inline-flex items-center gap-1 text-[11px] font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:text-[#0b0f19] disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>
                          {savingCategory === env.category
                            ? "Salvando..."
                            : "Salvar"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Simulador de Reserva e Aporte */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              Simulador de Reserva e Aporte
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
              Projeção a partir do saldo mensal atual de{" "}
              {formatCentavos(baseSurplusCents)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 items-center">
          <div className="space-y-5">
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
                aria-label="Aporte Mensal Simulado"
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
                aria-label="Rentabilidade Anual Esperada"
                className="w-full accent-[#6366F1] dark:accent-[#818cf8] cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50/70 dark:bg-[#171b26] border border-slate-200/70 dark:border-white/[0.06]">
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
        </div>
      </section>
    </div>
  );
};
