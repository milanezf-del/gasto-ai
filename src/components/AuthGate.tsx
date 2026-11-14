import React from "react";
import { Sun, Moon, Monitor, AlertCircle, CheckCircle2 } from "lucide-react";
import type { ThemePreference } from "../types/finance";
import { loginInputSchema, signupInputSchema } from "../lib/schemas";
import type { LoginInput, SignupInput } from "../lib/schemas";
import { TurnstileWidget, isTurnstileEnabled } from "./TurnstileWidget";
import { PWAInstallButton } from "./PWAInstallButton";

interface AuthGateProps {
  theme: ThemePreference;
  onChangeTheme: (theme: ThemePreference) => void;
  submitting: boolean;
  error: string | null;
  notice: string | null;
  onClearMessages: () => void;
  onLogin: (input: LoginInput) => Promise<void>;
  onSignup: (input: SignupInput) => Promise<void>;
}

const THEME_OPTIONS: Array<{
  id: ThemePreference;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Monitor },
];

export const AuthGate: React.FC<AuthGateProps> = ({
  theme,
  onChangeTheme,
  submitting,
  error,
  notice,
  onClearMessages,
  onLogin,
  onSignup,
}) => {
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState<string | undefined>(
    undefined
  );
  const [localError, setLocalError] = React.useState<string | null>(null);

  const switchMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setLocalError(null);
    setTurnstileToken(undefined);
    onClearMessages();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    onClearMessages();

    if (isTurnstileEnabled && !turnstileToken) {
      setLocalError("Conclua a verificação de segurança antes de continuar.");
      return;
    }

    if (mode === "login") {
      const parsed = loginInputSchema.safeParse({
        email,
        password,
        turnstileToken,
      });
      if (!parsed.success) {
        setLocalError(
          parsed.error.issues[0]?.message ?? "Verifique seu e-mail e senha."
        );
        return;
      }
      await onLogin(parsed.data).catch(() => {});
    } else {
      const parsed = signupInputSchema.safeParse({
        name,
        email,
        password,
        turnstileToken,
      });
      if (!parsed.success) {
        setLocalError(
          parsed.error.issues[0]?.message ?? "Verifique os dados informados."
        );
        return;
      }
      await onSignup(parsed.data).catch(() => {});
    }
  };

  const visibleError = localError || error;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#0b0f19] text-[#0F172A] dark:text-[#dfe2f1] p-6">
      <div className="flex items-center justify-between gap-3 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="20"
              height="20"
              rx="5"
              className="fill-[#6366F1] dark:fill-[#818cf8]"
            />
            <path
              d="M15.5 9.2A4.5 4.5 0 1 0 16.5 13H12.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white dark:text-[#0b0f19]"
            />
          </svg>
          <span className="font-display text-lg font-bold tracking-tight">
            Gastô
          </span>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton />
          <div
            role="group"
            aria-label="Tema de exibição"
            className="flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-[#171b26] border border-slate-200/80 dark:border-white/[0.08]"
          >
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeTheme(opt.id)}
                  aria-pressed={active}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                    active
                      ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                      : "text-slate-600 hover:text-slate-900 dark:text-[#908f9e] dark:hover:text-[#dfe2f1]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="w-full max-w-md mx-auto my-8 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-6 sm:p-8 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#dfe2f1]">
            {mode === "login" ? "Entrar no Gastô" : "Criar sua conta"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-1">
            {mode === "login"
              ? "Acesse seus lançamentos, orçamentos e análises financeiras."
              : "Comece a organizar seus gastos em centavos com classificação inteligente."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-lg bg-slate-100 dark:bg-[#171b26] border border-slate-200/70 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              mode === "login"
                ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                : "text-slate-600 dark:text-[#908f9e]"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`h-9 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              mode === "signup"
                ? "bg-white text-[#0F172A] shadow-xs dark:bg-[#262a35] dark:text-[#dfe2f1]"
                : "text-slate-600 dark:text-[#908f9e]"
            }`}
          >
            Criar conta
          </button>
        </div>

        {visibleError && (
          <div
            role="alert"
            className="mb-4 rounded-lg px-3.5 py-2.5 flex items-start gap-2 bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-xs text-[#93000a] dark:text-[#ffb4ab]"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{visibleError}</span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg px-3.5 py-2.5 flex items-start gap-2 bg-[#10B981]/10 border border-[#10B981]/30 text-xs text-[#005236] dark:text-[#4edea3]"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label
                htmlFor="auth-name"
                className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5"
              >
                Nome
              </label>
              <input
                id="auth-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8]"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5"
            >
              E-mail
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8]"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5"
            >
              Senha
            </label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#171b26] border border-slate-300 dark:border-white/[0.1] text-sm text-[#0F172A] dark:text-[#dfe2f1] focus:outline-none focus:border-[#6366F1] dark:focus:border-[#818cf8]"
            />
          </div>

          <TurnstileWidget key={mode} onTokenChange={setTurnstileToken} />

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting
              ? "Processando..."
              : mode === "login"
              ? "Entrar na Conta"
              : "Criar Conta"}
          </button>
        </form>
      </main>

      <footer className="text-center text-xs text-slate-500 dark:text-[#908f9e]">
        Gastô · Controle financeiro em BRL · Fuso America/Sao_Paulo
      </footer>
    </div>
  );
};
