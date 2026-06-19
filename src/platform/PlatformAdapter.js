/**
 * Cross-platform adapter helpers for Web, Electron, and WeChat Mini Game.
 *
 * @example
 * const files = PlatformAdapter.generateElectronFiles({ appName: 'My Game' });
 * const wechat = PlatformAdapter.adaptWechat(wx);
 */
export class PlatformAdapter {
  static prepare(platform = 'web', env = globalThis) {
    if (platform === 'wechat') return PlatformAdapter.adaptWechat(env.wx || env);
    if (platform === 'electron') return { platform, electron: true };
    return { platform: 'web' };
  }

  static generateElectronFiles({ appName = 'OmniCore App', entry = 'dist/index.html' } = {}) {
    return {
      'electron/main.js': `const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: ${JSON.stringify(appName)},
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, '..', ${JSON.stringify(entry)}));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`,
      'electron/preload.js': `const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('omnicoreElectron', {
  platform: 'electron'
});
`
    };
  }

  static adaptWechat(wxApi) {
    return {
      platform: 'wechat',
      createCanvas: () => wxApi?.createCanvas?.(),
      requestAnimationFrame: (fn) => wxApi?.requestAnimationFrame?.(fn) || setTimeout(() => fn(Date.now()), 16),
      cancelAnimationFrame: (id) => wxApi?.cancelAnimationFrame?.(id) || clearTimeout(id),
      storage: {
        get: (key) => wxApi?.getStorageSync?.(key),
        set: (key, value) => wxApi?.setStorageSync?.(key, value)
      }
    };
  }
}

export default PlatformAdapter;
