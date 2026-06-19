import { createOmniError, warnMessage } from '../core/OmniError.js';
import { DEFAULT_ENGINE_VERSION } from '../config/defaults.js';
import RealtimeConnection from './RealtimeConnection.js';
import WebTransportConnection from './WebTransportConnection.js';

/**
 * Network and persistence wrappers.
 *
 * @example
 * const net = new NetManager();
 * const profile = await net.get('/api/profile');
 * StorageManager.set('save', { level: 3 });
 */
export class NetManager {
  constructor({
    fetcher = globalThis.fetch?.bind(globalThis),
    headers = {},
    WebSocketClass = globalThis.WebSocket,
    WebTransportClass = globalThis.WebTransport
  } = {}) {
    this.fetcher = fetcher;
    this.headers = headers;
    this.WebSocketClass = WebSocketClass;
    this.WebTransportClass = WebTransportClass;
  }

  async request(url, options = {}) {
    if (!this.fetcher) throw createOmniError('Net', '当前环境没有可用的 fetch 实现。');
    const response = await this.fetcher(url, {
      ...options,
      headers: { ...this.headers, ...(options.headers || {}) }
    });
    if (!response.ok) throw createOmniError('Net', `请求失败：${url}，HTTP ${response.status || 500}`);
    const contentType = response.headers?.get?.('content-type') || '';
    return contentType.includes('application/json') ? response.json() : response.text();
  }

  get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  post(url, body, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
  }

  async connect(url, {
    transport = 'websocket',
    retryLimit = 0,
    WebSocketClass = this.WebSocketClass,
    WebTransportClass = this.WebTransportClass
  } = {}) {
    if (transport === 'webtransport') {
      return new WebTransportConnection({
        url,
        WebTransportClass,
        retryLimit
      }).open();
    }
    if (transport !== 'websocket') throw createOmniError('Net', `不支持的实时网络传输：${transport}`);
    return new RealtimeConnection({
      url,
      WebSocketClass
    }).open();
  }
}

export class StorageManager {
  static memory = new Map();

  static engineVersion = DEFAULT_ENGINE_VERSION;

  static onVersionMismatch = null;

  static migrations = {};

  static configure({ engineVersion, onVersionMismatch, migrations = {} } = {}) {
    if (engineVersion) StorageManager.engineVersion = engineVersion;
    if (onVersionMismatch) StorageManager.onVersionMismatch = onVersionMismatch;
    StorageManager.migrations = { ...StorageManager.migrations, ...migrations };
  }

  static async ensureEngineVersion({ engineVersion, onVersionMismatch, migrations = {} } = {}) {
    StorageManager.configure({ engineVersion, onVersionMismatch, migrations });
    const currentVersion = StorageManager.get('omnicore:engineVersion');
    const targetVersion = StorageManager.engineVersion;

    if (!currentVersion) {
      StorageManager.set('omnicore:engineVersion', targetVersion);
      return { migrated: false, from: null, to: targetVersion };
    }

    if (currentVersion === targetVersion) {
      return { migrated: false, from: currentVersion, to: targetVersion };
    }

    const context = {
      from: currentVersion,
      to: targetVersion,
      storage: StorageManager
    };
    await StorageManager.onVersionMismatch?.(context);
    const migration = StorageManager.migrations[`${currentVersion}->${targetVersion}`];
    if (migration) await migration(context);
    StorageManager.set('omnicore:engineVersion', targetVersion);
    return { migrated: Boolean(migration), from: currentVersion, to: targetVersion };
  }

  static async ensureSaveVersion(key, {
    version = StorageManager.engineVersion,
    migrations = {},
    onVersionMismatch = StorageManager.onVersionMismatch,
    versionField = '__version',
    backup = true,
    allowDowngrade = false
  } = {}) {
    if (!key) throw createOmniError('Storage', 'ensureSaveVersion requires a storage key.');
    const save = StorageManager.get(key);
    const targetVersion = String(version || StorageManager.engineVersion);

    if (save == null) {
      return { migrated: false, missing: true, from: null, to: targetVersion, steps: [] };
    }

    const currentVersion = String(save?.[versionField] || save?.version || '');
    if (!currentVersion) {
      const initialized = setSaveVersion(save, versionField, targetVersion);
      StorageManager.set(key, initialized);
      return { migrated: false, initialized: true, from: null, to: targetVersion, steps: [] };
    }

    if (currentVersion === targetVersion) {
      return { migrated: false, from: currentVersion, to: targetVersion, steps: [] };
    }

    if (!allowDowngrade && compareVersions(currentVersion, targetVersion) > 0) {
      throw createOmniError('Storage', `存档版本高于当前代码期望版本：${currentVersion} > ${targetVersion}`);
    }

    const steps = resolveMigrationSteps(currentVersion, targetVersion, migrations);
    if (steps.length === 0 && currentVersion !== targetVersion) {
      throw createOmniError('Storage', `缺少存档迁移路径：${currentVersion} -> ${targetVersion}`);
    }

    if (backup) StorageManager.backup(key, save, currentVersion);
    const context = {
      key,
      from: currentVersion,
      to: targetVersion,
      storage: StorageManager
    };
    await onVersionMismatch?.(context);

    let nextSave = save;
    for (const step of steps) {
      const migrated = await migrations[step](nextSave, {
        ...context,
        step,
        from: step.split('->')[0],
        to: step.split('->')[1],
        save: nextSave
      });
      if (migrated !== undefined) nextSave = migrated;
      nextSave = setSaveVersion(nextSave, versionField, step.split('->')[1]);
    }

    nextSave = setSaveVersion(nextSave, versionField, targetVersion);
    StorageManager.set(key, nextSave);
    return {
      migrated: steps.length > 0,
      from: currentVersion,
      to: targetVersion,
      steps
    };
  }

  static backup(key, value = StorageManager.get(key), version = StorageManager.get('omnicore:engineVersion') || 'unknown') {
    const backupKey = `omnicore:backup:${version}:${key}`;
    if (StorageManager.get(backupKey) === null) StorageManager.set(backupKey, value);
    return backupKey;
  }

  static set(key, value) {
    const serialized = JSON.stringify(value);
    try {
      globalThis.localStorage?.setItem(key, serialized);
    } catch {
      StorageManager.memory.set(key, serialized);
    }
  }

  static get(key, fallback = null) {
    let value = null;
    try {
      value = globalThis.localStorage?.getItem(key);
    } catch {
      value = StorageManager.memory.get(key);
    }
    if (value == null) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  static remove(key) {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      StorageManager.memory.delete(key);
    }
  }

  static saveEncrypted(key, value, secret = 'omnicore') {
    const payload = JSON.stringify(value);
    const encrypted = encodeBase64(xorCipher(payload, secret));
    StorageManager.set(key, encrypted);
    return encrypted;
  }

  static loadEncrypted(key, secret = 'omnicore', fallback = null) {
    const encrypted = StorageManager.get(key);
    if (!encrypted) return fallback;
    try {
      return JSON.parse(xorCipher(decodeBase64(encrypted), secret));
    } catch {
      return fallback;
    }
  }

  static read(key, fallback = null) {
    console.warn(warnMessage('Storage', '已废弃 API OmniCore.Storage.read，自 0.2.0 起废弃，将在 1.0.0 移除；请改用 OmniCore.Storage.get。'));
    return StorageManager.get(key, fallback);
  }

  static write(key, value) {
    console.warn(warnMessage('Storage', '已废弃 API OmniCore.Storage.write，自 0.2.0 起废弃，将在 1.0.0 移除；请改用 OmniCore.Storage.set。'));
    return StorageManager.set(key, value);
  }
}

function xorCipher(input, secret) {
  const key = String(secret || 'omnicore');
  return Array.from(String(input), (char, index) => {
    const keyCode = key.charCodeAt(index % key.length);
    // eslint-disable-next-line no-bitwise
    return String.fromCharCode(char.charCodeAt(0) ^ keyCode);
  }).join('');
}

function encodeBase64(value) {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'binary').toString('base64');
  return btoa(value);
}

function decodeBase64(value) {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'base64').toString('binary');
  return atob(value);
}

function setSaveVersion(save, versionField, version) {
  if (save && typeof save === 'object' && !Array.isArray(save)) {
    return { ...save, [versionField]: version };
  }
  return { [versionField]: version, value: save };
}

function resolveMigrationSteps(from, to, migrations = {}) {
  const edges = Object.keys(migrations)
    .map((key) => {
      const [source, target] = key.split('->');
      return source && target ? { key, source, target } : null;
    })
    .filter(Boolean);
  const queue = [{ version: from, steps: [] }];
  const visited = new Set([from]);

  while (queue.length) {
    const current = queue.shift();
    if (current.version === to) return current.steps;
    for (const edge of edges.filter((item) => item.source === current.version)) {
      if (visited.has(edge.target)) continue;
      visited.add(edge.target);
      queue.push({ version: edge.target, steps: [...current.steps, edge.key] });
    }
  }
  return [];
}

function compareVersions(left, right) {
  const leftParts = String(left).split(/[.-]/u).map(versionPart);
  const rightParts = String(right).split(/[.-]/u).map(versionPart);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

function versionPart(value) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  return String(value || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export default NetManager;
