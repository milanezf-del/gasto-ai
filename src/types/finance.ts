export type WorkspaceView = "overview" | "transactions" | "budgets" | "rules";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type ExpenseCategory =
  | "Alimentação"
  | "Transporte"
  | "Educação"
  | "Lazer"
  | "Outros";

export type ExpenseSource = "image" | "text" | "manual";
export type ExpenseStatus = "confirmed" | "needs_review";

export interface ExpenseConfidence {
  confidence?: number;
  rationale?: string;
  fields?: {
    merchant?: number;
    amount?: number;
    expense_date?: number;
    category?: number;
  };
}

export interface ExpenseItem {
  id: string;
  merchant: string | null;
  amount_cents: number; // positivo = entrada, negativo = saída (inteiro em centavos)
  expense_date: string; // ISO yyyy-mm-dd
  category: ExpenseCategory;
  note: string | null;
  source: ExpenseSource | null;
  status: ExpenseStatus;
  confidence_json: ExpenseConfidence | null;
  image_id?: string | null;
  dedupe_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseListFilters {
  from?: string;
  to?: string;
  category?: string;
  q?: string;
  minCents?: number;
  maxCents?: number;
  status?: "all" | "confirmed" | "needs_review";
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  limit?: number;
  cursor?: string | null;
}

export interface ExpenseListResponse {
  items: ExpenseItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

export interface BudgetEnvelope {
  category: ExpenseCategory;
  limitCents: number;
  alertPercent: number;
  spentCents: number;
  remainingCents?: number;
  usagePct?: number;
  status?: "ok" | "alert" | "exceeded" | "unconfigured";
  configured: boolean;
}

export interface MerchantRuleItem {
  merchant_norm: string;
  category: ExpenseCategory;
  updated_at: string;
}

export interface DailySeriesPoint {
  date: string;
  day: number;
  label: string;
  spentCents: number;
  inflowCents: number;
  cumulativeSpentCents: number;
}

export interface CategoryTotalItem {
  category: ExpenseCategory;
  spentCents: number;
  sharePct: number;
  count: number;
}

export interface DashboardBudgetItem {
  category: ExpenseCategory;
  limitCents: number;
  alertPercent: number;
  spentCents: number;
  remainingCents: number;
  usagePct: number;
  status: "ok" | "alert" | "exceeded" | "unconfigured";
  configured: boolean;
}

export interface DashboardData {
  month: string;
  previousMonth: string;
  totalMonthCents: number;
  totalPreviousMonthCents: number;
  variationPct: number | null;
  monthlyInflowCents: number;
  netSurplusCents: number;
  savingsRatePct: number;
  totalBudgetLimitCents: number;
  dailySeries: DailySeriesPoint[];
  byCategory: CategoryTotalItem[];
  budgets: DashboardBudgetItem[];
  recentExpenses: ExpenseItem[];
  pendingCount: number;
  monthPendingCount: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface ParsedExpenseDraft {
  draftId: string;
  source: "image" | "text";
  imageId: string | null;
  imageUrl: string | null;
  merchant: string;
  amountCents: number | null;
  expenseDate: string | null;
  category: ExpenseCategory;
  suggestedCategory: ExpenseCategory;
  note: string;
  status: ExpenseStatus;
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
    category: ExpenseCategory;
  } | null;
}

export type ParseImageItemResult =
  | { ok: true; fileName: string; draft: ParsedExpenseDraft }
  | {
      ok: false;
      fileName: string;
      imageId: string | null;
      imageUrl: string | null;
      error: string;
    };

export interface FinancialInsightItem {
  id: string;
  kind:
    | "category_growth"
    | "budget_alert"
    | "top_expense"
    | "recurring_expense";
  severity: "info" | "warning" | "alert";
  title: string;
  description: string;
  metricLabel?: string;
}

export interface InsightsResponse {
  month: string;
  empty: boolean;
  insights: FinancialInsightItem[];
  cached: boolean;
}

export interface AssistantCardItem {
  id: string;
  merchant: string;
  amountCents: number;
  expenseDate: string;
  category: ExpenseCategory;
}

export interface AssistantMiniSeriesPoint {
  label: string;
  valueCents: number;
}

export interface SuggestedAction {
  id: string;
  label: string;
  type: "adjust_budget" | "categorize_pending" | "navigate";
  category?: ExpenseCategory;
  amountCents?: number;
  view?: WorkspaceView;
  applied?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  confidence?: number;
  cards?: AssistantCardItem[];
  miniSeries?: AssistantMiniSeriesPoint[];
  suggestedActions?: SuggestedAction[];
}

export interface NotificationPreferences {
  budgetAlerts: boolean;
  pendingReviewReminder: boolean;
  monthlyDigest: boolean;
}
