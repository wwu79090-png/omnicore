import { Assets, Graphics } from 'pixi.js';
import { DEFAULT_DEBUG } from '../config/defaults.js';
import { createOmniError, toOmniError } from '../core/OmniError.js';

const PLACEHOLDER_AUDIO_DURATION_SECONDS = 0.045;
const PLACEHOLDER_AUDIO_FREQUENCY = 220;
const PLACEHOLDER_AUDIO_GAIN = 0.004;

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
      audioContext = null,
      AudioContextRef = globalThis.AudioContext || globalThis.webkitAudioContext,
      logger = null,
      fallbackColor = 0xff3b30,
      debug = DEFAULT_DEBUG
    } = options;
    this.assets = assets;
    this.fetcher = fetcher || globalThis.fetch?.bind(globalThis);
    this.preferFetcher = Boolean(preferFetcher && this.fetcher);
    this.graphicsFactory = graphicsFactory;
    this.audioContext = audioContext;
    this.AudioContextRef = AudioContextRef;
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

  async loadAudio(item) {
    const normalized = typeof item === 'string' ? { key: item, url: item } : item;
    const key = normalized.key || normalized.url;
    const cacheKey = `audio:${key}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    try {
      const buffer = await this._loadAudioBuffer(normalized);
      const asset = {
        key,
        url: normalized.url,
        type: 'audio',
        buffer,
        fallback: false,
        error: null
      };
      this.cache.set(cacheKey, asset);
      return asset;
    } catch (error) {
      const omniError = toOmniError(error, {
        module: 'Loader',
        message: `音频资源加载失败：${normalized.url || key}`
      });
      const asset = this._createMissingAudio(normalized, omniError);
      this.cache.set(cacheKey, asset);
      this._reportAudioLoadFailure(key, normalized, omniError);
      return asset;
    }
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

  async _loadAudioBuffer(item) {
    if (item.buffer) return item.buffer;
    if (!item.url) throw createOmniError('Loader', '音频资源缺少 url。');
    if (!this.fetcher) throw createOmniError('Loader', '当前环境没有可用的资源加载器。');
    const context = this._getAudioContext();
    if (!context?.decodeAudioData) throw createOmniError('Loader', '当前环境没有可用的音频解码器。');

    const response = await this.fetcher(item.url);
    if (!response?.ok) throw createOmniError('Loader', `音频路径不存在：${item.url}，HTTP ${response?.status || 500}`);
    const arrayBuffer = await response.arrayBuffer();
    return context.decodeAudioData(arrayBuffer);
  }

  _getAudioContext() {
    if (this.audioContext) return this.audioContext;
    if (!this.AudioContextRef) return null;
    this.audioContext = new this.AudioContextRef();
    return this.audioContext;
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

  _createMissingAudio(item, error) {
    const key = item.key || item.url || 'missing-audio';
    const buffer = this._createPlaceholderAudioBuffer();
    return {
      key,
      url: item.url,
      type: 'audio',
      buffer,
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

  _reportAudioLoadFailure(key, item, error) {
    const message = `音频资源加载失败，已生成占位音频：${key}`;
    if (this.logger?.warn) {
      this.logger.warn('loader', message, error);
    }
    if (!this.debug) return;
    const detail = item?.url ? `${message} (${item.url})` : message;
    console?.warn?.(`[OmniCore] [loader] ${detail}`);
  }

  _createPlaceholderAudioBuffer() {
    const context = this._getAudioContext();
    const sampleRate = Number(context?.sampleRate) || 44100;
    const length = Math.max(1, Math.round(sampleRate * PLACEHOLDER_AUDIO_DURATION_SECONDS));
    if (!context?.createBuffer) {
      return {
        duration: length / sampleRate,
        length,
        sampleRate,
        omnicorePlaceholder: 'missing-audio',
        getChannelData: () => new Float32Array(length)
      };
    }

    const buffer = context.createBuffer(1, length, sampleRate);
    const channel = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const t = index / sampleRate;
      const envelope = Math.sin((Math.PI * index) / Math.max(1, length - 1));
      const raw = Math.sin(2 * Math.PI * PLACEHOLDER_AUDIO_FREQUENCY * t) * PLACEHOLDER_AUDIO_GAIN * envelope;
      const lowPassed = previous + (raw - previous) * 0.12;
      previous = lowPassed;
      channel[index] = Math.abs(lowPassed) < 0.00002 ? 0 : lowPassed;
    }
    try {
      Object.defineProperty(buffer, 'omnicorePlaceholder', { value: 'missing-audio', configurable: true });
    } catch {
      // Native AudioBuffer objects may be non-extensible in some runtimes.
    }
    return buffer;
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
