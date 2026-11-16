import { useEffect, useState } from 'react';
import {
  createCreditRequest,
  fetchAccountStatus,
  getSavedApiKey,
  registerFreeAccount,
  setSavedApiKey,
} from '../utils/creditsApi';
import type { CreditRequestItem, CreditTransaction, ProcessLog, UserAccount } from '../utils/creditsApi';

export type CreditsTab = 'account' | 'topup' | 'api';

interface Props {
  open: boolean;
  initialTab?: CreditsTab;
  account: UserAccount | null;
  transactions: CreditTransaction[];
  logs: ProcessLog[];
  requests: CreditRequestItem[];
  onClose: () => void;
  onAccountUpdated: () => void;
}

const PACKS = [
  { id: 'starter', name: 'Pack Emprendedor', credits: 50, pricePen: 15, desc: 'Ideal para flyers, carruseles y piezas sueltas.' },
  { id: 'pro', name: 'Pack Diseñador Pro', credits: 200, pricePen: 45, desc: 'Para diseñadores de mailing, catálogos y lotes.', popular: true },
  { id: 'agency', name: 'Pack Agencia / API', credits: 600, pricePen: 99, desc: 'Uso intensivo en Web, App Windows y API automatizada.' },
];

const PERU_PAYMENT_INFO = {
  whatsappNumber: '51999888777',
  yapePlinPhone: '999 888 777',
  holderName: 'Nodos Diseño / Titular',
  bcpAccount: '191-XXXXXXXX-0-XX',
  cciAccount: '002-191-XXXXXXXXXXXX-XX',
};

export function CreditsModal({
  open,
  initialTab = 'account',
  account,
  transactions,
  logs,
  requests,
  onClose,
  onAccountUpdated,
}: Props) {
  const [tab, setTab] = useState<CreditsTab>(initialTab);
  const [keyInput, setKeyInput] = useState(getSavedApiKey());
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Registro rápido de cliente
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Formulario de Solicitud de Recarga
  const [selectedPack, setSelectedPack] = useState(PACKS[1]);
  const [paymentMethod, setPaymentMethod] = useState<'yape' | 'plin' | 'bcp' | 'interbank'>('yape');
  const [operationCode, setOperationCode] = useState('');
  const [senderName, setSenderName] = useState('');
  const [requestNote, setRequestNote] = useState('');

  // Prueba de API en vivo
  const [apiTestResult, setApiTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setKeyInput(getSavedApiKey());
      setSenderName(account?.name || '');
      setStatusMsg(null);
      setErrMsg(null);
    }
  }, [open, initialTab, account?.name]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleActivateKey() {
    const clean = keyInput.trim();
    if (!clean) return;
    setLoading(true);
    setErrMsg(null);
    setStatusMsg(null);
    try {
      const check = await fetchAccountStatus(clean);
      if (!check.ok) {
        setErrMsg(check.error || 'No se encontró esa licencia.');
      } else {
        setSavedApiKey(clean);
        onAccountUpdated();
        setStatusMsg(`Licencia vinculada: ${check.user.name} (${check.user.credits} créditos disponibles).`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFree() {
    if (!newName.trim()) {
      setErrMsg('Ingresa tu nombre o empresa para identificarte.');
      return;
    }
    setLoading(true);
    setErrMsg(null);
    setStatusMsg(null);
    try {
      const r = await registerFreeAccount({ name: newName.trim(), phone: newPhone.trim() });
      if (!r.ok) {
        setErrMsg(r.error || 'No se pudo crear la cuenta.');
      } else {
        if (r.keyToken) setKeyInput(r.keyToken);
        setNewName('');
        setNewPhone('');
        onAccountUpdated();
        setStatusMsg(`Cuenta creada con éxito. Tu licencia personal es ${r.keyToken}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitCreditRequest() {
    if (!operationCode.trim()) {
      setErrMsg('Por favor ingresa el N° de operación o celular desde el que realizaste el Yape/Plin/Transferencia.');
      return;
    }
    setLoading(true);
    setErrMsg(null);
    setStatusMsg(null);
    try {
      const r = await createCreditRequest({
        creditsRequested: selectedPack.credits,
        pricePen: selectedPack.pricePen,
        paymentMethod,
        operationCode: operationCode.trim(),
        senderName: senderName.trim() || account?.name || 'Cliente',
        note: requestNote.trim() || `${selectedPack.name} (${selectedPack.credits} cr)`,
      });
      if (!r.ok) {
        setErrMsg(r.error || 'No se pudo registrar la solicitud.');
      } else {
        setOperationCode('');
        setRequestNote('');
        onAccountUpdated();
        setStatusMsg(
          `¡Solicitud #${r.request?.id} enviada! El administrador ya recibió la notificación para activar tus ${selectedPack.credits} créditos.`,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTestSliceApi() {
    setLoading(true);
    setApiTestResult(null);
    setErrMsg(null);
    try {
      const res = await fetch('/api/v1/slice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${account?.keyToken || keyInput}`,
        },
        body: JSON.stringify({
          width: 1200,
          height: 600,
          mode: 'grid',
          grid: { rows: 1, cols: 3 },
        }),
      });
      const data = await res.json();
      setApiTestResult(JSON.stringify(data, null, 2));
      onAccountUpdated();
    } catch {
      setErrMsg('No se pudo conectar al servidor API.');
    } finally {
      setLoading(false);
    }
  }

  const pendingReqs = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-xs" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-5 py-3.5 text-white dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold">⚡</span>
            <div>
              <h2 className="text-sm font-semibold sm:text-base">Mi Cuenta y Créditos de Proceso</h2>
              <p className="text-xs text-slate-400">
                Cliente: <strong className="text-slate-200">{account?.name || 'Invitado'}</strong> · Disponibles:{' '}
                <strong className="text-emerald-400">{account?.credits ?? 0} créditos</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Cerrar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Pestañas limpias solo para el usuario */}
        <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-slate-200 bg-slate-100 p-1.5 dark:border-slate-800 dark:bg-slate-950">
          {([
            { id: 'account', label: 'Mi Cuenta / Licencia' },
            { id: 'topup', label: `Solicitar Créditos${pendingReqs > 0 ? ` (${pendingReqs})` : ''}` },
            { id: 'api', label: 'Uso por API' },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl py-2 text-xs font-semibold transition ${
                tab === t.id
                  ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-900 dark:text-indigo-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-5 text-xs">
          {statusMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-300">
              {statusMsg}
            </div>
          )}
          {errMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-red-700 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300">
              {errMsg}
            </div>
          )}

          {/* TAB 1: MI CUENTA / LICENCIA */}
          {tab === 'account' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Usuario identificado</span>
                  <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-slate-100">{account?.name || 'Sin vincular'}</p>
                  <p className="text-[11px] text-slate-500">{account?.phone || account?.email || `ID #${account?.id ?? 1}`}</p>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 dark:border-indigo-900/60 dark:bg-indigo-500/10">
                  <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">Saldo disponible</span>
                  <p className="mt-1 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{account?.credits ?? 0}</p>
                  <p className="text-[11px] text-indigo-600/80 dark:text-indigo-300/80">1 crédito = 1 descarga ZIP</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Procesos realizados</span>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{account?.totalProcesses ?? 0}</p>
                  <p className="text-[11px] text-slate-500">Web · Windows · API</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  Tu Código de Licencia (<code className="font-mono text-indigo-600 dark:text-indigo-400">Key</code>)
                </label>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Usa esta misma clave en la versión Web y en la App de Escritorio Windows para sincronizar tus créditos:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="nk_live_..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleActivateKey}
                    className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Validando…' : 'Vincular'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(keyInput);
                      setStatusMsg('Código copiado al portapapeles.');
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                <p className="font-semibold text-slate-800 dark:text-slate-200">¿Aún no tienes cuenta propia? Regístrate gratis con 10 créditos</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tu nombre o empresa"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Tu celular / WhatsApp"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCreateFree}
                    className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                  >
                    Generar mi cuenta
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Historial de saldo</h3>
                  {transactions.length === 0 ? (
                    <p className="mt-2 text-[11px] text-slate-500">Sin movimientos aún.</p>
                  ) : (
                    <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                      {transactions.map((tx) => (
                        <li key={tx.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-700 dark:text-slate-200">{tx.note || tx.payment_method}</p>
                            <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleString()}</p>
                          </div>
                          <span className={`shrink-0 font-bold ${tx.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Últimos procesos</h3>
                  {logs.length === 0 ? (
                    <p className="mt-2 text-[11px] text-slate-500">Sin procesos ejecutados aún.</p>
                  ) : (
                    <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
                      {logs.map((lg) => (
                        <li key={lg.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                          <div>
                            <p className="font-medium text-slate-700 dark:text-slate-200">
                              [{lg.source_type.toUpperCase()}] {lg.action_type} · {lg.files_count} arch ({lg.slices_count} cortes)
                            </p>
                            <p className="text-[10px] text-slate-400">{new Date(lg.created_at).toLocaleString()}</p>
                          </div>
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            -{lg.credits_used} cr
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SOLICITAR CRÉDITOS (NOTIFICACIÓN DIRECTA AL ADMIN) */}
          {tab === 'topup' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">1. Elige tu paquete de créditos</h3>
                <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
                  {PACKS.map((p) => {
                    const active = selectedPack.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPack(p)}
                        className={`cursor-pointer rounded-2xl border p-3 transition ${
                          active
                            ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 dark:border-indigo-500 dark:bg-indigo-500/15'
                            : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{p.name}</span>
                          {p.popular && (
                            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">Popular</span>
                          )}
                        </div>
                        <p className="mt-1.5 text-xl font-extrabold text-indigo-600 dark:text-indigo-400">S/ {p.pricePen}</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">⚡ {p.credits} créditos</p>
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{p.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-800/50">
                <div>
                  <span className="inline-block rounded-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    2. REALIZA EL PAGO (PERÚ)
                  </span>
                  <p className="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                    Yape / Plin: {PERU_PAYMENT_INFO.yapePlinPhone}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Titular: {PERU_PAYMENT_INFO.holderName}</p>
                  <div className="mt-2 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <p>BCP Soles: <code className="font-mono">{PERU_PAYMENT_INFO.bcpAccount}</code></p>
                    <p>CCI: <code className="font-mono">{PERU_PAYMENT_INFO.cciAccount}</code></p>
                  </div>
                  <p className="mt-2.5 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300">
                    Monto a transferir: <strong>S/ {selectedPack.pricePen}.00</strong> por <strong>{selectedPack.credits} créditos</strong>.
                  </p>
                </div>

                <div className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
                  <p className="font-bold text-slate-900 dark:text-slate-100">3. Notificar pago para activación</p>
                  <div>
                    <label className="text-[11px] text-slate-500">Medio utilizado</label>
                    <div className="mt-1 grid grid-cols-4 gap-1">
                      {(['yape', 'plin', 'bcp', 'interbank'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`rounded-lg border py-1 text-[11px] font-semibold uppercase transition ${
                            paymentMethod === m
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500">N° de operación o celular Yape/Plin *</label>
                    <input
                      type="text"
                      value={operationCode}
                      onChange={(e) => setOperationCode(e.target.value)}
                      placeholder="Ej. Op. 048291 o Cel. 987654321"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500">Tu nombre / titular del pago</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Nombre de quien envió el pago"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSubmitCreditRequest}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white shadow-xs transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Enviando solicitud…' : `Solicitar ${selectedPack.credits} créditos ahora`}
                  </button>
                </div>
              </div>

              {/* Estado de mis solicitudes */}
              <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <h4 className="font-semibold text-slate-800 dark:text-slate-200">Mis solicitudes de recarga</h4>
                {requests.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-slate-500">Aún no has enviado solicitudes de recarga.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {requests.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            Solicitud #{r.id} · +{r.credits_requested} créditos (S/ {r.price_pen})
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Vía {r.payment_method.toUpperCase()} · Op: {r.operation_code} · {new Date(r.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            r.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : r.status === 'rejected'
                                ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                          }`}
                        >
                          {r.status === 'approved' ? '✅ Aprobada' : r.status === 'rejected' ? '❌ Rechazada' : '⏳ En verificación'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: API POR PROCESOS */}
          {tab === 'api' && (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Endpoint de Corte por Procesos</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Consume tus créditos desde scripts propios, n8n o Make mediante <code className="font-mono text-indigo-600 dark:text-indigo-400">POST /api/v1/slice</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleTestSliceApi}
                    className="rounded-xl bg-indigo-600 px-3.5 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {loading ? 'Ejecutando…' : 'Probar API (-1 crédito)'}
                  </button>
                </div>
              </div>

              {apiTestResult && (
                <div className="rounded-xl border border-emerald-200 bg-slate-950 p-3 text-emerald-300">
                  <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Respuesta de POST /api/v1/slice:</p>
                  <pre className="max-h-40 overflow-auto font-mono text-[11px]">{apiTestResult}</pre>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-950 p-3.5 text-slate-200 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-indigo-400">Ejemplo cURL:</p>
                <pre className="mt-1.5 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-300">
{`curl -X POST http://localhost:3001/api/v1/slice \\
  -H "Authorization: Bearer ${account?.keyToken || keyInput}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "width": 1200,
    "height": 1500,
    "mode": "grid",
    "grid": { "rows": 1, "cols": 3 },
    "imageBase64": "data:image/png;base64,..."
  }'`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
