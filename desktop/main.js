const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

// During an active call the renderer asks the window to float above other
// apps (Zoom, browsers, CRMs) so the coach stays visible without Alt+Tab.
ipcMain.on('husai:set-float', (event, enabled) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.setAlwaysOnTop(Boolean(enabled), 'floating');
  if (process.platform === 'darwin') win.setVisibleOnAllWorkspaces(Boolean(enabled), { visibleOnFullScreen: true });
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    title: 'HusAI',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Auto-grant mic permission to our own renderer; every other permission is denied.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });

  // Dev: `npm run dev` points at the Vite dev server. Packaged: load the copied build.
  const devUrl = process.env.HUSAI_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
