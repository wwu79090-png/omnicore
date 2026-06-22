const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {
  scanWorkspaceDirectory,
  writeDockLayout,
  readDockLayout,
  writeAutoSave,
  readPendingRecovery,
  clearAutoSave,
  markSession
} = require('./workspace.cjs');

let activeWorkspaceRoot = null;

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
  const relativePath = payload.path || path.join('config', 'data.json');
  const target = path.resolve(projectRoot, relativePath);
  if (!target.startsWith(projectRoot)) {
    return { ok: false, path: target, error: '目标路径越过项目根目录。' };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(normalizeDatabaseConfig(payload.tables || {}), null, 2)}\n`, 'utf8');
  return { ok: true, path: target };
});

ipcMain.handle('omnicore-editor:open-project-folder', async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(owner, {
    title: '打开 OmniCore 项目',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
  return openWorkspace(result.filePaths[0], owner);
});

ipcMain.handle('omnicore-editor:scan-workspace', async (_event, payload = {}) => openWorkspace(payload.root));

ipcMain.handle('omnicore-editor:save-dock-layout', async (_event, payload = {}) => {
  const root = payload.root || activeWorkspaceRoot;
  return writeDockLayout({ root, layout: payload.layout || {} });
});

ipcMain.handle('omnicore-editor:load-dock-layout', async (_event, payload = {}) => {
  const root = payload.root || activeWorkspaceRoot;
  return readDockLayout({ root });
});

ipcMain.handle('omnicore-editor:write-autosave', async (_event, payload = {}) => {
  const root = payload.root || activeWorkspaceRoot;
  return writeAutoSave({ root, snapshot: payload });
});

ipcMain.handle('omnicore-editor:read-pending-recovery', async (_event, payload = {}) => {
  const root = payload.root || activeWorkspaceRoot;
  return readPendingRecovery({ root });
});

ipcMain.handle('omnicore-editor:clear-autosave', async (_event, payload = {}) => {
  const root = payload.root || activeWorkspaceRoot;
  return clearAutoSave({ root });
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
  createEditorMenu(win);
  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (activeWorkspaceRoot) markSession(activeWorkspaceRoot, true);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function openWorkspace(root, owner = null) {
  const workspace = scanWorkspaceDirectory(root);
  activeWorkspaceRoot = workspace.root;
  markSession(activeWorkspaceRoot, false);
  owner?.webContents?.send?.('omnicore-editor:workspace-opened', workspace);
  return workspace;
}

function createEditorMenu(win) {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开项目文件夹...',
          accelerator: 'CmdOrCtrl+O',
          click: () => win.webContents.send('omnicore-editor:menu-command', { command: 'open-project-folder' })
        },
        {
          label: '保存场景快照',
          accelerator: 'CmdOrCtrl+S',
          click: () => win.webContents.send('omnicore-editor:menu-command', { command: 'save-scene' })
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'delete', label: '删除' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '重置停靠布局',
          click: () => win.webContents.send('omnicore-editor:menu-command', { command: 'reset-dock-layout' })
        },
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '切换开发者工具' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 OmniCore 编辑器',
          click: () => dialog.showMessageBox(win, {
            type: 'info',
            title: 'OmniCore 编辑器',
            message: 'OmniCore 编辑器',
            detail: '用于 OmniCore 项目的独立桌面场景编辑器。'
          })
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
