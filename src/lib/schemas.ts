import { z } from "zod";
import { EXPENSE_CATEGORIES } from "../utils/formatters";

export const expenseCategorySchema = z.enum(
  EXPENSE_CATEGORIES as [string, ...string[]]
);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida no formato yyyy-mm-dd.");

export const loginInputSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  turnstileToken: z.string().optional(),
});

export const signupInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome (mínimo 2 caracteres).")
    .max(80, "O nome deve ter no máximo 80 caracteres."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z
    .string()
    .min(6, "A senha deve ter pelo menos 6 caracteres.")
    .max(128, "A senha é muito longa."),
  turnstileToken: z.string().optional(),
});

export const createExpenseSchema = z.object({
  merchant: z
    .string()
    .trim()
    .min(2, "Informe o nome do estabelecimento ou descrição principal.")
    .max(120, "O estabelecimento deve ter no máximo 120 caracteres."),
  note: z
    .string()
    .trim()
    .max(240, "A observação deve ter no máximo 240 caracteres.")
    .optional()
    .default(""),
  amountCents: z
    .number()
    .int("O valor deve ser um número inteiro em centavos.")
    .refine((v) => v !== 0, "O valor do lançamento não pode ser zero."),
  expenseDate: isoDateSchema,
  category: expenseCategorySchema,
  source: z.enum(["image", "text", "manual"]).optional().default("manual"),
  status: z.enum(["confirmed", "needs_review"]).optional().default("confirmed"),
});

export const updateExpenseSchema = z.object({
  merchant: z
    .string()
    .trim()
    .min(1, "Informe o estabelecimento.")
    .max(120, "O estabelecimento deve ter no máximo 120 caracteres.")
    .optional(),
  note: z.string().trim().max(240).optional(),
  amountCents: z
    .number()
    .int("O valor deve estar em centavos inteiros.")
    .refine((v) => v !== 0, "O valor não pode ser zero.")
    .optional(),
  expenseDate: isoDateSchema.optional(),
  category: expenseCategorySchema.optional(),
  status: z.enum(["confirmed", "needs_review"]).optional(),
});

export const confirmExpenseInputSchema = z.object({
  merchant: z
    .string()
    .trim()
    .min(1, "Informe o estabelecimento.")
    .max(120, "O estabelecimento deve ter no máximo 120 caracteres."),
  amountCents: z
    .number()
    .int("O valor deve estar em centavos inteiros.")
    .refine((v) => v !== 0, "O valor não pode ser zero."),
  expenseDate: isoDateSchema,
  category: expenseCategorySchema,
  note: z.string().trim().max(240).optional().default(""),
  source: z.enum(["image", "text", "manual"]).optional().default("manual"),
  imageId: z.string().uuid().nullable().optional().default(null),
  suggestedCategory: expenseCategorySchema.optional(),
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

export const parseTextInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(2, "Descreva a despesa (ex.: Uber 23,50 ontem).")
    .max(500, "A descrição deve ter no máximo 500 caracteres."),
});

export const updateBudgetLimitSchema = z.object({
  category: expenseCategorySchema,
  limitCents: z
    .number()
    .int("O limite deve ser um número inteiro em centavos.")
    .min(0, "O limite mensal não pode ser negativo."),
  alertPercent: z.number().int().min(1).max(100).optional().default(80),
});

export const aiChatInputSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Digite uma pergunta antes de enviar.")
    .max(1000, "A pergunta deve ter no máximo 1.000 caracteres."),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type SignupInput = z.infer<typeof signupInputSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ConfirmExpenseInput = z.infer<typeof confirmExpenseInputSchema>;
