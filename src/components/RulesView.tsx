import React from "react";
import {
  Trash2,
  LogOut,
  ShieldCheck,
  Bell,
  Download,
  AlertTriangle,
} from "lucide-react";
import type {
  AuthUser,
  MerchantRuleItem,
  NotificationPreferences,
} from "../types/finance";
import { api } from "../lib/api";
import { CATEGORY_META, formatDateBR } from "../utils/formatters";
import { EmptyState, ErrorState, TableSkeleton } from "./StateNotice";

const NOTIF_STORAGE_KEY = "gasto-notification-prefs";

const DEFAULT_PREFS: NotificationPreferences = {
  budgetAlerts: true,
  pendingReviewReminder: true,
  monthlyDigest: false,
};

function loadNotificationPrefs(): NotificationPreferences {
  try {
    const raw = window.localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      budgetAlerts: parsed.budgetAlerts ?? DEFAULT_PREFS.budgetAlerts,
      pendingReviewReminder:
        parsed.pendingReviewReminder ?? DEFAULT_PREFS.pendingReviewReminder,
      monthlyDigest: parsed.monthlyDigest ?? DEFAULT_PREFS.monthlyDigest,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

interface RulesViewProps {
  user: AuthUser;
  rules: MerchantRuleItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onDeleteRule: (merchantNorm: string) => void;
  onLogout: () => void;
  onDeleteAccount: (confirmation: string) => Promise<void>;
  onNotifySuccess: (message: string) => void;
  onNotifyError: (message: string) => void;
}

export const RulesView: React.FC<RulesViewProps> = ({
  user,
  rules,
  loading,
  error,
  onRetry,
  onDeleteRule,
  onLogout,
  onDeleteAccount,
  onNotifySuccess,
  onNotifyError,
}) => {
  const [prefs, setPrefs] = React.useState<NotificationPreferences>(
    loadNotificationPrefs
  );
  const [exporting, setExporting] = React.useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [deletingAccount, setDeletingAccount] = React.useState(false);

  const togglePref = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignora falha de quota em modo privado
      }
      return next;
    });
    onNotifySuccess("Preferência de notificação salva.");
  };

  const handleExportAllCsv = async () => {
    setExporting(true);
    try {
      await api.downloadExpensesCsv();
      onNotifySuccess("Seus dados foram exportados em CSV.");
    } catch (err) {
      onNotifyError(
        err instanceof Error
          ? err.message
          : "Não foi possível exportar seus dados."
      );
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmText.trim() !== "EXCLUIR") return;
    setDeletingAccount(true);
    try {
      await onDeleteAccount("EXCLUIR");
    } catch (err) {
      onNotifyError(
        err instanceof Error
          ? err.message
          : "Não foi possível excluir a conta."
      );
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Perfil e Sessão */}
      <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#6366F1]/10 dark:bg-[#818cf8]/15 text-[#4338CA] dark:text-[#bdc2ff] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              {user.name || user.email}
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
              {user.email} · Sessão autenticada via Supabase Auth
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg text-xs font-medium text-slate-700 dark:text-[#c6c5d5] bg-slate-100 hover:bg-slate-200 dark:bg-[#1e293b] dark:hover:bg-[#262a35] transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair da Conta</span>
        </button>
      </section>

      {/* Preferências de Notificação + Privacidade / Dados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
            <Bell className="w-4 h-4 text-[#6366F1] dark:text-[#818cf8]" />
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              Preferências de Notificação
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="font-medium text-[#0F172A] dark:text-[#dfe2f1]">
                  Alertas de orçamento atingido
                </div>
                <div className="text-slate-500 dark:text-[#908f9e]">
                  Destacar quando uma categoria atingir o percentual de alerta
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.budgetAlerts}
                onChange={() => togglePref("budgetAlerts")}
                className="w-4 h-4 accent-[#6366F1] dark:accent-[#818cf8]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="font-medium text-[#0F172A] dark:text-[#dfe2f1]">
                  Lembrete de itens pendentes de revisão
                </div>
                <div className="text-slate-500 dark:text-[#908f9e]">
                  Exibir contador no menu lateral e painel principal
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.pendingReviewReminder}
                onChange={() => togglePref("pendingReviewReminder")}
                className="w-4 h-4 accent-[#6366F1] dark:accent-[#818cf8]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="font-medium text-[#0F172A] dark:text-[#dfe2f1]">
                  Resumo de fechamento mensal
                </div>
                <div className="text-slate-500 dark:text-[#908f9e]">
                  Preferência salva localmente neste dispositivo
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.monthlyDigest}
                onChange={() => togglePref("monthlyDigest")}
                className="w-4 h-4 accent-[#6366F1] dark:accent-[#818cf8]"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none flex flex-col justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1] pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              Portabilidade e Privacidade (LGPD)
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-3 leading-relaxed">
              Exporte todas as suas despesas em CSV UTF-8 a qualquer momento ou remova definitivamente sua conta, imagens e históricos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExportAllCsv()}
              className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#1e293b] dark:hover:bg-[#262a35] text-[#0F172A] dark:text-[#dfe2f1] disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {exporting ? "Exportando..." : "Exportar meus dados"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteModalOpen(true);
              }}
              className="h-9 px-3.5 inline-flex items-center gap-2 rounded-lg text-xs font-semibold text-[#F43F5E] bg-[#F43F5E]/10 hover:bg-[#F43F5E]/15 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir minha conta e todos os meus dados</span>
            </button>
          </div>
        </section>
      </div>

      {/* Diálogo de confirmação explícita para exclusão de conta */}
      {deleteModalOpen && (
        <div
          role="alertdialog"
          aria-labelledby="delete-account-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
        >
          <form
            onSubmit={(e) => void handleConfirmDeleteAccount(e)}
            className="w-full max-w-md rounded-xl bg-white dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.12] p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#F43F5E]/10 text-[#F43F5E] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="delete-account-title"
                  className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]"
                >
                  Excluir conta permanentemente?
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-1 leading-relaxed">
                  Todos os seus lançamentos, comprovantes, orçamentos, regras e insights serão removidos de forma irreversível.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-[#c6c5d5] mb-1.5">
                Digite <strong>EXCLUIR</strong> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="EXCLUIR"
                className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-[#111827] border border-slate-300 dark:border-white/[0.1] text-sm font-mono text-[#0F172A] dark:text-[#dfe2f1]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setDeleteModalOpen(false)}
                className="h-9 px-3.5 rounded-lg text-xs font-medium text-slate-600 dark:text-[#c6c5d5] hover:bg-slate-100 dark:hover:bg-[#1e293b] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  deletingAccount || deleteConfirmText.trim() !== "EXCLUIR"
                }
                className="h-9 px-4 rounded-lg text-xs font-semibold bg-[#F43F5E] hover:bg-[#E11D48] text-white disabled:opacity-40 cursor-pointer"
              >
                {deletingAccount
                  ? "Excluindo conta..."
                  : "Confirmar Exclusão"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Regras Aprendidas */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : error ? (
        <ErrorState
          title="Erro ao carregar regras aprendidas"
          message={error}
          onRetry={onRetry}
        />
      ) : rules.length === 0 ? (
        <EmptyState
          title="Nenhuma regra automática registrada"
          description="Sempre que você alterar a categoria de um estabelecimento em Lançamentos ou na revisão de comprovantes, o Gastô aprende automaticamente."
        />
      ) : (
        <section className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
            <h2 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
              Regras Aprendidas por Estabelecimento
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5">
              Aplicadas automaticamente quando novos lançamentos chegam para revisão
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
            {rules.map((rule) => {
              const meta = CATEGORY_META[rule.category];
              return (
                <div
                  key={rule.merchant_norm}
                  className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-[#171b26]/70 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#0F172A] dark:text-[#dfe2f1] truncate">
                      {rule.merchant_norm}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-[#908f9e] mt-0.5 flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-xs shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span>{rule.category}</span>
                      {rule.updated_at && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            Atualizada em{" "}
                            {formatDateBR(rule.updated_at.slice(0, 10))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteRule(rule.merchant_norm)}
                    aria-label={`Remover regra ${rule.merchant_norm}`}
                    className="p-2 rounded-md text-slate-400 hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
