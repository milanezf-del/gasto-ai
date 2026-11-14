import { z } from "zod";

export const CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Educação",
  "Lazer",
  "Outros",
] as const;

export const categorySchema = z.enum(CATEGORIES);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida. Use o formato yyyy-mm-dd.");

export const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido. Use o formato YYYY-MM.");

export const uuidSchema = z.string().uuid("ID de lançamento inválido.");

export const centavosSchema = z
  .number()
  .int("O valor deve ser informado em centavos inteiros.")
  .refine((n) => Number.isSafeInteger(n), "Valor monetário fora do limite seguro.");

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .transform((e) => e.toLowerCase()),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome (mínimo 2 caracteres).")
    .max(80, "O nome deve ter no máximo 80 caracteres."),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .transform((e) => e.toLowerCase()),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres.")
    .max(128, "Senha muito longa."),
});

export const createExpenseSchema = z.object({
  merchant: z
    .string()
    .trim()
    .min(2, "Informe o estabelecimento ou descrição principal.")
    .max(120, "O estabelecimento deve ter no máximo 120 caracteres."),
  amountCents: centavosSchema.refine(
    (v) => v !== 0,
    "O valor do lançamento não pode ser zero."
  ),
  expenseDate: isoDateSchema,
  category: categorySchema.default("Outros"),
  note: z.string().trim().max(240).optional().default(""),
  source: z.enum(["image", "text", "manual"]).optional().default("manual"),
  status: z.enum(["confirmed", "needs_review"]).optional().default("confirmed"),
});

export const updateExpenseSchema = z
  .object({
    category: categorySchema.optional(),
    status: z.enum(["confirmed", "needs_review"]).optional(),
    merchant: z.string().trim().min(1, "Informe o estabelecimento.").max(120).optional(),
    note: z.string().trim().max(240).optional(),
    expenseDate: isoDateSchema.optional(),
    amountCents: centavosSchema
      .refine((v) => v !== 0, "O valor não pode ser zero.")
      .optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

const optionalNonNegativeInt = z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : val),
  z.coerce
    .number()
    .int("O filtro de valor deve estar em centavos inteiros.")
    .min(0, "O valor mínimo de filtro não pode ser negativo.")
    .optional()
);

export const expensesQuerySchema = z.object({
  from: z.preprocess(
    (v) => (v === "" ? undefined : v),
    isoDateSchema.optional()
  ),
  to: z.preprocess(
    (v) => (v === "" ? undefined : v),
    isoDateSchema.optional()
  ),
  category: z.preprocess(
    (v) => (v === "" || v === "all" ? undefined : v),
    categorySchema.optional()
  ),
  q: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : undefined),
    z.string().max(120).optional()
  ),
  search: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : undefined),
    z.string().max(120).optional()
  ),
  min: optionalNonNegativeInt,
  max: optionalNonNegativeInt,
  status: z.preprocess(
    (v) => (v === "" || v === "all" ? undefined : v),
    z.enum(["confirmed", "needs_review"]).optional()
  ),
  sort: z.preprocess(
    (v) => (v === "" || v === undefined ? "date_desc" : v),
    z.enum(["date_desc", "date_asc", "amount_desc", "amount_asc"])
  ),
  limit: z.preprocess(
    (v) => (v === "" || v === undefined ? 30 : v),
    z.coerce.number().int().min(1).max(100)
  ),
  cursor: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().max(512).optional()
  ),
});

export const upsertBudgetSchema = z.object({
  category: categorySchema,
  limitCents: centavosSchema.refine(
    (v) => v >= 0,
    "O limite mensal não pode ser negativo."
  ),
  alertPercent: z.number().int().min(1).max(100).optional().default(80),
});

export const aiCategorizeSchema = z.object({
  ids: z
    .array(z.string().uuid("ID de lançamento inválido."))
    .min(1, "Informe ao menos um lançamento para classificar.")
    .max(30, "Limite de 30 lançamentos por lote."),
});

export const aiChatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Digite uma pergunta antes de enviar.")
    .max(1000, "A pergunta deve ter no máximo 1.000 caracteres."),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(1500),
      })
    )
    .max(12)
    .optional()
    .default([]),
});

export const parseTextSchema = z.object({
  text: z
    .string()
    .trim()
    .min(2, "Descreva a despesa (ex.: Uber 23,50 ontem).")
    .max(500, "O texto deve ter no máximo 500 caracteres."),
});

export const confirmExpenseSchema = z.object({
  merchant: z
    .string()
    .trim()
    .min(1, "Informe o estabelecimento.")
    .max(120, "O estabelecimento deve ter no máximo 120 caracteres."),
  amountCents: centavosSchema.refine(
    (v) => v !== 0,
    "O valor da despesa não pode ser zero."
  ),
  expenseDate: isoDateSchema,
  category: categorySchema,
  note: z.string().trim().max(240).optional().default(""),
  source: z.enum(["image", "text", "manual"]).optional().default("manual"),
  imageId: uuidSchema.nullable().optional().default(null),
  suggestedCategory: categorySchema.optional(),
  confidenceJson: z
    .object({
      confidence: z.number().min(0).max(100).optional(),
      rationale: z.string().max(300).optional(),
      fields: z
        .object({
          merchant: z.number().min(0).max(1).optional(),
          amount: z.number().min(0).max(1).optional(),
          expense_date: z.number().min(0).max(1).optional(),
          category: z.number().min(0).max(1).optional(),
        })
        .optional(),
    })
    .nullable()
    .optional()
    .default(null),
});

