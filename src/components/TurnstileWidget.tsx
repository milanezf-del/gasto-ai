import React from "react";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface TurnstileWidgetProps {
  onTokenChange: (token: string | undefined) => void;
}

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();

export const isTurnstileEnabled = Boolean(SITE_KEY);

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onTokenChange,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!SITE_KEY) return;

    let widgetId: string | null = null;
    let cancelled = false;

    const mountWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      const isDark = document.documentElement.classList.contains("dark");
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: isDark ? "dark" : "light",
        callback: (token) => onTokenChange(token),
        "expired-callback": () => onTokenChange(undefined),
        "error-callback": () => onTokenChange(undefined),
      });
    };

    if (window.turnstile) {
      mountWidget();
    } else {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[data-turnstile-script="true"]'
      );
      if (existingScript) {
        existingScript.addEventListener("load", mountWidget);
      } else {
        const script = document.createElement("script");
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.turnstileScript = "true";
        script.addEventListener("load", mountWidget);
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // Ignora remoção caso o nó já tenha sido desmontado
        }
      }
    };
  }, [onTokenChange]);

  if (!SITE_KEY) return null;

  return (
    <div className="pt-1 flex justify-center">
      <div ref={containerRef} />
    </div>
  );
};
