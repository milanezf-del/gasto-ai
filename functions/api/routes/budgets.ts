import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  createUserSupabaseClient,
  type BudgetRow,
  type ExpenseRow,
} from "../lib/supabase";
import { getTodaySaoPaulo } from "../lib/dates";
import { CATEGORIES, upsertBudgetSchema, yearMonthSchema } from "../schemas";

export const budgetsRoutes = new Hono<ApiAppEnv>();

budgetsRoutes.use("*", requireAuth);

function getMonthRange(ym: string): { start: string; end: string } {
  const [yStr, mStr] = ym.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${ym}-01`,
    end: `${ym}-${String(lastDay).padStart(2, "0")}`,
  };
}

function computeBudgetStatus(
  limitCents: number,
  spentCents: number,
  alertPercent: number
): {
  usagePct: number;
  status: "ok" | "alert" | "exceeded" | "unconfigured";
} {
  if (limitCents <= 0) {
    return { usagePct: 0, status: "unconfigured" };
  }
  const usagePct = Number(((spentCents / limitCents) * 100).toFixed(1));
  if (usagePct > 100) return { usagePct, status: "exceeded" };
  if (usagePct >= alertPercent) return { usagePct, status: "alert" };
  return { usagePct, status: "ok" };
}

budgetsRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const rawMonth = c.req.query("month")?.trim() || getTodaySaoPaulo().slice(0, 7);
  const parsedMonth = yearMonthSchema.safeParse(rawMonth);
  if (!parsedMonth.success) {
    return c.json({ ok: false, error: "Mês inválido." }, 400);
  }

  const { start, end } = getMonthRange(parsedMonth.data);

  const [
    { data: budgetsData, error: budErr },
    { data: expensesData, error: expErr },
  ] = await Promise.all([
    supabase.from("budgets").select("*").eq("user_id", user.id),
    supabase
      .from("expenses")
      .select("category, amount_cents")
      .eq("user_id", user.id)
      .gte("expense_date", start)
      .lte("expense_date", end)
      .lt("amount_cents", 0),
  ]);

  if (budErr || expErr) {
    console.error("[Gastô Budgets Get Error]", { budErr, expErr });
    return c.json(
      { ok: false, error: "Não foi possível carregar os orçamentos." },
      500
    );
  }

  const spentMap = new Map<string, number>();
  for (const row of (expensesData ?? []) as Array<
    Pick<ExpenseRow, "category" | "amount_cents">
  >) {
    spentMap.set(
      row.category,
      (spentMap.get(row.category) ?? 0) + Math.abs(row.amount_cents)
    );
  }

  const budgetMap = new Map<string, BudgetRow>();
  for (const b of (budgetsData ?? []) as BudgetRow[]) {
    budgetMap.set(b.category, b);
  }

  const budgets = CATEGORIES.map((category) => {
    const existing = budgetMap.get(category);
    const limitCents = existing?.limit_cents ?? 0;
    const alertPercent = existing?.alert_percent ?? 80;
    const spentCents = spentMap.get(category) ?? 0;
    const { usagePct, status } = computeBudgetStatus(
      limitCents,
      spentCents,
      alertPercent
    );

    return {
      category,
      limitCents,
      alertPercent,
      spentCents,
      remainingCents: limitCents - spentCents,
      usagePct,
      status,
      configured: Boolean(existing),
    };
  });

  return c.json({ month: parsedMonth.data, budgets });
});

budgetsRoutes.put("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const body = await c.req.json().catch(() => null);
  const parsed = upsertBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados de orçamento inválidos.",
      },
      400
    );
  }

  const { category, limitCents, alertPercent } = parsed.data;
  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      {
        user_id: user.id,
        category,
        limit_cents: limitCents,
        alert_percent: alertPercent,
      },
      { onConflict: "user_id,category" }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("[Gastô Budgets Put Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível salvar o orçamento." },
      500
    );
  }

  const currentMonth = getTodaySaoPaulo().slice(0, 7);
  const { start, end } = getMonthRange(currentMonth);
  const { data: expensesData } = await supabase
    .from("expenses")
    .select("amount_cents")
    .eq("user_id", user.id)
    .eq("category", category)
    .gte("expense_date", start)
    .lte("expense_date", end)
    .lt("amount_cents", 0);

  const spentCents = (expensesData ?? []).reduce(
    (sum, r) => sum + Math.abs((r as { amount_cents: number }).amount_cents),
    0
  );

  const saved = data as BudgetRow;
  const { usagePct, status } = computeBudgetStatus(
    saved.limit_cents,
    spentCents,
    saved.alert_percent
  );

  return c.json({
    budget: {
      category,
      limitCents: saved.limit_cents,
      alertPercent: saved.alert_percent,
      spentCents,
      remainingCents: saved.limit_cents - spentCents,
      usagePct,
      status,
      configured: true,
    },
  });
});
