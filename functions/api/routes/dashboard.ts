import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  createUserSupabaseClient,
  type BudgetRow,
  type ExpenseRow,
} from "../lib/supabase";
import { getTodaySaoPaulo } from "../lib/dates";
import { CATEGORIES, yearMonthSchema } from "../schemas";

export const dashboardRoutes = new Hono<ApiAppEnv>();

dashboardRoutes.use("*", requireAuth);

function getPreviousYearMonth(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  let year = Number(yStr);
  let month = Number(mStr) - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getMonthBounds(ym: string): { start: string; end: string; daysInMonth: number } {
  const [yStr, mStr] = ym.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${ym}-01`,
    end: `${ym}-${String(daysInMonth).padStart(2, "0")}`,
    daysInMonth,
  };
}

dashboardRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const todayIso = getTodaySaoPaulo();
  const rawMonth = c.req.query("month")?.trim();
  const targetMonth = rawMonth || todayIso.slice(0, 7);

  const parsedMonth = yearMonthSchema.safeParse(targetMonth);
  if (!parsedMonth.success) {
    return c.json(
      { ok: false, error: parsedMonth.error.issues[0]?.message ?? "Mês inválido." },
      400
    );
  }

  const month = parsedMonth.data;
  const previousMonth = getPreviousYearMonth(month);
  const currentBounds = getMonthBounds(month);
  const prevBounds = getMonthBounds(previousMonth);

  const [
    { data: windowExpenses, error: expErr },
    { data: budgetsData, error: budErr },
    { count: globalPendingCount, error: pendingErr },
  ] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("expense_date", prevBounds.start)
      .lte("expense_date", currentBounds.end)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("budgets")
      .select("*")
      .eq("user_id", user.id),
    supabase
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "needs_review"),
  ]);

  if (expErr || budErr || pendingErr) {
    console.error("[Gastô Dashboard Query Error]", { expErr, budErr, pendingErr });
    return c.json(
      { ok: false, error: "Não foi possível carregar os dados do painel." },
      500
    );
  }

  const rows = (windowExpenses ?? []) as ExpenseRow[];

  let totalMonthCents = 0;
  let totalPreviousMonthCents = 0;
  let monthlyInflowCents = 0;
  let monthPendingCount = 0;

  const dailyBuckets = new Map<string, { spentCents: number; inflowCents: number }>();
  for (let day = 1; day <= currentBounds.daysInMonth; day++) {
    const iso = `${month}-${String(day).padStart(2, "0")}`;
    dailyBuckets.set(iso, { spentCents: 0, inflowCents: 0 });
  }

  const categoryTotals = new Map<string, { spentCents: number; count: number }>();
  for (const cat of CATEGORIES) {
    categoryTotals.set(cat, { spentCents: 0, count: 0 });
  }

  const monthRows: ExpenseRow[] = [];

  for (const row of rows) {
    const ym = row.expense_date.slice(0, 7);
    if (ym === previousMonth) {
      if (row.amount_cents < 0) {
        totalPreviousMonthCents += Math.abs(row.amount_cents);
      }
      continue;
    }

    if (ym === month) {
      monthRows.push(row);
      if (row.status === "needs_review") {
        monthPendingCount += 1;
      }

      const dayBucket = dailyBuckets.get(row.expense_date);
      if (row.amount_cents < 0) {
        const absVal = Math.abs(row.amount_cents);
        totalMonthCents += absVal;
        if (dayBucket) dayBucket.spentCents += absVal;

        const catEntry = categoryTotals.get(row.category) ?? {
          spentCents: 0,
          count: 0,
        };
        catEntry.spentCents += absVal;
        catEntry.count += 1;
        categoryTotals.set(row.category, catEntry);
      } else {
        monthlyInflowCents += row.amount_cents;
        if (dayBucket) dayBucket.inflowCents += row.amount_cents;
      }
    }
  }

  let variationPct: number | null = null;
  if (totalPreviousMonthCents > 0) {
    variationPct = Number(
      (((totalMonthCents - totalPreviousMonthCents) / totalPreviousMonthCents) * 100).toFixed(1)
    );
  } else if (totalMonthCents === 0) {
    variationPct = 0;
  }

  let runningSpent = 0;
  const dailySeries = Array.from(dailyBuckets.entries()).map(([date, bucket], idx) => {
    runningSpent += bucket.spentCents;
    return {
      date,
      day: idx + 1,
      label: `${String(idx + 1).padStart(2, "0")}/${month.slice(5, 7)}`,
      spentCents: bucket.spentCents,
      inflowCents: bucket.inflowCents,
      cumulativeSpentCents: runningSpent,
    };
  });

  const byCategory = CATEGORIES.map((cat) => {
    const entry = categoryTotals.get(cat) ?? { spentCents: 0, count: 0 };
    return {
      category: cat,
      spentCents: entry.spentCents,
      sharePct:
        totalMonthCents > 0
          ? Number(((entry.spentCents / totalMonthCents) * 100).toFixed(1))
          : 0,
      count: entry.count,
    };
  })
    .filter((item) => item.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents);

  const budgetMap = new Map<string, BudgetRow>();
  for (const b of (budgetsData ?? []) as BudgetRow[]) {
    budgetMap.set(b.category, b);
  }

  const budgets = CATEGORIES.map((category) => {
    const existing = budgetMap.get(category);
    const limitCents = existing?.limit_cents ?? 0;
    const alertPercent = existing?.alert_percent ?? 80;
    const spentCents = categoryTotals.get(category)?.spentCents ?? 0;
    const remainingCents = limitCents - spentCents;
    const usagePct =
      limitCents > 0 ? Number(((spentCents / limitCents) * 100).toFixed(1)) : 0;

    let status: "ok" | "alert" | "exceeded" | "unconfigured" = "unconfigured";
    if (limitCents > 0) {
      if (usagePct > 100) status = "exceeded";
      else if (usagePct >= alertPercent) status = "alert";
      else status = "ok";
    }

    return {
      category,
      limitCents,
      alertPercent,
      spentCents,
      remainingCents,
      usagePct,
      status,
      configured: Boolean(existing),
    };
  });

  const totalBudgetLimitCents = budgets.reduce((sum, b) => sum + b.limitCents, 0);
  const netSurplusCents = monthlyInflowCents - totalMonthCents;
  const savingsRatePct =
    monthlyInflowCents > 0
      ? Number((Math.max(netSurplusCents / monthlyInflowCents, 0) * 100).toFixed(1))
      : 0;

  return c.json({
    month,
    previousMonth,
    totalMonthCents,
    totalPreviousMonthCents,
    variationPct,
    monthlyInflowCents,
    netSurplusCents,
    savingsRatePct,
    totalBudgetLimitCents,
    dailySeries,
    byCategory,
    budgets,
    recentExpenses: monthRows.slice(0, 5),
    pendingCount: globalPendingCount ?? monthPendingCount,
    monthPendingCount,
  });
});
