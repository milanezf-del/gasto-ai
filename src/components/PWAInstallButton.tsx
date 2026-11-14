import React from "react";
import { Download, Share, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = React.useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white dark:bg-[#818cf8] dark:hover:bg-[#6366F1] dark:text-[#0b0f19] dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar app</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#171b26] text-slate-700 dark:text-[#c6c5d5] border border-slate-200/80 dark:border-white/[0.08] hover:border-[#6366F1] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar app</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[2px]"
          >
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#171b26] border border-slate-200 dark:border-white/[0.12] p-6 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
                <h3
                  id="ios-install-title"
                  className="font-display text-base font-semibold text-[#0F172A] dark:text-[#dfe2f1]"
                >
                  Instalar no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar instruções"
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-xs text-slate-600 dark:text-[#c6c5d5] list-decimal pl-4">
                <li>
                  Toque no botão{" "}
                  <strong className="inline-flex items-center gap-1 text-[#0F172A] dark:text-white">
                    <Share className="w-3 h-3" /> Compartilhar
                  </strong>{" "}
                  na barra do Safari.
                </li>
                <li>
                  Role as opções e selecione{" "}
                  <strong className="text-[#0F172A] dark:text-white">
                    Adicionar à Tela de Início
                  </strong>
                  .
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full h-9 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-[#262a35] dark:hover:bg-[#334155] text-[#0F172A] dark:text-[#dfe2f1] cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
