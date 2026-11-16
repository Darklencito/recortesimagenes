import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FALLBACK_FILE = path.join(__dirname, 'data-fallback.json');

export const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cortesmail',
};

export const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

let pool = null;
let dbMode = 'initializing'; // 'mariadb' | 'json-fallback'

function generateApiKey() {
  return `nk_live_${crypto.randomBytes(12).toString('hex')}`;
}

function loadFallbackStore() {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8'));
      if (!parsed.credit_requests) parsed.credit_requests = [];
      return parsed;
    }
  } catch {
    /* ignore */
  }
  const initial = {
    users: [
      {
        id: 1,
        name: 'Cliente Demo Perú',
        email: 'demo@nodos.pe',
        phone: '999888777',
        credits_balance: 25,
        total_processes: 0,
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ],
    api_keys: [
      {
        id: 1,
        user_id: 1,
        key_token: 'nk_live_demo_peru_2026',
        label: 'Licencia Demo Web/Windows',
        active: 1,
        last_used_at: null,
        created_at: new Date().toISOString(),
      },
    ],
    credit_transactions: [
      {
        id: 1,
        user_id: 1,
        amount: 25,
        balance_after: 25,
        payment_method: 'welcome',
        note: 'Bono de bienvenida (25 procesos)',
        created_at: new Date().toISOString(),
      },
    ],
    credit_requests: [],
    process_logs: [],
  };
  saveFallbackStore(initial);
  return initial;
}

function saveFallbackStore(store) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    /* ignore */
  }
}

export async function initDb() {
  if (pool || dbMode === 'json-fallback') return { mode: dbMode };
  try {
    const mysql = await import('mysql2/promise');
    const tmpPool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    const conn = await tmpPool.getConnection();
    await conn.ping();
    conn.release();
    pool = tmpPool;
    dbMode = 'mariadb';
    console.log(`[DB] Conectado a MariaDB (${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database})`);
  } catch (err) {
    dbMode = 'json-fallback';
    loadFallbackStore();
    console.log(
      `[DB] MariaDB no detectada (${err instanceof Error ? err.message : 'sin conexión'}). Usando persistencia local JSON en server/data-fallback.json hasta que actives MariaDB.`,
    );
  }
  return { mode: dbMode };
}

export function getDbMode() {
  return dbMode;
}

export async function findUserByApiKey(keyToken) {
  await initDb();
  if (!keyToken) return null;

  if (dbMode === 'mariadb' && pool) {
    const [rows] = await pool.execute(
      `SELECT u.*, k.id AS api_key_id, k.key_token, k.label AS key_label
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.key_token = ? AND k.active = 1 AND u.status = 'active'
       LIMIT 1`,
      [keyToken],
    );
    const user = rows[0] || null;
    if (!user) return null;

    const [txs] = await pool.execute(
      `SELECT id, amount, balance_after, payment_method, note, created_at
       FROM credit_transactions
       WHERE user_id = ?
       ORDER BY id DESC LIMIT 15`,
      [user.id],
    );
    const [logs] = await pool.execute(
      `SELECT id, source_type, action_type, files_count, slices_count, credits_used, created_at
       FROM process_logs
       WHERE user_id = ?
       ORDER BY id DESC LIMIT 15`,
      [user.id],
    );
    const [reqs] = await pool.execute(
      `SELECT id, credits_requested, price_pen, payment_method, operation_code, sender_name, note, status, resolved_at, created_at
       FROM credit_requests
       WHERE user_id = ?
       ORDER BY id DESC LIMIT 10`,
      [user.id],
    );
    return { user, transactions: txs, logs, requests: reqs };
  }

  const store = loadFallbackStore();
  const key = store.api_keys.find((k) => k.key_token === keyToken && k.active === 1);
  if (!key) return null;
  const user = store.users.find((u) => u.id === key.user_id && u.status === 'active');
  if (!user) return null;

  const transactions = store.credit_transactions
    .filter((t) => t.user_id === user.id)
    .slice(-15)
    .reverse();
  const logs = store.process_logs
    .filter((l) => l.user_id === user.id)
    .slice(-15)
    .reverse();
  const requests = (store.credit_requests || [])
    .filter((r) => r.user_id === user.id)
    .slice(-10)
    .reverse();

  return {
    user: { ...user, api_key_id: key.id, key_token: key.key_token, key_label: key.label },
    transactions,
    logs,
    requests,
  };
}

export async function consumeUserCredits({
  keyToken,
  amount = 1,
  sourceType = 'web',
  actionType = 'zip',
  filesCount = 1,
  slicesCount = 1,
  note = null,
}) {
  await initDb();
  const cost = Math.max(1, Math.round(Number(amount) || 1));

  if (dbMode === 'mariadb' && pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        `SELECT u.id, u.name, u.credits_balance, k.id AS api_key_id
         FROM api_keys k
         JOIN users u ON u.id = k.user_id
         WHERE k.key_token = ? AND k.active = 1 AND u.status = 'active'
         FOR UPDATE`,
        [keyToken],
      );
      const row = rows[0];
      if (!row) {
        await conn.rollback();
        return { ok: false, status: 401, error: 'API Key inválida o inactiva.' };
      }
      if (row.credits_balance < cost) {
        await conn.rollback();
        return {
          ok: false,
          status: 402,
          error: `Créditos insuficientes. Necesitas ${cost} y tienes ${row.credits_balance}.`,
          credits_balance: row.credits_balance,
        };
      }

      const nextBalance = row.credits_balance - cost;
      await conn.execute(
        `UPDATE users SET credits_balance = ?, total_processes = total_processes + ? WHERE id = ?`,
        [nextBalance, filesCount, row.id],
      );
      await conn.execute(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.api_key_id]);
      await conn.execute(
        `INSERT INTO credit_transactions (user_id, amount, balance_after, payment_method, note)
         VALUES (?, ?, ?, 'usage', ?)`,
        [row.id, -cost, nextBalance, note || `Proceso ${actionType} (${filesCount} arch, ${slicesCount} cortes)`],
      );
      await conn.execute(
        `INSERT INTO process_logs (user_id, api_key_id, source_type, action_type, files_count, slices_count, credits_used)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.api_key_id, sourceType, actionType, filesCount, slicesCount, cost],
      );
      await conn.commit();
      return { ok: true, credits_balance: nextBalance, consumed: cost };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  const store = loadFallbackStore();
  const key = store.api_keys.find((k) => k.key_token === keyToken && k.active === 1);
  if (!key) return { ok: false, status: 401, error: 'API Key inválida o inactiva.' };
  const user = store.users.find((u) => u.id === key.user_id && u.status === 'active');
  if (!user) return { ok: false, status: 401, error: 'Usuario no encontrado o suspendido.' };

  if (user.credits_balance < cost) {
    return {
      ok: false,
      status: 402,
      error: `Créditos insuficientes. Necesitas ${cost} y tienes ${user.credits_balance}.`,
      credits_balance: user.credits_balance,
    };
  }

  user.credits_balance -= cost;
  user.total_processes = (user.total_processes || 0) + filesCount;
  key.last_used_at = new Date().toISOString();

  store.credit_transactions.push({
    id: store.credit_transactions.length + 1,
    user_id: user.id,
    amount: -cost,
    balance_after: user.credits_balance,
    payment_method: 'usage',
    note: note || `Proceso ${actionType} (${filesCount} arch, ${slicesCount} cortes)`,
    created_at: new Date().toISOString(),
  });

  store.process_logs.push({
    id: store.process_logs.length + 1,
    user_id: user.id,
    api_key_id: key.id,
    source_type: sourceType,
    action_type: actionType,
    files_count: filesCount,
    slices_count: slicesCount,
    credits_used: cost,
    created_at: new Date().toISOString(),
  });

  saveFallbackStore(store);
  return { ok: true, credits_balance: user.credits_balance, consumed: cost };
}

export async function createCreditRequestDb({
  keyToken,
  creditsRequested,
  pricePen,
  paymentMethod = 'yape',
  operationCode,
  senderName = '',
  note = '',
}) {
  await initDb();
  const found = await findUserByApiKey(keyToken);
  if (!found) {
    throw new Error('Tu sesión o API Key no es válida.');
  }
  const user = found.user;
  const credits = Math.max(1, Math.round(Number(creditsRequested) || 50));
  const price = Math.max(0, Number(pricePen) || 0);
  const opCode = String(operationCode || '').trim();
  if (!opCode) {
    throw new Error('Ingresa el código de operación o número de celular desde el que realizaste el pago.');
  }

  if (dbMode === 'mariadb' && pool) {
    const [res] = await pool.execute(
      `INSERT INTO credit_requests (user_id, credits_requested, price_pen, payment_method, operation_code, sender_name, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [user.id, credits, price, paymentMethod, opCode, senderName || user.name, note || null],
    );
    return {
      id: res.insertId,
      user_id: user.id,
      user_name: user.name,
      user_phone: user.phone,
      key_token: user.key_token,
      credits_requested: credits,
      price_pen: price,
      payment_method: paymentMethod,
      operation_code: opCode,
      sender_name: senderName || user.name,
      note,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  }

  const store = loadFallbackStore();
  const reqItem = {
    id: (store.credit_requests.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1,
    user_id: user.id,
    credits_requested: credits,
    price_pen: price,
    payment_method: paymentMethod,
    operation_code: opCode,
    sender_name: senderName || user.name,
    note: note || null,
    status: 'pending',
    resolved_at: null,
    created_at: new Date().toISOString(),
  };
  store.credit_requests.push(reqItem);
  saveFallbackStore(store);
  return {
    ...reqItem,
    user_name: user.name,
    user_phone: user.phone,
    key_token: user.key_token,
  };
}

export async function listCreditRequestsAdmin() {
  await initDb();
  if (dbMode === 'mariadb' && pool) {
    const [rows] = await pool.execute(
      `SELECT r.*, u.name AS user_name, u.phone AS user_phone, u.email AS user_email, u.credits_balance,
              (SELECT k.key_token FROM api_keys k WHERE k.user_id = u.id AND k.active = 1 LIMIT 1) AS key_token
       FROM credit_requests r
       JOIN users u ON u.id = r.user_id
       ORDER BY FIELD(r.status, 'pending', 'approved', 'rejected'), r.id DESC
       LIMIT 100`,
    );
    return rows;
  }

  const store = loadFallbackStore();
  return [...(store.credit_requests || [])]
    .reverse()
    .map((r) => {
      const u = store.users.find((x) => x.id === r.user_id);
      const k = store.api_keys.find((x) => x.user_id === r.user_id && x.active === 1);
      return {
        ...r,
        user_name: u?.name || `Usuario #${r.user_id}`,
        user_phone: u?.phone || null,
        user_email: u?.email || null,
        credits_balance: u?.credits_balance ?? 0,
        key_token: k?.key_token || null,
      };
    });
}

export async function resolveCreditRequestAdmin({ requestId, action }) {
  await initDb();
  const id = Number(requestId);
  if (action !== 'approve' && action !== 'reject') {
    throw new Error('Acción inválida.');
  }

  if (dbMode === 'mariadb' && pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(
        `SELECT * FROM credit_requests WHERE id = ? FOR UPDATE`,
        [id],
      );
      const reqItem = rows[0];
      if (!reqItem) {
        await conn.rollback();
        throw new Error('Solicitud no encontrada.');
      }
      if (reqItem.status !== 'pending') {
        await conn.rollback();
        throw new Error(`Esta solicitud ya fue ${reqItem.status === 'approved' ? 'aprobada' : 'rechazada'}.`);
      }

      if (action === 'reject') {
        await conn.execute(
          `UPDATE credit_requests SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [id],
        );
        await conn.commit();
        return { id, status: 'rejected' };
      }

      const [uRows] = await conn.execute(
        `SELECT id, name, credits_balance FROM users WHERE id = ? FOR UPDATE`,
        [reqItem.user_id],
      );
      const u = uRows[0];
      if (!u) {
        await conn.rollback();
        throw new Error('Usuario no encontrado.');
      }

      const nextBalance = u.credits_balance + Number(reqItem.credits_requested);
      await conn.execute(`UPDATE users SET credits_balance = ? WHERE id = ?`, [nextBalance, u.id]);
      await conn.execute(
        `UPDATE credit_requests SET status = 'approved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id],
      );
      await conn.execute(
        `INSERT INTO credit_transactions (user_id, amount, balance_after, payment_method, note)
         VALUES (?, ?, ?, ?, ?)`,
        [
          u.id,
          reqItem.credits_requested,
          nextBalance,
          reqItem.payment_method === 'otro' ? 'manual' : reqItem.payment_method,
          `Solicitud #${id} aprobada (${reqItem.payment_method.toUpperCase()} · Op: ${reqItem.operation_code})`,
        ],
      );
      await conn.commit();
      return {
        id,
        status: 'approved',
        credits_added: reqItem.credits_requested,
        credits_balance: nextBalance,
        user_name: u.name,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  const store = loadFallbackStore();
  const reqItem = (store.credit_requests || []).find((r) => r.id === id);
  if (!reqItem) throw new Error('Solicitud no encontrada.');
  if (reqItem.status !== 'pending') {
    throw new Error(`Esta solicitud ya fue ${reqItem.status === 'approved' ? 'aprobada' : 'rechazada'}.`);
  }

  if (action === 'reject') {
    reqItem.status = 'rejected';
    reqItem.resolved_at = new Date().toISOString();
    saveFallbackStore(store);
    return { id, status: 'rejected' };
  }

  const u = store.users.find((x) => x.id === reqItem.user_id);
  if (!u) throw new Error('Usuario no encontrado.');
  u.credits_balance += Number(reqItem.credits_requested);
  reqItem.status = 'approved';
  reqItem.resolved_at = new Date().toISOString();

  store.credit_transactions.push({
    id: store.credit_transactions.length + 1,
    user_id: u.id,
    amount: Number(reqItem.credits_requested),
    balance_after: u.credits_balance,
    payment_method: reqItem.payment_method === 'otro' ? 'manual' : reqItem.payment_method,
    note: `Solicitud #${id} aprobada (${reqItem.payment_method.toUpperCase()} · Op: ${reqItem.operation_code})`,
    created_at: new Date().toISOString(),
  });
  saveFallbackStore(store);
  return {
    id,
    status: 'approved',
    credits_added: reqItem.credits_requested,
    credits_balance: u.credits_balance,
    user_name: u.name,
  };
}

export async function createCustomer({ name, email = null, phone = null, initialCredits = 10, label = 'Principal' }) {
  await initDb();
  const cleanCredits = Math.max(0, Math.round(Number(initialCredits) || 0));
  const keyToken = generateApiKey();

  if (dbMode === 'mariadb' && pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.execute(
        `INSERT INTO users (name, email, phone, credits_balance, role) VALUES (?, ?, ?, ?, 'user')`,
        [name, email, phone, cleanCredits],
      );
      const userId = res.insertId;
      await conn.execute(
        `INSERT INTO api_keys (user_id, key_token, label) VALUES (?, ?, ?)`,
        [userId, keyToken, label],
      );
      if (cleanCredits > 0) {
        await conn.execute(
          `INSERT INTO credit_transactions (user_id, amount, balance_after, payment_method, note)
           VALUES (?, ?, ?, 'welcome', ?)`,
          [userId, cleanCredits, cleanCredits, `Créditos iniciales (${cleanCredits})`],
        );
      }
      await conn.commit();
      return { id: userId, name, email, phone, credits_balance: cleanCredits, key_token: keyToken };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  const store = loadFallbackStore();
  const userId = (store.users.reduce((m, u) => Math.max(m, u.id), 0) || 0) + 1;
  const newUser = {
    id: userId,
    name,
    email,
    phone,
    credits_balance: cleanCredits,
    total_processes: 0,
    role: 'user',
    status: 'active',
    created_at: new Date().toISOString(),
  };
  store.users.push(newUser);
  store.api_keys.push({
    id: store.api_keys.length + 1,
    user_id: userId,
    key_token: keyToken,
    label,
    active: 1,
    last_used_at: null,
    created_at: new Date().toISOString(),
  });
  if (cleanCredits > 0) {
    store.credit_transactions.push({
      id: store.credit_transactions.length + 1,
      user_id: userId,
      amount: cleanCredits,
      balance_after: cleanCredits,
      payment_method: 'welcome',
      note: `Créditos iniciales (${cleanCredits})`,
      created_at: new Date().toISOString(),
    });
  }
  saveFallbackStore(store);
  return { ...newUser, key_token: keyToken };
}

export async function topUpCredits({ userId, amount, paymentMethod = 'yape', note = '' }) {
  await initDb();
  const delta = Math.round(Number(amount) || 0);
  if (delta === 0) throw new Error('El monto de créditos no puede ser 0.');

  if (dbMode === 'mariadb' && pool) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute(`SELECT id, name, credits_balance FROM users WHERE id = ? FOR UPDATE`, [userId]);
      const u = rows[0];
      if (!u) {
        await conn.rollback();
        throw new Error('Usuario no encontrado.');
      }
      const nextBalance = Math.max(0, u.credits_balance + delta);
      await conn.execute(`UPDATE users SET credits_balance = ? WHERE id = ?`, [nextBalance, userId]);
      await conn.execute(
        `INSERT INTO credit_transactions (user_id, amount, balance_after, payment_method, note)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, delta, nextBalance, paymentMethod, note || `Recarga manual (${paymentMethod.toUpperCase()})`],
      );
      await conn.commit();
      return { userId, name: u.name, credits_balance: nextBalance, added: delta };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  const store = loadFallbackStore();
  const u = store.users.find((x) => x.id === Number(userId));
  if (!u) throw new Error('Usuario no encontrado.');
  u.credits_balance = Math.max(0, u.credits_balance + delta);
  store.credit_transactions.push({
    id: store.credit_transactions.length + 1,
    user_id: u.id,
    amount: delta,
    balance_after: u.credits_balance,
    payment_method: paymentMethod,
    note: note || `Recarga manual (${paymentMethod.toUpperCase()})`,
    created_at: new Date().toISOString(),
  });
  saveFallbackStore(store);
  return { userId: u.id, name: u.name, credits_balance: u.credits_balance, added: delta };
}

export async function listAllUsersAdmin() {
  await initDb();
  if (dbMode === 'mariadb' && pool) {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.credits_balance, u.total_processes, u.status, u.created_at,
              (SELECT k.key_token FROM api_keys k WHERE k.user_id = u.id AND k.active = 1 LIMIT 1) AS key_token,
              (SELECT k.last_used_at FROM api_keys k WHERE k.user_id = u.id AND k.active = 1 LIMIT 1) AS last_used_at
       FROM users u
       ORDER BY u.id DESC`,
    );
    return rows;
  }

  const store = loadFallbackStore();
  return [...store.users].reverse().map((u) => {
    const k = store.api_keys.find((ak) => ak.user_id === u.id && ak.active === 1);
    return {
      ...u,
      key_token: k?.key_token || null,
      last_used_at: k?.last_used_at || null,
    };
  });
}
