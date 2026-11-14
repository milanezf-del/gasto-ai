import React from "react";
import type { CategoryTotalItem, DailySeriesPoint } from "../types/finance";
import {
  CATEGORY_META,
  formatCentavos,
  formatDateBR,
  formatMonthLabelPT,
} from "../utils/formatters";
import { EmptyState } from "./StateNotice";

interface DailyTrendChartProps {
  month: string;
  dailySeries: DailySeriesPoint[];
  totalMonthCents: number;
}

export const DailyTrendChart: React.FC<DailyTrendChartProps> = ({
  month,
  dailySeries,
  totalMonthCents,
}) => {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
  const [mode, setMode] = React.useState<"daily" | "cumulative">("daily");

  const hasSpending = dailySeries.some((d) => d.spentCents > 0);
  const maxVal = Math.max(
    ...dailySeries.map((d) =>
      mode === "daily" ? d.spentCents : d.cumulativeSpentCents
    ),
    100
  );

  const activePoint =
    hoveredIdx !== null && dailySeries[hoveredIdx]
      ? dailySeries[hoveredIdx]
      : [...dailySeries].reverse().find((d) => d.spentCents > 0) ??
        dailySeries[dailySeries.length - 1] ??
        null;

  return (
    <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none h-full flex flex-col justify-between">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              {mode === "daily"
                ? `Gastos Diários · ${formatMonthLabelPT(month)}`
                : `Curva Acumulada · ${formatMonthLabelPT(month)}`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
              Total acumulado no período:{" "}
              <span className="font-mono font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                {formatCentavos(totalMonthCents)}
              </span>
            </p>
          </div>

          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-[#171b26] border border-slate-200/60 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setMode("daily")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === "daily"
                  ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                  : "text-slate-600 hover:text-slate-900 dark:text-[#908f9e] dark:hover:text-[#dfe2f1]"
              }`}
            >
              Diário
            </button>
            <button
              type="button"
              onClick={() => setMode("cumulative")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                mode === "cumulative"
                  ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                  : "text-slate-600 hover:text-slate-900 dark:text-[#908f9e] dark:hover:text-[#dfe2f1]"
              }`}
            >
              Acumulado
            </button>
          </div>
        </div>

        {!hasSpending ? (
          <div className="pt-5">
            <EmptyState
              title="Sem despesas registradas neste mês"
              description="Assim que você lançar sua primeira despesa, a curva de gastos diários será exibida aqui."
            />
          </div>
        ) : (
          <div className="pt-4">
            {activePoint && (
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs">
                <span className="font-mono text-slate-500 dark:text-[#908f9e]">
                  {formatDateBR(activePoint.date)}
                </span>
                <div className="flex items-center gap-4 tabular-nums">
                  <span className="text-slate-600 dark:text-[#c6c5d5]">
                    Dia:{" "}
                    <strong className="font-mono text-[#6366F1] dark:text-[#818cf8]">
                      {formatCentavos(activePoint.spentCents)}
                    </strong>
                  </span>
                  <span className="text-slate-600 dark:text-[#c6c5d5]">
                    Acumulado:{" "}
                    <strong className="font-mono text-[#0F172A] dark:text-[#dfe2f1]">
                      {formatCentavos(activePoint.cumulativeSpentCents)}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            <div className="relative h-52 w-full flex items-end pt-3">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                {[1, 0.5, 0].map((ratio) => (
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

              <div className="relative z-10 w-full h-full flex items-end gap-[2px] sm:gap-1 pl-16 pb-6">
                {dailySeries.map((point, idx) => {
                  const val =
                    mode === "daily"
                      ? point.spentCents
                      : point.cumulativeSpentCents;
                  const heightPct =
                    val > 0 ? Math.max((val / maxVal) * 100, 3) : 0;
                  const isHovered = hoveredIdx === idx;
                  const showLabel =
                    point.day === 1 ||
                    point.day % 5 === 0 ||
                    point.day === dailySeries.length;

                  return (
                    <div
                      key={point.date}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="flex-1 h-full flex flex-col justify-end items-center relative group"
                    >
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-[2px] transition-all duration-150 ${
                          val === 0
                            ? "bg-transparent"
                            : isHovered
                            ? "bg-[#4F46E5] dark:bg-[#a5b4fc]"
                            : "bg-[#6366F1]/80 dark:bg-[#818cf8]/80"
                        }`}
                      />
                      {showLabel && (
                        <span className="absolute -bottom-5 text-[10px] font-mono text-slate-400 dark:text-[#767586]">
                          {String(point.day).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

interface CategoryDonutCardProps {
  byCategory: CategoryTotalItem[];
  totalMonthCents: number;
}

export const CategoryDonutCard: React.FC<CategoryDonutCardProps> = ({
  byCategory,
  totalMonthCents,
}) => {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none h-full flex flex-col justify-between">
      <div className="pb-4 border-b border-slate-100 dark:border-white/[0.06]">
        <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
          Despesas por Categoria
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
          Participação no total gasto do mês
        </p>
      </div>

      {byCategory.length === 0 || totalMonthCents <= 0 ? (
        <div className="pt-5 my-auto">
          <EmptyState
            title="Sem distribuição por categoria"
            description="Cadastre uma despesa no mês selecionado para visualizar o gráfico de participação."
          />
        </div>
      ) : (
        <div className="pt-5 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6 my-auto">
          <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
            <svg
              viewBox="0 0 144 144"
              className="w-full h-full -rotate-90"
              role="img"
              aria-label="Distribuição de despesas por categoria"
            >
              <circle
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                strokeWidth="16"
                className="stroke-slate-100 dark:stroke-[#1e293b]"
              />
              {byCategory.map((item) => {
                const segmentLen =
                  (item.spentCents / totalMonthCents) * circumference;
                const dashArray = `${segmentLen} ${circumference - segmentLen}`;
                const dashOffset = -accumulatedOffset;
                accumulatedOffset += segmentLen;
                const meta = CATEGORY_META[item.category];

                return (
                  <circle
                    key={item.category}
                    cx="72"
                    cy="72"
                    r={radius}
                    fill="none"
                    strokeWidth="16"
                    stroke={meta.color}
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-[#767586]">
                Total
              </span>
              <span className="font-mono text-xs font-bold text-[#0F172A] dark:text-[#dfe2f1] tabular-nums">
                {formatCentavos(totalMonthCents, { compact: true })}
              </span>
            </div>
          </div>

          <div className="w-full space-y-2.5">
            {byCategory.map((item) => {
              const meta = CATEGORY_META[item.category];
              return (
                <div
                  key={item.category}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="font-medium text-[#0F172A] dark:text-[#dfe2f1] truncate">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 tabular-nums font-mono">
                    <span className="text-slate-500 dark:text-[#908f9e]">
                      {item.sharePct.toFixed(1)}%
                    </span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#dfe2f1] whitespace-nowrap">
                      {formatCentavos(item.spentCents)}
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
