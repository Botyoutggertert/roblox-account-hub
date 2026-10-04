import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isMaximized: () => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
  robloxFetch: (url: string, options?: any) => Promise<{ status: number; data: any; headers: any; ok: boolean }>;
  startRobloxOAuth: () => Promise<{ authorizationUrl?: string; error?: string }>;
  checkRobloxOAuth: () => Promise<any>;
  disconnectRobloxOAuth: () => Promise<void>;
  getRobloxOAuthDiagnostics: () => Promise<any>;
  onRobloxOAuthResult: (listener: (result: any) => void) => () => void;
  showSaveDialog: (options: any) => Promise<any>;
  showOpenDialog: (options: any) => Promise<any>;
  saveFile: (path: string, content: string) => Promise<boolean>;
  readFile: (path: string) => Promise<string>;
}

const api: ElectronAPI = {
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  robloxFetch: (url: string, options?: any) => ipcRenderer.invoke('roblox-fetch', url, options),
  startRobloxOAuth: () => ipcRenderer.invoke('roblox-oauth-start'),
  checkRobloxOAuth: () => ipcRenderer.invoke('roblox-oauth-check'),
  disconnectRobloxOAuth: () => ipcRenderer.invoke('roblox-oauth-disconnect'),
  getRobloxOAuthDiagnostics: () => ipcRenderer.invoke('roblox-oauth-diagnostics'),
  onRobloxOAuthResult: listener => {
    const handler = (_event: unknown, result: any) => listener(result);
    ipcRenderer.on('roblox-oauth-result', handler);
    return () => ipcRenderer.removeListener('roblox-oauth-result', handler);
  },
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  saveFile: (path: string, content: string) => ipcRenderer.invoke('save-file', path, content),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
};

contextBridge.exposeInMainWorld('electronAPI', api);
