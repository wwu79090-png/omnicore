import { Assets, Graphics } from 'pixi.js';
import { DEFAULT_DEBUG } from '../config/defaults.js';
import { createOmniError, toOmniError } from '../core/OmniError.js';

/**
 * Defensive image asset loader with missing-texture fallback.
 *
 * Single image failures are converted into a generated Pixi.Graphics square so
 * bundle loading can continue and scenes can still render a visible placeholder.
 *
 * @example
 * const loader = new AssetLoader();
 * const hero = await loader.loadImage({ key: 'hero', url: '/hero.png' });
 * scene.add(new OmniCore.Sprite(hero.texture || hero.displayObject));
 */
export class AssetLoader {
  constructor(options = {}) {
    const {
      assets = Assets,
      fetcher,
      preferFetcher = true,
      graphicsFactory = null,
      logger = null,
      fallbackColor = 0xff3b30,
      debug = DEFAULT_DEBUG
    } = options;
    this.assets = assets;
    this.fetcher = fetcher || globalThis.fetch?.bind(globalThis);
    this.preferFetcher = Boolean(preferFetcher && this.fetcher);
    this.graphicsFactory = graphicsFactory;
    this.logger = logger;
    this.fallbackColor = fallbackColor;
    this.debug = debug;
    this.cache = new Map();
  }

  async loadImage(item) {
    const normalized = typeof item === 'string' ? { key: item, url: item } : item;
    const key = normalized.key || normalized.url;
    if (this.cache.has(key)) return this.cache.get(key);

    try {
      const texture = await this._loadTexture(normalized);
      const asset = {
        key,
        url: normalized.url,
        texture,
        displayObject: null,
        fallback: false,
        error: null
      };
      this.cache.set(key, asset);
      return asset;
    } catch (error) {
      const omniError = toOmniError(error, {
        module: 'Loader',
        message: `资源加载失败：${normalized.url || key}`
      });
      const asset = this._createMissingTexture(normalized, omniError);
      this.cache.set(key, asset);
      this._reportLoadFailure(key, normalized, omniError);
      return asset;
    }
  }

  async loadImages(items = []) {
    const output = {};
    await Promise.all(items.map(async (item) => {
      const asset = await this.loadImage(item);
      output[asset.key] = asset;
    }));
    return output;
  }

  clear() {
    this.cache.clear();
  }

  async _loadTexture(item) {
    if (item.texture) return item.texture;
    if (!item.url) throw createOmniError('Loader', '图片资源缺少 url。');
    if (this.preferFetcher) return this._fetchImage(item);
    if (this.assets?.load) return this.assets.load(item.url);
    return this._fetchImage(item);
  }

  async _fetchImage(item) {
    if (!this.fetcher) throw createOmniError('Loader', '当前环境没有可用的资源加载器。');

    const response = await this.fetcher(item.url);
    if (!response.ok) throw createOmniError('Loader', `资源路径不存在：${item.url}，HTTP ${response.status || 500}`);
    return response.blob ? response.blob() : response;
  }

  _createMissingTexture(item, error) {
    const width = item.width || 32;
    const height = item.height || 32;
    const displayObject = this._createFallbackGraphic({
      key: item.key || item.url || 'missing',
      url: item.url,
      width,
      height,
      color: item.fallbackColor || this.fallbackColor,
      error
    });

    return {
      key: item.key || item.url,
      url: item.url,
      texture: null,
      displayObject,
      fallback: true,
      error
    };
  }

  _reportLoadFailure(key, item, error) {
    const message = `图片资源加载失败，已生成占位纹理：${key}`;
    if (this.logger?.error) {
      this.logger.error('loader', message, error);
    }
    if (!this.debug) return;
    const detail = item?.url ? `${message} (${item.url})` : message;
    console?.error?.(`[OmniCore] [loader] ${detail}`, error);
  }

  _createFallbackGraphic(options) {
    if (this.graphicsFactory) return this.graphicsFactory(options);

    try {
      const graphic = new Graphics();
      graphic.rect(0, 0, options.width, options.height);
      graphic.fill({ color: options.color, alpha: 0.72 });
      graphic.rect(0, 0, options.width, options.height);
      graphic.stroke({ color: 0xffffff, width: 1, alpha: 0.9 });
      graphic.label = `missing:${options.key}`;
      graphic.omnicoreMissingPath = options.url || options.key;
      graphic.omnicoreDebugLabel = this.debug ? `Missing asset: ${options.url || options.key}` : '';
      return graphic;
    } catch {
      return {
        type: 'missing-texture',
        key: options.key,
        path: options.url || options.key,
        debugLabel: this.debug ? `Missing asset: ${options.url || options.key}` : '',
        width: options.width,
        height: options.height,
        color: options.color
      };
    }
  }
}

export default AssetLoader;
