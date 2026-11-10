/// <reference types="vite/client" />

interface ElectronAPI {
  onUpdateStatus: (callback: (data: any) => void) => () => void;
  installUpdate: () => void;
  saveToDownloads: (name: string, data: ArrayBuffer) => Promise<{ path: string; filename: string }>;
  isElectron: boolean;
}

interface Window {
  electronAPI?: ElectronAPI;
}
