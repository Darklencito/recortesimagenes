import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'loading';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  /** Acción opcional (ej. "Actualizar ahora"). */
  action?: { label: string; onClick: () => void };
  /** Duración en ms. 0 = no se cierra solo. */
  duration?: number;
}

const styles: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200',
  info: 'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-200',
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-500/10 dark:text-red-300',
  loading: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
};

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />;
}

export function ToastView({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!toast.duration) return;
    const t = setTimeout(() => onClose(), toast.duration);
    return () => clearTimeout(t);
  }, [toast.duration, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur transition-all duration-300 ${styles[toast.type]} ${visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      <div className="mt-0.5 shrink-0">
        {toast.type === 'loading' ? <Spinner /> : toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-lg p-1 opacity-60 transition hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}
