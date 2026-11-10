/// <reference types="vite/client" />

interface ElectronAPI {
  onUpdateStatus: (callback: (data: any) => void) => () => void;
  installUpdate: () => void;
  isElectron: boolean;
}

interface Window {
  electronAPI?: ElectronAPI;
}
