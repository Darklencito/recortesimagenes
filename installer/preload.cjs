const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('installerAPI', {
  startInstall: () => ipcRenderer.invoke('start-install'),
  launchApp: () => ipcRenderer.invoke('launch-app'),
  closeInstaller: () => ipcRenderer.invoke('close-installer'),
  onStatus: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('install-status', handler);
    return () => ipcRenderer.removeListener('install-status', handler);
  },
});
