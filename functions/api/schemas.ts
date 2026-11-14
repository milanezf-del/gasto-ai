import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida. Use o formato yyyy-mm-dd.");

export const centavosSchema = z
  .number()
  .int("O valor deve ser informado em centavos inteiros.")
  .refine((n) => Number.isSafeInteger(n), "Valor monetário fora do limite seguro.");

export const healthResponseSchema = z.object({
  ok: z.literal(true),
});
