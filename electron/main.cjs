const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;

// Sin barra de menú (File/Edit/View/Window) para que se vea como app nativa.
Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Herramientas de Diseño Nodos',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  return win;
}

app.whenReady().then(() => {
  const win = createWindow();

  if (!isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    const send = (payload) => {
      try {
        win.webContents.send('update-status', payload);
      } catch {
        /* ventana cerrada */
      }
    };

    autoUpdater.on('checking-for-update', () => send({ status: 'checking' }));
    autoUpdater.on('update-available', (info) => send({ status: 'available', version: info?.version }));
    autoUpdater.on('update-not-available', () => send({ status: 'up-to-date' }));
    autoUpdater.on('download-progress', (p) => send({ status: 'downloading', percent: Math.round(p?.percent ?? 0) }));
    autoUpdater.on('update-downloaded', (info) => send({ status: 'downloaded', version: info?.version }));
    autoUpdater.on('error', (err) => send({ status: 'error', message: err?.message }));

    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      send({ status: 'error', message: 'No se pudo verificar actualizaciones.' });
    });
  }

  ipcMain.on('install-update', () => {
    // Silencioso: reemplaza los archivos en el directorio de instalación
    // sin mostrar el asistente del instalador. Reinicia la app al terminar.
    autoUpdater.quitAndInstall(true, true);
  });

  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates().catch((err) => {
      try {
        win.webContents.send('update-status', { status: 'error', message: err?.message || 'Error al verificar actualizaciones.' });
      } catch {
        /* ventana cerrada */
      }
    });
  });

  ipcMain.handle('save-to-downloads', async (_event, name, data) => {
    const fs = require('node:fs');
    const path = require('node:path');
    const downloads = app.getPath('downloads');
    let filename = name;
    let target = path.join(downloads, filename);
    let i = 1;
    while (fs.existsSync(target)) {
      const dot = filename.lastIndexOf('.');
      const base = dot > 0 ? filename.slice(0, dot) : filename;
      const ext = dot > 0 ? filename.slice(dot) : '';
      filename = `${base} (${i})${ext}`;
      target = path.join(downloads, filename);
      i++;
    }
    fs.writeFileSync(target, Buffer.from(data));
    return { path: target, filename };
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
