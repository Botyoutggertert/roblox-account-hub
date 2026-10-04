import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ElectronOAuthManager, loadEnv } from './oauthService';

loadEnv();

let mainWindow: BrowserWindow | null = null;
const oauthManager = new ElectronOAuthManager();

oauthManager.setOnResult(result => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('roblox-oauth-result', result);
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    backgroundColor: '#090a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  oauthManager.printStartupDiagnostics();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  oauthManager.closeCallbackServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  oauthManager.closeCallbackServer();
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => (mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()));
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);
ipcMain.handle('open-external', async (_, url: string) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('roblox-oauth-start', async () => {
  return await oauthManager.startOAuth(async url => {
    await shell.openExternal(url);
  });
});

ipcMain.handle('roblox-oauth-check', () => oauthManager.checkOAuth());
ipcMain.handle('roblox-oauth-disconnect', () => oauthManager.disconnectOAuth());
ipcMain.handle('roblox-oauth-diagnostics', () => {
  oauthManager.refreshConfigDiagnostics();
  return oauthManager.getDiagnostics();
});

ipcMain.handle('roblox-fetch', async (_, url: string, options?: any) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.roblox.com')) {
      return { status: 400, ok: false, data: { error: 'Only Roblox HTTPS endpoints are allowed' }, headers: {} };
    }
    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RobloxAccountHub/1.0.0 (Windows Desktop)',
        ...(options?.headers || {}),
      },
      body: options?.body,
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      headers[key] = val;
    });
    return { status: response.status, ok: response.ok, data, headers };
  } catch (error: any) {
    return { status: 500, ok: false, data: { error: error?.message || 'Network error' }, headers: {} };
  }
});

ipcMain.handle('dialog-save-file', async (_, options: any) => {
  if (!mainWindow) return { canceled: true };
  return dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('dialog-open-file', async (_, options: any) => {
  if (!mainWindow) return { canceled: true };
  return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('fs-save-file', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs-read-file', async (_, filePath: string) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
});
