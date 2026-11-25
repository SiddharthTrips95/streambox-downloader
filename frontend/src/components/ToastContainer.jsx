import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 left-4 z-50 flex flex-col items-center gap-2 sm:left-auto sm:items-end"
    >
      {toasts.map((toast) => {
        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? AlertCircle
              : Info;
        const iconColor =
          toast.type === 'success'
            ? 'text-[#34C759] dark:text-[#30D158]'
            : toast.type === 'error'
              ? 'text-[#FF3B30] dark:text-[#FF453A]'
              : 'text-[#007AFF] dark:text-[#0A84FF]';

        return (
          <div
            key={toast.id}
            className="bento-surface pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-2.5 text-[13px] font-medium text-neutral-900 shadow-lg dark:text-white"
          >
            <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-full p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
