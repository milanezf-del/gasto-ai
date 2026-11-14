import React from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Não foi possível carregar os dados",
  message,
  onRetry,
}) => (
  <div
    role="alert"
    className="rounded-xl bg-white dark:bg-[#111827] border border-[#F43F5E]/30 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
  >
    <div className="flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-[#F43F5E] shrink-0 mt-0.5" />
      <div>
        <h3 className="font-display text-sm font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
          {title}
        </h3>
        <p className="text-xs text-slate-600 dark:text-[#c6c5d5] mt-1">
          {message}
        </p>
      </div>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-[#1e293b] dark:hover:bg-[#262a35] text-[#0F172A] dark:text-[#dfe2f1] transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Tentar novamente</span>
      </button>
    )}
  </div>
);

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] py-12 px-6 text-center">
    <div className="w-10 h-10 rounded-lg mx-auto mb-3 flex items-center justify-center bg-slate-100 dark:bg-[#171b26] text-slate-500 dark:text-[#908f9e]">
      <Inbox className="w-5 h-5" />
    </div>
    <h3 className="font-display text-sm font-semibold text-[#0F172A] dark:text-[#dfe2f1]">
      {title}
    </h3>
    <p className="text-xs text-slate-500 dark:text-[#908f9e] mt-1 max-w-md mx-auto">
      {description}
    </p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 h-9 px-4 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white transition-colors cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const CardSkeleton: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = "",
}) => (
  <div
    className={`rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] p-5 space-y-3 ${className}`}
  >
    <div className="h-3 w-1/3 rounded ai-shimmer" />
    {Array.from({ length: lines }).map((_, idx) => (
      <div
        key={idx}
        className={`h-4 rounded ai-shimmer ${
          idx === 0 ? "w-2/3" : idx === lines - 1 ? "w-1/2" : "w-full"
        }`}
      />
    ))}
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
      <div className="h-4 w-40 rounded ai-shimmer" />
      <div className="h-8 w-28 rounded-lg ai-shimmer" />
    </div>
    <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="px-5 py-3.5 flex items-center justify-between gap-4"
        >
          <div className="h-3.5 w-20 rounded ai-shimmer" />
          <div className="h-3.5 w-48 rounded ai-shimmer flex-1 max-w-xs" />
          <div className="h-3.5 w-24 rounded ai-shimmer hidden sm:block" />
          <div className="h-3.5 w-20 rounded ai-shimmer" />
        </div>
      ))}
    </div>
  </div>
);
