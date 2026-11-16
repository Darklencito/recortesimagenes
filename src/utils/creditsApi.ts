export interface UserAccount {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  credits: number;
  totalProcesses: number;
  role: 'user' | 'admin';
  keyToken: string;
  keyLabel?: string;
}

export interface CreditTransaction {
  id: number;
  amount: number;
  balance_after: number;
  payment_method: string;
  note: string | null;
  created_at: string;
}

export interface ProcessLog {
  id: number;
  source_type: 'web' | 'windows' | 'api';
  action_type: string;
  files_count: number;
  slices_count: number;
  credits_used: number;
  created_at: string;
}

export interface CreditRequestItem {
  id: number;
  user_id?: number;
  user_name?: string;
  user_phone?: string | null;
  key_token?: string | null;
  credits_requested: number;
  price_pen: number;
  payment_method: 'yape' | 'plin' | 'bcp' | 'interbank' | 'otro';
  operation_code: string;
  sender_name: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  resolved_at: string | null;
  created_at: string;
}

export interface AdminUserItem {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  credits_balance: number;
  total_processes: number;
  status: string;
  key_token: string | null;
  last_used_at: string | null;
  created_at: string;
}

const STORAGE_KEY = 'nodos-api-key';
const LOCAL_CREDITS_KEY = 'nodos-local-credits-state';
const DEFAULT_DEMO_KEY = 'nk_live_demo_peru_2026';

export function getSavedApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_DEMO_KEY;
  } catch {
    return DEFAULT_DEMO_KEY;
  }
}

export function setSavedApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } catch {
    /* ignore */
  }
}

function getApiBase(): string {
  try {
    const custom = localStorage.getItem('nodos-api-base');
    if (custom) return custom.replace(/\/+$/, '');
  } catch {
    /* ignore */
  }
  return '';
}

function loadLocalFallbackState(keyToken: string): {
  user: UserAccount;
  transactions: CreditTransaction[];
  logs: ProcessLog[];
  requests: CreditRequestItem[];
} {
  try {
    const raw = localStorage.getItem(LOCAL_CREDITS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.user) {
        parsed.user.keyToken = keyToken;
        if (!parsed.requests) parsed.requests = [];
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  const initial = {
    user: {
      id: 1,
      name: 'Cliente Demo Perú',
      email: 'demo@nodos.pe',
      phone: '999888777',
      credits: 25,
      totalProcesses: 0,
      role: 'user' as const,
      keyToken,
      keyLabel: 'Licencia Web / Windows',
    },
    transactions: [
      {
        id: 1,
        amount: 25,
        balance_after: 25,
        payment_method: 'welcome',
        note: 'Bono inicial de bienvenida (25 procesos)',
        created_at: new Date().toISOString(),
      },
    ],
    logs: [],
    requests: [],
  };
  saveLocalFallbackState(initial);
  return initial;
}

function saveLocalFallbackState(state: {
  user: UserAccount;
  transactions: CreditTransaction[];
  logs: ProcessLog[];
  requests: CreditRequestItem[];
}) {
  try {
    localStorage.setItem(LOCAL_CREDITS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export async function fetchAccountStatus(keyToken = getSavedApiKey()): Promise<{
  ok: boolean;
  dbMode: string;
  user: UserAccount;
  transactions: CreditTransaction[];
  logs: ProcessLog[];
  requests: CreditRequestItem[];
  error?: string;
}> {
  try {
    const res = await fetch(`${getApiBase()}/api/credits/me`, {
      headers: { 'x-api-key': keyToken },
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        dbMode: data.dbMode || 'api',
        user: loadLocalFallbackState(keyToken).user,
        transactions: [],
        logs: [],
        requests: [],
        error: data.error || 'API Key no válida.',
      };
    }
    return {
      ...data,
      requests: data.requests || [],
    };
  } catch {
    const local = loadLocalFallbackState(keyToken);
    return {
      ok: true,
      dbMode: 'local-offline',
      user: local.user,
      transactions: local.transactions,
      logs: local.logs,
      requests: local.requests,
    };
  }
}

export async function consumeCredits(opts: {
  amount?: number;
  actionType: 'zip' | 'batch' | 'slice';
  filesCount?: number;
  slicesCount?: number;
  note?: string;
}): Promise<{ ok: boolean; credits_balance: number; error?: string }> {
  const keyToken = getSavedApiKey();
  const amount = Math.max(1, opts.amount ?? 1);
  const sourceType = typeof window !== 'undefined' && window.electronAPI ? 'windows' : 'web';

  try {
    const res = await fetch(`${getApiBase()}/api/credits/consume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': keyToken,
      },
      body: JSON.stringify({
        amount,
        sourceType,
        actionType: opts.actionType,
        filesCount: opts.filesCount ?? 1,
        slicesCount: opts.slicesCount ?? 1,
        note: opts.note,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        credits_balance: data.credits_balance ?? 0,
        error: data.error || 'No tienes suficientes créditos.',
      };
    }
    return { ok: true, credits_balance: data.credits_balance };
  } catch {
    const local = loadLocalFallbackState(keyToken);
    if (local.user.credits < amount) {
      return {
        ok: false,
        credits_balance: local.user.credits,
        error: `Créditos insuficientes. Necesitas ${amount} y tienes ${local.user.credits}.`,
      };
    }
    local.user.credits -= amount;
    local.user.totalProcesses += opts.filesCount ?? 1;
    local.transactions.unshift({
      id: Date.now(),
      amount: -amount,
      balance_after: local.user.credits,
      payment_method: 'usage',
      note: opts.note || `Proceso ${opts.actionType} (${opts.filesCount ?? 1} arch, ${opts.slicesCount ?? 1} cortes)`,
      created_at: new Date().toISOString(),
    });
    local.logs.unshift({
      id: Date.now(),
      source_type: sourceType,
      action_type: opts.actionType,
      files_count: opts.filesCount ?? 1,
      slices_count: opts.slicesCount ?? 1,
      credits_used: amount,
      created_at: new Date().toISOString(),
    });
    saveLocalFallbackState(local);
    return { ok: true, credits_balance: local.user.credits };
  }
}

export async function createCreditRequest(payload: {
  creditsRequested: number;
  pricePen: number;
  paymentMethod: 'yape' | 'plin' | 'bcp' | 'interbank' | 'otro';
  operationCode: string;
  senderName?: string;
  note?: string;
}): Promise<{ ok: boolean; request?: CreditRequestItem; error?: string }> {
  const keyToken = getSavedApiKey();
  try {
    const res = await fetch(`${getApiBase()}/api/credits/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': keyToken,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'No se pudo enviar la solicitud.' };
    }
    return { ok: true, request: data.request };
  } catch {
    const local = loadLocalFallbackState(keyToken);
    const reqItem: CreditRequestItem = {
      id: Date.now(),
      user_id: local.user.id,
      user_name: local.user.name,
      user_phone: local.user.phone,
      key_token: keyToken,
      credits_requested: payload.creditsRequested,
      price_pen: payload.pricePen,
      payment_method: payload.paymentMethod,
      operation_code: payload.operationCode,
      sender_name: payload.senderName || local.user.name,
      note: payload.note || null,
      status: 'pending',
      resolved_at: null,
      created_at: new Date().toISOString(),
    };
    local.requests.unshift(reqItem);
    saveLocalFallbackState(local);
    return { ok: true, request: reqItem };
  }
}

export async function registerFreeAccount(payload: {
  name: string;
  phone?: string;
  email?: string;
}): Promise<{ ok: boolean; keyToken?: string; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/auth/register-free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'No se pudo registrar la cuenta.' };
    }
    if (data.customer?.key_token) {
      setSavedApiKey(data.customer.key_token);
    }
    return { ok: true, keyToken: data.customer?.key_token };
  } catch {
    const randomKey = `nk_live_${Math.random().toString(36).slice(2, 12)}`;
    setSavedApiKey(randomKey);
    saveLocalFallbackState({
      user: {
        id: Date.now(),
        name: payload.name || 'Usuario Nuevo',
        email: payload.email || null,
        phone: payload.phone || null,
        credits: 10,
        totalProcesses: 0,
        role: 'user',
        keyToken: randomKey,
        keyLabel: 'Cuenta Gratuita',
      },
      transactions: [
        {
          id: 1,
          amount: 10,
          balance_after: 10,
          payment_method: 'welcome',
          note: 'Bono de bienvenida (10 procesos)',
          created_at: new Date().toISOString(),
        },
      ],
      logs: [],
      requests: [],
    });
    return { ok: true, keyToken: randomKey };
  }
}

export async function adminFetchUsers(adminSecret: string): Promise<{
  ok: boolean;
  dbMode?: string;
  users: AdminUserItem[];
  requests: CreditRequestItem[];
  pendingCount: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${getApiBase()}/api/admin/users`, {
      headers: { 'x-admin-secret': adminSecret },
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, users: [], requests: [], pendingCount: 0, error: data.error || 'Error de autenticación admin.' };
    }
    return {
      ok: true,
      dbMode: data.dbMode,
      users: data.users || [],
      requests: data.requests || [],
      pendingCount: data.pendingCount ?? 0,
    };
  } catch {
    return {
      ok: false,
      users: [],
      requests: [],
      pendingCount: 0,
      error: 'El servidor backend (/api) no está encendido. Ejecuta "npm run api" en otra terminal.',
    };
  }
}

export async function adminResolveRequest(
  adminSecret: string,
  payload: { requestId: number; action: 'approve' | 'reject' },
): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/admin/requests/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'No se pudo procesar la solicitud.' };
    }
    return { ok: true, result: data.result };
  } catch {
    return { ok: false, error: 'Servidor API no disponible.' };
  }
}

export async function adminCreateUser(
  adminSecret: string,
  payload: { name: string; phone?: string; email?: string; initialCredits: number },
): Promise<{ ok: boolean; customer?: AdminUserItem; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Servidor API no disponible.' };
  }
}

export async function adminTopUpUser(
  adminSecret: string,
  payload: { userId: number; amount: number; paymentMethod: string; note?: string },
): Promise<{ ok: boolean; credits_balance?: number; error?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/api/admin/topup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': adminSecret,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'No se pudo recargar créditos.' };
    }
    return { ok: true, credits_balance: data.result?.credits_balance };
  } catch {
    return { ok: false, error: 'Servidor API no disponible.' };
  }
}
