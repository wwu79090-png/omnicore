const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('omnicoreEditor', {
  version: '0.1.0',
  platform: process.platform,
  saveDatabaseConfig(payload) {
    return ipcRenderer.invoke('omnicore-editor:save-database-config', payload);
  }
});
