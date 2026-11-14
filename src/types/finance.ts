export type WorkspaceView = "overview" | "transactions" | "budgets" | "accounts";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type TransactionCategory =
  | "Alimentação"
  | "Transporte"
  | "Educação"
  | "Lazer"
  | "Moradia"
  | "Assinaturas & Software"
  | "Receitas & Rendimentos"
  | "Sem categoria";

export type ExpenseCategory = Exclude<
  TransactionCategory,
  "Receitas & Rendimentos" | "Sem categoria"
>;

export type TransactionStatus = "Confirmado" | "Revisão pendente";

export interface ExpenseItem {
  id: string;
  date: string; // ISO yyyy-mm-dd
  merchant: string;
  description: string;
  category: TransactionCategory;
  amountCents: number; // positivo = entrada, negativo = saída (inteiro em centavos)
  accountId: string;
  status: TransactionStatus;
  aiConfidence?: number;
  aiRationale?: string;
  taxDeductible?: boolean;
}

export interface BudgetEnvelope {
  category: ExpenseCategory;
  monthlyLimitCents: number;
  spentCents: number;
}

export interface SubscriptionItem {
  id: string;
  name: string;
  vendor: string;
  category: TransactionCategory;
  amountCents: number;
  renewalDate: string; // ISO yyyy-mm-dd
  status: "Ativa" | "Pouco usada" | "Pausada";
  lastUsedDaysAgo: number;
}

export interface FinancialAccount {
  id: string;
  name: string;
  institution: string;
  type: "Conta Corrente" | "Reserva / CDB" | "Cartão de Crédito" | "Multi-Moeda";
  balanceCents: number;
  details: string;
  lastSynced: string;
}

export interface CashFlowPoint {
  label: string;
  inflowCents: number;
  outflowCents: number;
  netProjected?: boolean;
}

export interface UserProfile {
  name: string;
  planLabel: string;
  avatarUrl?: string;
}

export interface FinancialSummary {
  netWorthCents: number;
  monthlyInflowCents: number;
  monthlyOutflowCents: number;
  netSurplusCents: number;
  savingsRatePct: number;
  accountsCount: number;
  pendingCount: number;
  cashFlowHistory: CashFlowPoint[];
  user?: UserProfile;
}

export interface SuggestedAction {
  id: string;
  label: string;
  type: "adjust_budget" | "categorize_pending" | "pause_subscription" | "navigate";
  category?: ExpenseCategory;
  amountCents?: number;
  subscriptionId?: string;
  view?: WorkspaceView;
  applied?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  confidence?: number;
  suggestedActions?: SuggestedAction[];
}

export interface AiBriefing {
  headline: string;
  summary: string;
  confidence: number;
}
