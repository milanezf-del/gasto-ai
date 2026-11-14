import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Bindings } from "../types";

export type ExpenseCategoryDB =
  | "Alimentação"
  | "Transporte"
  | "Educação"
  | "Lazer"
  | "Outros";

export type ExpenseSourceDB = "image" | "text" | "manual";
export type ExpenseStatusDB = "confirmed" | "needs_review";

export interface ProfileRow {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  user_id: string;
  merchant: string | null;
  amount_cents: number;
  expense_date: string;
  category: ExpenseCategoryDB;
  note: string | null;
  source: ExpenseSourceDB | null;
  status: ExpenseStatusDB;
  confidence_json: { confidence?: number; rationale?: string } | null;
  image_id: string | null;
  dedupe_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  user_id: string;
  category: ExpenseCategoryDB;
  limit_cents: number;
  alert_percent: number;
}

export interface MerchantRuleRow {
  user_id: string;
  merchant_norm: string;
  category: ExpenseCategoryDB;
  updated_at: string;
}

export interface AiUsageRow {
  user_id: string;
  day: string;
  count: number;
}

export function isSupabaseConfigured(env: Bindings): boolean {
  return Boolean(
    env.SUPABASE_URL &&
      env.SUPABASE_URL.startsWith("http") &&
      env.SUPABASE_ANON_KEY &&
      env.SUPABASE_ANON_KEY.length > 10
  );
}

export function createAnonSupabaseClient(env: Bindings): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createUserSupabaseClient(
  env: Bindings,
  accessToken: string
): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function normalizeMerchant(merchant: string): string {
  return merchant
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
