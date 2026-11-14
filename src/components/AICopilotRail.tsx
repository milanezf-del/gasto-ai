import React from "react";
import { Sparkles, Send, RefreshCw, Check, X, AlertCircle } from "lucide-react";
import type { AiBriefing, ChatMessage, SuggestedAction } from "../types/finance";
import { aiChatInputSchema } from "../lib/schemas";

interface AICopilotRailProps {
  messages: ChatMessage[];
  isThinking: boolean;
  briefing: AiBriefing | null;
  isBriefingLoading: boolean;
  briefingError: string | null;
  chatError: string | null;
  onClearChatError: () => void;
  onRefreshBriefing: () => void;
  onSendMessage: (text: string) => void;
  onExecuteAction: (messageId: string, action: SuggestedAction) => void;
  desktopOpen: boolean;
  mobileDrawerOpen: boolean;
  onCloseMobileDrawer: () => void;
}

const QUICK_PROMPTS = [
  "Analisar ritmo de gastos",
  "Identificar assinaturas ociosas",
  "Projetar saldo do mês",
];

export const AICopilotRail: React.FC<AICopilotRailProps> = ({
  messages,
  isThinking,
  briefing,
  isBriefingLoading,
  briefingError,
  chatError,
  onClearChatError,
  onRefreshBriefing,
  onSendMessage,
  onExecuteAction,
  desktopOpen,
  mobileDrawerOpen,
  onCloseMobileDrawer,
}) => {
  const [input, setInput] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(
    null
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isThinking) return;
    setValidationError(null);

    const parsed = aiChatInputSchema.safeParse({ message: input });
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? "Digite uma mensagem válida."
      );
      return;
    }

    onSendMessage(parsed.data.message);
    setInput("");
  };

  const railBody = (
    <div className="flex h-full flex-col bg-white dark:bg-[#0f131d] border-l border-slate-200/80 dark:border-white/[0.08]">
      {/* Rail Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#6366F1] dark:text-[#818cf8]" />
          <h2 className="font-display text-sm font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
            Assistente Financeiro IA
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onRefreshBriefing}
            disabled={isBriefingLoading}
            title="Atualizar resumo executivo"
            aria-label="Atualizar resumo executivo"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:text-[#908f9e] dark:hover:text-[#dfe2f1] hover:bg-slate-100 dark:hover:bg-[#1e293b] cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isBriefingLoading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={onCloseMobileDrawer}
            aria-label="Fechar assistente IA"
            className="xl:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:text-[#908f9e] dark:hover:text-[#dfe2f1] hover:bg-slate-100 dark:hover:bg-[#1e293b] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Executive Briefing Insight Card */}
      <div className="p-4 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
        <div
          className="rounded-xl p-4 border border-[#6366F1]/25 dark:border-[#818cf8]/25 shadow-[0_0_24px_-4px_rgba(129,140,248,0.12)]"
          style={{
            background:
              "linear-gradient(135deg, rgba(129, 140, 248, 0.08) 0%, rgba(17, 24, 39, 0) 100%)",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] font-semibold tracking-wide text-[#4338CA] dark:text-[#bdc2ff]">
              Resumo Executivo
            </span>
            {briefing && (
              <span className="text-[11px] font-mono tabular-nums text-[#4338CA] dark:text-[#bdc2ff]">
                {briefing.confidence}% confiança
              </span>
            )}
          </div>

          {isBriefingLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-3.5 w-3/4 rounded ai-shimmer" />
              <div className="h-3 w-full rounded ai-shimmer" />
              <div className="h-3 w-5/6 rounded ai-shimmer" />
            </div>
          ) : briefingError ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-[#c6c5d5]">
                {briefingError}
              </p>
              <button
                type="button"
                onClick={onRefreshBriefing}
                className="text-[11px] font-medium text-[#4338CA] dark:text-[#bdc2ff] hover:underline cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          ) : briefing ? (
            <>
              <div className="text-xs font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
                {briefing.headline}
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-[#c6c5d5] mt-1">
                {briefing.summary}
              </p>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-slate-600 dark:text-[#c6c5d5]">
              Ainda não há dados suficientes para gerar um resumo automático.
            </p>
          )}
        </div>
      </div>

      {/* Conversation Thread */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 && !isThinking && (
          <div className="rounded-xl p-4 border border-dashed border-slate-200 dark:border-white/[0.08] text-center">
            <p className="text-xs font-medium text-[#0F172A] dark:text-[#dfe2f1]">
              Consulte o Gastô sobre suas finanças
            </p>
            <p className="text-[11px] text-slate-500 dark:text-[#908f9e] mt-1">
              As respostas são geradas exclusivamente no servidor a partir dos seus dados reais.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 bg-slate-100 dark:bg-[#1e293b] text-xs leading-relaxed text-[#0F172A] dark:text-[#dfe2f1]">
                  {msg.content}
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="space-y-2">
              <div className="rounded-xl p-3.5 border border-[#6366F1]/25 dark:border-[#818cf8]/25 bg-transparent">
                <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 font-medium text-[#4338CA] dark:text-[#bdc2ff]">
                    <Sparkles className="w-3 h-3" />
                    <span>Gastô IA</span>
                  </span>
                  {msg.confidence && (
                    <span className="font-mono tabular-nums text-slate-500 dark:text-[#908f9e]">
                      {msg.confidence}% confiança
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-[#dfe2f1]">
                  {msg.content}
                </p>

                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap gap-2">
                    {msg.suggestedActions.map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        disabled={act.applied}
                        onClick={() => onExecuteAction(msg.id, act)}
                        className={`h-7 px-2.5 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                          act.applied
                            ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/25 cursor-default"
                            : "bg-[#6366F1]/10 hover:bg-[#6366F1]/20 text-[#4338CA] dark:bg-[#818cf8]/15 dark:hover:bg-[#818cf8]/25 dark:text-[#bdc2ff] border border-[#6366F1]/25 dark:border-[#818cf8]/25"
                        }`}
                      >
                        {act.applied && <Check className="w-3 h-3" />}
                        <span>
                          {act.applied ? `${act.label} · Aplicado` : act.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="rounded-xl p-3.5 border border-[#6366F1]/20 dark:border-[#818cf8]/20 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] text-[#4338CA] dark:text-[#bdc2ff]">
              <Sparkles className="w-3 h-3" />
              <span>Consultando análise no servidor...</span>
            </div>
            <div className="h-3 w-full rounded ai-shimmer" />
            <div className="h-3 w-4/5 rounded ai-shimmer" />
          </div>
        )}

        {chatError && (
          <div
            role="alert"
            className="rounded-lg p-3 bg-[#F43F5E]/10 border border-[#F43F5E]/30 flex items-start justify-between gap-2 text-xs text-[#93000a] dark:text-[#ffb4ab]"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{chatError}</span>
            </div>
            <button
              type="button"
              onClick={onClearChatError}
              aria-label="Fechar aviso"
              className="p-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Prompt Composer */}
      <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2.5 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={isThinking}
              onClick={() => onSendMessage(q)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-[#c6c5d5] bg-slate-100 hover:bg-slate-200/80 dark:bg-[#171b26] dark:hover:bg-[#1e293b] border border-slate-200/70 dark:border-white/[0.06] transition-colors cursor-pointer whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>

        {validationError && (
          <p className="text-[11px] text-[#F43F5E]">{validationError}</p>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre gastos, metas ou saldo..."
            className="flex-1 h-10 px-3 rounded-lg bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-white/[0.1] text-xs text-[#0F172A] dark:text-[#dfe2f1] placeholder:text-slate-400 dark:placeholder:text-[#767586] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            aria-label="Enviar pergunta"
            className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white disabled:opacity-40 transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {desktopOpen && (
        <aside className="hidden xl:block w-[380px] shrink-0 h-screen sticky top-0">
          {railBody}
        </aside>
      )}

      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-[2px]"
            onClick={onCloseMobileDrawer}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-full max-w-[380px] h-full">
            {railBody}
          </aside>
        </div>
      )}
    </>
  );
};
