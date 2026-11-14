import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { createUserSupabaseClient, type ExpenseRow } from "../lib/supabase";
import { getTodaySaoPaulo } from "../lib/dates";

export const summaryRoutes = new Hono<ApiAppEnv>();

summaryRoutes.use("*", requireAuth);

const MONTH_LABELS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function getRecentMonths(refIso: string, count: number): string[] {
  const [yStr, mStr] = refIso.split("-");
  let year = Number(yStr);
  let month = Number(mStr);
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    months.unshift(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return months;
}

summaryRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));
  const todayIso = getTodaySaoPaulo();
  const currentMonth = todayIso.slice(0, 7); // yyyy-mm
  const monthsWindow = getRecentMonths(todayIso, 6);
  const windowStart = `${monthsWindow[0]}-01`;

  const [{ data: expenses, error: expErr }, { data: budgets, error: budErr }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("amount_cents, expense_date, status")
        .eq("user_id", user.id)
        .gte("expense_date", windowStart)
        .order("expense_date", { ascending: false }),
      supabase
        .from("budgets")
        .select("limit_cents")
        .eq("user_id", user.id),
    ]);

  if (expErr || budErr) {
    return c.json(
      { ok: false, error: "Não foi possível consolidar seu resumo financeiro." },
      500
    );
  }

  const rows = (expenses ?? []) as Array<
    Pick<ExpenseRow, "amount_cents" | "expense_date" | "status">
  >;

  let monthlyInflowCents = 0;
  let monthlyOutflowCents = 0;
  let pendingCount = 0;

  const monthlyMap = new Map<
    string,
    { inflowCents: number; outflowCents: number }
  >();
  for (const ym of monthsWindow) {
    monthlyMap.set(ym, { inflowCents: 0, outflowCents: 0 });
  }

  for (const row of rows) {
    const ym = row.expense_date.slice(0, 7);
    const bucket = monthlyMap.get(ym);
    if (bucket) {
      if (row.amount_cents > 0) {
        bucket.inflowCents += row.amount_cents;
      } else {
        bucket.outflowCents += Math.abs(row.amount_cents);
      }
    }

    if (ym === currentMonth) {
      if (row.amount_cents > 0) {
        monthlyInflowCents += row.amount_cents;
      } else {
        monthlyOutflowCents += Math.abs(row.amount_cents);
      }
      if (row.status === "needs_review") {
        pendingCount += 1;
      }
    }
  }

  const totalBudgetLimitCents = (budgets ?? []).reduce(
    (sum, b) => sum + Number((b as { limit_cents: number }).limit_cents ?? 0),
    0
  );

  const netSurplusCents = monthlyInflowCents - monthlyOutflowCents;
  const savingsRatePct =
    monthlyInflowCents > 0
      ? Math.max((netSurplusCents / monthlyInflowCents) * 100, 0)
      : 0;

  const cashFlowHistory = monthsWindow.map((ym) => {
    const monthIndex = Number(ym.slice(5, 7)) - 1;
    const stats = monthlyMap.get(ym) ?? { inflowCents: 0, outflowCents: 0 };
    return {
      label: MONTH_LABELS_PT[monthIndex] ?? ym,
      inflowCents: stats.inflowCents,
      outflowCents: stats.outflowCents,
    };
  });

  return c.json({
    monthlyInflowCents,
    monthlyOutflowCents,
    netSurplusCents,
    savingsRatePct,
    totalBudgetLimitCents,
    pendingCount,
    cashFlowHistory,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email.split("@")[0],
    },
  });
});
