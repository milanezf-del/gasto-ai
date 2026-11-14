import React from "react";
import type {
  CashFlowPoint,
  ExpenseItem,
  TransactionCategory,
} from "../types/finance";
import {
  CATEGORY_META,
  EXPENSE_CATEGORIES,
  formatCentavos,
} from "../utils/formatters";
import { EmptyState } from "./StateNotice";

interface CashFlowChartProps {
  history: CashFlowPoint[];
  expenses: ExpenseItem[];
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({
  history,
  expenses,
}) => {
  const [mode, setMode] = React.useState<"cashflow" | "categories">("cashflow");
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  const maxVal = Math.max(
    ...history.map((p) => Math.max(p.inflowCents, p.outflowCents)),
    100
  );

  const categoryTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    let totalSpentCents = 0;
    for (const cat of EXPENSE_CATEGORIES) {
      totals[cat] = 0;
    }
    for (const tx of expenses) {
      if (tx.amountCents < 0 && tx.category !== "Receitas & Rendimentos") {
        const key = tx.category;
        totals[key] = (totals[key] ?? 0) + Math.abs(tx.amountCents);
        totalSpentCents += Math.abs(tx.amountCents);
      }
    }
    const items = Object.entries(totals)
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amountCents]) => ({
        category: cat as TransactionCategory,
        amountCents,
        share: totalSpentCents > 0 ? (amountCents / totalSpentCents) * 100 : 0,
      }));
    return { items, totalSpentCents };
  }, [expenses]);

  const activePoint =
    hoveredIdx !== null
      ? history[hoveredIdx]
      : history.length > 0
      ? history[history.length - 1]
      : null;

  return (
    <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-white/[0.06]">
        <div>
          <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
            {mode === "cashflow"
              ? "Fluxo de Caixa e Projeção"
              : "Distribuição por Categoria"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
            {mode === "cashflow"
              ? "Histórico consolidado e estimativa de encerramento"
              : `Saídas registradas no ciclo: ${formatCentavos(
                  categoryTotals.totalSpentCents
                )}`}
          </p>
        </div>

        <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-[#171b26] border border-slate-200/60 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => setMode("cashflow")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              mode === "cashflow"
                ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                : "text-slate-600 hover:text-slate-900 dark:text-[#908f9e] dark:hover:text-[#dfe2f1]"
            }`}
          >
            Fluxo de Caixa
          </button>
          <button
            type="button"
            onClick={() => setMode("categories")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              mode === "categories"
                ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                : "text-slate-600 hover:text-slate-900 dark:text-[#908f9e] dark:hover:text-[#dfe2f1]"
            }`}
          >
            Categorias
          </button>
        </div>
      </div>

      {mode === "cashflow" ? (
        history.length === 0 ? (
          <div className="pt-5">
            <EmptyState
              title="Sem histórico de fluxo de caixa"
              description="Assim que seus lançamentos forem sincronizados com a API, a série histórica e as projeções aparecerão aqui."
            />
          </div>
        ) : (
          <div className="pt-5">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-5 text-xs">
                <span className="flex items-center gap-2 text-slate-600 dark:text-[#c6c5d5]">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#10B981] inline-block" />
                  <span>Entradas</span>
                </span>
                <span className="flex items-center gap-2 text-slate-600 dark:text-[#c6c5d5]">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#6366F1] dark:bg-[#818cf8] inline-block" />
                  <span>Saídas</span>
                </span>
                <span className="flex items-center gap-2 text-slate-500 dark:text-[#908f9e]">
                  <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-slate-400 dark:border-[#908f9e] inline-block" />
                  <span>Projeção IA</span>
                </span>
              </div>

              {activePoint && (
                <div className="flex items-center gap-4 text-xs tabular-nums">
                  <span className="font-medium text-slate-500 dark:text-[#908f9e]">
                    {activePoint.label}
                  </span>
                  <span className="text-[#10B981] font-mono font-medium whitespace-nowrap">
                    +{formatCentavos(activePoint.inflowCents)}
                  </span>
                  <span className="text-[#6366F1] dark:text-[#bdc2ff] font-mono font-medium whitespace-nowrap">
                    -{formatCentavos(activePoint.outflowCents)}
                  </span>
                  <span className="font-mono font-semibold text-[#0F172A] dark:text-[#dfe2f1] whitespace-nowrap">
                    Saldo{" "}
                    {formatCentavos(
                      activePoint.inflowCents - activePoint.outflowCents,
                      { signed: true }
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="relative h-56 w-full flex items-end gap-2 sm:gap-4 pt-4">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7">
                {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                  <div
                    key={ratio}
                    className="w-full border-b border-dashed border-slate-200/70 dark:border-white/[0.06] flex items-center"
                  >
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-[#767586] -translate-y-2 pr-2">
                      {formatCentavos(Math.round(maxVal * ratio), {
                        compact: true,
                      })}
                    </span>
                  </div>
                ))}
              </div>

              <div className="relative z-10 w-full h-full flex items-end justify-between gap-1.5 sm:gap-3 pl-16 pb-7">
                {history.map((point, idx) => {
                  const inflowPct = Math.max(
                    (point.inflowCents / maxVal) * 100,
                    4
                  );
                  const outflowPct = Math.max(
                    (point.outflowCents / maxVal) * 100,
                    4
                  );
                  const isHovered = hoveredIdx === idx;
                  return (
                    <div
                      key={point.label}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className={`flex-1 h-full flex flex-col justify-end items-center group rounded-md px-1 transition-colors ${
                        isHovered
                          ? "bg-slate-100/70 dark:bg-white/[0.04]"
                          : ""
                      }`}
                    >
                      <div className="w-full h-full flex items-end justify-center gap-1 sm:gap-1.5">
                        <div
                          style={{ height: `${inflowPct}%` }}
                          className={`w-2.5 sm:w-3.5 rounded-t-sm transition-all duration-200 ${
                            point.netProjected
                              ? "bg-[#10B981]/35 border border-dashed border-[#10B981]"
                              : "bg-[#10B981]"
                          }`}
                        />
                        <div
                          style={{ height: `${outflowPct}%` }}
                          className={`w-2.5 sm:w-3.5 rounded-t-sm transition-all duration-200 ${
                            point.netProjected
                              ? "bg-[#6366F1]/35 dark:bg-[#818cf8]/35 border border-dashed border-[#6366F1] dark:border-[#818cf8]"
                              : "bg-[#6366F1] dark:bg-[#818cf8]"
                          }`}
                        />
                      </div>
                      <span className="absolute bottom-0 text-[11px] font-medium text-slate-500 dark:text-[#908f9e] whitespace-nowrap">
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      ) : categoryTotals.items.length === 0 ? (
        <div className="pt-5">
          <EmptyState
            title="Nenhuma despesa categorizada"
            description="Registre seus gastos para visualizar a distribuição percentual por categoria."
          />
        </div>
      ) : (
        <div className="pt-5 space-y-4">
          <div className="h-3 w-full rounded-sm overflow-hidden flex bg-slate-100 dark:bg-[#171b26]">
            {categoryTotals.items.map((item) => {
              const meta = CATEGORY_META[item.category];
              return (
                <div
                  key={item.category}
                  style={{
                    width: `${item.share}%`,
                    backgroundColor: meta.color,
                  }}
                  title={`${item.category}: ${item.share.toFixed(1)}%`}
                  className="h-full transition-all duration-300"
                />
              );
            })}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {categoryTotals.items.map((item) => {
              const meta = CATEGORY_META[item.category];
              return (
                <div
                  key={item.category}
                  className="py-2.5 flex items-center justify-between gap-4 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="font-medium text-[#0F172A] dark:text-[#dfe2f1] truncate">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 tabular-nums">
                    <span className="text-xs text-slate-500 dark:text-[#908f9e] w-12 text-right font-mono">
                      {item.share.toFixed(1)}%
                    </span>
                    <span className="font-mono font-semibold text-[#0F172A] dark:text-[#dfe2f1] whitespace-nowrap min-w-[110px] text-right">
                      {formatCentavos(item.amountCents)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
