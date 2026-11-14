import React from "react";
import {
  X,
  Camera,
  Upload,
  FileText,
  Edit3,
  Sparkles,
  AlertTriangle,
  Check,
  Trash2,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import {
  confirmExpenseInputSchema,
  createExpenseSchema,
  type ConfirmExpenseInput,
  type CreateExpenseInput,
} from "../lib/schemas";
import type {
  ExpenseCategory,
  ParseImageItemResult,
  ParsedExpenseDraft,
} from "../types/finance";
import {
  CATEGORY_META,
  EXPENSE_CATEGORIES,
  centavosToReaisInput,
  formatCentavos,
  formatDateBR,
  getTodayIsoSaoPaulo,
  reaisInputToCentavos,
} from "../utils/formatters";
import { compressImageForUpload } from "../utils/imageCompression";

type ModalMode = "image" | "text" | "manual";

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  onSubmitExpense: (input: CreateExpenseInput) => Promise<void>;
  onConfirmExpense: (input: ConfirmExpenseInput) => Promise<void>;
  onNotifySuccess: (message: string) => void;
  onNotifyError: (message: string) => void;
}

const PROCESSING_STEPS = [
  "Enviando e otimizando dados",
  "Extraindo estabelecimento, valor e data com IA",
  "Aplicando regras e verificando duplicatas",
];

function quickExtractTextFallback(raw: string): {
  merchant: string;
  rawAmount: string;
} {
  const amountMatch = raw.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}|\d+)/);
  const rawAmount = amountMatch ? amountMatch[1].replace(".", ",") : "";
  const cleaned = raw
    .replace(/R\$/gi, "")
    .replace(amountMatch?.[0] ?? "", "")
    .replace(/\b(hoje|ontem|anteontem|reais|real)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    merchant: cleaned.slice(0, 80),
    rawAmount,
  };
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  open,
  onClose,
  submitting,
  onSubmitExpense,
  onConfirmExpense,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [mode, setMode] = React.useState<ModalMode>("image");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [aiFallbackNotice, setAiFallbackNotice] = React.useState<string | null>(
    null
  );

  // Estado de carregamento animado da IA
  const [processingAi, setProcessingAi] = React.useState(false);
  const [processingStep, setProcessingStep] = React.useState(0);

  // Modo Imagem
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  // Modo Texto Rápido
  const [quickText, setQuickText] = React.useState("");

  // Fila de Revisão (itens retornados pela IA)
  const [reviewQueue, setReviewQueue] = React.useState<ParsedExpenseDraft[]>(
    []
  );
  const [failedImages, setFailedImages] = React.useState<
    Array<{ fileName: string; error: string }>
  >([]);
  const [reviewIdx, setReviewIdx] = React.useState(0);

  // Campos editáveis do item em revisão
  const [revMerchant, setRevMerchant] = React.useState("");
  const [revRawAmount, setRevRawAmount] = React.useState("");
  const [revDate, setRevDate] = React.useState(getTodayIsoSaoPaulo);
  const [revCategory, setRevCategory] =
    React.useState<ExpenseCategory>("Outros");
  const [revNote, setRevNote] = React.useState("");
  const [confirmingDraft, setConfirmingDraft] = React.useState(false);

  // Campos do formulário manual simples
  const [merchant, setMerchant] = React.useState("");
  const [note, setNote] = React.useState("");
  const [rawAmount, setRawAmount] = React.useState("");
  const [txType, setTxType] = React.useState<"expense" | "income">("expense");
  const [category, setCategory] = React.useState<ExpenseCategory>("Outros");
  const [needsReview, setNeedsReview] = React.useState(false);
  const [expenseDate, setExpenseDate] = React.useState(getTodayIsoSaoPaulo);

  const activeDraft = reviewQueue[reviewIdx] ?? null;

  // Sincroniza campos editáveis sempre que o item ativo da fila mudar
  React.useEffect(() => {
    if (!activeDraft) return;
    setRevMerchant(activeDraft.merchant ?? "");
    setRevRawAmount(
      activeDraft.amountCents !== null
        ? centavosToReaisInput(activeDraft.amountCents)
        : ""
    );
    setRevDate(activeDraft.expenseDate ?? getTodayIsoSaoPaulo());
    setRevCategory(activeDraft.category ?? "Outros");
    setRevNote(activeDraft.note ?? "");
    setFormError(null);
  }, [activeDraft]);

  // Avança passos visuais enquanto IA processa
  React.useEffect(() => {
    if (!processingAi) {
      setProcessingStep(0);
      return;
    }
    const t1 = window.setTimeout(() => setProcessingStep(1), 900);
    const t2 = window.setTimeout(() => setProcessingStep(2), 2300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [processingAi]);

  const resetAll = React.useCallback(() => {
    setFormError(null);
    setAiFallbackNotice(null);
    setSelectedFiles([]);
    setQuickText("");
    setReviewQueue([]);
    setFailedImages([]);
    setReviewIdx(0);
    setMerchant("");
    setNote("");
    setRawAmount("");
    setTxType("expense");
    setCategory("Outros");
    setNeedsReview(false);
    setExpenseDate(getTodayIsoSaoPaulo());
  }, []);

  const handleClose = () => {
    if (processingAi || confirmingDraft || submitting) return;
    resetAll();
    onClose();
  };

  if (!open) return null;

  const appendFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFormError(null);
    const accepted = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      f.type.startsWith("image/")
    );
    if (accepted.length === 0) {
      setFormError("Selecione imagens válidas nos formatos JPEG, PNG ou WebP.");
      return;
    }
    setSelectedFiles((prev) => {
      const merged = [...prev, ...accepted].slice(0, 5);
      if (prev.length + accepted.length > 5) {
        setFormError("Máximo de 5 imagens por envio.");
      }
      return merged;
    });
  };

  const handleAiLimitFallback = (err: unknown, sourceText?: string) => {
    if (
      err instanceof ApiError &&
      (err.code === "AI_LIMIT" || err.status === 429 || err.status === 503)
    ) {
      setAiFallbackNotice(err.message);
      if (sourceText) {
        const extracted = quickExtractTextFallback(sourceText);
        if (extracted.merchant) setMerchant(extracted.merchant);
        if (extracted.rawAmount) setRawAmount(extracted.rawAmount);
        setNote(sourceText.slice(0, 200));
      }
      setMode("manual");
      return true;
    }
    return false;
  };

  const handleProcessImages = async () => {
    if (selectedFiles.length === 0) {
      setFormError("Selecione ou tire foto de pelo menos 1 comprovante.");
      return;
    }
    setFormError(null);
    setAiFallbackNotice(null);
    setProcessingAi(true);

    try {
      const compressed: File[] = [];
      for (const file of selectedFiles.slice(0, 5)) {
        const optimized = await compressImageForUpload(file);
        if (optimized.size > 5 * 1024 * 1024) {
          throw new Error(
            `A imagem "${file.name}" excedeu 5 MB mesmo após compressão.`
          );
        }
        compressed.push(optimized);
      }

      const res = await api.parseImages(compressed);
      const drafts: ParsedExpenseDraft[] = [];
      const failures: Array<{ fileName: string; error: string }> = [];

      for (const item of res.results as ParseImageItemResult[]) {
        if (item.ok) {
          drafts.push(item.draft);
        } else {
          failures.push({ fileName: item.fileName, error: item.error });
        }
      }

      setFailedImages(failures);
      if (drafts.length === 0) {
        setFormError(
          failures[0]?.error ??
            "Não foi possível extrair dados das imagens. Preencha manualmente."
        );
        return;
      }

      setReviewQueue(drafts);
      setReviewIdx(0);
      setSelectedFiles([]);
    } catch (err) {
      if (!handleAiLimitFallback(err)) {
        const msg =
          err instanceof Error
            ? err.message
            : "Erro ao processar imagens com IA.";
        setFormError(msg);
        onNotifyError(msg);
      }
    } finally {
      setProcessingAi(false);
    }
  };

  const handleProcessText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) {
      setFormError("Descreva o gasto antes de enviar.");
      return;
    }
    setFormError(null);
    setAiFallbackNotice(null);
    setProcessingAi(true);

    try {
      const res = await api.parseText(quickText.trim());
      setReviewQueue([res.draft]);
      setFailedImages([]);
      setReviewIdx(0);
      setQuickText("");
    } catch (err) {
      if (!handleAiLimitFallback(err, quickText.trim())) {
        const msg =
          err instanceof Error ? err.message : "Erro ao interpretar texto com IA.";
        setFormError(msg);
        onNotifyError(msg);
      }
    } finally {
      setProcessingAi(false);
    }
  };

  const advanceOrCloseQueue = () => {
    if (reviewIdx + 1 < reviewQueue.length) {
      setReviewIdx((idx) => idx + 1);
    } else {
      resetAll();
      onClose();
    }
  };

  const handleConfirmCurrentDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDraft) return;
    setFormError(null);

    const absCents = reaisInputToCentavos(revRawAmount);
    if (absCents === null) {
      setFormError("Informe um valor monetário válido maior que zero.");
      return;
    }

    const parsed = confirmExpenseInputSchema.safeParse({
      merchant: revMerchant,
      amountCents: -absCents,
      expenseDate: revDate,
      category: revCategory,
      note: revNote,
      source: activeDraft.source,
      imageId: activeDraft.imageId,
      suggestedCategory: activeDraft.suggestedCategory,
      confidenceJson: {
        confidence: Math.round(
          ((activeDraft.confidence.merchant +
            activeDraft.confidence.amount +
            activeDraft.confidence.expense_date +
            activeDraft.confidence.category) /
            4) *
            100
        ),
        fields: activeDraft.confidence,
      },
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Revise os campos antes de confirmar."
      );
      return;
    }

    setConfirmingDraft(true);
    try {
      await onConfirmExpense(parsed.data);
      onNotifySuccess("Despesa confirmada e salva!");
      advanceOrCloseQueue();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Não foi possível salvar a despesa."
      );
    } finally {
      setConfirmingDraft(false);
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const centavos = reaisInputToCentavos(rawAmount);
    if (centavos === null) {
      setFormError("Informe um valor monetário válido maior que zero.");
      return;
    }

    const signedCents = txType === "expense" ? -centavos : centavos;
    const parsed = createExpenseSchema.safeParse({
      merchant,
      note,
      amountCents: signedCents,
      expenseDate,
      category,
      source: "manual",
      status: needsReview ? "needs_review" : "confirmed",
    });

    if (!parsed.success) {
      setFormError(
        parsed.error.issues[0]?.message ?? "Verifique os dados informados."
      );
      return;
    }

    try {
      await onSubmitExpense(parsed.data);
      onNotifySuccess("Lançamento salvo com sucesso!");
      resetAll();
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar o lançamento."
      );
    }
  };

  const lowConfidenceClass = (score: number | undefined, missing = false) =>
    missing || (typeof score === "number" && score < 0.8)
      ? "border-[#F59E0B] bg-[#F59E0B]/5 dark:border-[#f59e0b] dark:bg-[#f59e0b]/10"
      : "border-slate-300 dark:border-white/[0.1] bg-white dark:bg-[#111827]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-entry-title"
    >
      <div
        className="fixed inset-0 bg-slate-950/55 dark:bg-black/75 backdrop-blur-[2px]"
        onClick={handleClose}
      />

      <div className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-white dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.12] shadow-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08]">
          <div>
            <h2
              id="new-entry-title"
              className="font-display text-lg font-semibold text-[#0F172A] dark:text-[#dfe2f1]"
            >
              {activeDraft
                ? `Revisar Item ${reviewIdx + 1} de ${reviewQueue.length}`
                : "Adicionar Despesa"}
            </h2>
            {!activeDraft && (
              <p className="text-xs text-slate-500 dark:text-[#908f9e]">
                Foto de comprovante, texto rápido ou formulário manual
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar janela"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:text-[#908f9e] dark:hover:text-[#dfe2f1] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerta de fallback 429/503 */}
        {aiFallbackNotice && (
          <div
            role="status"
            className="mt-4 rounded-lg p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-xs text-[#92400E] dark:text-[#fcd34d] flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{aiFallbackNotice}</p>
              <p className="mt-0.5 opacity-90">
                Você pode concluir o registro pelo formulário manual abaixo sem perder seus dados.
              </p>
            </div>
          </div>
        )}

        {/* Tela de Revisão Item a Item após extração por IA */}
        {activeDraft ? (
          <form
            onSubmit={(e) => void handleConfirmCurrentDraft(e)}
            className="pt-4 space-y-4"
          >
            {failedImages.length > 0 && reviewIdx === 0 && (
              <div className="rounded-lg p-3 bg-[#F43F5E]/10 border border-[#F43F5E]/25 text-xs text-[#93000a] dark:text-[#ffb4ab]">
                {failedImages.length} imagem(ns) não puderam ser processadas:{" "}
                {failedImages.map((f) => `${f.fileName} (${f.error})`).join(", ")}
              </div>
            )}

            {activeDraft.duplicateOf && (
              <div className="rounded-lg p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/35 text-xs text-[#92400E] dark:text-[#fcd34d] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Possível duplicata detectada: </span>
                  já existe um registro de{" "}
                  <strong>{activeDraft.duplicateOf.merchant || "despesa"}</strong> (
                  {formatCentavos(activeDraft.duplicateOf.amount_cents)}) em{" "}
                  {formatDateBR(activeDraft.duplicateOf.expense_date)}.
                </div>
              </div>
            )}

            {activeDraft.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#111827] max-h-48 flex items-center justify-center">
                <img
                  src={activeDraft.imageUrl}
                  alt="Prévia do comprovante enviado"
                  className="max-h-48 w-auto object-contain"
                />
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="rounded-lg px-3 py-2 text-xs bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#93000a] dark:text-[#ffb4ab]"
              >
                {formError}
              </div>
            )}

            <div className="text-[11px] text-slate-500 dark:text-[#908f9e] flex items-center justify-between">
              <span>
                Campos em âmbar têm confiança abaixo de 80% — confira antes de salvar.
              </span>
              {activeDraft.ruleApplied && (
                <span className="text-[#10B981] font-medium">Regra aplicada</span>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600 dark:text-[#c6c5d5]">
                  Estabelecimento
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {Math.round(activeDraft.confidence.merchant * 100)}%
                </span>
              </div>
              <input
                type="text"
                required
                value={revMerchant}
                onChange={(e) => setRevMerchant(e.target.value)}
                className={`w-full h-10 px-3 rounded-lg border text-sm text-[#0F172A] dark:text-[#dfe2f1] ${lowConfidenceClass(
                  activeDraft.confidence.merchant,
                  !revMerchant.trim()
                )}`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-[#c6c5d5]">
                    Valor (BRL)
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {Math.round(activeDraft.confidence.amount * 100)}%
                  </span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={revRawAmount}
                  onChange={(e) => setRevRawAmount(e.target.value)}
                  placeholder="0,00"
                  className={`w-full h-10 px-3 rounded-lg border text-sm font-mono tabular-nums text-[#0F172A] dark:text-[#dfe2f1] ${lowConfidenceClass(
                    activeDraft.confidence.amount,
                    !revRawAmount.trim()
                  )}`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-[#c6c5d5]">
                    Data
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {Math.round(activeDraft.confidence.expense_date * 100)}%
                  </span>
                </div>
                <input
                  type="date"
                  required
                  value={revDate}
                  onChange={(e) => setRevDate(e.target.value)}
                  className={`w-full h-10 px-2.5 rounded-lg border text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1] ${lowConfidenceClass(
                    activeDraft.confidence.expense_date,
                    !activeDraft.expenseDate
                  )}`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-600 dark:text-[#c6c5d5]">
                  Categoria
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {Math.round(activeDraft.confidence.category * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: CATEGORY_META[revCategory].color }}
                />
                <select
                  value={revCategory}
                  onChange={(e) =>
                    setRevCategory(e.target.value as ExpenseCategory)
                  }
                  className={`w-full h-10 px-2.5 rounded-lg border text-xs text-[#0F172A] dark:text-[#dfe2f1] ${lowConfidenceClass(
                    activeDraft.confidence.category
                  )}`}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1">
                Observação
              </label>
              <input
                type="text"
                value={revNote}
                onChange={(e) => setRevNote(e.target.value)}
                placeholder="Detalhes opcionais"
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1]"
              />
            </div>

            <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-white/[0.08]">
              <button
                type="button"
                disabled={confirmingDraft}
                onClick={advanceOrCloseQueue}
                className="h-10 px-3.5 rounded-lg inline-flex items-center gap-1.5 text-xs font-medium text-[#F43F5E] bg-[#F43F5E]/10 hover:bg-[#F43F5E]/15 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Descartar</span>
              </button>

              <button
                type="submit"
                disabled={confirmingDraft}
                className="h-10 px-5 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:text-[#0b0f19] disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {confirmingDraft ? "Salvando..." : "Confirmar e Salvar"}
                </span>
              </button>
            </div>
          </form>
        ) : processingAi ? (
          /* Estado animado de leitura pela IA */
          <div className="py-10 px-4 space-y-5 text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#6366F1]/10 dark:bg-[#818cf8]/15 text-[#6366F1] dark:text-[#818cf8] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                Analisando com Cloudflare Workers AI
              </p>
              <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-1">
                Isso leva alguns segundos. Nunca salvamos sem sua revisão quando houver dúvida.
              </p>
            </div>
            <div className="max-w-xs mx-auto space-y-2 text-left">
              {PROCESSING_STEPS.map((label, idx) => {
                const done = idx < processingStep;
                const active = idx === processingStep;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-2 text-xs ${
                      done
                        ? "text-[#10B981]"
                        : active
                        ? "text-[#4338CA] dark:text-[#bdc2ff] font-medium"
                        : "text-slate-400 dark:text-[#767586]"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ml-0.5 mr-1 ${
                          active ? "bg-[#6366F1] animate-pulse" : "bg-slate-300 dark:bg-slate-600"
                        }`}
                      />
                    )}
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            {/* Seletor de Abas (Foto / Texto / Manual) */}
            <div className="mt-4 grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-[#111827] border border-slate-200/70 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setMode("image");
                  setFormError(null);
                }}
                className={`h-9 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === "image"
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                    : "text-slate-600 dark:text-[#908f9e]"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Foto / IA</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("text");
                  setFormError(null);
                }}
                className={`h-9 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === "text"
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                    : "text-slate-600 dark:text-[#908f9e]"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Texto Rápido</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("manual");
                  setFormError(null);
                }}
                className={`h-9 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                  mode === "manual"
                    ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                    : "text-slate-600 dark:text-[#908f9e]"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Manual</span>
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="mt-4 rounded-lg px-3 py-2 text-xs bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-[#93000a] dark:text-[#ffb4ab]"
              >
                {formError}
              </div>
            )}

            {/* MODO FOTO / COMPROVANTE */}
            {mode === "image" && (
              <div className="pt-4 space-y-4">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    appendFiles(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    appendFiles(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="h-11 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#111827] hover:border-[#6366F1] text-xs font-semibold text-[#0F172A] dark:text-[#dfe2f1] inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#6366F1] dark:text-[#818cf8]" />
                    <span>Usar Câmera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="h-11 rounded-lg border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#111827] hover:border-[#6366F1] text-xs font-semibold text-[#0F172A] dark:text-[#dfe2f1] inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#6366F1] dark:text-[#818cf8]" />
                    <span>Escolher Fotos (até 5)</span>
                  </button>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    appendFiles(e.dataTransfer.files);
                  }}
                  className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                    dragOver
                      ? "border-[#6366F1] bg-[#6366F1]/5"
                      : "border-slate-200 dark:border-white/[0.1] bg-slate-50/60 dark:bg-[#111827]/60"
                  }`}
                >
                  <p className="text-xs font-medium text-[#0F172A] dark:text-[#dfe2f1]">
                    Arraste cupons fiscais, notas ou comprovantes PIX aqui
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-[#908f9e] mt-1">
                    JPEG, PNG ou WebP · Compressão automática no navegador antes do envio
                  </p>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-600 dark:text-[#c6c5d5]">
                      {selectedFiles.length} imagem(ns) pronta(s):
                    </div>
                    <div className="space-y-1.5">
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] text-xs"
                        >
                          <span className="truncate text-[#0F172A] dark:text-[#dfe2f1]">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedFiles((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            aria-label={`Remover ${file.name}`}
                            className="text-slate-400 hover:text-[#F43F5E] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-10 px-4 rounded-lg text-xs font-medium text-slate-600 dark:text-[#c6c5d5] hover:bg-slate-100 dark:hover:bg-[#1e293b] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={selectedFiles.length === 0}
                    onClick={() => void handleProcessImages()}
                    className="h-10 px-5 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:text-[#0b0f19] disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ler com IA</span>
                  </button>
                </div>
              </div>
            )}

            {/* MODO TEXTO RÁPIDO */}
            {mode === "text" && (
              <form
                onSubmit={(e) => void handleProcessText(e)}
                className="pt-4 space-y-4"
              >
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                    Descreva sua compra em linguagem natural
                  </label>
                  <textarea
                    rows={3}
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    placeholder="Ex.: Uber 23,50 ontem para o aeroporto"
                    className="w-full p-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Uber 23,50 ontem",
                    "Almoço Padaria Real 42,90 hoje",
                    "Ingresso cinema 58,00",
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setQuickText(example)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-[#111827] dark:hover:bg-[#1e293b] text-slate-600 dark:text-[#c6c5d5] cursor-pointer"
                    >
                      {example}
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-10 px-4 rounded-lg text-xs font-medium text-slate-600 dark:text-[#c6c5d5] hover:bg-slate-100 dark:hover:bg-[#1e293b] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!quickText.trim()}
                    className="h-10 px-5 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:text-[#0b0f19] disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Interpretar com IA</span>
                  </button>
                </div>
              </form>
            )}

            {/* MODO MANUAL */}
            {mode === "manual" && (
              <form
                onSubmit={(e) => void handleSubmitManual(e)}
                className="pt-4 space-y-4"
              >
                <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-100 dark:bg-[#111827] border border-slate-200/70 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setTxType("expense")}
                    className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      txType === "expense"
                        ? "bg-white text-[#F43F5E] shadow-xs dark:bg-[#262a35] dark:text-[#ffb4ab]"
                        : "text-slate-600 dark:text-[#908f9e]"
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType("income")}
                    className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      txType === "income"
                        ? "bg-white text-[#10B981] shadow-xs dark:bg-[#262a35] dark:text-[#4edea3]"
                        : "text-slate-600 dark:text-[#908f9e]"
                    }`}
                  >
                    Entrada / Receita
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                    Valor (BRL)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-sm font-mono text-slate-400 dark:text-[#767586] select-none">
                      R$
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={rawAmount}
                      onChange={(e) => setRawAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full h-11 pl-10 pr-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm font-mono tabular-nums text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                    Estabelecimento ou Contraparte
                  </label>
                  <input
                    type="text"
                    required
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="Ex.: Padaria Real, Uber, Salário"
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                      Categoria
                    </label>
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as ExpenseCategory)
                      }
                      className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-xs text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                      Data
                    </label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-xs font-mono text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                    Observação
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Descrição opcional"
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1]"
                  />
                </div>

                <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsReview}
                    onChange={(e) => setNeedsReview(e.target.checked)}
                    className="w-4 h-4 rounded-xs accent-[#6366F1] dark:accent-[#818cf8]"
                  />
                  <span className="text-xs text-slate-600 dark:text-[#c6c5d5]">
                    Marcar como pendente de revisão
                  </span>
                </label>

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="h-10 px-4 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-[#c6c5d5] dark:hover:bg-[#1e293b] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-10 px-5 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submitting ? "Salvando..." : "Salvar Lançamento"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};
