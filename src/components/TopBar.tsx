import React from "react";
import { Menu, Moon, Sun, Monitor, Sparkles } from "lucide-react";
import type { ThemePreference, WorkspaceView } from "../types/finance";
import { PWAInstallButton } from "./PWAInstallButton";

interface TopBarProps {
  activeView: WorkspaceView;
  theme: ThemePreference;
  onChangeTheme: (theme: ThemePreference) => void;
  onOpenMobileNav: () => void;
  onToggleCopilotDrawer: () => void;
  copilotOpenDesktop: boolean;
  onToggleCopilotDesktop: () => void;
}

const VIEW_TITLES: Record<WorkspaceView, string> = {
  overview: "Visão Geral",
  transactions: "Despesas e Lançamentos",
  budgets: "Orçamentos e Metas",
  rules: "Perfil e Regras",
};

const THEME_OPTIONS: Array<{
  id: ThemePreference;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Monitor },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  theme,
  onChangeTheme,
  onOpenMobileNav,
  onToggleCopilotDrawer,
  copilotOpenDesktop,
  onToggleCopilotDesktop,
}) => {
  return (
    <header className="h-16 sticky top-0 z-30 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]/90 dark:bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08]">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Abrir menu de navegação"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 dark:text-[#c6c5d5] dark:hover:text-white dark:hover:bg-[#1e293b] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 dark:text-[#767586] hidden sm:inline whitespace-nowrap">
            Gastô
          </span>
          <span
            aria-hidden="true"
            className="text-slate-300 dark:text-[#454653] hidden sm:inline"
          >
            /
          </span>
          <h1 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1] truncate">
            {VIEW_TITLES[activeView]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
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
                title={`Tema ${opt.label}`}
                aria-pressed={active}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] ${
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

        <button
          type="button"
          onClick={onToggleCopilotDrawer}
          className="xl:hidden h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-semibold bg-[#6366F1]/10 text-[#4338CA] dark:bg-[#818cf8]/15 dark:text-[#bdc2ff] border border-[#6366F1]/25 dark:border-[#818cf8]/25 hover:bg-[#6366F1]/15 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Assistente IA</span>
        </button>

        <button
          type="button"
          onClick={onToggleCopilotDesktop}
          className={`hidden xl:flex h-9 px-3 items-center gap-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            copilotOpenDesktop
              ? "bg-[#6366F1]/10 text-[#4338CA] border-[#6366F1]/25 dark:bg-[#818cf8]/15 dark:text-[#bdc2ff] dark:border-[#818cf8]/25"
              : "bg-white dark:bg-[#171b26] text-slate-700 dark:text-[#c6c5d5] border-slate-200/80 dark:border-white/[0.08]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{copilotOpenDesktop ? "Ocultar IA" : "Abrir IA"}</span>
        </button>
      </div>
    </header>
  );
};
