import { z } from "zod";
import { ALL_CATEGORIES, EXPENSE_CATEGORIES } from "../utils/formatters";

export const transactionCategorySchema = z.enum(
  ALL_CATEGORIES as [string, ...string[]]
);

export const expenseCategorySchema = z.enum(
  EXPENSE_CATEGORIES as [string, ...string[]]
);

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida no formato yyyy-mm-dd.");

export const createExpenseSchema = z.object({
  merchant: z
    .string()
    .trim()
    .min(2, "Informe o nome do estabelecimento ou contraparte.")
    .max(120, "O nome do estabelecimento deve ter no máximo 120 caracteres."),
  description: z
    .string()
    .trim()
    .max(240, "A observação deve ter no máximo 240 caracteres.")
    .optional()
    .default(""),
  amountCents: z
    .number()
    .int("O valor deve ser um número inteiro em centavos.")
    .refine((v) => v !== 0, "O valor do lançamento não pode ser zero."),
  date: isoDateSchema,
  category: transactionCategorySchema,
  accountId: z.string().trim().min(1, "Selecione uma conta válida."),
  taxDeductible: z.boolean().optional().default(false),
  autoClassify: z.boolean().optional().default(false),
});

export const updateBudgetLimitSchema = z.object({
  category: expenseCategorySchema,
  monthlyLimitCents: z
    .number()
    .int("O limite deve ser um número inteiro em centavos.")
    .min(100, "O limite mensal deve ser de pelo menos R$ 1,00."),
});

export const transferAccountsSchema = z
  .object({
    fromAccountId: z.string().trim().min(1, "Selecione a conta de origem."),
    toAccountId: z.string().trim().min(1, "Selecione a conta de destino."),
    amountCents: z
      .number()
      .int("O valor deve estar em centavos inteiros.")
      .positive("Informe um valor maior que zero."),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "As contas de origem e destino devem ser diferentes.",
    path: ["toAccountId"],
  });

export const aiChatInputSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Digite uma pergunta antes de enviar.")
    .max(1000, "A pergunta deve ter no máximo 1.000 caracteres."),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type TransferAccountsInput = z.infer<typeof transferAccountsSchema>;
