import http from 'node:http';
import {
  ADMIN_SECRET,
  consumeUserCredits,
  createCreditRequestDb,
  createCustomer,
  findUserByApiKey,
  getDbMode,
  initDb,
  listAllUsersAdmin,
  listCreditRequestsAdmin,
  resolveCreditRequestAdmin,
  topUpCredits,
} from './db.mjs';

const PORT = Number(process.env.API_PORT) || 3001;

// Lógica matemática pura de cortes (idéntica a src/utils/slicing.ts)
function computeSlicesFromGrid(width, height, grid) {
  const rows = Math.max(1, Math.floor(grid?.rows || 1));
  const cols = Math.max(1, Math.floor(grid?.cols || 2));
  const xs = Array.from({ length: cols + 1 }, (_, i) => Math.round((i * width) / cols));
  const ys = Array.from({ length: rows + 1 }, (_, i) => Math.round((i * height) / rows));
  const rects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rects.push({
        x: xs[c],
        y: ys[r],
        width: Math.max(1, xs[c + 1] - xs[c]),
        height: Math.max(1, ys[r + 1] - ys[r]),
        row: r + 1,
        col: c + 1,
      });
    }
  }
  return rects;
}

function computeSlicesFromGuides(width, height, guides) {
  const cleanX = Array.from(new Set((guides?.xs || []).map((n) => Math.round(Number(n))).filter((n) => n > 0 && n < width))).sort((a, b) => a - b);
  const cleanY = Array.from(new Set((guides?.ys || []).map((n) => Math.round(Number(n))).filter((n) => n > 0 && n < height))).sort((a, b) => a - b);
  const xs = [0, ...cleanX, width];
  const ys = [0, ...cleanY, height];
  const rects = [];
  for (let r = 0; r < ys.length - 1; r++) {
    for (let c = 0; c < xs.length - 1; c++) {
      rects.push({
        x: xs[c],
        y: ys[r],
        width: Math.max(1, xs[c + 1] - xs[c]),
        height: Math.max(1, ys[r + 1] - ys[r]),
        row: r + 1,
        col: c + 1,
      });
    }
  }
  return rects;
}

function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-admin-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Payload demasiado grande (máx 25MB).'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON inválido en el cuerpo de la petición.'));
      }
    });
    req.on('error', reject);
  });
}

function extractApiKey(req) {
  const auth = req.headers['authorization'] || '';
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const headerKey = req.headers['x-api-key'];
  return typeof headerKey === 'string' ? headerKey.trim() : '';
}

function checkAdmin(req) {
  const secret = req.headers['x-admin-secret'];
  return typeof secret === 'string' && secret === ADMIN_SECRET;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-admin-secret',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // 1. Healthcheck
    if (req.method === 'GET' && pathname === '/api/health') {
      await initDb();
      return sendJson(res, 200, { ok: true, dbMode: getDbMode(), version: '1.0.13' });
    }

    // 2. Registro rápido gratuito
    if (req.method === 'POST' && pathname === '/api/auth/register-free') {
      const body = await readJsonBody(req);
      const name = String(body.name || 'Usuario Web').trim().slice(0, 100);
      const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null;
      const email = body.email ? String(body.email).trim().slice(0, 120) : null;
      const created = await createCustomer({
        name,
        phone,
        email,
        initialCredits: 10,
        label: 'Cuenta Gratuita',
      });
      return sendJson(res, 201, { ok: true, customer: created, dbMode: getDbMode() });
    }

    // 3. Consultar saldo y movimientos de la cuenta actual
    if (req.method === 'GET' && pathname === '/api/credits/me') {
      const keyToken = extractApiKey(req) || url.searchParams.get('key') || '';
      const data = await findUserByApiKey(keyToken);
      if (!data) {
        return sendJson(res, 401, { ok: false, error: 'API Key no válida o no encontrada.' });
      }
      return sendJson(res, 200, {
        ok: true,
        dbMode: getDbMode(),
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          credits: data.user.credits_balance,
          totalProcesses: data.user.total_processes,
          role: data.user.role,
          keyToken: data.user.key_token,
          keyLabel: data.user.key_label,
        },
        transactions: data.transactions,
        logs: data.logs,
        requests: data.requests || [],
      });
    }

    // 3b. Enviar solicitud de recarga de créditos (Yape / Plin / BCP / Interbank)
    if (req.method === 'POST' && pathname === '/api/credits/request') {
      const keyToken = extractApiKey(req);
      const body = await readJsonBody(req);
      const created = await createCreditRequestDb({
        keyToken,
        creditsRequested: body.creditsRequested,
        pricePen: body.pricePen,
        paymentMethod: body.paymentMethod || 'yape',
        operationCode: body.operationCode,
        senderName: body.senderName || '',
        note: body.note || '',
      });
      return sendJson(res, 201, { ok: true, request: created });
    }

    // 4. Consumir créditos desde la app Web o Windows
    if (req.method === 'POST' && pathname === '/api/credits/consume') {
      const keyToken = extractApiKey(req);
      const body = await readJsonBody(req);
      const result = await consumeUserCredits({
        keyToken,
        amount: body.amount ?? 1,
        sourceType: body.sourceType || 'web',
        actionType: body.actionType || 'zip',
        filesCount: body.filesCount ?? 1,
        slicesCount: body.slicesCount ?? 1,
        note: body.note || null,
      });
      if (!result.ok) {
        return sendJson(res, result.status || 400, result);
      }
      return sendJson(res, 200, result, {
        'X-Credits-Remaining': String(result.credits_balance),
      });
    }

    // 5. Endpoint público de API por procesos: POST /api/v1/slice
    if (req.method === 'POST' && pathname === '/api/v1/slice') {
      const keyToken = extractApiKey(req);
      const body = await readJsonBody(req);
      const width = Math.max(1, Number(body.width) || 1200);
      const height = Math.max(1, Number(body.height) || 800);
      const mode = body.mode === 'guides' ? 'guides' : 'grid';
      const rects =
        mode === 'grid'
          ? computeSlicesFromGrid(width, height, body.grid || { rows: 1, cols: 2 })
          : computeSlicesFromGuides(width, height, body.guides || { xs: [], ys: [] });

      // Consumir 1 crédito por proceso de API
      const consumption = await consumeUserCredits({
        keyToken,
        amount: 1,
        sourceType: 'api',
        actionType: 'api_slice',
        filesCount: 1,
        slicesCount: rects.length,
        note: `API /v1/slice (${rects.length} cortes)`,
      });

      if (!consumption.ok) {
        return sendJson(res, consumption.status || 402, consumption);
      }

      // Si el cliente envía imageBase64 y sharp está instalado, recortar imágenes reales
      let slicedImages = null;
      if (body.imageBase64 && typeof body.imageBase64 === 'string') {
        try {
          const sharpMod = await import('sharp');
          const sharp = sharpMod.default || sharpMod;
          const cleanB64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
          const imgBuffer = Buffer.from(cleanB64, 'base64');
          const meta = await sharp(imgBuffer).metadata();
          const realW = meta.width || width;
          const realH = meta.height || height;
          const realRects =
            mode === 'grid'
              ? computeSlicesFromGrid(realW, realH, body.grid || { rows: 1, cols: 2 })
              : computeSlicesFromGuides(realW, realH, body.guides || { xs: [], ys: [] });

          slicedImages = [];
          for (let i = 0; i < realRects.length; i++) {
            const r = realRects[i];
            const outBuf = await sharp(imgBuffer)
              .extract({ left: r.x, top: r.y, width: r.width, height: r.height })
              .png()
              .toBuffer();
            slicedImages.push({
              index: i + 1,
              filename: `${i + 1}.png`,
              ...r,
              base64: `data:image/png;base64,${outBuf.toString('base64')}`,
            });
          }
        } catch {
          /* sharp opcional: devuelve el plan exacto de coordenadas y piezas */
        }
      }

      return sendJson(
        res,
        200,
        {
          ok: true,
          creditsRemaining: consumption.credits_balance,
          slicesCount: rects.length,
          slices: slicedImages || rects.map((r, i) => ({ index: i + 1, filename: `${i + 1}.png`, ...r })),
        },
        { 'X-Credits-Remaining': String(consumption.credits_balance) },
      );
    }

    // 6. Endpoints de Administración (Recargas manuales Perú: Yape / Plin / BCP)
    if (pathname.startsWith('/api/admin/')) {
      if (!checkAdmin(req)) {
        return sendJson(res, 403, { ok: false, error: 'Clave de administrador (ADMIN_SECRET) incorrecta.' });
      }

      if (req.method === 'GET' && pathname === '/api/admin/users') {
        const users = await listAllUsersAdmin();
        const requests = await listCreditRequestsAdmin();
        const pendingCount = requests.filter((r) => r.status === 'pending').length;
        return sendJson(res, 200, { ok: true, dbMode: getDbMode(), users, requests, pendingCount });
      }

      if (req.method === 'GET' && pathname === '/api/admin/requests') {
        const requests = await listCreditRequestsAdmin();
        const pendingCount = requests.filter((r) => r.status === 'pending').length;
        return sendJson(res, 200, { ok: true, dbMode: getDbMode(), requests, pendingCount });
      }

      if (req.method === 'POST' && pathname === '/api/admin/requests/resolve') {
        const body = await readJsonBody(req);
        const result = await resolveCreditRequestAdmin({
          requestId: Number(body.requestId),
          action: body.action,
        });
        return sendJson(res, 200, { ok: true, result });
      }

      if (req.method === 'POST' && pathname === '/api/admin/users') {
        const body = await readJsonBody(req);
        if (!body.name) {
          return sendJson(res, 400, { ok: false, error: 'El nombre del cliente es obligatorio.' });
        }
        const customer = await createCustomer({
          name: String(body.name).trim(),
          email: body.email ? String(body.email).trim() : null,
          phone: body.phone ? String(body.phone).trim() : null,
          initialCredits: Number(body.initialCredits ?? 50),
          label: body.label ? String(body.label).trim() : 'Cliente Perú',
        });
        return sendJson(res, 201, { ok: true, customer });
      }

      if (req.method === 'POST' && pathname === '/api/admin/topup') {
        const body = await readJsonBody(req);
        const result = await topUpCredits({
          userId: Number(body.userId),
          amount: Number(body.amount),
          paymentMethod: body.paymentMethod || 'yape',
          note: body.note || '',
        });
        return sendJson(res, 200, { ok: true, result });
      }
    }

    return sendJson(res, 404, { ok: false, error: `Ruta no encontrada: ${pathname}` });
  } catch (err) {
    console.error('[API Error]', err);
    return sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Error interno del servidor',
    });
  }
});

initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`[API CortesMail] Servidor listo en http://localhost:${PORT} (Modo DB: ${getDbMode()})`);
  });
});
