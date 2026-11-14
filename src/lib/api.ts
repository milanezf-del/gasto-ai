import type {
  AiBriefing,
  BudgetEnvelope,
  ChatMessage,
  ExpenseCategory,
  ExpenseItem,
  FinancialAccount,
  FinancialSummary,
  SubscriptionItem,
  SuggestedAction,
  TransactionCategory,
} from "../types/finance";
import {
  aiChatInputSchema,
  createExpenseSchema,
  transferAccountsSchema,
  updateBudgetLimitSchema,
  type CreateExpenseInput,
  type TransferAccountsInput,
} from "./schemas";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function defaultErrorMessageForStatus(status: number): string {
  if (status === 400 || status === 422) {
    return "Os dados enviados são inválidos. Verifique os campos e tente novamente.";
  }
  if (status === 401) {
    return "Sua sessão expirou. Faça login novamente para continuar.";
  }
  if (status === 403) {
    return "Você não tem permissão para executar esta operação.";
  }
  if (status === 404) {
    return "Este recurso ainda não está disponível na API.";
  }
  if (status === 429) {
    return "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente.";
  }
  if (status >= 500) {
    return "O servidor encontrou um problema temporário. Tente novamente em instantes.";
  }
  return "Não foi possível concluir a requisição.";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError(
      "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
      0
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  let parsedBody: unknown = null;
  if (contentType.includes("application/json")) {
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    const serverMessage =
      parsedBody &&
      typeof parsedBody === "object" &&
      "error" in parsedBody &&
      typeof (parsedBody as { error?: unknown }).error === "string"
        ? (parsedBody as { error: string }).error
        : defaultErrorMessageForStatus(response.status);

    throw new ApiError(serverMessage, response.status, parsedBody);
  }

  return parsedBody as T;
}

export const api = {
  health: () => apiFetch<{ ok: boolean }>("/api/health"),

  getSummary: () => apiFetch<FinancialSummary>("/api/summary"),

  getExpenses: (params?: {
    search?: string;
    category?: string;
    type?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.category && params.category !== "all") {
      qs.set("category", params.category);
    }
    if (params?.type && params.type !== "all") qs.set("type", params.type);
    const query = qs.toString();
    return apiFetch<{ items: ExpenseItem[] }>(
      `/api/expenses${query ? `?${query}` : ""}`
    );
  },

  createExpense: (input: CreateExpenseInput) => {
    const validated = createExpenseSchema.parse(input);
    return apiFetch<{ item: ExpenseItem }>("/api/expenses", {
      method: "POST",
      body: JSON.stringify(validated),
    });
  },

  updateExpenseCategory: (id: string, category: TransactionCategory) =>
    apiFetch<{ item: ExpenseItem }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ category }),
    }),

  deleteExpense: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  categorizePending: (ids: string[]) =>
    apiFetch<{
      results: Array<{
        id: string;
        category: TransactionCategory;
        confidence: number;
        rationale: string;
      }>;
    }>("/api/ai/categorize", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  getBudgets: () =>
    apiFetch<{
      budgets: BudgetEnvelope[];
      subscriptions: SubscriptionItem[];
    }>("/api/budgets"),

  updateBudgetLimit: (category: ExpenseCategory, monthlyLimitCents: number) => {
    const validated = updateBudgetLimitSchema.parse({
      category,
      monthlyLimitCents,
    });
    return apiFetch<{ budget: BudgetEnvelope }>("/api/budgets", {
      method: "PUT",
      body: JSON.stringify(validated),
    });
  },

  toggleSubscription: (id: string) =>
    apiFetch<{ subscription: SubscriptionItem }>(
      `/api/subscriptions/${encodeURIComponent(id)}/toggle`,
      { method: "PATCH" }
    ),

  getAccounts: () =>
    apiFetch<{ accounts: FinancialAccount[] }>("/api/accounts"),

  syncAccounts: () =>
    apiFetch<{ accounts: FinancialAccount[] }>("/api/accounts/sync", {
      method: "POST",
    }),

  transferAccounts: (input: TransferAccountsInput) => {
    const validated = transferAccountsSchema.parse(input);
    return apiFetch<{ accounts: FinancialAccount[] }>("/api/accounts/transfer", {
      method: "POST",
      body: JSON.stringify(validated),
    });
  },

  getBriefing: () => apiFetch<AiBriefing>("/api/ai/briefing"),

  sendAiChat: (
    message: string,
    history: Array<Pick<ChatMessage, "role" | "content">>
  ) => {
    const validated = aiChatInputSchema.parse({ message });
    return apiFetch<{
      reply: string;
      confidence: number;
      suggestedActions: SuggestedAction[];
    }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message: validated.message, history }),
    });
  },
};
