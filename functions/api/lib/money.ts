export function parseBRLToCentavos(input: string | number): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  const isNegative = trimmed.startsWith("-") || trimmed.includes("-R$");
  // Remove currency symbol, spaces, and sign characters
  const cleaned = trimmed
    .replace(/R\$/gi, "")
    .replace(/[+\-\s]/g, "");

  if (!cleaned || !/^[0-9.,]+$/.test(cleaned)) {
    return null;
  }

  let normalizedNumberStr: string;

  if (cleaned.includes(",")) {
    // Formato brasileiro: pontos são separadores de milhar, vírgula é decimal (ex.: 1.234,56 ou 23,50)
    const parts = cleaned.split(",");
    if (parts.length !== 2) return null;
    const [intPartRaw, decPart] = parts;
    if (!/^\d{1,2}$/.test(decPart)) return null;
    const intPart = intPartRaw.replace(/\./g, "");
    if (!/^\d+$/.test(intPart)) return null;
    normalizedNumberStr = `${intPart}.${decPart.padEnd(2, "0")}`;
  } else if (cleaned.includes(".")) {
    // Sem vírgula: se houver exatamente 1 ponto com 1 ou 2 dígitos decimais (ex.: 23.50), trata como decimal;
    // caso contrário, se seguir padrão de milhar (ex.: 1.234), remove os pontos.
    const dotParts = cleaned.split(".");
    if (dotParts.length === 2 && /^\d+$/.test(dotParts[0]) && /^\d{1,2}$/.test(dotParts[1])) {
      normalizedNumberStr = `${dotParts[0]}.${dotParts[1].padEnd(2, "0")}`;
    } else if (dotParts.every((p, idx) => (idx === 0 ? /^\d{1,3}$/.test(p) : /^\d{3}$/.test(p)))) {
      normalizedNumberStr = `${dotParts.join("")}.00`;
    } else {
      return null;
    }
  } else {
    normalizedNumberStr = `${cleaned}.00`;
  }

  const [wholeStr, fracStr] = normalizedNumberStr.split(".");
  const whole = Number.parseInt(wholeStr, 10);
  const frac = Number.parseInt(fracStr, 10);

  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) {
    return null;
  }

  const totalCentavos = whole * 100 + frac;
  if (!Number.isSafeInteger(totalCentavos)) {
    return null;
  }

  return isNegative ? -totalCentavos : totalCentavos;
}

export function formatCentavosToBRL(
  cents: number,
  options?: { signed?: boolean }
): string {
  const safeCents = Number.isFinite(cents) ? Math.round(cents) : 0;
  const absReais = Math.abs(safeCents) / 100;

  const formatted = absReais.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (options?.signed) {
    if (safeCents > 0) return `+${formatted}`;
    if (safeCents < 0) return `-${formatted}`;
  } else if (safeCents < 0) {
    return `-${formatted}`;
  }

  return formatted;
}
