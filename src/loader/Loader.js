import {
  DEFAULT_ASSET_MANIFEST,
  DEFAULT_LOADER_RETRIES,
  DEFAULT_LOADER_TIMEOUT_MS
} from '../config/defaults.js';
import EventBus from '../core/EventBus.js';
import { createOmniError } from '../core/OmniError.js';

const DEFAULT_FALLBACK_PATHS = Object.freeze([
  'public/assets/textures/player.png',
  './textures/player.png'
]);

/**
 * Asset loader with manifest preflight, timeout, retry, and friendly errors.
 *
 * @example
 * const loader = new Loader({ timeout: 5000, retries: 1 });
 * const assets = await loader.loadBundle([
 *   { key: 'hero', url: '/assets/sprites/default/default-tilesheet.svg', type: 'blob' }
 * ]);
 */
export class FriendlyLoadError extends Error {
  constructor(message, item, cause) {
    super(createOmniError('Loader', message, { cause }).message);
    this.name = 'FriendlyLoadError';
    this.item = item;
    this.cause = cause;
    this.friendlyMessage = `[OmniCore] [Loader] 资源加载失败：${item?.key || item?.url || 'unknown'}，请检查网络或资源清单。`;
  }
}

export class Loader {
  constructor({
    timeout = DEFAULT_LOADER_TIMEOUT_MS,
    retries = DEFAULT_LOADER_RETRIES,
    fetcher = globalThis.fetch?.bind(globalThis),
    pathResolver = defaultPathResolver,
    onFriendlyError,
    webpSupport = null,
    preferWebp = true,
    caches = globalThis.caches,
    cacheName = 'omnicore-assets-v1',
    scheduleIdle = defaultIdleScheduler,
    imageFactory = defaultImageFactory,
    fileProtocolFallback = true
  } = {}) {
    this.timeout = timeout;
    this.retries = retries;
    this.fetcher = fetcher;
    this.pathResolverMap = pathResolver && typeof pathResolver === 'object' && typeof pathResolver !== 'function'
      ? { ...pathResolver }
      : {};
    this.pathResolver = normalizePathResolver(pathResolver);
    this.onFriendlyError = onFriendlyError;
    this.webpSupport = webpSupport;
    this.preferWebp = preferWebp;
    this.caches = caches;
    this.cacheName = cacheName;
    this.scheduleIdle = scheduleIdle;
    this.imageFactory = imageFactory;
    this.fileProtocolFallback = fileProtocolFallback !== false;
    this.cache = new Map();
    this.inflight = new Map();
    this.events = new EventBus({ recursionGuard: false });
  }

  on(event, handler) {
    return this.events.on(event, handler);
  }

  off(event, handler) {
    return this.events.off(event, handler);
  }

  emit(event, payload) {
    return this.events.emit(event, payload);
  }

  async preflightManifest(url = DEFAULT_ASSET_MANIFEST) {
    const manifest = await this._loadItem({ key: 'manifest', url, type: 'json' }, 0);
    if (!manifest || (!Array.isArray(manifest.assets) && !Array.isArray(manifest))) {
      throw createOmniError('Loader', `${DEFAULT_ASSET_MANIFEST} 必须导出数组或 { assets: [] }。`);
    }
    return manifest;
  }

  async loadBundle(items, options = {}) {
    const list = Array.isArray(items) ? items : items?.assets || [];
    const output = {};
    const total = list.length;
    let loaded = 0;
    await Promise.all(
      list.map(async (item) => {
        output[this._cacheKey(item)] = await this._loadItem(item, options.retries ?? this.retries);
        loaded += 1;
        this.emit('progress', {
          item,
          key: this._cacheKey(item),
          loaded,
          total,
          progress: total > 0 ? loaded / total : 1
        });
      })
    );
    this.emit('complete', { loaded, total, assets: output });
    return output;
  }

  async cacheAssets(items, options = {}) {
    const cacheName = options.cacheName || this.cacheName;
    const list = normalizeAssetList(items).filter(isCacheableImage);
    const report = { cacheName, cached: [], fetched: [], failed: [] };
    if (!this.caches?.open) return report;
    const cache = await this.caches.open(cacheName);
    await Promise.all(list.map(async (item) => {
      const { url } = item;
      const request = createRequest(url);
      try {
        const existing = await cache.match?.(request);
        if (existing) {
          report.cached.push(url);
          return;
        }
        const response = await this.fetcher(url, { cache: 'reload' });
        if (!response?.ok) throw createOmniError('Loader', `预缓存失败：${url}`);
        await cache.put?.(request, response.clone ? response.clone() : response);
        report.fetched.push(url);
      } catch (error) {
        report.failed.push({ url, message: error?.message || String(error) });
      }
    }));
    return report;
  }

  async predecodeTextures(items, options = {}) {
    const list = normalizeAssetList(items).filter(isCacheableImage);
    const scheduleIdle = options.scheduleIdle || this.scheduleIdle || defaultIdleScheduler;
    const imageFactory = options.imageFactory || this.imageFactory || defaultImageFactory;
    const report = { decoded: [], failed: [] };

    await new Promise((resolve) => {
      scheduleIdle(async () => {
        await Promise.all(list.map(async (item) => {
          try {
            const image = imageFactory();
            image.decoding = 'async';
            image.src = item.url;
            if (typeof image.decode === 'function') await image.decode();
            report.decoded.push(item.url);
          } catch (error) {
            report.failed.push({ url: item.url, message: error?.message || String(error) });
          }
        }));
        resolve();
      });
    });

    return report;
  }

  async _loadItem(item, retriesLeft) {
    const key = this._cacheKey(item);
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.inflight.has(key)) return this.inflight.get(key);

    const promise = this._loadAndCache(item, key, retriesLeft);
    this.inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  async _loadAndCache(item, key, retriesLeft) {
    let lastError = null;
    const candidates = [];

    for (const primary of this._primaryItems(item)) {
      candidates.push(primary);
      try {
        const result = await this._fetchWithRetries(primary, retriesLeft);
        this.cache.set(key, result);
        return result;
      } catch (error) {
        lastError = error;
      }
    }

    for (const primary of this._primaryItems(item)) {
      for (const fallback of this._fallbackItems(primary, lastError)) {
        candidates.push(fallback);
        try {
          const result = await this._fetchWithRetries(fallback, retriesLeft);
          this.cache.set(key, result);
          return result;
        } catch (fallbackError) {
          lastError = fallbackError;
        }
      }
    }

    if (this.fileProtocolFallback && isFileProtocolMode(item?.url)) {
      const localFallback = this._createFileProtocolFallback(item, lastError, candidates);
      this.cache.set(key, localFallback);
      return localFallback;
    }

    const friendly = new FriendlyLoadError(lastError?.message || 'resource missing', item, lastError);
    this.onFriendlyError?.(friendly);
    console.error('资源丢失，请检查路径配置', {
      key: this._cacheKey(item),
      url: item?.url,
      tried: candidates.map((candidate) => candidate.url),
      error: friendly
    });
    const placeholder = this._createResourceMissing(item, friendly, candidates);
    this.cache.set(key, placeholder);
    return placeholder;
  }

  async _fetchWithRetries(item, retriesLeft) {
    try {
      return await this._fetchWithTimeout(item);
    } catch (error) {
      if (retriesLeft > 0) return this._fetchWithRetries(item, retriesLeft - 1);
      throw error;
    }
  }

  _fallbackItems(item, error) {
    const resolved = this.pathResolver?.(item, error) || [];
    const urls = Array.isArray(resolved) ? resolved : [resolved];
    const seen = new Set([item?.url]);
    return urls
      .filter(Boolean)
      .filter((url) => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
      })
      .map((url) => ({ ...item, url, resolvedFrom: item?.url }));
  }

  _primaryItems(item) {
    if (!this.preferWebp || !this._supportsWebp() || !isPngUrl(item?.url)) return [item];
    return [
      {
        ...item,
        url: item.url.replace(/\.png(?=($|[?#]))/i, '.webp'),
        preferredFormat: 'webp',
        resolvedFrom: item.url
      },
      item
    ];
  }

  _supportsWebp() {
    if (typeof this.webpSupport === 'boolean') return this.webpSupport;
    if (typeof this.webpSupport === 'function') return Boolean(this.webpSupport());
    return detectWebpSupport();
  }

  _createResourceMissing(item, error, candidates = []) {
    const width = Math.max(1, Number(item?.width) || 32);
    const height = Math.max(1, Number(item?.height) || 32);
    const label = `资源丢失：${item?.url || item?.key || 'unknown'}`;
    return {
      type: 'ResourceMissing',
      kind: 'sprite',
      name: 'ResourceMissing',
      label,
      key: this._cacheKey(item),
      url: item?.url,
      tried: candidates.map((candidate) => candidate.url),
      fallback: true,
      error,
      x: item?.x || 0,
      y: item?.y || 0,
      width,
      height,
      alpha: 0.5,
      color: 'rgba(255,0,0,0.5)',
      render(ctx) {
        if (!ctx) return;
        ctx.save?.();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'rgba(255,0,0,1)';
        ctx.fillRect?.(this.x || 0, this.y || 0, width, height);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = '12px sans-serif';
        ctx.fillText?.(label, (this.x || 0) + 4, (this.y || 0) + Math.min(height - 6, 16));
        ctx.restore?.();
      }
    };
  }

  _createFileProtocolFallback(item, error, candidates = []) {
    const payload = {
      key: this._cacheKey(item),
      url: item?.url,
      type: item?.type || 'text',
      protocol: 'file:',
      localFileFallback: true,
      tried: candidates.map((candidate) => candidate.url),
      error
    };
    this.emit('fileFallback', payload);
    return createLocalFileFallbackValue(item, payload);
  }

  _cacheKey(item) {
    return item?.key || item?.url;
  }

  async _fetchWithTimeout(item) {
    if (hasInlinePayload(item)) return decodeInlineItem(item);
    if (!this.fetcher) throw createOmniError('Loader', '当前环境没有可用的 fetch 实现。');
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), item.timeout ?? this.timeout);
    try {
      const response = await this.fetcher(item.url, {
        signal: controller?.signal,
        ...(shouldUseNoCors(item.url) ? { mode: 'no-cors' } : {})
      });
      if (!response.ok && response.type !== 'opaque') throw createOmniError('Loader', `资源路径不存在：${item.url}`);
      switch (item.type) {
        case 'json':
          return response.json();
        case 'arrayBuffer':
          return response.arrayBuffer();
        case 'blob':
          return response.blob();
        case 'image':
          return {
            type: 'ImageAsset',
            key: this._cacheKey(item),
            url: item.url,
            resolvedFrom: item.resolvedFrom || null,
            blob: response.blob ? await response.blob() : null
          };
        case 'text':
        case 'csv':
        default:
          return response.text();
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

function hasInlinePayload(item = {}) {
  return Boolean(item.base64 || item.inlineBase64 || isDataUrl(item.url));
}

function decodeInlineItem(item = {}) {
  const text = decodeInlineText(item);
  switch (item.type) {
    case 'json':
      return JSON.parse(text);
    case 'arrayBuffer':
      return textToArrayBuffer(text);
    case 'blob':
      return typeof Blob !== 'undefined' ? new Blob([text]) : text;
    case 'image':
      return {
        type: 'ImageAsset',
        key: item.key || item.url,
        url: item.url,
        inline: true,
        blob: typeof Blob !== 'undefined' ? new Blob([text]) : null
      };
    case 'text':
    case 'csv':
    default:
      return text;
  }
}

function decodeInlineText(item = {}) {
  const dataUrlPayload = isDataUrl(item.url) ? String(item.url).split(',').slice(1).join(',') : '';
  const value = item.base64 || item.inlineBase64 || dataUrlPayload;
  if (typeof Buffer !== 'undefined') return Buffer.from(String(value), 'base64').toString('utf8');
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(String(value))));
  return String(value);
}

function textToArrayBuffer(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).buffer;
  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(text);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  return new ArrayBuffer(0);
}

function isDataUrl(url = '') {
  return /^data:/i.test(String(url || ''));
}

function shouldUseNoCors(url = '') {
  return isFileProtocolMode(url);
}

function isFileProtocolUrl(url = '') {
  return /^file:\/\//i.test(String(url || ''));
}

function isFileProtocolMode(url = '') {
  return isFileProtocolUrl(url) || globalThis.location?.protocol === 'file:';
}

function createLocalFileFallbackValue(item = {}, payload = {}) {
  switch (item.type) {
    case 'json':
      if (item.key === 'manifest' || /asset-manifest\.json(?:$|[?#])/i.test(item.url || '')) {
        return { assets: [], localFileFallback: true, fileFallback: payload };
      }
      return { localFileFallback: true, fileFallback: payload };
    case 'arrayBuffer':
      return new ArrayBuffer(0);
    case 'blob':
      return typeof Blob !== 'undefined'
        ? new Blob([])
        : { type: 'LocalFileFallbackBlob', localFileFallback: true, fileFallback: payload };
    case 'image':
    case 'texture':
      return {
        type: 'ImageAsset',
        key: item.key || item.url,
        url: item.url,
        blob: null,
        fallback: true,
        localFileFallback: true,
        fileFallback: payload
      };
    case 'text':
    case 'csv':
    default:
      return '';
  }
}

function defaultPathResolver(item = {}) {
  return item.fallbackPaths || item.fallbackUrls || [...DEFAULT_FALLBACK_PATHS];
}

function normalizePathResolver(pathResolver) {
  if (typeof pathResolver === 'function') return pathResolver;
  if (pathResolver && typeof pathResolver === 'object') {
    const map = { ...pathResolver };
    return (item = {}) => {
      const url = item.url || '';
      return map[url] || map[`/${url}`] || item.fallbackPaths || item.fallbackUrls || [...DEFAULT_FALLBACK_PATHS];
    };
  }
  return defaultPathResolver;
}

function isPngUrl(url = '') {
  return /\.png(?:$|[?#])/i.test(url);
}

function normalizeAssetList(items) {
  return Array.isArray(items) ? items : items?.assets || [];
}

function isCacheableImage(item = {}) {
  return Boolean(item?.url) && (
    item.type === 'image'
    || item.type === 'texture'
    || /\.(png|webp|jpg|jpeg|avif)(?:$|[?#])/i.test(item.url)
  );
}

function createRequest(url) {
  if (typeof Request === 'function') {
    try {
      return new Request(url);
    } catch {
      return { url };
    }
  }
  return { url };
}

function defaultIdleScheduler(callback) {
  if (typeof globalThis.requestIdleCallback === 'function') {
    return globalThis.requestIdleCallback(callback, { timeout: 1000 });
  }
  return setTimeout(callback, 0);
}

function defaultImageFactory() {
  if (typeof Image === 'function') return new Image();
  return { decode: async () => undefined };
}

let detectedWebpSupport = null;

function detectWebpSupport() {
  if (detectedWebpSupport !== null) return detectedWebpSupport;
  if (/jsdom/i.test(globalThis.navigator?.userAgent || '')) {
    detectedWebpSupport = false;
    return detectedWebpSupport;
  }
  try {
    const canvas = globalThis.document?.createElement?.('canvas');
    detectedWebpSupport = Boolean(canvas?.toDataURL?.('image/webp')?.startsWith('data:image/webp'));
  } catch {
    detectedWebpSupport = false;
  }
  return detectedWebpSupport;
}

export default Loader;
