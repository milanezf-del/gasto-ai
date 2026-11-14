import { Hono } from "hono";
import { z } from "zod";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  createUserSupabaseClient,
  type BudgetRow,
  type ExpenseCategoryDB,
  type ExpenseRow,
} from "../lib/supabase";
import { addDaysIso, formatIsoToDateBR, getTodaySaoPaulo } from "../lib/dates";
import { formatCentavosToBRL } from "../lib/money";
import {
  AiLimitError,
  checkAiQuota,
  incrementAiUsage,
  parseTolerantAiJson,
  runTextModel,
} from "../lib/aiClient";
import { aiChatSchema, CATEGORIES } from "../schemas";

export const assistantRoutes = new Hono<ApiAppEnv>();

assistantRoutes.use("*", requireAuth);

type AssistantIntent =
  | "total_por_categoria"
  | "maior_despesa"
  | "comparar_meses"
  | "listar_despesas"
  | "media_diaria"
  | "status_orcamento"
  | "fora_do_escopo";

const intentClassifierSchema = z.object({
  intent: z.enum([
    "total_por_categoria",
    "maior_despesa",
    "comparar_meses",
    "listar_despesas",
    "media_diaria",
    "status_orcamento",
    "fora_do_escopo",
  ]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  category: z.enum(CATEGORIES).nullable().optional(),
  monthA: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional(),
  monthB: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional(),
  limit: z.number().int().min(1).max(20).nullable().optional(),
});

function getMonthBounds(ym: string): { from: string; to: string; days: number } {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(days).padStart(2, "0")}`,
    days,
  };
}

function getPreviousMonth(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  let y = Number(yStr);
  let m = Number(mStr) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function detectCategoryFromText(text: string): ExpenseCategoryDB | null {
  const lower = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (lower.includes("alimenta") || lower.includes("comida") || lower.includes("mercado") || lower.includes("restaurante")) {
    return "Alimentação";
  }
  if (lower.includes("transport") || lower.includes("uber") || lower.includes("gasolina") || lower.includes("onibus")) {
    return "Transporte";
  }
  if (lower.includes("educa") || lower.includes("curso") || lower.includes("livro") || lower.includes("faculdade")) {
    return "Educação";
  }
  if (lower.includes("lazer") || lower.includes("cinema") || lower.includes("viagem") || lower.includes("streaming")) {
    return "Lazer";
  }
  if (lower.includes("outros")) {
    return "Outros";
  }
  return null;
}

function fallbackClassifyIntent(
  message: string,
  todayIso: string
): z.infer<typeof intentClassifierSchema> {
  const lower = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const currentMonth = todayIso.slice(0, 7);
  const prevMonth = getPreviousMonth(currentMonth);
  const currentBounds = getMonthBounds(currentMonth);

  let from = currentBounds.from;
  let to = todayIso;

  if (lower.includes("mes passado") || lower.includes("ultimo mes")) {
    const prev = getMonthBounds(prevMonth);
    from = prev.from;
    to = prev.to;
  } else if (lower.includes("semana passada") || lower.includes("ultimos 7 dias")) {
    from = addDaysIso(todayIso, -7) ?? currentBounds.from;
    to = todayIso;
  } else if (lower.includes("hoje")) {
    from = todayIso;
    to = todayIso;
  } else if (lower.includes("ontem")) {
    const yest = addDaysIso(todayIso, -1) ?? todayIso;
    from = yest;
    to = yest;
  } else if (lower.includes("ultimos 30 dias")) {
    from = addDaysIso(todayIso, -30) ?? currentBounds.from;
    to = todayIso;
  }

  const category = detectCategoryFromText(message);

  if (lower.includes("comparar") || lower.includes("mes anterior") || lower.includes("versus") || lower.includes("ritmo")) {
    return {
      intent: "comparar_meses",
      monthA: currentMonth,
      monthB: prevMonth,
      from,
      to,
      category,
      limit: 5,
    };
  }
  if (lower.includes("orcamento") || lower.includes("teto") || lower.includes("limite") || lower.includes("meta")) {
    return {
      intent: "status_orcamento",
      category,
      from: currentBounds.from,
      to: currentBounds.to,
      monthA: currentMonth,
      monthB: prevMonth,
      limit: 5,
    };
  }
  if (lower.includes("maior") || lower.includes("mais caro") || lower.includes("recorde")) {
    return {
      intent: "maior_despesa",
      from,
      to,
      category,
      monthA: currentMonth,
      monthB: prevMonth,
      limit: 5,
    };
  }
  if (lower.includes("media") || lower.includes("por dia") || lower.includes("diaria")) {
    return {
      intent: "media_diaria",
      from,
      to,
      category,
      monthA: currentMonth,
      monthB: prevMonth,
      limit: 5,
    };
  }
  if (lower.includes("listar") || lower.includes("ultim") || lower.includes("quais despesas") || lower.includes("mostrar")) {
    return {
      intent: "listar_despesas",
      from,
      to,
      category,
      monthA: currentMonth,
      monthB: prevMonth,
      limit: 5,
    };
  }
  if (
    lower.includes("quanto") ||
    lower.includes("gast") ||
    lower.includes("total") ||
    lower.includes("categori") ||
    lower.includes("saldo") ||
    lower.includes("resumo") ||
    lower.includes("despesa")
  ) {
    return {
      intent: "total_por_categoria",
      from,
      to,
      category,
      monthA: currentMonth,
      monthB: prevMonth,
      limit: 5,
    };
  }

  return {
    intent: "fora_do_escopo",
    from,
    to,
    category: null,
    monthA: currentMonth,
    monthB: prevMonth,
    limit: 5,
  };
}

function daysBetweenInclusive(fromIso: string, toIso: string): number {
  const start = new Date(`${fromIso}T00:00:00Z`).getTime();
  const end = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
}

assistantRoutes.post("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const body = await c.req.json().catch(() => null);
  const parsedBody = aiChatSchema.safeParse(body);
  if (!parsedBody.success) {
    return c.json(
      {
        ok: false,
        error: parsedBody.error.issues[0]?.message ?? "Mensagem inválida.",
      },
      400
    );
  }

  const todayIso = getTodaySaoPaulo();
  const currentMonth = todayIso.slice(0, 7);
  const currentBounds = getMonthBounds(currentMonth);

  let aiAvailable = Boolean(c.env.AI);
  let aiAllowed = false;

  if (aiAvailable) {
    try {
      await checkAiQuota(supabase, user.id);
      aiAllowed = true;
    } catch (err) {
      if (err instanceof AiLimitError) {
        aiAllowed = false;
      }
    }
  }

  // PASSO 1: Classificar intenção (nunca gerar SQL)
  let classified = fallbackClassifyIntent(parsedBody.data.message, todayIso);

  if (aiAllowed && c.env.AI) {
    try {
      const classifierPrompt = [
        "Você classifica perguntas financeiras em UMA intenção de uma lista fixa. NUNCA escreva SQL.",
        `Data de hoje em America/Sao_Paulo: ${todayIso} (mês atual: ${currentMonth}).`,
        "Intenções válidas:",
        "- total_por_categoria: soma de gastos em um período (opcionalmente filtrada por categoria)",
        "- maior_despesa: maior gasto individual em um período",
        "- comparar_meses: comparar gastos entre dois meses (mes_a e mes_b no formato YYYY-MM)",
        "- listar_despesas: listar últimas despesas (opcionalmente por período/categoria/limite)",
        "- media_diaria: gasto médio por dia em um período",
        "- status_orcamento: consumo atual dos orçamentos vs limites (opcionalmente por categoria)",
        "- fora_do_escopo: perguntas sem relação com finanças pessoais do usuário",
        `Categorias válidas: ${CATEGORIES.join(", ")}.`,
        'Responda APENAS JSON válido: {"intent": string, "from": "YYYY-MM-DD"|null, "to": "YYYY-MM-DD"|null, "category": string|null, "monthA": "YYYY-MM"|null, "monthB": "YYYY-MM"|null, "limit": number|null}.',
      ].join("\n");

      const rawIntent = await runTextModel(
        c.env.AI,
        classifierPrompt,
        `Histórico recente: ${JSON.stringify(parsedBody.data.history.slice(-4))}\nPergunta: ${parsedBody.data.message}`,
        { maxTokens: 250 }
      );
      await incrementAiUsage(supabase, user.id);

      const jsonIntent = parseTolerantAiJson(rawIntent);
      const validIntent = intentClassifierSchema.safeParse(jsonIntent);
      if (validIntent.success) {
        classified = validIntent.data;
      }
    } catch (err) {
      if (err instanceof AiLimitError) {
        aiAllowed = false;
      }
      // Mantém classificação determinística de fallback
    }
  }

  const intent: AssistantIntent = classified.intent;
  const fromIso = classified.from || currentBounds.from;
  const toIso =
    classified.to && classified.to >= fromIso ? classified.to : todayIso;
  const categoryFilter = classified.category ?? null;
  const limitNum = classified.limit ?? 5;

  // PASSO 2: Consultas SQL parametrizadas seguras (sempre com user.id da sessão)
  let realDataContext: Record<string, unknown> = {};
  let templateReply = "";
  let cards: Array<{
    id: string;
    merchant: string;
    amountCents: number;
    expenseDate: string;
    category: ExpenseCategoryDB;
  }> = [];
  let miniSeries: Array<{ label: string; valueCents: number }> = [];
  const suggestedActions: Array<{
    id: string;
    label: string;
    type: "navigate";
    view: "overview" | "transactions" | "budgets" | "rules";
  }> = [];

  if (intent === "fora_do_escopo") {
    templateReply =
      "Posso ajudar apenas com consultas sobre suas despesas, categorias, orçamentos e comparativos mensais no Gastô. Experimente perguntar quanto você gastou neste mês ou como estão seus orçamentos.";
    return c.json({
      reply: templateReply,
      intent,
      confidence: 95,
      usedAi: false,
      cards: [],
      miniSeries: [],
      suggestedActions: [],
    });
  }

  if (intent === "total_por_categoria") {
    let query = supabase
      .from("expenses")
      .select("id, merchant, amount_cents, expense_date, category")
      .eq("user_id", user.id)
      .gte("expense_date", fromIso)
      .lte("expense_date", toIso)
      .lt("amount_cents", 0)
      .order("expense_date", { ascending: false });

    if (categoryFilter) {
      query = query.eq("category", categoryFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Gastô Assistant Query Error]", error);
      return c.json({ ok: false, error: "Erro ao consultar suas despesas." }, 500);
    }

    const rows = (data ?? []) as ExpenseRow[];
    const totalSpentCents = rows.reduce((s, r) => s + Math.abs(r.amount_cents), 0);

    const byCatMap = new Map<ExpenseCategoryDB, number>();
    for (const r of rows) {
      byCatMap.set(
        r.category,
        (byCatMap.get(r.category) ?? 0) + Math.abs(r.amount_cents)
      );
    }
    const breakdown = Array.from(byCatMap.entries())
      .map(([cat, cents]) => ({ label: cat, valueCents: cents }))
      .sort((a, b) => b.valueCents - a.valueCents);

    miniSeries = breakdown;
    cards = rows.slice(0, 3).map((r) => ({
      id: r.id,
      merchant: r.merchant || "Lançamento",
      amountCents: r.amount_cents,
      expenseDate: r.expense_date,
      category: r.category,
    }));

    realDataContext = {
      periodo: `${formatIsoToDateBR(fromIso)} a ${formatIsoToDateBR(toIso)}`,
      categoria: categoryFilter ?? "Todas",
      quantidade_lancamentos: rows.length,
      total_gasto: formatCentavosToBRL(totalSpentCents),
      detalhe_por_categoria: breakdown.map((b) => ({
        categoria: b.label,
        total: formatCentavosToBRL(b.valueCents),
      })),
    };

    if (rows.length === 0) {
      templateReply = categoryFilter
        ? `Não encontrei despesas em ${categoryFilter} entre ${formatIsoToDateBR(fromIso)} e ${formatIsoToDateBR(toIso)}.`
        : `Você não registrou despesas entre ${formatIsoToDateBR(fromIso)} e ${formatIsoToDateBR(toIso)}.`;
    } else {
      templateReply = categoryFilter
        ? `Entre ${formatIsoToDateBR(fromIso)} e ${formatIsoToDateBR(toIso)}, você gastou ${formatCentavosToBRL(totalSpentCents)} em ${categoryFilter} (${rows.length} lançamento${rows.length > 1 ? "s" : ""}).`
        : `Entre ${formatIsoToDateBR(fromIso)} e ${formatIsoToDateBR(toIso)}, o total gasto foi ${formatCentavosToBRL(totalSpentCents)} em ${rows.length} lançamento${rows.length > 1 ? "s" : ""}.`;
    }
  } else if (intent === "maior_despesa") {
    let query = supabase
      .from("expenses")
      .select("id, merchant, amount_cents, expense_date, category")
      .eq("user_id", user.id)
      .gte("expense_date", fromIso)
      .lte("expense_date", toIso)
      .lt("amount_cents", 0)
      .order("amount_cents", { ascending: true }) // mais negativo = maior gasto
      .limit(3);

    if (categoryFilter) {
      query = query.eq("category", categoryFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Gastô Assistant Top Expense Error]", error);
      return c.json({ ok: false, error: "Erro ao consultar suas despesas." }, 500);
    }

    const rows = (data ?? []) as ExpenseRow[];
    cards = rows.map((r) => ({
      id: r.id,
      merchant: r.merchant || "Lançamento",
      amountCents: r.amount_cents,
      expenseDate: r.expense_date,
      category: r.category,
    }));

    const top = rows[0];
    realDataContext = {
      periodo: `${formatIsoToDateBR(fromIso)} a ${formatIsoToDateBR(toIso)}`,
      maior_despesa: top
        ? {
            estabelecimento: top.merchant || "Lançamento",
            valor: formatCentavosToBRL(Math.abs(top.amount_cents)),
            data: formatIsoToDateBR(top.expense_date),
            categoria: top.category,
          }
        : null,
    };

    templateReply = top
      ? `Sua maior despesa entre ${formatIsoToDateBR(fromIso)} e ${formatIsoToDateBR(toIso)} foi em ${top.merchant || "Lançamento"} (${top.category}), no valor de ${formatCentavosToBRL(Math.abs(top.amount_cents))} em ${formatIsoToDateBR(top.expense_date)}.`
      : `Nenhuma despesa registrada entre ${formatIsoToDateBR(fromIso)} e ${formatIsoToDateBR(toIso)}.`;
  } else if (intent === "comparar_meses") {
    const monthA = classified.monthA || currentMonth;
    const monthB = classified.monthB || getPreviousMonth(monthA);
    const boundsA = getMonthBounds(monthA);
    const boundsB = getMonthBounds(monthB);

    const [{ data: dataA, error: errA }, { data: dataB, error: errB }] =
      await Promise.all([
        supabase
          .from("expenses")
          .select("amount_cents, category")
          .eq("user_id", user.id)
          .gte("expense_date", boundsA.from)
          .lte("expense_date", boundsA.to)
          .lt("amount_cents", 0),
        supabase
          .from("expenses")
          .select("amount_cents, category")
          .eq("user_id", user.id)
          .gte("expense_date", boundsB.from)
          .lte("expense_date", boundsB.to)
          .lt("amount_cents", 0),
      ]);

    if (errA || errB) {
      console.error("[Gastô Assistant Compare Error]", { errA, errB });
      return c.json({ ok: false, error: "Erro ao comparar meses." }, 500);
    }

    const totalA = (dataA ?? []).reduce(
      (s, r) => s + Math.abs((r as { amount_cents: number }).amount_cents),
      0
    );
    const totalB = (dataB ?? []).reduce(
      (s, r) => s + Math.abs((r as { amount_cents: number }).amount_cents),
      0
    );
    const diffCents = totalA - totalB;
    const pct = totalB > 0 ? Number(((diffCents / totalB) * 100).toFixed(1)) : null;

    miniSeries = [
      { label: monthB, valueCents: totalB },
      { label: monthA, valueCents: totalA },
    ];

    realDataContext = {
      mes_a: monthA,
      total_mes_a: formatCentavosToBRL(totalA),
      mes_b: monthB,
      total_mes_b: formatCentavosToBRL(totalB),
      diferenca: formatCentavosToBRL(Math.abs(diffCents)),
      variacao_pct: pct !== null ? `${pct > 0 ? "+" : ""}${pct}%` : "Sem base no mês B",
    };

    templateReply =
      totalB > 0
        ? `Em ${monthA}, você gastou ${formatCentavosToBRL(totalA)} contra ${formatCentavosToBRL(totalB)} em ${monthB} (${diffCents >= 0 ? "+" : "-"}${formatCentavosToBRL(Math.abs(diffCents))}, ${pct}%).`
        : `Em ${monthA}, você gastou ${formatCentavosToBRL(totalA)}. Ainda não há despesas registradas em ${monthB} para comparação.`;
  } else if (intent === "listar_despesas") {
    let query = supabase
      .from("expenses")
      .select("id, merchant, amount_cents, expense_date, category")
      .eq("user_id", user.id)
      .gte("expense_date", fromIso)
      .lte("expense_date", toIso)
      .lt("amount_cents", 0)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limitNum);

    if (categoryFilter) {
      query = query.eq("category", categoryFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Gastô Assistant List Error]", error);
      return c.json({ ok: false, error: "Erro ao listar despesas." }, 500);
    }

    const rows = (data ?? []) as ExpenseRow[];
    cards = rows.map((r) => ({
      id: r.id,
      merchant: r.merchant || "Lançamento",
      amountCents: r.amount_cents,
      expenseDate: r.expense_date,
      category: r.category,
    }));

    const total = rows.reduce((s, r) => s + Math.abs(r.amount_cents), 0);
    realDataContext = {
      periodo: `${formatIsoToDateBR(fromIso)} a ${formatIsoToDateBR(toIso)}`,
      quantidade_exibida: rows.length,
      soma_exibida: formatCentavosToBRL(total),
    };

    suggestedActions.push({
      id: "nav-tx",
      label: "Abrir todas as despesas",
      type: "navigate",
      view: "transactions",
    });

    templateReply =
      rows.length > 0
        ? `Encontrei ${rows.length} despesa${rows.length > 1 ? "s" : ""} recente${rows.length > 1 ? "s" : ""} no período, somando ${formatCentavosToBRL(total)}.`
        : `Nenhuma despesa encontrada entre ${formatIsoToDateBR(fromIso)} e ${formatIsoToDateBR(toIso)}.`;
  } else if (intent === "media_diaria") {
    const { data, error } = await supabase
      .from("expenses")
      .select("amount_cents, expense_date")
      .eq("user_id", user.id)
      .gte("expense_date", fromIso)
      .lte("expense_date", toIso)
      .lt("amount_cents", 0);

    if (error) {
      console.error("[Gastô Assistant Daily Avg Error]", error);
      return c.json({ ok: false, error: "Erro ao calcular média diária." }, 500);
    }

    const rows = (data ?? []) as Array<{ amount_cents: number; expense_date: string }>;
    const total = rows.reduce((s, r) => s + Math.abs(r.amount_cents), 0);
    const numDays = daysBetweenInclusive(fromIso, toIso);
    const avgPerDayCents = Math.round(total / numDays);

    const perDay = new Map<string, number>();
    for (const r of rows) {
      perDay.set(
        r.expense_date,
        (perDay.get(r.expense_date) ?? 0) + Math.abs(r.amount_cents)
      );
    }
    miniSeries = Array.from(perDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([d, v]) => ({ label: formatIsoToDateBR(d).slice(0, 5), valueCents: v }));

    realDataContext = {
      periodo: `${formatIsoToDateBR(fromIso)} a ${formatIsoToDateBR(toIso)}`,
      dias: numDays,
      total_gasto: formatCentavosToBRL(total),
      media_diaria: formatCentavosToBRL(avgPerDayCents),
    };

    templateReply = `No período de ${formatIsoToDateBR(fromIso)} a ${formatIsoToDateBR(toIso)} (${numDays} dias), sua média diária de gastos foi de ${formatCentavosToBRL(avgPerDayCents)}, com total de ${formatCentavosToBRL(total)}.`;
  } else if (intent === "status_orcamento") {
    const [{ data: budgetsData, error: budErr }, { data: expData, error: expErr }] =
      await Promise.all([
        supabase.from("budgets").select("*").eq("user_id", user.id),
        supabase
          .from("expenses")
          .select("category, amount_cents")
          .eq("user_id", user.id)
          .gte("expense_date", currentBounds.from)
          .lte("expense_date", currentBounds.to)
          .lt("amount_cents", 0),
      ]);

    if (budErr || expErr) {
      console.error("[Gastô Assistant Budgets Error]", { budErr, expErr });
      return c.json({ ok: false, error: "Erro ao consultar orçamentos." }, 500);
    }

    const spentByCat = new Map<string, number>();
    for (const r of (expData ?? []) as Array<{ category: string; amount_cents: number }>) {
      spentByCat.set(
        r.category,
        (spentByCat.get(r.category) ?? 0) + Math.abs(r.amount_cents)
      );
    }

    const filteredBudgets = ((budgetsData ?? []) as BudgetRow[]).filter((b) =>
      categoryFilter ? b.category === categoryFilter : true
    );

    const statusRows = filteredBudgets.map((b) => {
      const spent = spentByCat.get(b.category) ?? 0;
      const pct = b.limit_cents > 0 ? Math.round((spent / b.limit_cents) * 100) : 0;
      return {
        category: b.category,
        limitCents: b.limit_cents,
        spentCents: spent,
        alertPercent: b.alert_percent,
        pct,
        state:
          b.limit_cents === 0
            ? "Sem teto"
            : pct > 100
            ? "Estourado"
            : pct >= b.alert_percent
            ? "Alerta"
            : "Normal",
      };
    });

    miniSeries = statusRows.map((s) => ({
      label: s.category,
      valueCents: s.spentCents,
    }));

    suggestedActions.push({
      id: "nav-budgets",
      label: "Ajustar orçamentos",
      type: "navigate",
      view: "budgets",
    });

    realDataContext = {
      mes: currentMonth,
      orcamentos: statusRows.map((s) => ({
        categoria: s.category,
        gasto: formatCentavosToBRL(s.spentCents),
        limite: formatCentavosToBRL(s.limitCents),
        consumo: `${s.pct}%`,
        situacao: s.state,
      })),
    };

    const alerts = statusRows.filter(
      (s) => s.state === "Estourado" || s.state === "Alerta"
    );
    if (statusRows.length === 0) {
      templateReply =
        "Você ainda não configurou limites mensais de orçamento. Acesse Orçamentos e Metas para definir seus tetos.";
    } else if (alerts.length > 0) {
      const summaryParts = alerts
        .map(
          (a) =>
            `${a.category} (${a.state}: ${formatCentavosToBRL(a.spentCents)} de ${formatCentavosToBRL(a.limitCents)})`
        )
        .join(", ");
      templateReply = `Atenção aos orçamentos neste mês: ${summaryParts}.`;
    } else {
      templateReply = `Todos os ${statusRows.length} orçamentos configurados estão dentro da meta neste mês.`;
    }
  }

  // PASSO 3: Opcionalmente redigir resposta amigável com TEXT_MODEL usando APENAS os números reais
  let finalReply = templateReply;
  let usedAi = false;

  if (aiAllowed && c.env.AI) {
    try {
      await checkAiQuota(supabase, user.id);
      const redactorPrompt = [
        "Você é o Gastô, assistente financeiro em pt-BR.",
        "Redija uma resposta curta e objetiva (máximo 3 frases) usando EXCLUSIVAMENTE os números reais do JSON fornecido.",
        "NUNCA invente valores, estabelecimentos ou porcentagens que não estejam no JSON.",
      ].join("\n");

      const rawText = await runTextModel(
        c.env.AI,
        redactorPrompt,
        `Pergunta do usuário: ${parsedBody.data.message}\nDados reais retornados do banco: ${JSON.stringify(realDataContext)}`,
        { maxTokens: 260 }
      );
      await incrementAiUsage(supabase, user.id);

      const cleaned = rawText.replace(/```[\s\S]*?```/g, "").trim();
      if (cleaned.length >= 10) {
        finalReply = cleaned;
        usedAi = true;
      }
    } catch {
      // Se cota acabar ou IA falhar, mantém resposta montada por template sem erro
    }
  }

  return c.json({
    reply: finalReply,
    intent,
    confidence: usedAi ? 96 : 100,
    usedAi,
    cards,
    miniSeries,
    suggestedActions,
  });
});
