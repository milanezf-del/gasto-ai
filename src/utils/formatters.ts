import type { ExpenseCategory } from "../types/finance";

export const SAO_PAULO_TZ = "America/Sao_Paulo";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatterBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const weekdayDateFormatterBR = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const monthYearFormatterBR = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

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
    formatted = brlFormatter.format(absReais);
  }

  if (options?.signed) {
    if (safeCents > 0) return `+${formatted}`;
    if (safeCents < 0) return `-${formatted}`;
  } else if (safeCents < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

export function centavosToReaisInput(cents: number): string {
  const abs = Math.abs(Math.round(cents)) / 100;
  return abs.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function reaisInputToCentavos(rawValue: string): number | null {
  const trimmed = rawValue.trim().replace(/R\$/gi, "").replace(/\s+/g, "");
  if (!trimmed) return null;

  let normalized = trimmed;
  if (trimmed.includes(",")) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

export function formatDateBR(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  return dateFormatterBR.format(dt);
}

export function formatDateWithWeekdayBR(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  const label = weekdayDateFormatterBR.format(dt);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMonthLabelPT(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!match) return ym;
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  const raw = monthYearFormatterBR.format(dt);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function shiftYearMonth(ym: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!match) return getTodayIsoSaoPaulo().slice(0, 7);
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1 + deltaMonths, 1)
  );
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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
}

export const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  Alimentação: {
    color: "#F97316",
    tintBg: "rgba(249, 115, 22, 0.12)",
  },
  Transporte: {
    color: "#0EA5E9",
    tintBg: "rgba(14, 165, 233, 0.12)",
  },
  Educação: {
    color: "#8B5CF6",
    tintBg: "rgba(139, 92, 246, 0.12)",
  },
  Lazer: {
    color: "#EC4899",
    tintBg: "rgba(236, 72, 153, 0.12)",
  },
  Outros: {
    color: "#64748B",
    tintBg: "rgba(100, 116, 139, 0.14)",
  },
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Alimentação",
  "Transporte",
  "Educação",
  "Lazer",
  "Outros",
];
