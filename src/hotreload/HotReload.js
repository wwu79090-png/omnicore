import { createOmniError, toOmniError } from '../core/OmniError.js';

/**
 * Runtime hot reload adapter for assets and JSON config.
 *
 * @example
 * const hot = new HotReload({ url: 'ws://localhost:35729', assetLoader, database });
 * hot.connect();
 */
export class HotReload {
  constructor({
    url = 'ws://localhost:35729',
    socketFactory = (targetUrl) => new WebSocket(targetUrl),
    assetLoader = null,
    database = null,
    onChange = null,
    logger = null,
    runtime = globalThis,
    loop = null,
    moduleImporter = (moduleUrl) => import(/* @vite-ignore */ moduleUrl),
    onCoreSwap = null
  } = {}) {
    this.url = url;
    this.socketFactory = socketFactory;
    this.assetLoader = assetLoader;
    this.database = database;
    this.onChange = onChange;
    this.logger = logger;
    this.runtime = runtime;
    this.loop = loop;
    this.moduleImporter = moduleImporter;
    this.onCoreSwap = onCoreSwap;
    this.socket = null;
    this.assets = new Map();
  }

  connect() {
    if (this.socket || typeof this.socketFactory !== 'function') return this;
    this.socket = this.socketFactory(this.url);
    this.socket.onmessage = (event) => {
      let change;
      try {
        change = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (error) {
        this.logger?.error?.('hotreload', toOmniError(error, { module: 'HotReload', message: '热更新消息解析失败。' }));
        return;
      }
      this.applyChange(change).catch((error) => {
        this.logger?.error?.('hotreload', toOmniError(error, { module: 'HotReload', message: '热更新应用失败。' }));
      });
    };
    return this;
  }

  disconnect() {
    this.socket?.close?.();
    this.socket = null;
  }

  async applyChange(change) {
    if (change.type === 'asset') return this._applyAsset(change);
    if (change.type === 'config') return this._applyConfig(change);
    if (change.type === 'core-module') return this._applyCoreModule(change);
    throw createOmniError('HotReload', `不支持的热更新类型：${change.type}`);
  }

  async _applyAsset(change) {
    if (!this.assetLoader?.loadImage) throw createOmniError('HotReload', '资源热更新需要提供 assetLoader.loadImage。');
    const asset = await this.assetLoader.loadImage({
      key: change.key,
      url: change.url,
      type: change.assetType || 'image'
    });
    this.assets.set(change.key, asset);
    const result = { type: 'asset', key: change.key, asset };
    this.onChange?.(result);
    return result;
  }

  async _applyConfig(change) {
    if (!this.database?.register) throw createOmniError('HotReload', '配置热更新需要提供 database.register。');
    const record = this.database.register(change.dbType, change.id, change.data);
    const result = { type: 'config', dbType: change.dbType, id: change.id, record };
    this.onChange?.(result);
    return result;
  }

  async _applyCoreModule(change) {
    if (!change.url) throw createOmniError('HotReload', '核心模块热替换需要提供 url。');
    this.loop?.pause?.();
    const url = addCacheBust(change.url, change.version || Date.now());
    const module = await this.moduleImporter(url);
    const core = module.default || module.OmniCore || module;
    this.runtime.OmniCore = core;
    const result = { type: 'core-module', url, core };
    this.onCoreSwap?.(result);
    this.onChange?.(result);
    const resume = () => this.loop?.resume?.();
    if (typeof this.runtime.requestAnimationFrame === 'function') this.runtime.requestAnimationFrame(resume);
    else Promise.resolve().then(resume);
    return result;
  }
}

function addCacheBust(url, version) {
  const joiner = String(url).includes('?') ? '&' : '?';
  return `${url}${joiner}omnicore_hmr=${encodeURIComponent(version)}`;
}

export default HotReload;
