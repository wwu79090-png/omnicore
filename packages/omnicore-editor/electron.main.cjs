const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function normalizeDatabaseConfig(tables = {}) {
  const output = {};
  for (const [tableName, records] of Object.entries(tables || {})) {
    output[tableName] = {};
    const list = Array.isArray(records) ? records : Object.values(records || {});
    for (const record of list) {
      if (record && record.id) output[tableName][record.id] = { ...record };
    }
  }
  return output;
}

ipcMain.handle('omnicore-editor:save-database-config', async (_event, payload = {}) => {
  const projectRoot = path.resolve(payload.root || process.cwd());
  const relativePath = payload.path || path.join('config', 'db.json');
  const target = path.resolve(projectRoot, relativePath);
  if (!target.startsWith(projectRoot)) {
    return { ok: false, path: target, error: 'Target path escapes project root.' };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(normalizeDatabaseConfig(payload.tables || {}), null, 2)}\n`, 'utf8');
  return { ok: true, path: target };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'OmniCore Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.OMNICORE_EDITOR_DEV_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
