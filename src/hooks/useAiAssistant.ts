import React from "react";
import { api, ApiError } from "../lib/api";
import type { ChatMessage } from "../types/finance";
import { getCurrentTimeSaoPaulo } from "../utils/formatters";

export function useAiAssistant() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | null>(null);

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
        const res = await api.askAssistant(
          text,
          messages.map((m) => ({ role: m.role, content: m.content }))
        );
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          content: res.reply,
          confidence: res.confidence,
          cards: res.cards ?? [],
          miniSeries: res.miniSeries ?? [],
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
    isThinking,
    chatError,
    clearChatError: () => setChatError(null),
    sendMessage,
    markActionApplied,
  };
}
