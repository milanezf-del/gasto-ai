import React from "react";
import { AlertCircle, X } from "lucide-react";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "./hooks/useAuth";
import { useToast } from "./hooks/useToast";
import { useDashboard } from "./hooks/useDashboard";
import { useExpenses } from "./hooks/useExpenses";
import { useBudgets } from "./hooks/useBudgets";
import { useRules } from "./hooks/useRules";
import { useAiAssistant } from "./hooks/useAiAssistant";
import type { SuggestedAction, WorkspaceView } from "./types/finance";
import { SidebarNav } from "./components/SidebarNav";
import { TopBar } from "./components/TopBar";
import { OverviewView } from "./components/OverviewView";
import { TransactionsView } from "./components/TransactionsView";
import { ExpenseDetailView } from "./components/ExpenseDetailView";
import { BudgetsView } from "./components/BudgetsView";
import { RulesView } from "./components/RulesView";
import { AICopilotRail } from "./components/AICopilotRail";
import { AddTransactionModal } from "./components/AddTransactionModal";
import { AuthGate } from "./components/AuthGate";
import { CardSkeleton } from "./components/StateNotice";
import { ToastContainer } from "./components/ToastContainer";

export default function App() {
  const { theme, setTheme } = useTheme();
  const auth = useAuth();
  const isAuthenticated = Boolean(auth.user);
  const { toasts, pushToast, dismissToast } = useToast();

  const [activeView, setActiveView] = React.useState<WorkspaceView>("overview");
  const [selectedExpenseId, setSelectedExpenseId] = React.useState<
    string | null
  >(null);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [copilotOpenDesktop, setCopilotOpenDesktop] = React.useState(true);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = React.useState(false);
  const [newEntryModalOpen, setNewEntryModalOpen] = React.useState(false);

  const notifyError = React.useCallback(
    (msg: string) => pushToast(msg, "error"),
    [pushToast]
  );
  const notifySuccess = React.useCallback(
    (msg: string) => pushToast(msg, "success"),
    [pushToast]
  );

  const dashboardState = useDashboard(isAuthenticated);
  const refetchDashboard = dashboardState.refetch;
  const rulesState = useRules(isAuthenticated);
  const refetchRules = rulesState.refetch;

  const handleBudgetChanged = React.useCallback(() => {
    void refetchDashboard();
  }, [refetchDashboard]);

  const budgetsState = useBudgets(isAuthenticated, handleBudgetChanged);
  const refetchBudgets = budgetsState.refetch;

  const refreshAggregates = React.useCallback(() => {
    void refetchDashboard();
    void refetchBudgets();
    void refetchRules();
  }, [refetchDashboard, refetchBudgets, refetchRules]);

  const expensesState = useExpenses(
    isAuthenticated,
    refreshAggregates,
    notifyError
  );
  const aiState = useAiAssistant();

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0b0f19] p-6">
        <div className="w-full max-w-md">
          <CardSkeleton lines={4} />
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  if (!auth.user) {
    return (
      <>
        <AuthGate
          theme={theme}
          onChangeTheme={setTheme}
          submitting={auth.submitting}
          error={auth.error}
          notice={auth.notice}
          onClearMessages={auth.clearMessages}
          onLogin={auth.login}
          onSignup={auth.signup}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const activeActionError =
    expensesState.actionError ||
    budgetsState.actionError ||
    rulesState.actionError;

  const dismissActionError = () => {
    expensesState.clearActionError();
    budgetsState.clearActionError();
    rulesState.clearActionError();
  };

  const handleSelectView = (view: WorkspaceView) => {
    setSelectedExpenseId(null);
    setActiveView(view);
  };

  const handleExecuteAction = (messageId: string, action: SuggestedAction) => {
    if (action.type === "categorize_pending") {
      void expensesState.categorizePending();
    } else if (
      action.type === "adjust_budget" &&
      action.category &&
      typeof action.amountCents === "number"
    ) {
      void budgetsState.updateBudgetLimit(
        action.category,
        action.amountCents,
        80
      );
    } else if (action.type === "navigate" && action.view) {
      handleSelectView(action.view);
    }
    aiState.markActionApplied(messageId, action.id);
  };

  const pendingCount =
    dashboardState.data?.pendingCount ??
    expensesState.expenses.filter((t) => t.status === "needs_review").length;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0b0f19] text-[#0F172A] dark:text-[#dfe2f1]">
      <SidebarNav
        activeView={activeView}
        onSelectView={handleSelectView}
        pendingCount={pendingCount}
        user={auth.user}
        onLogout={() => void auth.logout()}
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

          {selectedExpenseId ? (
            <ExpenseDetailView
              expenseId={selectedExpenseId}
              onClose={() => setSelectedExpenseId(null)}
              onUpdate={expensesState.updateExpense}
              onDelete={expensesState.deleteExpense}
            />
          ) : (
            <>
              {activeView === "overview" && (
                <OverviewView
                  month={dashboardState.month}
                  onChangeMonth={dashboardState.setMonth}
                  onPrevMonth={dashboardState.prevMonth}
                  onNextMonth={dashboardState.nextMonth}
                  dashboard={dashboardState.data}
                  loading={dashboardState.loading}
                  error={dashboardState.error}
                  onRetry={() => void dashboardState.refetch()}
                  insights={dashboardState.insights}
                  insightsEmpty={dashboardState.insightsEmpty}
                  insightsLoading={dashboardState.insightsLoading}
                  isCategorizing={expensesState.mutating}
                  onCategorizePending={() =>
                    void expensesState.categorizePending()
                  }
                  onOpenNewEntry={() => setNewEntryModalOpen(true)}
                  onSelectExpense={(id) => setSelectedExpenseId(id)}
                  onNavigate={handleSelectView}
                />
              )}

              {activeView === "transactions" && (
                <TransactionsView
                  expenses={expensesState.expenses}
                  filters={expensesState.filters}
                  onChangeFilters={expensesState.setFilters}
                  onResetFilters={expensesState.resetFilters}
                  hasMore={expensesState.hasMore}
                  totalCount={expensesState.totalCount}
                  loading={expensesState.loading}
                  loadingMore={expensesState.loadingMore}
                  error={expensesState.error}
                  onRetry={() => void expensesState.refetch()}
                  onLoadMore={() => void expensesState.loadMore()}
                  isCategorizing={expensesState.mutating}
                  onCategorizePending={() =>
                    void expensesState.categorizePending()
                  }
                  onUpdateCategory={(id, cat) =>
                    void expensesState.updateCategory(id, cat)
                  }
                  onDeleteExpense={expensesState.deleteExpense}
                  onSelectExpense={(id) => setSelectedExpenseId(id)}
                  onOpenNewEntry={() => setNewEntryModalOpen(true)}
                  onNotifyError={notifyError}
                  onNotifySuccess={notifySuccess}
                />
              )}

              {activeView === "budgets" && (
                <BudgetsView
                  budgets={budgetsState.budgets}
                  loading={budgetsState.loading}
                  error={budgetsState.error}
                  onRetry={() => void budgetsState.refetch()}
                  dashboard={dashboardState.data}
                  onUpdateBudgetLimit={(cat, cents, alertPct) =>
                    budgetsState.updateBudgetLimit(cat, cents, alertPct)
                  }
                  onNotifySuccess={notifySuccess}
                  onNotifyError={notifyError}
                />
              )}

              {activeView === "rules" && (
                <RulesView
                  user={auth.user}
                  rules={rulesState.rules}
                  loading={rulesState.loading}
                  error={rulesState.error}
                  onRetry={() => void rulesState.refetch()}
                  onDeleteRule={(norm) => void rulesState.deleteRule(norm)}
                  onLogout={() => void auth.logout()}
                  onDeleteAccount={auth.deleteAccount}
                  onNotifySuccess={notifySuccess}
                  onNotifyError={notifyError}
                />
              )}
            </>
          )}
        </main>
      </div>

      <AICopilotRail
        messages={aiState.messages}
        isThinking={aiState.isThinking}
        chatError={aiState.chatError}
        onClearChatError={aiState.clearChatError}
        onSendMessage={(text) => void aiState.sendMessage(text)}
        onExecuteAction={handleExecuteAction}
        onSelectExpense={(id) => {
          setSelectedExpenseId(id);
          setCopilotDrawerOpen(false);
        }}
        desktopOpen={copilotOpenDesktop}
        mobileDrawerOpen={copilotDrawerOpen}
        onCloseMobileDrawer={() => setCopilotDrawerOpen(false)}
      />

      <AddTransactionModal
        open={newEntryModalOpen}
        onClose={() => setNewEntryModalOpen(false)}
        submitting={expensesState.mutating}
        onSubmitExpense={async (input) => {
          await expensesState.createExpense(input);
        }}
        onConfirmExpense={async (input) => {
          await expensesState.confirmExpense(input);
        }}
        onNotifySuccess={notifySuccess}
        onNotifyError={notifyError}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
