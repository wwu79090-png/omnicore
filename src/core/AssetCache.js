import {
  Assets,
  BufferImageSource,
  Texture
} from 'pixi.js';

const DEFAULT_PLACEHOLDER_RGBA = [37, 99, 235, 255];

export class AssetCache {
  constructor({
    assets = Assets,
    placeholderSize = 64,
    placeholderColor = DEFAULT_PLACEHOLDER_RGBA
  } = {}) {
    this.assets = assets;
    this.placeholderSize = Math.max(1, Number(placeholderSize) || 64);
    this.placeholderColor = normalizeColor(placeholderColor);
    this.entries = new Map();
    this.placeholderTexture = null;
  }

  async load(key, url = key) {
    const id = String(key || url || '');
    if (!id) return this.getPlaceholder();
    if (this.entries.has(id)) return this.entries.get(id).asset;
    try {
      const asset = await this.assets.load(url);
      this.entries.set(id, { key: id, url, asset });
      return asset;
    } catch {
      const asset = this.getPlaceholder();
      this.entries.set(id, { key: id, url, asset, missing: true });
      return asset;
    }
  }

  get(key) {
    const id = String(key || '');
    if (this.entries.has(id)) return this.entries.get(id).asset;
    if (this.assets.cache?.has && !this.assets.cache.has(id)) return this.getPlaceholder();
    const asset = this.assets.get?.(id);
    if (asset) {
      this.entries.set(id, { key: id, url: id, asset });
      return asset;
    }
    return this.getPlaceholder();
  }

  async preload(bundle = []) {
    const items = normalizeBundle(bundle);
    const loaded = {};
    for (const item of items) {
      loaded[item.key] = await this.load(item.key, item.url);
    }
    return loaded;
  }

  async release(key) {
    const id = String(key || '');
    const entry = this.entries.get(id);
    this.entries.delete(id);
    if (!entry || entry.asset === this.placeholderTexture) return false;
    try {
      await this.assets.unload?.(entry.url || id);
    } catch {
      // Pixi.Assets unload is best-effort because custom loaders may not track aliases.
    }
    entry.asset?.destroy?.(false);
    return true;
  }

  getPlaceholder() {
    if (this.placeholderTexture && !this.placeholderTexture.destroyed) return this.placeholderTexture;
    const size = this.placeholderSize;
    const [r, g, b, a] = this.placeholderColor;
    const data = new Uint8Array(size * size * 4);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = a;
    }
    const source = new BufferImageSource({
      resource: data,
      width: size,
      height: size
    });
    const texture = new Texture({ source });
    texture.label = 'omnicore:placeholder:blue';
    texture.__omnicorePlaceholder = true;
    texture.__omnicorePlaceholderColor = `rgba(${r},${g},${b},${Number((a / 255).toFixed(3))})`;
    this.placeholderTexture = texture;
    return texture;
  }

  destroy() {
    for (const key of [...this.entries.keys()]) this.release(key);
    this.entries.clear();
    this.placeholderTexture?.destroy?.(true);
    this.placeholderTexture = null;
  }
}

function normalizeBundle(bundle) {
  if (Array.isArray(bundle)) {
    return bundle.map((item) => {
      if (typeof item === 'string') return { key: item, url: item };
      return {
        key: item.key || item.alias || item.name || item.url,
        url: item.url || item.src || item.path || item.key
      };
    }).filter((item) => item.key);
  }

  const assets = bundle?.assets || bundle?.entries || null;
  if (Array.isArray(assets)) return normalizeBundle(assets);

  return Object.entries(bundle || {}).map(([key, url]) => ({
    key,
    url: typeof url === 'string' ? url : url?.url || url?.src || key
  }));
}

function normalizeColor(color) {
  if (Array.isArray(color)) {
    return [
      clampByte(color[0]),
      clampByte(color[1]),
      clampByte(color[2]),
      clampByte(color[3] ?? 255)
    ];
  }
  if (typeof color === 'string') {
    const hex = color.replace('#', '').trim();
    if (/^[0-9a-f]{6}$/iu.test(hex)) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        255
      ];
    }
  }
  return [...DEFAULT_PLACEHOLDER_RGBA];
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Number(value) || 0));
}

export default AssetCache;
