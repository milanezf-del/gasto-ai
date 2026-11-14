import type { D1Database, D1Result } from "@cloudflare/workers-types";

export type ExpenseCategoryDB =
  | "Alimentação"
  | "Transporte"
  | "Educação"
  | "Lazer"
  | "Outros";

export type ExpenseSourceDB = "image" | "text" | "manual";
export type ExpenseStatusDB = "confirmed" | "needs_review";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

export interface SessionRow {
  id_hash: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface ImageRow {
  id: string;
  user_id: string;
  mime: string;
  data: ArrayBuffer | Uint8Array;
  size: number | null;
  created_at: string | null;
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
  confidence_json: string | null;
  image_id: string | null;
  dedupe_hash: string | null;
  created_at: string | null;
  updated_at: string | null;
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
  updated_at: string | null;
}

export interface AiUsageRow {
  user_id: string;
  day: string;
  count: number;
}

export interface LoginAttemptRow {
  key: string;
  attempted_at: string;
}

export interface BoundStatement {
  sql: string;
  params?: readonly unknown[];
}

export async function queryAll<T>(
  db: D1Database,
  sql: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();
  return result.results ?? [];
}

export async function queryFirst<T>(
  db: D1Database,
  sql: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const row = await bound.first<T>();
  return row ?? null;
}

export async function execute(
  db: D1Database,
  sql: string,
  params: readonly unknown[] = []
): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return bound.run();
}

export async function executeBatch(
  db: D1Database,
  statements: readonly BoundStatement[]
): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  const prepared = statements.map(({ sql, params = [] }) => {
    const stmt = db.prepare(sql);
    return params.length > 0 ? stmt.bind(...params) : stmt;
  });
  return db.batch(prepared);
}
