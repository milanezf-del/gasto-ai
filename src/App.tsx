import React from "react";
import { AlertCircle, X } from "lucide-react";
import { api } from "./lib/api";
import { useTheme } from "./hooks/useTheme";
import { useSummary } from "./hooks/useSummary";
import { useExpenses } from "./hooks/useExpenses";
import { useBudgets } from "./hooks/useBudgets";
import { useAccounts } from "./hooks/useAccounts";
import { useAiAssistant } from "./hooks/useAiAssistant";
import type { SuggestedAction, WorkspaceView } from "./types/finance";
import { SidebarNav } from "./components/SidebarNav";
import { TopBar } from "./components/TopBar";
import { OverviewView } from "./components/OverviewView";
import { TransactionsView } from "./components/TransactionsView";
import { BudgetsView } from "./components/BudgetsView";
import { AccountsView } from "./components/AccountsView";
import { AICopilotRail } from "./components/AICopilotRail";
import { AddTransactionModal } from "./components/AddTransactionModal";

export default function App() {
  const { theme, setTheme } = useTheme();
  const [activeView, setActiveView] = React.useState<WorkspaceView>("overview");
  const [apiHealthy, setApiHealthy] = React.useState<boolean | null>(null);

  const summaryState = useSummary();
  const expensesState = useExpenses();
  const budgetsState = useBudgets();
  const accountsState = useAccounts();
  const aiState = useAiAssistant();

  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [copilotOpenDesktop, setCopilotOpenDesktop] = React.useState(true);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = React.useState(false);
  const [newEntryModalOpen, setNewEntryModalOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    api
      .health()
      .then((res) => {
        if (mounted) setApiHealthy(Boolean(res.ok));
      })
      .catch(() => {
        if (mounted) setApiHealthy(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const activeActionError =
    expensesState.actionError ||
    budgetsState.actionError ||
    accountsState.actionError;

  const dismissActionError = () => {
    expensesState.clearActionError();
    budgetsState.clearActionError();
    accountsState.clearActionError();
  };

  const handleExecuteAction = (messageId: string, action: SuggestedAction) => {
    if (action.type === "categorize_pending") {
      void expensesState.categorizePending();
    } else if (
      action.type === "adjust_budget" &&
      action.category &&
      typeof action.amountCents === "number"
    ) {
      void budgetsState.updateBudgetLimit(action.category, action.amountCents);
    } else if (action.type === "pause_subscription" && action.subscriptionId) {
      void budgetsState.toggleSubscription(action.subscriptionId);
    } else if (action.type === "navigate" && action.view) {
      setActiveView(action.view);
    }
    aiState.markActionApplied(messageId, action.id);
  };

  const handleAskAI = (prompt: string) => {
    if (!copilotOpenDesktop) setCopilotOpenDesktop(true);
    if (window.innerWidth < 1280) setCopilotDrawerOpen(true);
    void aiState.sendMessage(prompt);
  };

  const pendingCount = expensesState.expenses.filter(
    (t) => t.category === "Sem categoria" || t.status === "Revisão pendente"
  ).length;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0b0f19] text-[#0F172A] dark:text-[#dfe2f1]">
      <SidebarNav
        activeView={activeView}
        onSelectView={setActiveView}
        pendingCount={pendingCount}
        user={summaryState.data?.user}
        apiHealthy={apiHealthy}
        onOpenNewEntry={() => setNewEntryModalOpen(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeView={activeView}
          theme={theme}
          onChangeTheme={setTheme}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onToggleCopilotDrawer={() => setCopilotDrawerOpen((o) => !o)}
          copilotOpenDesktop={copilotOpenDesktop}
          onToggleCopilotDesktop={() => setCopilotOpenDesktop((o) => !o)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {activeActionError && (
            <div
              role="alert"
              className="mb-5 rounded-lg px-4 py-3 flex items-center justify-between gap-3 bg-[#F43F5E]/10 border border-[#F43F5E]/30 text-xs text-[#93000a] dark:text-[#ffb4ab]"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{activeActionError}</span>
              </div>
              <button
                type="button"
                onClick={dismissActionError}
                aria-label="Fechar alerta"
                className="p-1 rounded hover:bg-[#F43F5E]/15 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeView === "overview" && (
            <OverviewView
              summary={summaryState.data}
              summaryLoading={summaryState.loading}
              summaryError={summaryState.error}
              onRetrySummary={() => void summaryState.refetch()}
              expenses={expensesState.expenses}
              expensesLoading={expensesState.loading}
              expensesError={expensesState.error}
              onRetryExpenses={() => void expensesState.refetch()}
              budgets={budgetsState.budgets}
              budgetsLoading={budgetsState.loading}
              budgetsError={budgetsState.error}
              onRetryBudgets={() => void budgetsState.refetch()}
              isCategorizing={expensesState.mutating}
              onCategorizePending={() => void expensesState.categorizePending()}
              onOpenNewEntry={() => setNewEntryModalOpen(true)}
              onNavigate={setActiveView}
              onAskAI={handleAskAI}
            />
          )}

          {activeView === "transactions" && (
            <TransactionsView
              expenses={expensesState.expenses}
              loading={expensesState.loading}
              error={expensesState.error}
              onRetry={() => void expensesState.refetch()}
              accounts={accountsState.accounts}
              isCategorizing={expensesState.mutating}
              onCategorizePending={() => void expensesState.categorizePending()}
              onUpdateCategory={(id, cat) =>
                void expensesState.updateCategory(id, cat)
              }
              onDeleteExpense={(id) => void expensesState.deleteExpense(id)}
              onOpenNewEntry={() => setNewEntryModalOpen(true)}
            />
          )}

          {activeView === "budgets" && (
            <BudgetsView
              budgets={budgetsState.budgets}
              subscriptions={budgetsState.subscriptions}
              loading={budgetsState.loading}
              error={budgetsState.error}
              onRetry={() => void budgetsState.refetch()}
              summary={summaryState.data}
              onUpdateBudgetLimit={(cat, cents) =>
                void budgetsState.updateBudgetLimit(cat, cents)
              }
              onToggleSubscription={(id) =>
                void budgetsState.toggleSubscription(id)
              }
            />
          )}

          {activeView === "accounts" && (
            <AccountsView
              accounts={accountsState.accounts}
              loading={accountsState.loading}
              syncing={accountsState.syncing}
              error={accountsState.error}
              onRetry={() => void accountsState.refetch()}
              onSyncAccounts={() => void accountsState.syncAccounts()}
              onTransfer={accountsState.transferAccounts}
            />
          )}
        </main>
      </div>

      <AICopilotRail
        messages={aiState.messages}
        isThinking={aiState.isThinking}
        briefing={aiState.briefing}
        isBriefingLoading={aiState.isBriefingLoading}
        briefingError={aiState.briefingError}
        chatError={aiState.chatError}
        onClearChatError={aiState.clearChatError}
        onRefreshBriefing={() => void aiState.refreshBriefing()}
        onSendMessage={(text) => void aiState.sendMessage(text)}
        onExecuteAction={handleExecuteAction}
        desktopOpen={copilotOpenDesktop}
        mobileDrawerOpen={copilotDrawerOpen}
        onCloseMobileDrawer={() => setCopilotDrawerOpen(false)}
      />

      <AddTransactionModal
        open={newEntryModalOpen}
        onClose={() => setNewEntryModalOpen(false)}
        accounts={accountsState.accounts}
        submitting={expensesState.mutating}
        onSubmitExpense={async (input) => {
          await expensesState.createExpense(input);
        }}
      />
    </div>
  );
}
