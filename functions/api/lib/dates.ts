export const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";

export function getTodaySaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function getNowIsoUtc(now: Date = new Date()): string {
  return now.toISOString();
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

function toIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(isoDate: string, deltaDays: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) return null;

  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return toIsoDate(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate()
  );
}

export function resolveRelativeDateBR(
  input: string,
  referenceIso: string = getTodaySaoPaulo()
): string | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "hoje") {
    return referenceIso;
  }
  if (normalized === "ontem") {
    return addDaysIso(referenceIso, -1);
  }
  if (normalized === "anteontem") {
    return addDaysIso(referenceIso, -2);
  }

  // ISO yyyy-mm-dd
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return isValidCalendarDate(y, m, d) ? toIsoDate(y, m, d) : null;
  }

  // dd/mm/aaaa
  const brFullMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized);
  if (brFullMatch) {
    const d = Number(brFullMatch[1]);
    const m = Number(brFullMatch[2]);
    const y = Number(brFullMatch[3]);
    return isValidCalendarDate(y, m, d) ? toIsoDate(y, m, d) : null;
  }

  // dd/mm (usa o ano de referência em America/Sao_Paulo)
  const brShortMatch = /^(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (brShortMatch) {
    const d = Number(brShortMatch[1]);
    const m = Number(brShortMatch[2]);
    const refYear = Number(referenceIso.slice(0, 4));
    return isValidCalendarDate(refYear, m, d) ? toIsoDate(refYear, m, d) : null;
  }

  return null;
}

export function formatIsoToDateBR(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
