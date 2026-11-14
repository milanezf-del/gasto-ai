import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  createUserSupabaseClient,
  normalizeMerchant,
  type BudgetRow,
  type ExpenseCategoryDB,
  type ExpenseRow,
} from "../lib/supabase";
import { getTodaySaoPaulo } from "../lib/dates";
import { formatCentavosToBRL } from "../lib/money";
import {
  checkAiQuota,
  incrementAiUsage,
  parseTolerantAiJson,
  runTextModel,
} from "../lib/aiClient";
import { CATEGORIES, yearMonthSchema } from "../schemas";

export const insightsRoutes = new Hono<ApiAppEnv>();

insightsRoutes.use("*", requireAuth);

export interface FinancialInsightItem {
  id: string;
  kind:
    | "category_growth"
    | "budget_alert"
    | "top_expense"
    | "recurring_expense";
  severity: "info" | "warning" | "alert";
  title: string;
  description: string;
  metricLabel?: string;
}

function getPrevMonth(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  let y = Number(yStr);
  let m = Number(mStr) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function getMonthEnd(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  const days = new Date(Date.UTC(Number(yStr), Number(mStr), 0)).getUTCDate();
  return `${ym}-${String(days).padStart(2, "0")}`;
}

insightsRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const rawMonth = c.req.query("month")?.trim() || getTodaySaoPaulo().slice(0, 7);
  const parsedMonth = yearMonthSchema.safeParse(rawMonth);
  if (!parsedMonth.success) {
    return c.json({ ok: false, error: "Mês inválido." }, 400);
  }

  const month = parsedMonth.data;
  const prevMonth = getPrevMonth(month);
  const twoMonthsAgo = getPrevMonth(prevMonth);
  const windowStart = `${twoMonthsAgo}-01`;
  const monthEnd = getMonthEnd(month);

  const [{ data: expData, error: expErr }, { data: budgetsData, error: budErr }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("id, merchant, amount_cents, expense_date, category")
        .eq("user_id", user.id)
        .gte("expense_date", windowStart)
        .lte("expense_date", monthEnd)
        .lt("amount_cents", 0)
        .order("expense_date", { ascending: false }),
      supabase.from("budgets").select("*").eq("user_id", user.id),
    ]);

  if (expErr || budErr) {
    console.error("[Gastô Insights Query Error]", { expErr, budErr });
    return c.json(
      { ok: false, error: "Não foi possível gerar os insights do mês." },
      500
    );
  }

  const rows = (expData ?? []) as Array<
    Pick<ExpenseRow, "id" | "merchant" | "amount_cents" | "expense_date" | "category">
  >;
  const monthRows = rows.filter((r) => r.expense_date.startsWith(month));

  if (monthRows.length === 0) {
    return c.json({
      month,
      empty: true,
      insights: [] as FinancialInsightItem[],
      cached: false,
    });
  }

  const monthSum = monthRows.reduce((s, r) => s + Math.abs(r.amount_cents), 0);
  const budgetSig = ((budgetsData ?? []) as BudgetRow[])
    .map((b) => `${b.category}:${b.limit_cents}:${b.alert_percent}`)
    .sort()
    .join("|");
  const dataSignature = `${rows.length}:${monthRows.length}:${monthSum}:${budgetSig}`;

  // Verifica cache em insights_cache (ignora graciosamente se a tabela ainda não foi migrada)
  try {
    const { data: cachedRow } = await supabase
      .from("insights_cache")
      .select("insights_json, data_signature")
      .eq("user_id", user.id)
      .eq("month", month)
      .maybeSingle();

    if (
      cachedRow &&
      (cachedRow as { data_signature?: string }).data_signature === dataSignature &&
      Array.isArray((cachedRow as { insights_json?: unknown }).insights_json)
    ) {
      return c.json({
        month,
        empty: false,
        insights: (cachedRow as { insights_json: FinancialInsightItem[] })
          .insights_json,
        cached: true,
      });
    }
  } catch {
    // Segue sem cache
  }

  // Cálculo 100% determinístico dos insights
  const curCat = new Map<ExpenseCategoryDB, number>();
  const prevCat = new Map<ExpenseCategoryDB, number>();
  for (const cat of CATEGORIES) {
    curCat.set(cat, 0);
    prevCat.set(cat, 0);
  }

  let topExpense: (typeof monthRows)[number] | null = null;
  for (const r of rows) {
    const ym = r.expense_date.slice(0, 7);
    const absVal = Math.abs(r.amount_cents);
    if (ym === month) {
      curCat.set(r.category, (curCat.get(r.category) ?? 0) + absVal);
      if (!topExpense || absVal > Math.abs(topExpense.amount_cents)) {
        topExpense = r;
      }
    } else if (ym === prevMonth) {
      prevCat.set(r.category, (prevCat.get(r.category) ?? 0) + absVal);
    }
  }

  const insights: FinancialInsightItem[] = [];

  // 1) Categoria que mais cresceu vs mês anterior
  let bestGrowth: {
    cat: ExpenseCategoryDB;
    cur: number;
    prev: number;
    deltaCents: number;
    pct: number | null;
  } | null = null;

  for (const cat of CATEGORIES) {
    const cur = curCat.get(cat) ?? 0;
    const prev = prevCat.get(cat) ?? 0;
    const deltaCents = cur - prev;
    if (cur > 0 && deltaCents > 0) {
      const pct = prev > 0 ? Number(((deltaCents / prev) * 100).toFixed(0)) : null;
      if (!bestGrowth || deltaCents > bestGrowth.deltaCents) {
        bestGrowth = { cat, cur, prev, deltaCents, pct };
      }
    }
  }

  if (bestGrowth) {
    insights.push({
      id: "cat-growth",
      kind: "category_growth",
      severity: "warning",
      title: `${bestGrowth.cat} liderou a alta do mês`,
      description:
        bestGrowth.pct !== null
          ? `Os gastos em ${bestGrowth.cat} subiram ${bestGrowth.pct}% (+${formatCentavosToBRL(bestGrowth.deltaCents)}) frente ao mês anterior, somando ${formatCentavosToBRL(bestGrowth.cur)}.`
          : `Você destinou ${formatCentavosToBRL(bestGrowth.cur)} para ${bestGrowth.cat} neste mês sem gastos equivalentes no mês anterior.`,
      metricLabel:
        bestGrowth.pct !== null
          ? `+${bestGrowth.pct}%`
          : formatCentavosToBRL(bestGrowth.cur),
    });
  }

  // 2) Orçamento perto do limite ou estourado
  const budgetAlertCandidate = ((budgetsData ?? []) as BudgetRow[])
    .filter((b) => b.limit_cents > 0)
    .map((b) => {
      const spent = curCat.get(b.category) ?? 0;
      const pct = Math.round((spent / b.limit_cents) * 100);
      return { ...b, spent, pct };
    })
    .filter((b) => b.pct >= b.alert_percent)
    .sort((a, b) => b.pct - a.pct)[0];

  if (budgetAlertCandidate) {
    const isOver = budgetAlertCandidate.pct > 100;
    insights.push({
      id: "budget-alert",
      kind: "budget_alert",
      severity: isOver ? "alert" : "warning",
      title: isOver
        ? `Orçamento de ${budgetAlertCandidate.category} estourado`
        : `${budgetAlertCandidate.category} atingiu ${budgetAlertCandidate.pct}% do teto`,
      description: isOver
        ? `O gasto de ${formatCentavosToBRL(budgetAlertCandidate.spent)} ultrapassou o limite mensal de ${formatCentavosToBRL(budgetAlertCandidate.limit_cents)}.`
        : `Você já utilizou ${formatCentavosToBRL(budgetAlertCandidate.spent)} do limite de ${formatCentavosToBRL(budgetAlertCandidate.limit_cents)} (alerta em ${budgetAlertCandidate.alert_percent}%).`,
      metricLabel: `${budgetAlertCandidate.pct}%`,
    });
  }

  // 3) Possível despesa recorrente (mesmo estabelecimento normalizado e valor em 2+ meses)
  const recurringMap = new Map<
    string,
    { merchant: string; amountCents: number; months: Set<string> }
  >();
  for (const r of rows) {
    if (!r.merchant) continue;
    const norm = normalizeMerchant(r.merchant);
    if (!norm) continue;
    const absVal = Math.abs(r.amount_cents);
    const key = `${norm}|${absVal}`;
    const existing = recurringMap.get(key) ?? {
      merchant: r.merchant,
      amountCents: absVal,
      months: new Set<string>(),
    };
    existing.months.add(r.expense_date.slice(0, 7));
    recurringMap.set(key, existing);
  }

  const recurringCandidate = Array.from(recurringMap.values()).find(
    (entry) => entry.months.size >= 2 && entry.months.has(month)
  );

  if (recurringCandidate && insights.length < 3) {
    insights.push({
      id: "recurring-expense",
      kind: "recurring_expense",
      severity: "info",
      title: `Possível cobrança recorrente: ${recurringCandidate.merchant}`,
      description: `O lançamento de ${formatCentavosToBRL(recurringCandidate.amountCents)} em ${recurringCandidate.merchant} apareceu em ${recurringCandidate.months.size} meses recentes.`,
      metricLabel: formatCentavosToBRL(recurringCandidate.amountCents),
    });
  }

  // 4) Maior despesa do mês (completa até 3 insights)
  if (topExpense && insights.length < 3) {
    const absTop = Math.abs(topExpense.amount_cents);
    insights.push({
      id: "top-expense",
      kind: "top_expense",
      severity: "info",
      title: `Maior despesa do mês: ${topExpense.merchant || "Lançamento"}`,
      description: `Representou ${monthSum > 0 ? Math.round((absTop / monthSum) * 100) : 0}% do total gasto no mês (${formatCentavosToBRL(absTop)} em ${topExpense.category}).`,
      metricLabel: formatCentavosToBRL(absTop),
    });
  }

  const finalInsights = insights.slice(0, 3);

  // Reescrita amigável opcional via IA (sem alterar os números reais)
  if (c.env.AI && finalInsights.length > 0) {
    try {
      await checkAiQuota(supabase, user.id);
      const raw = await runTextModel(
        c.env.AI,
        'Reescreva de forma clara e cordial em pt-BR apenas os campos "title" e "description" de cada insight preservando TODOS os valores em R$ e porcentagens exatamente como recebidos. Responda APENAS JSON: {"items":[{"id":string,"title":string,"description":string}]}.',
        JSON.stringify(
          finalInsights.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
          }))
        ),
        { maxTokens: 450 }
      );
      await incrementAiUsage(supabase, user.id);

      const parsed = parseTolerantAiJson(raw);
      if (Array.isArray(parsed?.items)) {
        for (const item of parsed.items as Array<Record<string, unknown>>) {
          const target = finalInsights.find((i) => i.id === item.id);
          if (target) {
            if (typeof item.title === "string" && item.title.trim()) {
              target.title = item.title.trim().slice(0, 90);
            }
            if (typeof item.description === "string" && item.description.trim()) {
              target.description = item.description.trim().slice(0, 220);
            }
          }
        }
      }
    } catch {
      // Mantém textos determinísticos se cota/IA indisponível
    }
  }

  // Salva no cache (ignora graciosamente se a tabela insights_cache ainda não existir)
  try {
    await supabase.from("insights_cache").upsert(
      {
        user_id: user.id,
        month,
        insights_json: finalInsights,
        data_signature: dataSignature,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,month" }
    );
  } catch {
    // Ignora caso a migração 002 ainda não tenha sido executada
  }

  return c.json({
    month,
    empty: false,
    insights: finalInsights,
    cached: false,
  });
});
