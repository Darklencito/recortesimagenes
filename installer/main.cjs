const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');

const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 420,
    resizable: false,
    maximizable: false,
    minimizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

ipcMain.handle('start-install', async () => {
  const installerPath = isDev
    ? path.join(__dirname, 'installer.exe')
    : path.join(process.resourcesPath, 'installer.exe');

  if (!fs.existsSync(installerPath)) {
    send('install-status', { phase: 'error', message: 'No se encontró el instalador interno.' });
    return { ok: false };
  }

  send('install-status', { phase: 'preparing', message: 'Preparando instalación…', progress: 5 });

  const child = spawn(installerPath, ['/S'], { windowsHide: true });

  // Progreso estimado mientras el instalador corre en silencio
  let progress = 5;
  const ticker = setInterval(() => {
    if (progress < 90) {
      progress += Math.random() * 3 + 1;
      if (progress > 90) progress = 90;
      send('install-status', { phase: 'installing', message: 'Instalando archivos…', progress: Math.round(progress) });
    }
  }, 400);

  send('install-status', { phase: 'installing', message: 'Instalando archivos…', progress: 10 });

  return new Promise((resolve) => {
    child.on('exit', (code) => {
      clearInterval(ticker);
      if (code === 0) {
        send('install-status', { phase: 'done', message: '¡Instalación completa!', progress: 100 });
        resolve({ ok: true });
      } else {
        send('install-status', { phase: 'error', message: `La instalación falló (código ${code}).` });
        resolve({ ok: false, code });
      }
    });
    child.on('error', (err) => {
      clearInterval(ticker);
      send('install-status', { phase: 'error', message: `Error: ${err.message}` });
      resolve({ ok: false, error: err.message });
    });
  });
});

function findInstalledApp() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'Programs');
  const target = 'Herramientas de Diseño Nodos.exe';
  // Búsqueda directa en carpetas candidatas
  const candidates = [
    path.join(base, 'cortesmail', target),
    path.join(base, 'Herramientas de Diseño Nodos', target),
    path.join(base, 'Herramientas de Diseno Nodos', target),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Búsqueda recursiva (por si el instalador usó otro nombre de carpeta)
  try {
    const dirs = fs.readdirSync(base, { withFileTypes: true });
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const p = path.join(base, d.name, target);
      if (fs.existsSync(p)) return p;
    }
  } catch {
    /* ignore */
  }
  return null;
}

ipcMain.handle('launch-app', async () => {
  const appPath = findInstalledApp();
  if (appPath) {
    spawn(appPath, { detached: true, stdio: 'ignore' }).unref();
    // Intentar auto-eliminar el instalador tras cerrarse (best-effort)
    try {
      const installerExe = process.execPath;
      const cmd = `ping -n 6 127.0.0.1 >nul & del /f /q "${installerExe}" 2>nul & ping -n 2 127.0.0.1 >nul & del /f /q "${installerExe}" 2>nul`;
      spawn('cmd.exe', ['/c', cmd], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();
    } catch {
      /* ignore */
    }
    setTimeout(() => app.quit(), 800);
    return { ok: true };
  }
  return { ok: false, message: 'No se encontró la app instalada. Búscala en el menú inicio.' };
});

ipcMain.handle('close-installer', () => {
  app.quit();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
