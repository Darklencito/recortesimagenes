import { useEffect, useRef } from 'react';
import type { NotificationItem } from './Toast';

interface Props {
  notifications: NotificationItem[];
  unread: number;
  onMarkAllRead: () => void;
  onClear: () => void;
  onToggle: () => void;
  open: boolean;
}

const iconFor: Record<NotificationItem['type'], string> = {
  success: '✓',
  info: 'i',
  warning: '!',
  error: '!',
  loading: '…',
};

const colorFor: Record<NotificationItem['type'], string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  info: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  loading: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'ahora';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(ts).toLocaleDateString();
}

export function NotificationBell({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

export function NotificationPanel({ notifications, unread, onMarkAllRead, onClear, open }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // handled by parent toggle; nothing here
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!open) return null;

  return (
    <div ref={ref} className="absolute right-0 top-12 z-50 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notificaciones</h3>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button type="button" onClick={onMarkAllRead} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Marcar leídas
            </button>
          )}
          {notifications.length > 0 && (
            <button type="button" onClick={onClear} className="text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400">
              Limpiar
            </button>
          )}
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Sin notificaciones aún.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read ? 'opacity-60' : ''}`}>
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorFor[n.type]}`}>
                  {iconFor[n.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-200">{n.message}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{timeAgo(n.timestamp)}</p>
                  {n.action && (
                    <button type="button" onClick={n.action.onClick} className="mt-1.5 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500">
                      {n.action.label}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
