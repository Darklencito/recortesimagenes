import { useEffect, useRef, useState } from 'react';
import {
  adminCreateUser,
  adminFetchUsers,
  adminResolveRequest,
  adminTopUpUser,
  type AdminUserItem,
  type CreditRequestItem,
} from '../utils/creditsApi';

interface Props {
  onExitAdmin: () => void;
}

export function AdminDashboard({ onExitAdmin }: Props) {
  const [adminSecret, setAdminSecret] = useState(() => localStorage.getItem('nodos-admin-secret') || 'admin123');
  const [authenticated, setAuthenticated] = useState(false);
  const [dbMode, setDbMode] = useState('mariadb');
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [requests, setRequests] = useState<CreditRequestItem[]>([]);
  const [filter, setFilter] = useState('');
  const [reqFilter, setReqFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Nuevo cliente
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerCredits, setNewCustomerCredits] = useState(50);

  // Recarga directa
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'bcp' | 'interbank' | 'manual'>('yape');
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({});

  // Detector de nuevas notificaciones entrantes
  const prevPendingIds = useRef<Set<number>>(new Set());
  const [newAlertBanner, setNewAlertBanner] = useState<CreditRequestItem | null>(null);

  async function loadDashboard(silent = false) {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const r = await adminFetchUsers(adminSecret);
      if (!r.ok) {
        if (!silent) setError(r.error || 'Clave de administrador incorrecta.');
        setAuthenticated(false);
        return;
      }
      localStorage.setItem('nodos-admin-secret', adminSecret);
      setAuthenticated(true);
      if (r.dbMode) setDbMode(r.dbMode);
      setUsers(r.users);
      setRequests(r.requests);

      const currentPending = r.requests.filter((x) => x.status === 'pending');
      for (const req of currentPending) {
        if (prevPendingIds.current.size > 0 && !prevPendingIds.current.has(req.id)) {
          setNewAlertBanner(req);
        }
      }
      prevPendingIds.current = new Set(currentPending.map((x) => x.id));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(false);
    const timer = setInterval(() => {
      void loadDashboard(true);
    }, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret]);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  useEffect(() => {
    const prevTitle = document.title;
    document.title = pendingCount > 0 ? `(${pendingCount} nuevas) Admin Nodos` : 'Panel Admin · Nodos';
    return () => {
      document.title = prevTitle;
    };
  }, [pendingCount]);

  async function handleResolve(requestId: number, action: 'approve' | 'reject') {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const r = await adminResolveRequest(adminSecret, { requestId, action });
      if (!r.ok) {
        setError(r.error || 'No se pudo procesar la solicitud.');
      } else {
        if (newAlertBanner?.id === requestId) setNewAlertBanner(null);
        setNotice(
          action === 'approve'
            ? `✅ Solicitud #${requestId} aprobada: se abonaron +${r.result?.credits_added} créditos a ${r.result?.user_name}.`
            : `Solicitud #${requestId} rechazada.`,
        );
        await loadDashboard(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!newCustomerName.trim()) {
      setError('Ingresa el nombre del cliente.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const r = await adminCreateUser(adminSecret, {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
        initialCredits: newCustomerCredits,
      });
      if (!r.ok) {
        setError(r.error || 'No se pudo crear el cliente.');
      } else {
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNotice(`Cliente creado con éxito. Licencia generada: ${r.customer?.key_token}`);
        await loadDashboard(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDirectTopup(userId: number, amount: number) {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const r = await adminTopUpUser(adminSecret, {
        userId,
        amount,
        paymentMethod,
        note: `Abono directo admin (${paymentMethod.toUpperCase()})`,
      });
      if (!r.ok) {
        setError(r.error || 'No se pudo aplicar la recarga.');
      } else {
        setNotice(`Recarga aplicada (${amount > 0 ? `+${amount}` : amount} créditos). Nuevo saldo: ${r.credits_balance}`);
        await loadDashboard(true);
      }
    } finally {
      setLoading(false);
    }
  }

  const visibleRequests = requests.filter((r) => (reqFilter === 'pending' ? r.status === 'pending' : true));
  const visibleUsers = users.filter((u) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.key_token || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header Admin */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <img src="./logo-nodos-white.png" alt="nodos.pe" className="h-8 w-auto" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold sm:text-base">Panel de Administración · Créditos y Clientes</h1>
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {dbMode}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Gestión de solicitudes Yape / Plin / Bancos y licencias API</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs">
              <span>🔔 Solicitudes pendientes:</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${pendingCount > 0 ? 'animate-pulse bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                {pendingCount}
              </span>
            </div>
            <button
              type="button"
              onClick={onExitAdmin}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              ← Volver a la App
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {/* Alerta en vivo de nueva solicitud */}
        {newAlertBanner && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg dark:border-amber-500 dark:bg-amber-500/15 dark:text-amber-200">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-lg font-bold text-slate-950">
                🔔
              </span>
              <div>
                <p className="text-sm font-bold">
                  ¡Nueva solicitud de créditos de {newAlertBanner.user_name}! (+{newAlertBanner.credits_requested} créditos · S/ {newAlertBanner.price_pen})
                </p>
                <p className="text-xs">
                  Medio: <strong className="uppercase">{newAlertBanner.payment_method}</strong> · N° Operación / Ref: <strong>{newAlertBanner.operation_code}</strong> · Titular: {newAlertBanner.sender_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleResolve(newAlertBanner.id, 'approve')}
                className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
              >
                ✅ Aprobar ahora
              </button>
              <button
                type="button"
                onClick={() => setNewAlertBanner(null)}
                className="rounded-xl border border-amber-400 px-2.5 py-1.5 text-xs font-semibold"
              >
                Ocultar
              </button>
            </div>
          </div>
        )}

        {/* Autenticación Admin */}
        {!authenticated && (
          <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-bold">Acceso de Administrador</h2>
            <p className="mt-1 text-xs text-slate-500">Ingresa tu clave maestra (`ADMIN_SECRET`, por defecto `admin123`):</p>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void loadDashboard(false); }}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => loadDashboard(false)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
              >
                Entrar
              </button>
            </div>
          </section>
        )}

        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-300">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {authenticated && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* COLUMNA IZQUIERDA (7 cols): Bandeja de Solicitudes de Recarga */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Bandeja de Solicitudes de Créditos
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Se actualiza automáticamente cada 4 segundos cuando un cliente reporta un Yape, Plin o transferencia.
                  </p>
                </div>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setReqFilter('pending')}
                    className={`rounded-lg px-3 py-1 font-semibold ${reqFilter === 'pending' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Pendientes ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqFilter('all')}
                    className={`rounded-lg px-3 py-1 font-semibold ${reqFilter === 'all' ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    Todas ({requests.length})
                  </button>
                </div>
              </div>

              {visibleRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800">
                  {reqFilter === 'pending'
                    ? 'No hay solicitudes pendientes de revisión en este momento.'
                    : 'Aún no se han recibido solicitudes de créditos.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`rounded-xl border p-4 transition ${
                        req.status === 'pending'
                          ? 'border-amber-300 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/5'
                          : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-slate-700">
                              Solicitud #{req.id}
                            </span>
                            <strong className="text-sm text-slate-900 dark:text-slate-100">
                              {req.user_name}
                            </strong>
                            {req.user_phone && (
                              <span className="text-xs text-slate-500">📱 {req.user_phone}</span>
                            )}
                            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-extrabold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                              +{req.credits_requested} créditos (S/ {req.price_pen})
                            </span>
                          </div>

                          <div className="mt-2 grid gap-1 text-xs text-slate-700 sm:grid-cols-2 dark:text-slate-300">
                            <p>
                              Medio de pago: <strong className="uppercase text-indigo-600 dark:text-indigo-400">{req.payment_method}</strong>
                            </p>
                            <p>
                              N° Operación / Ref: <strong className="rounded bg-white px-1.5 py-0.5 font-mono dark:bg-slate-900">{req.operation_code}</strong>
                            </p>
                            <p>Titular reportado: <strong>{req.sender_name || req.user_name}</strong></p>
                            <p className="text-[11px] text-slate-400">Fecha: {new Date(req.created_at).toLocaleString()}</p>
                          </div>

                          {req.key_token && (
                            <p className="mt-1 font-mono text-[10px] text-slate-400">
                              Key del usuario: {req.key_token}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleResolve(req.id, 'approve')}
                                className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-500 disabled:opacity-50"
                              >
                                ✅ Aprobar (+{req.credits_requested} cr)
                              </button>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleResolve(req.id, 'reject')}
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300"
                              >
                                Rechazar
                              </button>
                            </>
                          ) : (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                req.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                              }`}
                            >
                              {req.status === 'approved' ? '✅ Aprobada' : '❌ Rechazada'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* COLUMNA DERECHA (5 cols): Directorio de Clientes y Abono Directo */}
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Directorio de Clientes ({users.length})</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Crea nuevos usuarios o abónales créditos directamente sin esperar solicitud.
                </p>
              </div>

              {/* Crear cliente */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Registrar nuevo cliente</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Nombre o empresa"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="WhatsApp / Celular"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={newCustomerCredits}
                    onChange={(e) => setNewCustomerCredits(Number(e.target.value) || 0)}
                    className="w-28 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="text-[11px] text-slate-500">créditos iniciales</span>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCreateUser}
                    className="ml-auto rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    + Crear Cliente
                  </button>
                </div>
              </div>

              {/* Buscador y medio de pago */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Buscar por nombre, celular o Key…"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="bcp">BCP</option>
                  <option value="interbank">Interbank</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div className="max-h-[55vh] space-y-2.5 overflow-y-auto pr-1">
                {visibleUsers.map((u) => (
                  <div
                    key={u.id}
                    className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          #{u.id} · {u.name}
                        </span>
                        {u.phone && <span className="ml-2 text-[11px] text-slate-500">📱 {u.phone}</span>}
                      </div>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                        ⚡ {u.credits_balance} cr
                      </span>
                    </div>

                    {u.key_token && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1 text-[11px] dark:bg-slate-900">
                        <code className="truncate font-mono text-slate-600 dark:text-slate-300">{u.key_token}</code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(u.key_token!);
                            setNotice(`Key de ${u.name} copiada.`);
                          }}
                          className="shrink-0 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          Copiar Key
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                      {[20, 50, 100, 200].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          disabled={loading}
                          onClick={() => handleDirectTopup(u.id, amt)}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        >
                          +{amt}
                        </button>
                      ))}
                      <input
                        type="number"
                        placeholder="±Cant"
                        value={customAmounts[u.id] || ''}
                        onChange={(e) => setCustomAmounts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-[11px] dark:border-slate-700 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        disabled={loading || !Number(customAmounts[u.id])}
                        onClick={() => {
                          const n = Number(customAmounts[u.id]);
                          if (n) void handleDirectTopup(u.id, n);
                        }}
                        className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-40 dark:bg-indigo-600"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
