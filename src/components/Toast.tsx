import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'info' | 'warning' | 'error' | 'loading';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  /** Subtítulo opcional o detalle secundario. */
  subtitle?: string;
  /** Etiqueta destacada opcional (ej. "v1.0.14"). */
  badge?: string;
  /** Acción opcional (ej. "Reiniciar ahora"). */
  action?: { label: string; onClick: () => void };
  /** Duración en ms. 0 = no se cierra solo. */
  duration?: number;
}

export interface NotificationItem {
  id: number;
  type: ToastType;
  message: string;
  subtitle?: string;
  badge?: string;
  timestamp: number;
  read: boolean;
  action?: { label: string; onClick: () => void };
}

const styles: Record<ToastType, string> = {
  success:
    'border-emerald-200/90 bg-white/95 text-slate-900 shadow-emerald-950/5 dark:border-emerald-500/30 dark:bg-slate-900/95 dark:text-slate-100',
  info:
    'border-indigo-200/90 bg-white/95 text-slate-900 shadow-indigo-950/5 dark:border-indigo-500/30 dark:bg-slate-900/95 dark:text-slate-100',
  warning:
    'border-amber-200/90 bg-white/95 text-slate-900 shadow-amber-950/5 dark:border-amber-500/30 dark:bg-slate-900/95 dark:text-slate-100',
  error:
    'border-red-200/90 bg-white/95 text-slate-900 shadow-red-950/5 dark:border-red-500/30 dark:bg-slate-900/95 dark:text-slate-100',
  loading:
    'border-slate-200 bg-white/95 text-slate-800 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100',
};

const iconWrapStyles: Record<ToastType, string> = {
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
  info: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400',
  error: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
  loading: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
};

const actionBtnStyles: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-400',
  info: 'bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-400',
  warning: 'bg-amber-600 text-white hover:bg-amber-500 focus:ring-amber-400',
  error: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-400',
  loading: 'bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-400',
};

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'loading') {
    return <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />;
  }
  if (type === 'success') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === 'error') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
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
      className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border p-3.5 shadow-xl backdrop-blur-md transition-all duration-300 ${styles[toast.type]} ${visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconWrapStyles[toast.type]}`}>
        <ToastIcon type={toast.type} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-xs font-semibold leading-snug text-slate-900 dark:text-slate-100">{toast.message}</p>
          {toast.badge && (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              {toast.badge}
            </span>
          )}
        </div>
        {toast.subtitle && (
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{toast.subtitle}</p>
        )}
      </div>

      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className={`shrink-0 inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-semibold shadow-xs transition focus:outline-none focus:ring-2 ${actionBtnStyles[toast.type]}`}
        >
          {toast.action.label}
        </button>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar notificación"
        className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
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
