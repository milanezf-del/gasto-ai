import React from "react";
import {
  LayoutDashboard,
  ListOrdered,
  SlidersHorizontal,
  Landmark,
  Plus,
  X,
  User,
} from "lucide-react";
import type { UserProfile, WorkspaceView } from "../types/finance";

interface SidebarNavProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  pendingCount: number;
  user?: UserProfile;
  apiHealthy: boolean | null;
  onOpenNewEntry: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: WorkspaceView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "transactions", label: "Lançamentos", icon: ListOrdered },
  { id: "budgets", label: "Orçamentos e Metas", icon: SlidersHorizontal },
  { id: "accounts", label: "Contas", icon: Landmark },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeView,
  onSelectView,
  pendingCount,
  user,
  apiHealthy,
  onOpenNewEntry,
  mobileOpen,
  onCloseMobile,
}) => {
  const [imgError, setImgError] = React.useState(false);

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-[#0f131d] border-r border-slate-200/80 dark:border-white/[0.08] px-4 py-5 select-none">
      <div>
        <div className="flex items-center justify-between px-2 pb-6">
          <button
            type="button"
            onClick={() => {
              onSelectView("overview");
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] rounded-md cursor-pointer"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
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
            <span className="font-display text-lg font-bold tracking-tight text-[#0F172A] dark:text-[#dfe2f1] whitespace-nowrap">
              Gastô
            </span>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar navegação"
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-[#908f9e] dark:hover:text-[#dfe2f1] hover:bg-slate-100 dark:hover:bg-[#1e293b]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenNewEntry();
            onCloseMobile();
          }}
          className="w-full mb-5 flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white transition-all duration-150 cursor-pointer whitespace-nowrap shadow-[0_2px_10px_rgba(99,102,241,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0f131d]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>Novo Lançamento</span>
        </button>

        <nav aria-label="Navegação principal" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] ${
                  isActive
                    ? "bg-[#6366F1]/10 text-[#4338CA] dark:bg-[#818cf8]/15 dark:text-[#bdc2ff]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-[#908f9e] dark:hover:text-[#dfe2f1] dark:hover:bg-[#171b26]"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? "text-[#6366F1] dark:text-[#818cf8]"
                        : "text-slate-400 dark:text-[#767586]"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === "transactions" && pendingCount > 0 && (
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#D97706] dark:text-[#f59e0b]">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.08] space-y-3">
        <div className="flex items-center gap-3 px-2 py-1">
          {user?.avatarUrl && !imgError ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-white/[0.1] shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-[#171b26] border border-slate-200/70 dark:border-white/[0.08] text-slate-500 dark:text-[#908f9e] flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-[#0F172A] dark:text-[#dfe2f1] truncate">
              {user ? user.name : "Conta não autenticada"}
            </div>
            <div className="text-xs text-slate-500 dark:text-[#908f9e] truncate">
              {user
                ? user.planLabel
                : apiHealthy
                ? "API conectada"
                : "Aguardando conexão"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[240px] shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[260px] max-w-[80vw] h-full">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
};
