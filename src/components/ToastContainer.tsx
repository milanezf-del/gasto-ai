import React from "react";
import { AlertCircle, CheckCircle2, Info, WifiOff, X } from "lucide-react";
import type { ToastItem } from "../hooks/useToast";
import { useOnlineStatus } from "../hooks/usePWAInstall";

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  const isOnline = useOnlineStatus();

  return (
    <>
      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-[#D97706] px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Sem conexão — verifique sua rede para salvar alterações</span>
        </div>
      )}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]"
        >
          {toasts.map((toast) => {
            const Icon =
              toast.variant === "success"
                ? CheckCircle2
                : toast.variant === "info"
                ? Info
                : AlertCircle;

            const styleClass =
              toast.variant === "success"
                ? "bg-[#065F46] text-white border-[#10B981]/40"
                : toast.variant === "info"
                ? "bg-[#1E293B] text-white border-white/15"
                : "bg-[#991B1B] text-white border-[#F43F5E]/40";

            return (
              <div
                key={toast.id}
                role={toast.variant === "error" ? "alert" : "status"}
                className={`flex items-start justify-between gap-2.5 rounded-xl border px-3.5 py-3 text-xs shadow-lg ${styleClass}`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{toast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDismiss(toast.id)}
                  aria-label="Fechar notificação"
                  className="p-0.5 rounded hover:bg-white/15 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
