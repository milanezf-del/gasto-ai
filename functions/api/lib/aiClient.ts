import type { Ai } from "@cloudflare/workers-types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTodaySaoPaulo } from "./dates";

// Modelos centralizados para facilitar futuras trocas
export const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
export const TEXT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
export const AI_TIMEOUT_MS = 25_000;

export const AI_DAILY_USER_LIMIT = 40;
export const AI_TOTAL_LIMIT = 300;

export class AiLimitError extends Error {
  code = "AI_LIMIT" as const;
  status = 429 as const;

  constructor(
    message = "Limite diário de IA atingido. Você pode lançar a despesa manualmente ou tentar amanhã."
  ) {
    super(message);
    this.name = "AiLimitError";
  }
}

export class AiTimeoutError extends Error {
  constructor(message = "Tempo limite excedido ao consultar a IA.") {
    super(message);
    this.name = "AiTimeoutError";
  }
}

export function isAiQuotaError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : typeof err === "string"
      ? err.toLowerCase()
      : "";
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("daily limit") ||
    msg.includes("limit exceeded") ||
    msg.includes("too many requests") ||
    msg.includes("neuron")
  );
}

function isLicenseAgreementError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : typeof err === "string"
      ? err.toLowerCase()
      : "";
  return (
    msg.includes("agree") ||
    msg.includes("license") ||
    msg.includes("licence") ||
    msg.includes("accept the") ||
    msg.includes("terms")
  );
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = AI_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AiTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export async function checkAiQuota(
  supabase: SupabaseClient,
  userId: string
): Promise<{ dailyCount: number; totalCount: number }> {
  const today = getTodaySaoPaulo();
  const { data, error } = await supabase
    .from("ai_usage")
    .select("day, count")
    .eq("user_id", userId);

  if (error) {
    console.error("[Gastô AI Quota Check Error]", error);
    return { dailyCount: 0, totalCount: 0 };
  }

  let dailyCount = 0;
  let totalCount = 0;
  for (const row of (data ?? []) as Array<{ day: string; count: number }>) {
    const c = Number(row.count ?? 0);
    totalCount += c;
    if (row.day === today) {
      dailyCount += c;
    }
  }

  if (dailyCount >= AI_DAILY_USER_LIMIT || totalCount >= AI_TOTAL_LIMIT) {
    throw new AiLimitError();
  }

  return { dailyCount, totalCount };
}

export async function incrementAiUsage(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const today = getTodaySaoPaulo();
  const { data: existing } = await supabase
    .from("ai_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();

  const nextCount =
    Number((existing as { count?: number } | null)?.count ?? 0) + 1;

  const { error } = await supabase.from("ai_usage").upsert(
    {
      user_id: userId,
      day: today,
      count: nextCount,
    },
    { onConflict: "user_id,day" }
  );

  if (error) {
    console.error("[Gastô AI Usage Increment Error]", error);
  }
}

export async function runTextModel(
  ai: Ai,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    jsonSchema?: Record<string, unknown>;
    maxTokens?: number;
  }
): Promise<string> {
  const basePayload: Record<string, unknown> = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: options?.maxTokens ?? 700,
    temperature: 0.1,
  };

  if (options?.jsonSchema) {
    try {
      const structured = (await withTimeout(
        ai.run(TEXT_MODEL as never, {
          ...basePayload,
          response_format: {
            type: "json_schema",
            json_schema: options.jsonSchema,
          },
        } as never)
      )) as { response?: unknown };
      if (structured?.response !== undefined) {
        return typeof structured.response === "string"
          ? structured.response.trim()
          : JSON.stringify(structured.response);
      }
    } catch (err) {
      if (isAiQuotaError(err)) throw new AiLimitError();
      if (err instanceof AiTimeoutError) throw err;
      // Fallback sem response_format caso o modelo/runtime rejeite json_schema
    }
  }

  try {
    const output = (await withTimeout(
      ai.run(TEXT_MODEL as never, basePayload as never)
    )) as { response?: unknown };
    return typeof output?.response === "string"
      ? output.response.trim()
      : output?.response !== undefined
      ? JSON.stringify(output.response)
      : "";
  } catch (err) {
    if (isAiQuotaError(err)) throw new AiLimitError();
    throw err;
  }
}

async function invokeVisionOnce(
  ai: Ai,
  payload: Record<string, unknown>
): Promise<string> {
  const output = (await withTimeout(
    ai.run(VISION_MODEL as never, payload as never)
  )) as { response?: unknown };
  if (typeof output?.response === "string") {
    return output.response.trim();
  }
  if (output?.response !== undefined) {
    return JSON.stringify(output.response);
  }
  return "";
}

export async function runVisionModel(
  ai: Ai,
  systemPrompt: string,
  userPrompt: string,
  imageBytes: Uint8Array,
  mime: string,
  jsonSchema?: Record<string, unknown>
): Promise<string> {
  const base64 = uint8ToBase64(imageBytes);
  const dataUri = `data:${mime};base64,${base64}`;

  const multimodalPayload: Record<string, unknown> = {
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      },
    ],
    max_tokens: 800,
    temperature: 0.1,
  };

  const runWithLicenseRetry = async (payload: Record<string, unknown>) => {
    try {
      return await invokeVisionOnce(ai, payload);
    } catch (err) {
      if (isAiQuotaError(err)) throw new AiLimitError();
      if (err instanceof AiTimeoutError) throw err;
      if (isLicenseAgreementError(err)) {
        // Aceite único da licença Meta Llama 3.2 Vision conforme documentação Workers AI
        await withTimeout(
          ai.run(VISION_MODEL as never, { prompt: "agree" } as never),
          15_000
        );
        return await invokeVisionOnce(ai, payload);
      }
      throw err;
    }
  };

  if (jsonSchema) {
    try {
      return await runWithLicenseRetry({
        ...multimodalPayload,
        response_format: {
          type: "json_schema",
          json_schema: jsonSchema,
        },
      });
    } catch (err) {
      if (err instanceof AiLimitError || err instanceof AiTimeoutError) {
        throw err;
      }
      if (isAiQuotaError(err)) throw new AiLimitError();
      // Tenta sem response_format
    }
  }

  try {
    return await runWithLicenseRetry(multimodalPayload);
  } catch (err) {
    if (err instanceof AiLimitError || err instanceof AiTimeoutError) {
      throw err;
    }
    if (isAiQuotaError(err)) throw new AiLimitError();
    // Fallback para formato prompt + image byte array suportado em versões antigas do Workers AI
    const legacyPayload: Record<string, unknown> = {
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      image: Array.from(imageBytes),
      max_tokens: 800,
    };
    try {
      return await runWithLicenseRetry(legacyPayload);
    } catch (legacyErr) {
      if (isAiQuotaError(legacyErr)) throw new AiLimitError();
      throw legacyErr;
    }
  }
}

export function parseTolerantAiJson(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;
  const withoutFences = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const candidate = withoutFences.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // Tenta remover vírgulas sobrando antes de } ou ]
    try {
      const cleaned = candidate.replace(/,\s*([}\]])/g, "$1");
      const parsed = JSON.parse(cleaned) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function uint8ToPgByteaHex(bytes: Uint8Array): string {
  let hex = "\\x";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function pgByteaToUint8(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (typeof value !== "string" || !value) return null;

  if (value.startsWith("\\x") || value.startsWith("\\X")) {
    const hex = value.slice(2);
    if (hex.length % 2 !== 0) return null;
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
      const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      if (Number.isNaN(byte)) return null;
      out[i] = byte;
    }
    return out;
  }

  try {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}
