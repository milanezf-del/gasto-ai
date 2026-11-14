import type { ExpenseCategory, TransactionCategory } from "../types/finance";

export const SAO_PAULO_TZ = "America/Sao_Paulo";

export function formatCentavos(
  cents: number,
  options?: { signed?: boolean; compact?: boolean }
): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const absReais = Math.abs(safeCents) / 100;

  let formatted: string;
  if (options?.compact && absReais >= 1000) {
    const kVal = absReais / 1000;
    formatted = `R$ ${kVal.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mil`;
  } else {
    formatted = absReais.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (options?.signed) {
    if (safeCents > 0) return `+${formatted}`;
    if (safeCents < 0) return `-${formatted}`;
  } else if (safeCents < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

export function reaisInputToCentavos(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function formatDateBR(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function getTodayIsoSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getCurrentTimeSaoPaulo(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export interface CategoryMeta {
  color: string;
  tintBg: string;
  shortLabel: string;
}

export const CATEGORY_META: Record<TransactionCategory, CategoryMeta> = {
  Alimentação: {
    color: "#F97316",
    tintBg: "rgba(249, 115, 22, 0.12)",
    shortLabel: "Alimentação",
  },
  Transporte: {
    color: "#0EA5E9",
    tintBg: "rgba(14, 165, 233, 0.12)",
    shortLabel: "Transporte",
  },
  Educação: {
    color: "#8B5CF6",
    tintBg: "rgba(139, 92, 246, 0.12)",
    shortLabel: "Educação",
  },
  Lazer: {
    color: "#EC4899",
    tintBg: "rgba(236, 72, 153, 0.12)",
    shortLabel: "Lazer",
  },
  Moradia: {
    color: "#14B8A6",
    tintBg: "rgba(20, 184, 166, 0.12)",
    shortLabel: "Moradia",
  },
  "Assinaturas & Software": {
    color: "#6366F1",
    tintBg: "rgba(99, 102, 241, 0.12)",
    shortLabel: "Assinaturas",
  },
  "Receitas & Rendimentos": {
    color: "#10B981",
    tintBg: "rgba(16, 185, 129, 0.12)",
    shortLabel: "Receitas",
  },
  "Sem categoria": {
    color: "#64748B",
    tintBg: "rgba(100, 116, 139, 0.14)",
    shortLabel: "Revisão pendente",
  },
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Alimentação",
  "Transporte",
  "Educação",
  "Lazer",
  "Moradia",
  "Assinaturas & Software",
];

export const ALL_CATEGORIES: TransactionCategory[] = [
  "Alimentação",
  "Transporte",
  "Educação",
  "Lazer",
  "Moradia",
  "Assinaturas & Software",
  "Receitas & Rendimentos",
  "Sem categoria",
];
