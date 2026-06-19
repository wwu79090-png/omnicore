const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('omnicoreEditor', {
  version: '0.1.0',
  platform: process.platform,
  openProjectFolder() {
    return ipcRenderer.invoke('omnicore-editor:open-project-folder');
  },
  scanWorkspace(payload) {
    return ipcRenderer.invoke('omnicore-editor:scan-workspace', payload);
  },
  saveDockLayout(payload) {
    return ipcRenderer.invoke('omnicore-editor:save-dock-layout', payload);
  },
  loadDockLayout(payload) {
    return ipcRenderer.invoke('omnicore-editor:load-dock-layout', payload);
  },
  writeAutoSave(payload) {
    return ipcRenderer.invoke('omnicore-editor:write-autosave', payload);
  },
  readPendingRecovery(payload) {
    return ipcRenderer.invoke('omnicore-editor:read-pending-recovery', payload);
  },
  clearAutoSave(payload) {
    return ipcRenderer.invoke('omnicore-editor:clear-autosave', payload);
  },
  onWorkspaceOpened(callback) {
    const listener = (_event, workspace) => callback?.(workspace);
    ipcRenderer.on('omnicore-editor:workspace-opened', listener);
    return () => ipcRenderer.removeListener('omnicore-editor:workspace-opened', listener);
  },
  onMenuCommand(callback) {
    const listener = (_event, payload) => callback?.(payload);
    ipcRenderer.on('omnicore-editor:menu-command', listener);
    return () => ipcRenderer.removeListener('omnicore-editor:menu-command', listener);
  },
  saveDatabaseConfig(payload) {
    return ipcRenderer.invoke('omnicore-editor:save-database-config', payload);
  },
  saveDataConfig(payload) {
    return ipcRenderer.invoke('omnicore-editor:save-database-config', {
      path: 'config/data.json',
      ...(payload || {})
    });
  }
});
