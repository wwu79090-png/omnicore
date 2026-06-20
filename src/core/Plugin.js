import { createOmniError } from './OmniError.js';

function normalizePlugin(plugin) {
  const candidate = plugin?.default || plugin;
  if (!candidate?.name || typeof candidate.install !== 'function') {
    throw createOmniError('Plugin', 'Plugin requires a name and install(api, options) function.');
  }
  return candidate;
}

export class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.installed = new Set();
  }

  create(plugin) {
    return Plugin.create(plugin);
  }

  register(plugin) {
    const normalized = normalizePlugin(plugin);
    this.plugins.set(normalized.name, normalized);
    return normalized;
  }

  async use(pluginOrName, api, options = {}) {
    const plugin = typeof pluginOrName === 'string'
      ? this.plugins.get(pluginOrName)
      : this.register(pluginOrName);
    if (!plugin) throw createOmniError('Plugin', `Plugin not registered: ${pluginOrName}`);
    if (this.installed.has(plugin.name) && !options.force) return plugin;
    await plugin.install(api, options);
    this.installed.add(plugin.name);
    return plugin;
  }

  async unuse(name, api, options = {}) {
    const plugin = this.plugins.get(name);
    if (!plugin) return null;
    await plugin.uninstall?.(api, options);
    this.installed.delete(name);
    return plugin;
  }

  has(name) {
    return this.plugins.has(name) || this.installed.has(name);
  }

  get(name) {
    return this.plugins.get(name) || null;
  }

  list() {
    return [...this.plugins.values()];
  }
}

export const Plugin = {
  registry: new PluginRegistry(),

  create(plugin) {
    return Object.freeze({ ...normalizePlugin(plugin) });
  },

  isPlugin(plugin) {
    const candidate = plugin?.default || plugin;
    return Boolean(candidate?.name && typeof candidate.install === 'function');
  },

  register(plugin) {
    return this.registry.register(plugin);
  },

  use(pluginOrName, api, options) {
    return this.registry.use(pluginOrName, api, options);
  },

  unuse(name, api, options) {
    return this.registry.unuse(name, api, options);
  },

  has(name) {
    return this.registry.has(name);
  },

  get(name) {
    return this.registry.get(name);
  },

  list() {
    return this.registry.list();
  }
};

export default Plugin;
