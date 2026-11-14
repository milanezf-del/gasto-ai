import React from "react";
import { api, ApiError } from "../lib/api";
import type { AiBriefing, ChatMessage } from "../types/finance";
import { getCurrentTimeSaoPaulo } from "../utils/formatters";

export function useAiAssistant() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [briefing, setBriefing] = React.useState<AiBriefing | null>(null);
  const [isThinking, setIsThinking] = React.useState(false);
  const [isBriefingLoading, setIsBriefingLoading] = React.useState(true);
  const [briefingError, setBriefingError] = React.useState<string | null>(null);
  const [chatError, setChatError] = React.useState<string | null>(null);

  const refreshBriefing = React.useCallback(async () => {
    setIsBriefingLoading(true);
    setBriefingError(null);
    try {
      const res = await api.getBriefing();
      setBriefing(res);
    } catch (err) {
      setBriefingError(
        err instanceof ApiError
          ? err.message
          : "Resumo de IA indisponível no momento."
      );
      setBriefing(null);
    } finally {
      setIsBriefingLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshBriefing();
  }, [refreshBriefing]);

  const sendMessage = React.useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: text,
        timestamp: getCurrentTimeSaoPaulo(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsThinking(true);
      setChatError(null);

      try {
        const res = await api.sendAiChat(
          text,
          messages.map((m) => ({ role: m.role, content: m.content }))
        );
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          content: res.reply,
          confidence: res.confidence,
          suggestedActions: res.suggestedActions ?? [],
          timestamp: getCurrentTimeSaoPaulo(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Não foi possível consultar o assistente financeiro.";
        setChatError(msg);
      } finally {
        setIsThinking(false);
      }
    },
    [messages]
  );

  const markActionApplied = React.useCallback(
    (messageId: string, actionId: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.suggestedActions) return m;
          return {
            ...m,
            suggestedActions: m.suggestedActions.map((a) =>
              a.id === actionId ? { ...a, applied: true } : a
            ),
          };
        })
      );
    },
    []
  );

  return {
    messages,
    briefing,
    isThinking,
    isBriefingLoading,
    briefingError,
    chatError,
    clearChatError: () => setChatError(null),
    sendMessage,
    refreshBriefing,
    markActionApplied,
  };
}
