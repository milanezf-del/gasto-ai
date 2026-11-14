import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import {
  createUserSupabaseClient,
  normalizeMerchant,
  type ExpenseCategoryDB,
  type ExpenseRow,
} from "../lib/supabase";
import { sha256Hex } from "../lib/ids";
import { formatIsoToDateBR, getTodaySaoPaulo } from "../lib/dates";
import { formatCentavosToBRL } from "../lib/money";
import {
  confirmExpenseSchema,
  createExpenseSchema,
  expensesQuerySchema,
  updateExpenseSchema,
  uuidSchema,
} from "../schemas";

export const expensesRoutes = new Hono<ApiAppEnv>();

expensesRoutes.use("*", requireAuth);

interface CursorPayload {
  offset: number;
}

function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(raw?: string): CursorPayload {
  if (!raw) return { offset: 0 };
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { offset?: unknown };
    const offset =
      typeof parsed.offset === "number" && Number.isInteger(parsed.offset) && parsed.offset >= 0
        ? parsed.offset
        : 0;
    return { offset };
  } catch {
    return { offset: 0 };
  }
}

function escapeCsvCell(value: string): string {
  const needsQuotes = /[;"\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

async function queryFilteredExpenses(
  supabase: ReturnType<typeof createUserSupabaseClient>,
  userId: string,
  params: ReturnType<typeof expensesQuerySchema.parse>
): Promise<{ rows: ExpenseRow[]; error: unknown }> {
  const searchTerm = (params.q || params.search || "").trim().toLowerCase();

  let query = supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId);

  if (params.from) {
    query = query.gte("expense_date", params.from);
  }
  if (params.to) {
    query = query.lte("expense_date", params.to);
  }
  if (params.category) {
    query = query.eq("category", params.category);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.max !== undefined) {
    query = query.gte("amount_cents", -params.max).lte("amount_cents", params.max);
  }

  const ascending = params.sort === "date_asc";
  query = query
    .order("expense_date", { ascending })
    .order("created_at", { ascending })
    .order("id", { ascending })
    .limit(1000);

  const { data, error } = await query;
  if (error) {
    return { rows: [], error };
  }

  let rows = (data ?? []) as ExpenseRow[];

  if (params.min !== undefined) {
    rows = rows.filter((item) => Math.abs(item.amount_cents) >= params.min!);
  }

  if (searchTerm) {
    rows = rows.filter(
      (item) =>
        (item.merchant ?? "").toLowerCase().includes(searchTerm) ||
        (item.note ?? "").toLowerCase().includes(searchTerm) ||
        item.category.toLowerCase().includes(searchTerm)
    );
  }

  if (params.sort === "amount_desc") {
    rows.sort((a, b) => Math.abs(b.amount_cents) - Math.abs(a.amount_cents));
  } else if (params.sort === "amount_asc") {
    rows.sort((a, b) => Math.abs(a.amount_cents) - Math.abs(b.amount_cents));
  }

  return { rows, error: null };
}

expensesRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const parsed = expensesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Parâmetros de consulta inválidos.",
      },
      400
    );
  }

  const params = parsed.data;
  const { offset } = decodeCursor(params.cursor);

  const { rows, error } = await queryFilteredExpenses(supabase, user.id, params);
  if (error) {
    console.error("[Gastô Expenses List Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível carregar seus lançamentos." },
      500
    );
  }

  const totalCount = rows.length;
  const sliced = rows.slice(offset, offset + params.limit);
  const nextOffset = offset + sliced.length;
  const hasMore = nextOffset < totalCount;
  const nextCursor = hasMore ? encodeCursor({ offset: nextOffset }) : null;

  return c.json({
    items: sliced,
    nextCursor,
    hasMore,
    totalCount,
  });
});

// IMPORTANTE: registrado antes de "/:id" para não ser interpretado como UUID
expensesRoutes.get("/export.csv", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const parsed = expensesQuerySchema.safeParse({
    ...c.req.query(),
    limit: "100",
  });
  if (!parsed.success) {
    return c.json(
      { ok: false, error: "Parâmetros inválidos para exportação." },
      400
    );
  }

  const { rows, error } = await queryFilteredExpenses(
    supabase,
    user.id,
    parsed.data
  );
  if (error) {
    console.error("[Gastô Export CSV Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível exportar suas despesas." },
      500
    );
  }

  const header = [
    "Data",
    "Estabelecimento",
    "Categoria",
    "Tipo",
    "Valor (BRL)",
    "Status",
    "Origem",
    "Observação",
  ].join(";");

  const lines = rows.map((row) => {
    const tipo = row.amount_cents < 0 ? "Despesa" : "Entrada";
    const statusLabel =
      row.status === "confirmed" ? "Confirmado" : "Revisão pendente";
    const originLabel =
      row.source === "image"
        ? "Comprovante"
        : row.source === "text"
        ? "Texto IA"
        : "Manual";

    return [
      escapeCsvCell(formatIsoToDateBR(row.expense_date)),
      escapeCsvCell(row.merchant ?? ""),
      escapeCsvCell(row.category),
      escapeCsvCell(tipo),
      escapeCsvCell(formatCentavosToBRL(row.amount_cents)),
      escapeCsvCell(statusLabel),
      escapeCsvCell(originLabel),
      escapeCsvCell(row.note ?? ""),
    ].join(";");
  });

  const csvBody = `\uFEFF${[header, ...lines].join("\r\n")}`;
  const today = getTodaySaoPaulo();

  return new Response(csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gasto-despesas-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

// Grava despesa revisada vinda do pipeline de IA (Etapa 5) e aprende correção de categoria
expensesRoutes.post("/confirm", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const body = await c.req.json().catch(() => null);
  const parsed = confirmExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Dados de confirmação inválidos.",
      },
      400
    );
  }

  const {
    merchant,
    amountCents,
    expenseDate,
    category,
    note,
    source,
    imageId,
    suggestedCategory,
    confidenceJson,
  } = parsed.data;

  if (imageId) {
    const { data: ownedImage, error: imgErr } = await supabase
      .from("images")
      .select("id")
      .eq("id", imageId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (imgErr || !ownedImage) {
      return c.json(
        { ok: false, error: "Imagem do comprovante não encontrada." },
        404
      );
    }
  }

  const merchantNorm = normalizeMerchant(merchant);
  const dedupeHash = await sha256Hex(
    `${merchantNorm}|${amountCents}|${expenseDate}`
  );

  const { data: inserted, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      merchant,
      amount_cents: amountCents,
      expense_date: expenseDate,
      category,
      note: note || null,
      source,
      status: "confirmed",
      image_id: imageId,
      confidence_json: confidenceJson,
      dedupe_hash: dedupeHash,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    console.error("[Gastô Confirm Expense Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível confirmar e salvar a despesa." },
      500
    );
  }

  // Se o usuário corrigiu a categoria sugerida pela IA, grava regra para próximas leituras
  if (merchantNorm && suggestedCategory && suggestedCategory !== category) {
    const { error: ruleErr } = await supabase.from("merchant_rules").upsert(
      {
        user_id: user.id,
        merchant_norm: merchantNorm,
        category,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,merchant_norm" }
    );
    if (ruleErr) {
      console.error("[Gastô Merchant Rule Learn Error]", ruleErr);
    }
  }

  return c.json({ item: inserted }, 201);
});

expensesRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const idCheck = uuidSchema.safeParse(c.req.param("id"));
  if (!idCheck.success) {
    return c.json({ ok: false, error: "ID de lançamento inválido." }, 400);
  }

  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", idCheck.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[Gastô Get Expense Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível carregar os detalhes do lançamento." },
      500
    );
  }

  if (!data) {
    return c.json({ ok: false, error: "Lançamento não encontrado." }, 404);
  }

  return c.json({ item: data });
});

expensesRoutes.post("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const body = await c.req.json().catch(() => null);
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Dados do lançamento inválidos.",
      },
      400
    );
  }

  const { merchant, amountCents, expenseDate, note, source } = parsed.data;
  let { category, status } = parsed.data;
  let confidenceJson: { confidence?: number; rationale?: string } | null = null;

  const merchantNorm = normalizeMerchant(merchant);
  if (status === "needs_review" && merchantNorm) {
    const { data: rule } = await supabase
      .from("merchant_rules")
      .select("category")
      .eq("user_id", user.id)
      .eq("merchant_norm", merchantNorm)
      .maybeSingle();

    if (rule && rule.category) {
      category = rule.category as ExpenseCategoryDB;
      status = "confirmed";
      confidenceJson = {
        confidence: 99,
        rationale: "Classificado pela regra aprendida deste estabelecimento.",
      };
    }
  }

  const dedupeHash = await sha256Hex(
    `${merchantNorm}|${amountCents}|${expenseDate}`
  );

  const { data: inserted, error } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      merchant,
      amount_cents: amountCents,
      expense_date: expenseDate,
      category,
      note: note || null,
      source,
      status,
      confidence_json: confidenceJson,
      dedupe_hash: dedupeHash,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    console.error("[Gastô Create Expense Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível salvar o lançamento no banco." },
      500
    );
  }

  return c.json({ item: inserted }, 201);
});

expensesRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const idCheck = uuidSchema.safeParse(c.req.param("id"));
  if (!idCheck.success) {
    return c.json({ ok: false, error: "ID de lançamento inválido." }, 400);
  }
  const id = idCheck.data;

  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const body = await c.req.json().catch(() => null);
  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Dados de atualização inválidos.",
      },
      400
    );
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[Gastô Fetch For Patch Error]", fetchErr);
    return c.json(
      { ok: false, error: "Não foi possível atualizar o lançamento." },
      500
    );
  }
  if (!existing) {
    return c.json({ ok: false, error: "Lançamento não encontrado." }, 404);
  }

  const current = existing as ExpenseRow;
  const nextMerchant =
    parsed.data.merchant !== undefined
      ? parsed.data.merchant
      : current.merchant ?? "";
  const nextAmountCents =
    parsed.data.amountCents !== undefined
      ? parsed.data.amountCents
      : current.amount_cents;
  const nextDate =
    parsed.data.expenseDate !== undefined
      ? parsed.data.expenseDate
      : current.expense_date;

  const dedupeHash = await sha256Hex(
    `${normalizeMerchant(nextMerchant)}|${nextAmountCents}|${nextDate}`
  );

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    dedupe_hash: dedupeHash,
  };
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.merchant !== undefined) updates.merchant = parsed.data.merchant;
  if (parsed.data.note !== undefined) updates.note = parsed.data.note || null;
  if (parsed.data.expenseDate !== undefined) {
    updates.expense_date = parsed.data.expenseDate;
  }
  if (parsed.data.amountCents !== undefined) {
    updates.amount_cents = parsed.data.amountCents;
  }

  const { data: updated, error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    console.error("[Gastô Patch Expense Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível atualizar o lançamento." },
      500
    );
  }

  const row = updated as ExpenseRow;
  if (parsed.data.category && row.merchant) {
    const merchantNorm = normalizeMerchant(row.merchant);
    if (merchantNorm) {
      await supabase.from("merchant_rules").upsert(
        {
          user_id: user.id,
          merchant_norm: merchantNorm,
          category: parsed.data.category,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,merchant_norm" }
      );
    }
  }

  return c.json({ item: row });
});

expensesRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const idCheck = uuidSchema.safeParse(c.req.param("id"));
  if (!idCheck.success) {
    return c.json({ ok: false, error: "ID de lançamento inválido." }, 400);
  }

  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", idCheck.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[Gastô Delete Expense Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível excluir o lançamento." },
      500
    );
  }

  if (!data) {
    return c.json({ ok: false, error: "Lançamento não encontrado." }, 404);
  }

  return c.json({ ok: true });
});
