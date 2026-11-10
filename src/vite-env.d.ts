/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ElectronAPI {
  onUpdateStatus: (callback: (data: any) => void) => () => void;
  installUpdate: () => void;
  checkForUpdates: () => void;
  saveToDownloads: (name: string, data: ArrayBuffer) => Promise<{ path: string; filename: string }>;
  isElectron: boolean;
}

interface Window {
  electronAPI?: ElectronAPI;
}
