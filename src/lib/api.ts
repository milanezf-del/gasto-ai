import type {
  AssistantCardItem,
  AssistantMiniSeriesPoint,
  AuthUser,
  BudgetEnvelope,
  ChatMessage,
  DashboardData,
  ExpenseCategory,
  ExpenseItem,
  ExpenseListFilters,
  ExpenseListResponse,
  InsightsResponse,
  MerchantRuleItem,
  ParseImageItemResult,
  ParsedExpenseDraft,
  SuggestedAction,
} from "../types/finance";
import {
  aiChatInputSchema,
  confirmExpenseInputSchema,
  createExpenseSchema,
  loginInputSchema,
  parseTextInputSchema,
  signupInputSchema,
  updateBudgetLimitSchema,
  updateExpenseSchema,
  type ConfirmExpenseInput,
  type CreateExpenseInput,
  type LoginInput,
  type SignupInput,
  type UpdateExpenseInput,
} from "./schemas";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    details?: unknown,
    code?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.code = code;
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
    return "Recurso não encontrado na API.";
  }
  if (status === 429) {
    return "Limite de requisições atingido. Tente novamente em instantes.";
  }
  if (status === 503) {
    return "Serviço temporariamente indisponível.";
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
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
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
      0,
      undefined,
      "NETWORK_ERROR"
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
    const bodyObj =
      parsedBody && typeof parsedBody === "object"
        ? (parsedBody as { error?: unknown; message?: unknown; code?: unknown })
        : null;

    const serverMessage =
      typeof bodyObj?.error === "string"
        ? bodyObj.error
        : typeof bodyObj?.message === "string"
        ? bodyObj.message
        : defaultErrorMessageForStatus(response.status);

    const code = typeof bodyObj?.code === "string" ? bodyObj.code : undefined;
    throw new ApiError(serverMessage, response.status, parsedBody, code);
  }

  return parsedBody as T;
}

function buildExpensesQueryString(filters?: ExpenseListFilters): string {
  if (!filters) return "";
  const qs = new URLSearchParams();
  if (filters.from) qs.set("from", filters.from);
  if (filters.to) qs.set("to", filters.to);
  if (filters.category && filters.category !== "all") {
    qs.set("category", filters.category);
  }
  if (filters.q?.trim()) qs.set("q", filters.q.trim());
  if (typeof filters.minCents === "number" && filters.minCents > 0) {
    qs.set("min", String(filters.minCents));
  }
  if (typeof filters.maxCents === "number" && filters.maxCents > 0) {
    qs.set("max", String(filters.maxCents));
  }
  if (filters.status && filters.status !== "all") {
    qs.set("status", filters.status);
  }
  if (filters.sort) qs.set("sort", filters.sort);
  if (filters.limit) qs.set("limit", String(filters.limit));
  if (filters.cursor) qs.set("cursor", filters.cursor);
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export const api = {
  health: () =>
    apiFetch<{ ok: boolean; database: string; configured: boolean }>(
      "/api/health"
    ),

  me: () => apiFetch<{ ok: boolean; user: AuthUser }>("/api/auth/me"),

  login: (input: LoginInput) => {
    const validated = loginInputSchema.parse(input);
    return apiFetch<{ ok: boolean; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(validated),
    });
  },

  signup: (input: SignupInput) => {
    const validated = signupInputSchema.parse(input);
    return apiFetch<{
      ok: boolean;
      requiresEmailConfirmation: boolean;
      user: AuthUser | null;
    }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(validated),
    });
  },

  logout: () => apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  deleteAccount: (confirmation: string) =>
    apiFetch<{ ok: boolean }>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
    }),

  getDashboard: (month?: string) =>
    apiFetch<DashboardData>(
      `/api/dashboard${month ? `?month=${encodeURIComponent(month)}` : ""}`
    ),

  getInsights: (month?: string) =>
    apiFetch<InsightsResponse>(
      `/api/insights${month ? `?month=${encodeURIComponent(month)}` : ""}`
    ),

  getExpenses: (filters?: ExpenseListFilters) =>
    apiFetch<ExpenseListResponse>(
      `/api/expenses${buildExpensesQueryString(filters)}`
    ),

  getExpenseById: (id: string) =>
    apiFetch<{ item: ExpenseItem }>(`/api/expenses/${encodeURIComponent(id)}`),

  createExpense: (input: CreateExpenseInput) => {
    const validated = createExpenseSchema.parse(input);
    return apiFetch<{ item: ExpenseItem }>("/api/expenses", {
      method: "POST",
      body: JSON.stringify(validated),
    });
  },

  confirmExpense: (input: ConfirmExpenseInput) => {
    const validated = confirmExpenseInputSchema.parse(input);
    return apiFetch<{ item: ExpenseItem }>("/api/expenses/confirm", {
      method: "POST",
      body: JSON.stringify(validated),
    });
  },

  updateExpense: (id: string, input: UpdateExpenseInput) => {
    const validated = updateExpenseSchema.parse(input);
    return apiFetch<{ item: ExpenseItem }>(
      `/api/expenses/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(validated),
      }
    );
  },

  updateExpenseCategory: (id: string, category: ExpenseCategory) =>
    apiFetch<{ item: ExpenseItem }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ category, status: "confirmed" }),
    }),

  deleteExpense: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/expenses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  downloadExpensesCsv: async (filters?: ExpenseListFilters) => {
    const qs = buildExpensesQueryString(filters);
    let response: Response;
    try {
      response = await fetch(`/api/expenses/export.csv${qs}`, {
        credentials: "include",
      });
    } catch {
      throw new ApiError(
        "Sem conexão ao exportar o arquivo CSV.",
        0,
        undefined,
        "NETWORK_ERROR"
      );
    }
    if (!response.ok) {
      throw new ApiError(
        "Não foi possível exportar suas despesas em CSV.",
        response.status
      );
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gasto-despesas.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  parseImages: (files: File[]) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("images", file);
    }
    return apiFetch<{ results: ParseImageItemResult[] }>("/api/ai/parse-image", {
      method: "POST",
      body: formData,
    });
  },

  parseText: (text: string) => {
    const validated = parseTextInputSchema.parse({ text });
    return apiFetch<{ draft: ParsedExpenseDraft }>("/api/ai/parse-text", {
      method: "POST",
      body: JSON.stringify(validated),
    });
  },

  categorizePending: (ids: string[]) =>
    apiFetch<{
      results: Array<{
        id: string;
        category: ExpenseCategory;
        confidence: number;
        rationale: string;
      }>;
    }>("/api/ai/categorize", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  getBudgets: (month?: string) =>
    apiFetch<{ month: string; budgets: BudgetEnvelope[] }>(
      `/api/budgets${month ? `?month=${encodeURIComponent(month)}` : ""}`
    ),

  updateBudgetLimit: (
    category: ExpenseCategory,
    limitCents: number,
    alertPercent = 80
  ) => {
    const validated = updateBudgetLimitSchema.parse({
      category,
      limitCents,
      alertPercent,
    });
    return apiFetch<{ budget: BudgetEnvelope }>("/api/budgets", {
      method: "PUT",
      body: JSON.stringify(validated),
    });
  },

  getRules: () => apiFetch<{ rules: MerchantRuleItem[] }>("/api/rules"),

  deleteRule: (merchantNorm: string) =>
    apiFetch<{ ok: boolean }>(
      `/api/rules/${encodeURIComponent(merchantNorm)}`,
      { method: "DELETE" }
    ),

  askAssistant: (
    message: string,
    history: Array<Pick<ChatMessage, "role" | "content">>
  ) => {
    const validated = aiChatInputSchema.parse({ message });
    return apiFetch<{
      reply: string;
      intent: string;
      confidence: number;
      usedAi: boolean;
      cards: AssistantCardItem[];
      miniSeries: AssistantMiniSeriesPoint[];
      suggestedActions: SuggestedAction[];
    }>("/api/assistant", {
      method: "POST",
      body: JSON.stringify({ message: validated.message, history }),
    });
  },
};
