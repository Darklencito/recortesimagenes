const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },
  installUpdate: () => ipcRenderer.send('install-update'),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  saveToDownloads: (name, data) => ipcRenderer.invoke('save-to-downloads', name, data),
  isElectron: true,
});
