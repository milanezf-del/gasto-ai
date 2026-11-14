import { Hono } from "hono";
import { z } from "zod";
import type { ApiAppEnv } from "./types";
import { requireAuth } from "./middleware/auth";
import {
  createUserSupabaseClient,
  normalizeMerchant,
  type ExpenseCategoryDB,
  type ExpenseRow,
  type MerchantRuleRow,
} from "./lib/supabase";
import { getTodaySaoPaulo, resolveRelativeDateBR } from "./lib/dates";
import { parseBRLToCentavos } from "./lib/money";
import { sha256Hex } from "./lib/ids";
import {
  AiLimitError,
  AiTimeoutError,
  checkAiQuota,
  incrementAiUsage,
  isAiQuotaError,
  parseTolerantAiJson,
  runTextModel,
  runVisionModel,
  uint8ToPgByteaHex,
} from "./lib/aiClient";
import { aiCategorizeSchema, CATEGORIES, parseTextSchema } from "./schemas";

export const aiStage5Routes = new Hono<ApiAppEnv>();

aiStage5Routes.use("*", requireAuth);

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_REQUEST = 5;

const rawAiDraftSchema = z.object({
  merchant: z.string().nullable().optional(),
  amount: z.union([z.number(), z.string()]).nullable().optional(),
  expense_date: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  confidence: z
    .object({
      merchant: z.number().min(0).max(1).optional(),
      amount: z.number().min(0).max(1).optional(),
      expense_date: z.number().min(0).max(1).optional(),
      category: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: ["string", "null"] },
    amount: { type: ["number", "string", "null"] },
    expense_date: { type: ["string", "null"] },
    category: {
      type: "string",
      enum: ["Alimentação", "Transporte", "Educação", "Lazer", "Outros"],
    },
    note: { type: ["string", "null"] },
    confidence: {
      type: "object",
      properties: {
        merchant: { type: "number" },
        amount: { type: "number" },
        expense_date: { type: "number" },
        category: { type: "number" },
      },
      required: ["merchant", "amount", "expense_date", "category"],
    },
  },
  required: ["merchant", "amount", "expense_date", "category", "confidence"],
};

function clampConfidence(val: unknown, fallback: number): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  if (val > 1 && val <= 100) return Number((val / 100).toFixed(2));
  return Number(Math.min(1, Math.max(0, val)).toFixed(2));
}

export interface ParsedExpenseDraft {
  draftId: string;
  source: "image" | "text";
  imageId: string | null;
  imageUrl: string | null;
  merchant: string;
  amountCents: number | null;
  expenseDate: string | null;
  category: ExpenseCategoryDB;
  suggestedCategory: ExpenseCategoryDB;
  note: string;
  status: "confirmed" | "needs_review";
  ruleApplied: boolean;
  confidence: {
    merchant: number;
    amount: number;
    expense_date: number;
    category: number;
  };
  duplicateOf: {
    id: string;
    merchant: string | null;
    amount_cents: number;
    expense_date: string;
    category: ExpenseCategoryDB;
  } | null;
}

async function buildParsedDraft(params: {
  rawJson: Record<string, unknown> | null;
  userId: string;
  supabase: ReturnType<typeof createUserSupabaseClient>;
  source: "image" | "text";
  imageId: string | null;
  todayIso: string;
}): Promise<ParsedExpenseDraft> {
  const validated = rawAiDraftSchema.safeParse(params.rawJson ?? {});
  const data = validated.success ? validated.data : {};

  const merchant = (data.merchant ?? "").trim().slice(0, 120);
  let confMerchant = clampConfidence(data.confidence?.merchant, merchant ? 0.85 : 0.3);
  if (!merchant) confMerchant = Math.min(confMerchant, 0.3);

  let amountCents: number | null = null;
  if (data.amount !== undefined && data.amount !== null) {
    const parsedCents = parseBRLToCentavos(data.amount);
    if (parsedCents !== null && parsedCents !== 0) {
      amountCents = -Math.abs(parsedCents);
    }
  }
  let confAmount = clampConfidence(
    data.confidence?.amount,
    amountCents !== null ? 0.85 : 0.25
  );
  if (amountCents === null) confAmount = Math.min(confAmount, 0.25);

  let expenseDate: string | null = null;
  let confDate = clampConfidence(data.confidence?.expense_date, 0.8);
  if (typeof data.expense_date === "string" && data.expense_date.trim()) {
    const resolved = resolveRelativeDateBR(data.expense_date, params.todayIso);
    // Data inválida ou futura -> null + baixa confiança
    if (resolved && resolved <= params.todayIso) {
      expenseDate = resolved;
    } else {
      expenseDate = null;
      confDate = Math.min(confDate, 0.35);
    }
  } else {
    expenseDate = null;
    confDate = Math.min(confDate, 0.35);
  }

  const rawCategory = (data.category ?? "").trim();
  let category: ExpenseCategoryDB = (CATEGORIES as readonly string[]).includes(
    rawCategory
  )
    ? (rawCategory as ExpenseCategoryDB)
    : "Outros";
  let confCategory = clampConfidence(
    data.confidence?.category,
    (CATEGORIES as readonly string[]).includes(rawCategory) ? 0.82 : 0.55
  );
  if (!(CATEGORIES as readonly string[]).includes(rawCategory)) {
    confCategory = Math.min(confCategory, 0.6);
  }

  const suggestedCategory: ExpenseCategoryDB = category;
  let ruleApplied = false;
  const merchantNorm = normalizeMerchant(merchant);

  if (merchantNorm) {
    const { data: rule } = await params.supabase
      .from("merchant_rules")
      .select("category")
      .eq("user_id", params.userId)
      .eq("merchant_norm", merchantNorm)
      .maybeSingle();

    if (rule && (rule as { category?: string }).category) {
      category = (rule as { category: ExpenseCategoryDB }).category;
      ruleApplied = true;
      confCategory = 0.99;
    }
  }

  let duplicateOf: ParsedExpenseDraft["duplicateOf"] = null;
  if (merchantNorm && amountCents !== null && expenseDate) {
    const dedupeHash = await sha256Hex(
      `${merchantNorm}|${amountCents}|${expenseDate}`
    );
    const { data: existingDup } = await params.supabase
      .from("expenses")
      .select("id, merchant, amount_cents, expense_date, category")
      .eq("user_id", params.userId)
      .eq("dedupe_hash", dedupeHash)
      .limit(1)
      .maybeSingle();

    if (existingDup) {
      duplicateOf = existingDup as ParsedExpenseDraft["duplicateOf"];
    }
  }

  const minConf = Math.min(confMerchant, confAmount, confDate, confCategory);
  const status: "confirmed" | "needs_review" =
    minConf < 0.8 || !merchant || amountCents === null || !expenseDate
      ? "needs_review"
      : "confirmed";

  return {
    draftId: crypto.randomUUID(),
    source: params.source,
    imageId: params.imageId,
    imageUrl: params.imageId ? `/api/images/${params.imageId}` : null,
    merchant,
    amountCents,
    expenseDate,
    category,
    suggestedCategory,
    note: (data.note ?? "").trim().slice(0, 240),
    status,
    ruleApplied,
    confidence: {
      merchant: confMerchant,
      amount: confAmount,
      expense_date: confDate,
      category: confCategory,
    },
    duplicateOf,
  };
}

aiStage5Routes.post("/parse-image", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json(
      { ok: false, error: "Envie de 1 a 5 imagens no formato multipart/form-data." },
      400
    );
  }

  const files: File[] = [];
  for (const fieldName of ["images", "image", "files", "file"]) {
    const entries = formData.getAll(fieldName);
    for (const entry of entries) {
      if (entry instanceof File && entry.size > 0) {
        files.push(entry);
      }
    }
  }

  if (files.length === 0) {
    return c.json(
      { ok: false, error: "Selecione ao menos 1 imagem para leitura." },
      400
    );
  }
  if (files.length > MAX_IMAGES_PER_REQUEST) {
    return c.json(
      {
        ok: false,
        error: `Envie no máximo ${MAX_IMAGES_PER_REQUEST} imagens por vez.`,
      },
      400
    );
  }

  for (const file of files) {
    if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
      return c.json(
        {
          ok: false,
          error: "Formato não suportado. Use imagens JPEG, PNG ou WebP.",
        },
        400
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return c.json(
        {
          ok: false,
          error: "Cada imagem deve ter no máximo 5 MB.",
        },
        400
      );
    }
  }

  try {
    await checkAiQuota(supabase, user.id);
  } catch (err) {
    if (err instanceof AiLimitError) {
      return c.json(
        { ok: false, code: err.code, message: err.message, error: err.message },
        429
      );
    }
  }

  if (!c.env.AI) {
    return c.json(
      {
        ok: false,
        code: "AI_UNAVAILABLE",
        message:
          "Leitura automática por IA requer o binding Workers AI ativo no Cloudflare Pages. Use o lançamento manual.",
        error:
          "Leitura automática por IA requer o binding Workers AI ativo no Cloudflare Pages. Use o lançamento manual.",
      },
      503
    );
  }

  const todayIso = getTodaySaoPaulo();
  const systemPrompt = [
    "Você é um extrator financeiro rigoroso para comprovantes e notas fiscais do Brasil (pt-BR).",
    `Data de hoje em America/Sao_Paulo: ${todayIso}.`,
    "Regras obrigatórias:",
    "- Valores brasileiros usam formato 1.234,56 (vírgula decimal). Extraia APENAS o VALOR TOTAL PAGO (nunca subtotal ou soma parcial de itens).",
    "- Comprovantes PIX, transferências, cupons fiscais e recibos de maquininha de cartão são válidos.",
    "- Data da compra deve estar em YYYY-MM-DD (nunca futura).",
    `- Categoria DEVE ser exatamente uma destas 5 opções: ${CATEGORIES.join(", ")}.`,
    "- Atribua confiança de 0 a 1 (ex.: 0.92) para merchant, amount, expense_date e category.",
    "- Responda SOMENTE JSON válido, sem markdown e sem texto fora do JSON.",
  ].join("\n");

  const results: Array<
    | { ok: true; fileName: string; draft: ParsedExpenseDraft }
    | { ok: false; fileName: string; imageId: string | null; imageUrl: string | null; error: string }
  > = [];

  for (const file of files) {
    try {
      await checkAiQuota(supabase, user.id);
    } catch (err) {
      if (err instanceof AiLimitError) {
        return c.json(
          {
            ok: false,
            code: err.code,
            message: err.message,
            error: err.message,
            results,
          },
          429
        );
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { data: savedImg, error: imgErr } = await supabase
      .from("images")
      .insert({
        user_id: user.id,
        mime: file.type,
        data: uint8ToPgByteaHex(bytes),
        size: bytes.byteLength,
      })
      .select("id")
      .single();

    if (imgErr || !savedImg) {
      console.error("[Gastô Save Image Error]", imgErr);
      results.push({
        ok: false,
        fileName: file.name,
        imageId: null,
        imageUrl: null,
        error: "Não foi possível armazenar a imagem enviada.",
      });
      continue;
    }

    const imageId = (savedImg as { id: string }).id;

    try {
      const rawReply = await runVisionModel(
        c.env.AI,
        systemPrompt,
        "Extraia os dados do pagamento desta imagem e responda apenas em JSON.",
        bytes,
        file.type,
        EXTRACTION_JSON_SCHEMA
      );
      await incrementAiUsage(supabase, user.id);

      const parsedJson = parseTolerantAiJson(rawReply);
      if (!parsedJson) {
        results.push({
          ok: false,
          fileName: file.name,
          imageId,
          imageUrl: `/api/images/${imageId}`,
          error: "Não consegui ler a imagem, tente outra foto.",
        });
        continue;
      }

      const draft = await buildParsedDraft({
        rawJson: parsedJson,
        userId: user.id,
        supabase,
        source: "image",
        imageId,
        todayIso,
      });

      results.push({ ok: true, fileName: file.name, draft });
    } catch (err) {
      if (err instanceof AiLimitError || isAiQuotaError(err)) {
        const limitErr = new AiLimitError();
        return c.json(
          {
            ok: false,
            code: limitErr.code,
            message: limitErr.message,
            error: limitErr.message,
            results,
          },
          429
        );
      }

      console.error("[Gastô Vision Parse Error]", err);
      const friendly =
        err instanceof AiTimeoutError
          ? "A leitura demorou mais que o esperado. Tente outra foto mais nítida."
          : "Não consegui ler a imagem, tente outra foto.";
      results.push({
        ok: false,
        fileName: file.name,
        imageId,
        imageUrl: `/api/images/${imageId}`,
        error: friendly,
      });
    }
  }

  return c.json({ results });
});

aiStage5Routes.post("/parse-text", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const body = await c.req.json().catch(() => null);
  const parsed = parseTextSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Texto inválido.",
      },
      400
    );
  }

  try {
    await checkAiQuota(supabase, user.id);
  } catch (err) {
    if (err instanceof AiLimitError) {
      return c.json(
        { ok: false, code: err.code, message: err.message, error: err.message },
        429
      );
    }
  }

  if (!c.env.AI) {
    return c.json(
      {
        ok: false,
        code: "AI_UNAVAILABLE",
        message:
          "O parser inteligente requer Cloudflare Workers AI ativo. Você pode preencher o lançamento manualmente.",
        error:
          "O parser inteligente requer Cloudflare Workers AI ativo. Você pode preencher o lançamento manualmente.",
      },
      503
    );
  }

  const todayIso = getTodaySaoPaulo();
  const systemPrompt = [
    "Você converte descrições curtas de gastos em português do Brasil para JSON estruturado.",
    `Data de hoje em America/Sao_Paulo: ${todayIso}.`,
    'Resolva expressões como "hoje", "ontem", "anteontem" e "dd/mm" para YYYY-MM-DD usando a data de hoje como referência.',
    "Valores brasileiros como '23,50', '38 reais' ou '1.234,56' devem virar número decimal positivo em reais.",
    `Categoria DEVE ser exatamente uma destas 5 opções: ${CATEGORIES.join(", ")}.`,
    "Retorne confiança de 0 a 1 para merchant, amount, expense_date e category.",
    "Responda SOMENTE JSON válido, sem texto extra.",
  ].join("\n");

  try {
    const rawReply = await runTextModel(
      c.env.AI,
      systemPrompt,
      `Despesa informada pelo usuário: "${parsed.data.text}"`,
      { jsonSchema: EXTRACTION_JSON_SCHEMA, maxTokens: 450 }
    );
    await incrementAiUsage(supabase, user.id);

    const parsedJson = parseTolerantAiJson(rawReply);
    if (!parsedJson) {
      return c.json(
        {
          ok: false,
          error:
            "Não consegui interpretar esse texto. Tente no formato 'Uber 23,50 ontem' ou lance manualmente.",
        },
        422
      );
    }

    const draft = await buildParsedDraft({
      rawJson: parsedJson,
      userId: user.id,
      supabase,
      source: "text",
      imageId: null,
      todayIso,
    });

    return c.json({ draft });
  } catch (err) {
    if (err instanceof AiLimitError || isAiQuotaError(err)) {
      const limitErr = new AiLimitError();
      return c.json(
        {
          ok: false,
          code: limitErr.code,
          message: limitErr.message,
          error: limitErr.message,
        },
        429
      );
    }

    console.error("[Gastô Parse Text Error]", err);
    return c.json(
      {
        ok: false,
        error:
          err instanceof AiTimeoutError
            ? "Tempo limite excedido ao interpretar o texto. Tente novamente ou lance manualmente."
            : "Não foi possível interpretar a descrição. Você pode preencher manualmente.",
      },
      502
    );
  }
});

aiStage5Routes.post("/categorize", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const body = await c.req.json().catch(() => null);
  const parsed = aiCategorizeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Lista de lançamentos inválida.",
      },
      400
    );
  }

  const [{ data: targetExpenses, error: expErr }, { data: rulesData }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .in("id", parsed.data.ids),
      supabase.from("merchant_rules").select("*").eq("user_id", user.id),
    ]);

  if (expErr) {
    console.error("[Gastô Categorize Fetch Error]", expErr);
    return c.json(
      { ok: false, error: "Não foi possível consultar os lançamentos." },
      500
    );
  }

  const ruleMap = new Map<string, ExpenseCategoryDB>();
  for (const r of (rulesData ?? []) as MerchantRuleRow[]) {
    ruleMap.set(r.merchant_norm, r.category);
  }

  const results: Array<{
    id: string;
    category: ExpenseCategoryDB;
    confidence: number;
    rationale: string;
  }> = [];

  const needsAi: ExpenseRow[] = [];

  for (const tx of (targetExpenses ?? []) as ExpenseRow[]) {
    const norm = tx.merchant ? normalizeMerchant(tx.merchant) : "";
    const matchedRule = norm ? ruleMap.get(norm) : undefined;
    if (matchedRule) {
      results.push({
        id: tx.id,
        category: matchedRule,
        confidence: 99,
        rationale: "Regra aprendida pelo histórico do usuário.",
      });
    } else {
      needsAi.push(tx);
    }
  }

  if (needsAi.length > 0) {
    try {
      await checkAiQuota(supabase, user.id);
    } catch (err) {
      if (err instanceof AiLimitError) {
        return c.json(
          { ok: false, code: err.code, message: err.message, error: err.message },
          429
        );
      }
    }

    if (!c.env.AI) {
      return c.json(
        {
          ok: false,
          error:
            "Binding AI (Cloudflare Workers AI) indisponível neste ambiente para classificar itens inéditos.",
        },
        503
      );
    }

    try {
      const raw = await runTextModel(
        c.env.AI,
        `Classifique cada lançamento em uma das categorias permitidas: ${CATEGORIES.join(", ")}. Responda APENAS JSON válido no formato {"results":[{"id":string,"category":string,"confidence":number,"rationale":string}]}.`,
        JSON.stringify(
          needsAi.map((t) => ({
            id: t.id,
            merchant: t.merchant,
            note: t.note,
            amount_cents: t.amount_cents,
          }))
        )
      );
      await incrementAiUsage(supabase, user.id);

      const parsedAi = parseTolerantAiJson(raw);
      const aiItems = Array.isArray(parsedAi?.results)
        ? (parsedAi.results as Array<Record<string, unknown>>)
        : [];

      for (const tx of needsAi) {
        const found = aiItems.find((r) => r.id === tx.id);
        const cat =
          found &&
          typeof found.category === "string" &&
          (CATEGORIES as readonly string[]).includes(found.category)
            ? (found.category as ExpenseCategoryDB)
            : "Outros";
        results.push({
          id: tx.id,
          category: cat,
          confidence:
            found && typeof found.confidence === "number"
              ? Math.min(99, Math.max(50, Math.round(found.confidence)))
              : 85,
          rationale:
            found && typeof found.rationale === "string"
              ? found.rationale
              : "Classificado via Cloudflare Workers AI.",
        });
      }
    } catch (err) {
      if (err instanceof AiLimitError || isAiQuotaError(err)) {
        const limitErr = new AiLimitError();
        return c.json(
          {
            ok: false,
            code: limitErr.code,
            message: limitErr.message,
            error: limitErr.message,
          },
          429
        );
      }
      console.error("[Gastô Categorize AI Error]", err);
      return c.json(
        { ok: false, error: "Falha ao classificar os lançamentos com IA." },
        502
      );
    }
  }

  for (const res of results) {
    await supabase
      .from("expenses")
      .update({
        category: res.category,
        status: "confirmed",
        confidence_json: {
          confidence: res.confidence,
          rationale: res.rationale,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", res.id)
      .eq("user_id", user.id);
  }

  return c.json({ results });
});
