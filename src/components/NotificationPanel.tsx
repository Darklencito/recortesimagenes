import { useEffect, useRef } from 'react';
import type { NotificationItem } from './Toast';

export interface UpdateStatusInfo {
  state: 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

interface Props {
  notifications: NotificationItem[];
  unread: number;
  onMarkAllRead: () => void;
  onClear: () => void;
  open: boolean;
  onClose: () => void;
  onCheckUpdates?: () => void;
  onInstallUpdate?: () => void;
  checking?: boolean;
  updateInfo?: UpdateStatusInfo;
}

const colorFor: Record<NotificationItem['type'], string> = {
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
  info: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
  error: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300',
  loading: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
};

function NotifIcon({ type }: { type: NotificationItem['type'] }) {
  if (type === 'success') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === 'error' || type === 'warning') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

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

export function NotificationPanel({
  notifications,
  unread,
  onMarkAllRead,
  onClear,
  open,
  onClose,
  onCheckUpdates,
  onInstallUpdate,
  checking,
  updateInfo,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const currentState = updateInfo?.state ?? (checking ? 'checking' : 'idle');

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      {/* Drawer: entra de derecha a izquierda */}
      <aside
        ref={ref}
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-96 dark:bg-slate-900 ${open ? 'translate-x-0' : 'translate-x-full'} ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
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
            <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {onCheckUpdates && (
          <div className="border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
            {currentState === 'up-to-date' ? (
              <div
                role="status"
                aria-live="polite"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-xs transition-all duration-300 dark:border-emerald-800/60 dark:bg-emerald-500/15 dark:text-emerald-300"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                  ✓
                </span>
                <span>Ya tienes la última versión (v{__APP_VERSION__})</span>
              </div>
            ) : currentState === 'checking' ? (
              <div
                role="status"
                aria-live="polite"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-medium text-indigo-700 transition-all duration-300 dark:border-indigo-800/60 dark:bg-indigo-500/10 dark:text-indigo-300"
              >
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <span>Verificando actualizaciones…</span>
              </div>
            ) : currentState === 'available' || currentState === 'downloading' ? (
              <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-500/10 dark:text-indigo-200">
                <div className="flex items-center justify-between font-medium">
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    <span>Descargando actualización</span>
                    {updateInfo?.version && (
                      <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        v{updateInfo.version}
                      </span>
                    )}
                  </span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300">{updateInfo?.percent ?? 0}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-200/80 dark:bg-indigo-950">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-400"
                    style={{ width: `${Math.min(100, Math.max(5, updateInfo?.percent ?? 5))}%` }}
                  />
                </div>
              </div>
            ) : currentState === 'downloaded' ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/70 p-3 shadow-xs dark:border-emerald-800/60 dark:from-emerald-500/15 dark:to-teal-500/10">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-emerald-950 dark:text-emerald-100">
                        Actualización lista
                      </span>
                      {updateInfo?.version && (
                        <span className="rounded-md bg-emerald-600/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200">
                          v{updateInfo.version}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-emerald-700/90 dark:text-emerald-300/80">
                      Lista para instalar al reiniciar
                    </p>
                  </div>
                </div>
                {onInstallUpdate && (
                  <button
                    type="button"
                    onClick={onInstallUpdate}
                    className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    Reiniciar ahora
                  </button>
                )}
              </div>
            ) : currentState === 'error' ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300">
                <span className="truncate">{updateInfo?.message || 'No se pudo verificar actualizaciones.'}</span>
                <button
                  type="button"
                  onClick={onCheckUpdates}
                  className="shrink-0 underline hover:no-underline"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onCheckUpdates}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs transition hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/60 dark:hover:bg-slate-700/80"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
                <span>Buscar actualizaciones</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  v{__APP_VERSION__}
                </span>
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Sin notificaciones aún.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((n) => (
                <li key={n.id} className={`flex items-start gap-3 px-4 py-3 transition ${n.read ? 'opacity-65' : ''}`}>
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${colorFor[n.type]}`}>
                    <NotifIcon type={n.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{n.message}</p>
                      {n.badge && (
                        <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                          {n.badge}
                        </span>
                      )}
                    </div>
                    {n.subtitle && (
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{n.subtitle}</p>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{timeAgo(n.timestamp)}</span>
                      {n.action && (
                        <button
                          type="button"
                          onClick={n.action.onClick}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs transition ${
                            n.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'
                          }`}
                        >
                          {n.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
