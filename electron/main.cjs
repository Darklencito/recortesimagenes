const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');

const isDev = !app.isPackaged;

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
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      /* sin conexión o sin publicación: se ignora */
    });

    autoUpdater.on('update-available', () => {
      win.webContents.send('update-available');
    });
    autoUpdater.on('update-downloaded', () => {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'info',
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 0,
        title: 'Actualización disponible',
        message: 'Se descargó una nueva versión. ¿Reiniciar para instalarla?',
      });
      if (choice === 0) autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', () => {
      /* errores de actualización no bloquean la app */
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
