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

  static saveSlotPrefix = 'omnicore:save:slot:';

  static cloudAdapter = null;

  static storeBindings = new Set();

  static configure({ engineVersion, onVersionMismatch, migrations = {} } = {}) {
    if (engineVersion) StorageManager.engineVersion = engineVersion;
    if (onVersionMismatch) StorageManager.onVersionMismatch = onVersionMismatch;
    StorageManager.migrations = { ...StorageManager.migrations, ...migrations };
  }

  static configureSaveSlots({ prefix, cloudAdapter } = {}) {
    if (prefix) StorageManager.saveSlotPrefix = prefix;
    if (cloudAdapter) StorageManager.cloudAdapter = cloudAdapter;
    return {
      prefix: StorageManager.saveSlotPrefix,
      cloudAdapter: StorageManager.cloudAdapter
    };
  }

  static bindStore(store, {
    prefix = 'omnicore:store:',
    target = globalThis.window
  } = {}) {
    if (!store || typeof store.set !== 'function') throw createOmniError('Storage', 'bindStore(store) requires a Store-like object.');
    if (!target?.addEventListener) return () => {};
    const handler = (event) => {
      if (!event?.key || !event.key.startsWith(prefix)) return;
      const key = event.key.slice(prefix.length);
      if (!key) return;
      store.set(key, parseStorageEventValue(event.newValue));
    };
    target.addEventListener('storage', handler);
    const binding = { store, target, handler };
    StorageManager.storeBindings.add(binding);
    return () => {
      target.removeEventListener?.('storage', handler);
      StorageManager.storeBindings.delete(binding);
    };
  }

  static unbindStore(store = null) {
    for (const binding of [...StorageManager.storeBindings]) {
      if (store && binding.store !== store) continue;
      binding.target.removeEventListener?.('storage', binding.handler);
      StorageManager.storeBindings.delete(binding);
    }
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

  static importLegacy(localStorageKey, formatMap = {}, {
    store = null,
    removeLegacy = false,
    fallback = null
  } = {}) {
    if (!localStorageKey) throw createOmniError('Storage', 'importLegacy(localStorageKey, formatMap) requires a localStorage key.');
    const legacy = StorageManager.get(localStorageKey, fallback);
    if (legacy == null) {
      return {
        imported: false,
        key: localStorageKey,
        reason: 'missing',
        importedKeys: [],
        values: {}
      };
    }

    const values = {};
    const importedKeys = [];
    for (const [targetKey, mapping] of Object.entries(formatMap || {})) {
      const value = resolveLegacyMapping(legacy, mapping, {
        key: localStorageKey,
        targetKey
      });
      values[targetKey] = value;
      importedKeys.push(targetKey);
      store?.set?.(targetKey, value);
    }
    if (removeLegacy) StorageManager.remove(localStorageKey);
    return {
      imported: true,
      key: localStorageKey,
      importedKeys,
      values
    };
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

  static async saveSlot(slot, data, {
    schema = null,
    version = StorageManager.engineVersion,
    atomic = true,
    encrypt = false,
    secret = 'omnicore',
    cloudAdapter = StorageManager.cloudAdapter
  } = {}) {
    const key = slotKey(slot);
    const payload = setSaveVersion({
      ...cloneJson(data),
      savedAt: new Date().toISOString()
    }, '__version', String(version || StorageManager.engineVersion));
    validateSaveSchema(payload, schema);
    const previous = StorageManager.get(key, null);
    if (previous != null) StorageManager.set(`${key}:backup`, previous);
    const writeValue = encrypt ? encodeEncryptedPayload(payload, secret) : payload;
    if (atomic) {
      StorageManager.set(`${key}:tmp`, writeValue);
      StorageManager.set(key, StorageManager.get(`${key}:tmp`));
      StorageManager.remove(`${key}:tmp`);
    } else {
      StorageManager.set(key, writeValue);
    }
    await cloudAdapter?.save?.(slot, payload);
    return {
      slot,
      key,
      version: payload.__version,
      saved: true,
      cloud: Boolean(cloudAdapter)
    };
  }

  static async loadSlot(slot, {
    fallback = null,
    schema = null,
    encrypted = false,
    secret = 'omnicore',
    cloudAdapter = StorageManager.cloudAdapter
  } = {}) {
    const key = slotKey(slot);
    let value = StorageManager.get(key, null);
    if (value == null && cloudAdapter?.load) {
      value = await cloudAdapter.load(slot);
      if (value != null) StorageManager.set(key, value);
    }
    if (value == null) return fallback;
    const decoded = encrypted ? decodeEncryptedPayload(value, secret, fallback) : value;
    if (decoded == null) return fallback;
    validateSaveSchema(decoded, schema);
    return decoded;
  }

  static rollbackSlot(slot) {
    const key = slotKey(slot);
    const backup = StorageManager.get(`${key}:backup`, null);
    if (backup == null) return null;
    StorageManager.set(key, backup);
    return backup;
  }

  static deleteSlot(slot, { cloudAdapter = StorageManager.cloudAdapter } = {}) {
    const key = slotKey(slot);
    StorageManager.remove(key);
    StorageManager.remove(`${key}:backup`);
    cloudAdapter?.delete?.(slot);
    return true;
  }

  static listSlots({ prefix = StorageManager.saveSlotPrefix } = {}) {
    const keys = new Set();
    for (const key of StorageManager.memory.keys()) {
      if (String(key).startsWith(prefix) && !String(key).endsWith(':backup') && !String(key).endsWith(':tmp')) {
        keys.add(String(key).slice(prefix.length));
      }
    }
    try {
      const storage = globalThis.localStorage;
      for (let index = 0; storage && index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix) && !key.endsWith(':backup') && !key.endsWith(':tmp')) keys.add(key.slice(prefix.length));
      }
    } catch {
      // In private modes localStorage enumeration can throw; memory keys still work.
    }
    return [...keys].sort();
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

function resolveLegacyMapping(legacy, mapping, context) {
  if (typeof mapping === 'function') {
    return mapping({
      ...context,
      legacy,
      get: (path, fallback = undefined) => readLegacyPath(legacy, path, fallback)
    });
  }
  if (mapping && typeof mapping === 'object' && !Array.isArray(mapping)) {
    const sourcePath = mapping.from ?? mapping.path ?? mapping.source ?? context.targetKey;
    const raw = readLegacyPath(legacy, sourcePath, mapping.fallback);
    return typeof mapping.transform === 'function'
      ? mapping.transform(raw, { ...context, legacy, sourcePath })
      : raw;
  }
  return readLegacyPath(legacy, mapping || context.targetKey);
}

function slotKey(slot) {
  if (!slot) throw createOmniError('Storage', 'save slot name is required.');
  return `${StorageManager.saveSlotPrefix}${String(slot)}`;
}

function cloneJson(value) {
  if (value == null || typeof value !== 'object') return { value };
  return JSON.parse(JSON.stringify(value));
}

function validateSaveSchema(value, schema = null) {
  if (!schema) return true;
  const required = schema.required || [];
  for (const key of required) {
    if (value?.[key] === undefined) {
      throw createOmniError('Storage', `存档缺少必填字段：${key}`, {
        code: 'OMNICORE_SAVE_SCHEMA_INVALID',
        category: 'storage',
        recoverable: true,
        details: { key }
      });
    }
  }
  const properties = schema.properties || {};
  for (const [key, rule] of Object.entries(properties)) {
    if (value?.[key] === undefined || !rule?.type) continue;
    const actual = Array.isArray(value[key]) ? 'array' : typeof value[key];
    if (actual !== rule.type) {
      throw createOmniError('Storage', `存档字段类型不匹配：${key}`, {
        code: 'OMNICORE_SAVE_SCHEMA_INVALID',
        category: 'storage',
        recoverable: true,
        details: { key, expected: rule.type, actual }
      });
    }
  }
  return true;
}

function encodeEncryptedPayload(value, secret) {
  return {
    __encrypted: true,
    payload: encodeBase64(xorCipher(JSON.stringify(value), secret))
  };
}

function decodeEncryptedPayload(value, secret, fallback) {
  try {
    if (value?.__encrypted) return JSON.parse(xorCipher(decodeBase64(value.payload), secret));
    if (typeof value === 'string') return JSON.parse(xorCipher(decodeBase64(value), secret));
    return value;
  } catch {
    return fallback;
  }
}

function readLegacyPath(source, path, fallback = undefined) {
  if (!path) return source ?? fallback;
  const parts = String(path).split('.').filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (current == null) return fallback;
    current = current[part];
  }
  return current === undefined ? fallback : current;
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

function parseStorageEventValue(value) {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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
