import { createOmniError, toOmniError } from '../../core/OmniError.js';

/**
 * Resource pipeline addon: bundles, HMR hooks, asset packing, and audit entry.
 */
export class ResourcesAddon {
  constructor({ fetcher = globalThis.fetch?.bind(globalThis) } = {}) {
    this.fetcher = fetcher;
    this.cache = new Map();
    this.hmr = null;
  }

  mount(bootstrap) {
    this.bootstrap = bootstrap;
    return this;
  }

  async loadBundle(bundle = []) {
    const output = {};
    for (const item of bundle) {
      const key = item.key || item.url;
      try {
        if (!this.fetcher) throw createOmniError('Resources', '当前环境没有可用的资源加载器。');
        const response = await this.fetcher(item.url);
        if (!response.ok) throw createOmniError('Resources', `资源路径不存在：${item.url}，HTTP ${response.status || 500}`);
        output[key] = item.type === 'json' ? await response.json() : await response.text();
      } catch (error) {
        const omniError = toOmniError(error, { module: 'Resources', message: `资源加载失败：${item.url}` });
        output[key] = { missing: true, url: item.url, error: omniError.message };
      }
      this.cache.set(key, output[key]);
    }
    return output;
  }

  connectHMR(url, WebSocketRef = globalThis.WebSocket) {
    if (!url || !WebSocketRef) return null;
    this.hmr?.close?.();
    this.hmr = new WebSocketRef(url);
    this.hmr.addEventListener?.('message', (event) => {
      try {
        this.bootstrap?.bus.emit('resources:hmr', JSON.parse(event.data));
      } catch (error) {
        this.bootstrap?.bus.emit('resources:hmr:error', { error, data: event.data });
      }
    });
    return this.hmr;
  }

  packAssets(items = []) {
    return {
      meta: { generatedAt: new Date().toISOString(), image: 'atlas.png' },
      frames: Object.fromEntries(items.map((item, index) => [item.key, {
        frame: { x: index * 16, y: 0, w: 16, h: 16 },
        source: item.url
      }]))
    };
  }

  auditAssets(references = [], files = []) {
    const fileSet = new Set(files);
    return {
      missing: references.filter((ref) => !fileSet.has(ref)),
      unused: files.filter((file) => !references.includes(file))
    };
  }

  unmount() {
    this.hmr?.close?.();
    this.hmr = null;
    this.cache.clear();
  }
}

export default ResourcesAddon;
