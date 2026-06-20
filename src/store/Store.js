import { atom as nanoAtom } from 'nanostores';
import { createOmniError, warnMessage } from '../core/OmniError.js';

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function createWeakRef(value) {
  if (typeof WeakRef === 'function') return new WeakRef(value);
  return { deref: () => value };
}

function queueMicrotaskSafe(callback) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback);
    return;
  }
  Promise.resolve().then(callback);
}

const STORE_CHECKPOINTS = new WeakMap();

/**
 * Nano Stores based global state registry.
 *
 * Renderer backends inject their current identity here so cross-backend state is
 * retained during experimental renderer switching.
 *
 * @example
 * const store = new Store({ score: 0 });
 * store.subscribe('score', (score) => uiScore.text = String(score));
 * store.injectBackend('pixi');
 */
export class Store {
  static pluginMarket = {
    cdn: '',
    fetcher: globalThis.fetch?.bind(globalThis),
    moduleLoader: (url) => import(/* @vite-ignore */ url),
    installed: new Map()
  };

  constructor(initialState = {}, options = {}) {
    this.stores = new Map();
    this.debug = Boolean(options.debug);
    this.emergencyPatch = options.emergencyPatch || {};
    this.initialTypes = new Map();
    this.middlewares = [];
    this.derived = new Map();
    this.dependencyGraph = new Map();
    this.derivedFlushScheduled = false;
    this.derivedFlushing = false;
    STORE_CHECKPOINTS.set(this, {
      enabled: Boolean(options.debug && options.checkpointStorage),
      storage: options.checkpointStorage || null,
      prefix: options.checkpointPrefix || 'omnicore:store:snapshot:'
    });
    Object.entries(initialState).forEach(([key, value]) => this.atom(key, value));
  }

  /**
   * @param {string} key State key.
   * @param {*} initialValue Initial value used when creating a store.
   * @returns {{get: Function, set: Function, subscribe: Function}} Nano store atom.
   */
  atom(key, initialValue = null) {
    if (!this.stores.has(key)) {
      this.stores.set(key, nanoAtom(initialValue));
      this.initialTypes.set(key, valueType(initialValue));
    }
    return this.stores.get(key);
  }

  /**
   * @param {string} key State key.
   * @param {*} value Next value.
   * @returns {*} Stored value after emergency patching.
   *
   * @deprecated since 0.3.0, removeIn 2.0.0. Use `store.setValue(key, value)`.
   * @replacement Store#setValue
   * @removeIn 2.0.0
   */
  set(key, value) {
    return this.setValue(key, value);
  }

  /**
   * @param {string} key State key.
   * @param {*} value Next value.
   * @returns {*} Stored value after emergency patching.
   */
  setValue(key, value) {
    const previous = this.get(key);
    if (Object.is(previous, value)) return previous;
    const next = this._applyMiddleware(key, value, previous);
    this._warnTypeDrift(key, next);
    const patched = this._applyEmergencyPatch(key, next);
    if (Object.is(previous, patched)) return patched;
    this.atom(key).set(patched);
    this._markDerivedDependents(key);
    this._scheduleDerivedFlush();
    return patched;
  }

  /**
   * Defines a state value derived from other Store keys.
   *
   * @param {string} name Derived state key.
   * @param {string[]} deps Dependency keys.
   * @param {Function} computeFn Function receiving ({ depName: value }, store).
   * @returns {Function} Dispose function that removes the derived definition.
   */
  derive(name, deps, computeFn) {
    if (!name || typeof name !== 'string') throw createOmniError('Store', 'derive(name, deps, computeFn) 需要字符串名称。');
    if (!Array.isArray(deps) || deps.some((dep) => typeof dep !== 'string')) {
      throw createOmniError('Store', 'derive(name, deps, computeFn) 的 deps 必须是字符串数组。');
    }
    if (typeof computeFn !== 'function') throw createOmniError('Store', 'derive(name, deps, computeFn) 的 computeFn 必须是函数。');

    if (this.derived.has(name)) this.underive(name);

    const record = {
      name,
      deps: [...deps],
      computeFn,
      dirty: true,
      computing: false,
      refs: []
    };
    this.derived.set(name, record);
    for (const dep of record.deps) this._addDependencyEdge(dep, record);
    this._flushDerived();
    return () => this.underive(name);
  }

  /**
   * Removes a derived value definition.
   *
   * @param {string} name Derived state key.
   * @returns {boolean} True when a derived definition was removed.
   */
  underive(name) {
    const record = this.derived.get(name);
    if (!record) return false;
    for (const { dep, ref } of record.refs) {
      const refs = this.dependencyGraph.get(dep);
      refs?.delete(ref);
      if (refs?.size === 0) this.dependencyGraph.delete(dep);
    }
    record.refs.length = 0;
    this.derived.delete(name);
    this.stores.delete(name);
    this.initialTypes.delete(name);
    return true;
  }

  /**
   * Register a Store middleware.
   *
   * @param {Function} middleware Interceptor receiving { key, value, previous, store }.
   * @returns {Function} Unsubscribe function that removes the middleware.
   */
  use(middleware) {
    if (typeof middleware !== 'function') throw createOmniError('Store', 'middleware 必须是函数。');
    this.middlewares.push(middleware);
    return () => {
      this.middlewares = this.middlewares.filter((item) => item !== middleware);
    };
  }

  /**
   * @param {string} key State key.
   * @returns {*} Current value.
   */
  get(key) {
    const record = this.derived.get(key);
    if (record?.dirty) this._flushDerived();
    if (!this.stores.has(key)) return undefined;
    return this.atom(key).get();
  }

  /**
   * @param {string} key State key.
   * @param {Function} listener Subscription callback.
   * @returns {Function} Unsubscribe callback.
   */
  subscribe(key, listener) {
    return this.atom(key).subscribe(listener);
  }

  /**
   * @param {string} backend Active renderer backend.
   * @returns {void}
   */
  injectBackend(backend) {
    this.set('backend', backend);
    this.set('rendererInjectedAt', Date.now());
  }

  /**
   * @param {?string} name Optional checkpoint name used when checkpoint storage is enabled.
   * @returns {Record<string, *>} Plain state snapshot.
   */
  snapshot(name = null) {
    const result = {};
    for (const [key, store] of this.stores) result[key] = store.get();
    if (name) {
      const checkpoint = STORE_CHECKPOINTS.get(this);
      if (checkpoint?.enabled) checkpoint.storage.set(`${checkpoint.prefix}${name}`, result);
    }
    return result;
  }

  /**
   * @param {string} name Checkpoint name to restore from checkpoint storage.
   * @returns {?Record<string, *>} Restored state snapshot, or null when unavailable.
   */
  loadSnapshot(name) {
    if (!name) return null;
    const checkpoint = STORE_CHECKPOINTS.get(this);
    if (!checkpoint?.enabled) return null;
    const snapshot = checkpoint.storage.get(`${checkpoint.prefix}${name}`, null);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    for (const [key, value] of Object.entries(snapshot)) this.setValue(key, value);
    return snapshot;
  }

  _warnTypeDrift(key, value) {
    if (!this.debug) return;
    const previousType = this.initialTypes.get(key);
    const nextType = valueType(value);
    if (previousType && previousType !== 'null' && nextType !== previousType) {
      console.warn(warnMessage('Store', `状态类型不一致 "${key}"：期望 ${previousType}，实际 ${nextType}。`));
    }
  }

  _applyEmergencyPatch(key, value) {
    const patch = this.emergencyPatch[key];
    if (!patch) return value;
    if (typeof patch === 'function') {
      const next = patch(value);
      if (this.debug && next !== value) console.warn(warnMessage('Store', `emergencyPatch 已修复状态 "${key}"。`));
      return next;
    }
    if (typeof value !== 'number' || value < patch.min || value > patch.max) {
      if (this.debug) console.warn(warnMessage('Store', `emergencyPatch 已修复状态 "${key}"。`));
      return patch.fallback;
    }
    return value;
  }

  _applyMiddleware(key, value, previous) {
    return this.middlewares.reduce((current, middleware) => {
      const result = middleware({ key, value: current, previous, store: this });
      return result === undefined ? current : result;
    }, value);
  }

  _addDependencyEdge(dep, record) {
    if (!this.dependencyGraph.has(dep)) this.dependencyGraph.set(dep, new Set());
    const ref = createWeakRef(record);
    this.dependencyGraph.get(dep).add(ref);
    record.refs.push({ dep, ref });
  }

  _markDerivedDependents(key) {
    const refs = this.dependencyGraph.get(key);
    if (!refs) return;
    for (const ref of [...refs]) {
      const record = ref.deref();
      if (!record || !this.derived.has(record.name)) {
        refs.delete(ref);
        continue;
      }
      record.dirty = true;
    }
    if (refs.size === 0) this.dependencyGraph.delete(key);
  }

  _scheduleDerivedFlush() {
    if (this.derivedFlushScheduled || this.derivedFlushing) return;
    if (![...this.derived.values()].some((record) => record.dirty)) return;
    this.derivedFlushScheduled = true;
    queueMicrotaskSafe(() => this._flushDerived());
  }

  _flushDerived() {
    if (this.derivedFlushing) return;
    this.derivedFlushScheduled = false;
    this.derivedFlushing = true;
    const maxPasses = Math.max(10, this.derived.size * this.derived.size + 1);
    let passes = 0;
    try {
      while (passes < maxPasses) {
        const dirty = [...this.derived.values()].filter((record) => record.dirty);
        if (dirty.length === 0) return;
        passes += 1;
        for (const record of dirty) this._recomputeDerived(record);
      }
      throw createOmniError('Store', '派生状态依赖图可能存在循环。');
    } finally {
      this.derivedFlushing = false;
    }
  }

  _recomputeDerived(record) {
    if (record.computing) throw createOmniError('Store', `派生状态存在循环依赖：${record.name}`);
    record.computing = true;
    try {
      const values = {};
      for (const dep of record.deps) values[dep] = this.get(dep);
      const previous = this.stores.has(record.name) ? this.atom(record.name).get() : undefined;
      const next = record.computeFn(values, this);
      record.dirty = false;
      if (!this.stores.has(record.name)) this.atom(record.name);
      if (Object.is(previous, next)) return;
      this.atom(record.name).set(next);
      this._markDerivedDependents(record.name);
    } finally {
      record.computing = false;
    }
  }

  /**
   * @param {object} options Plugin market options.
   * @returns {{cdn: string, fetcher: Function, moduleLoader: Function, installed: Map}} Plugin market config.
   */
  static configurePluginMarket(options = {}) {
    Store.pluginMarket = {
      ...Store.pluginMarket,
      ...options,
      installed: Store.pluginMarket.installed
    };
    return Store.pluginMarket;
  }

  /**
   * @param {string} name Plugin name.
   * @param {{version?: string, force?: boolean}} options Install options.
   * @returns {Promise<object>} Installed plugin record.
   */
  static async install(name, options = {}) {
    if (Store.pluginMarket.installed.has(name) && !options.force) {
      return Store.pluginMarket.installed.get(name);
    }

    const manifest = await Store._loadPluginManifest(name, options.version);
    Store._assertPluginManifest(manifest, name);
    const moduleUrl = Store._resolveModuleUrl(manifest);
    const pluginModule = await Store.pluginMarket.moduleLoader(moduleUrl, manifest);
    const plugin = pluginModule.default || pluginModule;
    const exports = {};
    const sandbox = Store._createPluginSandbox(manifest, exports);
    await plugin.install?.(sandbox, { manifest });

    const record = {
      name: manifest.name,
      version: manifest.version,
      manifest,
      exports,
      installedAt: Date.now()
    };
    Store.pluginMarket.installed.set(name, record);
    return record;
  }

  /**
   * @param {string} name Plugin name.
   * @returns {object|null} Installed plugin record or null.
   */
  static getPlugin(name) {
    return Store.pluginMarket.installed.get(name) || null;
  }

  /**
   * @param {string} name Plugin name.
   * @param {Record<string, *>} exports Plugin exports.
   * @param {Record<string, *>} manifest Plugin manifest.
   * @returns {object} Installed plugin record.
   */
  static registerPlugin(name, exports = {}, manifest = {}) {
    const record = {
      name,
      version: manifest.version || '0.0.0',
      manifest: { name, ...manifest },
      exports,
      installedAt: Date.now()
    };
    Store.pluginMarket.installed.set(name, record);
    return record;
  }

  static async _loadPluginManifest(name, version = 'latest') {
    const { fetcher } = Store.pluginMarket;
    if (!fetcher) throw createOmniError('Store', '插件市场需要可用的 fetcher。');
    const base = Store.pluginMarket.cdn.replace(/\/$/, '');
    const url = `${base}/${name}/${version}/plugin.json`;
    const response = await fetcher(url);
    if (!response.ok) throw createOmniError('Store', `插件清单加载失败：${name}`);
    return response.json();
  }

  static _assertPluginManifest(manifest, expectedName) {
    if (!manifest?.name || manifest.name !== expectedName) {
      throw createOmniError('Store', `插件清单名称不匹配，期望：${expectedName}`);
    }
    if (!manifest.version) throw createOmniError('Store', `插件缺少版本号：${expectedName}`);
    if (!manifest.module) throw createOmniError('Store', `插件缺少模块入口：${expectedName}`);
    const permissions = manifest.permissions || [];
    const allowed = new Set(['events', 'store', 'renderer', 'assets']);
    const denied = permissions.filter((permission) => !allowed.has(permission));
    if (denied.length) throw createOmniError('Store', `插件请求了不支持的权限：${denied.join(', ')}`);
  }

  static _resolveModuleUrl(manifest) {
    if (/^https?:\/\//.test(manifest.module)) return manifest.module;
    return `${Store.pluginMarket.cdn.replace(/\/$/, '')}/${manifest.name}/${manifest.version}/${manifest.module}`;
  }

  static _createPluginSandbox(manifest, exports) {
    return Object.freeze({
      name: manifest.name,
      version: manifest.version,
      permissions: [...(manifest.permissions || [])],
      register(key, value) {
        if (key === manifest.name && value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(exports, value);
          return value;
        }
        exports[key] = value;
        return value;
      }
    });
  }
}

export default Store;
