import React from "react";

export interface ToastItem {
  id: string;
  variant: "error" | "success" | "info";
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = React.useCallback(
    (message: string, variant: ToastItem["variant"] = "error") => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, variant, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  return {
    toasts,
    pushToast,
    dismissToast,
  };
}
