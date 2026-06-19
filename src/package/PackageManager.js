import { createOmniError } from '../core/OmniError.js';

/**
 * REST-backed plugin package resolver.
 */
export class PackageManager {
  constructor({
    registryUrl = 'https://registry.omnicore.dev',
    fetcher = globalThis.fetch?.bind(globalThis),
    moduleLoader = (url) => import(/* @vite-ignore */ url)
  } = {}) {
    this.registryUrl = registryUrl.replace(/\/$/, '');
    this.fetcher = fetcher;
    this.moduleLoader = moduleLoader;
    this.installed = new Map();
  }

  async resolve(name, { version = 'latest' } = {}) {
    if (!this.fetcher) throw createOmniError('PackageManager', '缺少 REST fetcher。');
    const url = `${this.registryUrl}/packages/${name}/${version}`;
    const response = await this.fetcher(url);
    if (!response?.ok) throw createOmniError('PackageManager', `插件清单加载失败：${name}`);
    const manifest = await response.json();
    return {
      ...manifest,
      name: manifest.name || name,
      version: manifest.version || version,
      module: resolveModuleUrl(url, manifest)
    };
  }

  async install(name, { version = 'latest', config = {}, context = {} } = {}) {
    const manifest = await this.resolve(name, { version });
    const module = await this.moduleLoader(manifest.module, manifest);
    const plugin = module.default || module;
    await plugin.install?.(context, { manifest, config });
    const record = {
      name: manifest.name,
      version: manifest.version,
      manifest,
      plugin,
      installedAt: Date.now(),
      config: applyPluginConfig(config, manifest)
    };
    this.installed.set(record.name, record);
    return record;
  }
}

function resolveModuleUrl(baseUrl, manifest) {
  if (/^https?:\/\//.test(manifest.module)) return manifest.module;
  return `${baseUrl}/${manifest.module || 'index.js'}`;
}

function applyPluginConfig(config, manifest) {
  const next = {
    ...config,
    plugins: [...(config.plugins || [])]
  };
  const pluginConfig = {
    name: manifest.name,
    version: manifest.version,
    ...(manifest.config || {})
  };
  const existingIndex = next.plugins.findIndex((item) => item.name === manifest.name);
  if (existingIndex >= 0) next.plugins[existingIndex] = pluginConfig;
  else next.plugins.push(pluginConfig);
  return next;
}

export default PackageManager;
