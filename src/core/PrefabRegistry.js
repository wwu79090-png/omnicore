import PrefabManager from '../prefab/PrefabManager.js';
import { createOmniError } from './OmniError.js';

const DEFAULT_BASE_URL = '/assets/prefabs';

export class PrefabRegistry {
  constructor({
    baseUrl = DEFAULT_BASE_URL,
    fetcher = globalThis.fetch?.bind(globalThis),
    registry = {}
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/u, '');
    this.fetcher = fetcher;
    this.registry = registry;
    this.prefabs = new Map();
  }

  load(name, config = undefined) {
    if (!name) throw createOmniError('Prefab', 'Prefab.load(name, config) 需要名称。');
    if (config === undefined) return this.loadFromAssets(name);
    this.prefabs.set(String(name), clone(config));
    return this;
  }

  async loadFromAssets(name) {
    if (!this.fetcher) throw createOmniError('Prefab', '读取 /assets/prefabs 需要可用 fetcher。');
    const url = `${this.baseUrl}/${String(name).replace(/\.json$/u, '')}.json`;
    const response = await this.fetcher(url);
    if (!response?.ok) throw createOmniError('Prefab', `Prefab 配置读取失败：${url}`);
    const config = await response.json();
    this.prefabs.set(String(name), clone(config));
    if (config.extends && !this.prefabs.has(String(config.extends))) await this.loadFromAssets(config.extends);
    return this;
  }

  get(name) {
    if (!this.prefabs.has(String(name))) return null;
    return this.resolve(name);
  }

  instantiate(name, x = 0, y = 0, overrides = {}) {
    const config = this.resolve(name);
    const merged = mergePrefab(config, overrides);
    const instance = PrefabManager.instantiate(merged, x, y, this.registry);
    instance.prefab = String(name);
    instance.props = { ...(merged.props || {}) };
    return instance;
  }

  resolve(name, seen = new Set()) {
    const key = String(name);
    const config = this.prefabs.get(key);
    if (!config) throw createOmniError('Prefab', `Prefab 未注册：${key}`);
    if (!config.extends) return clone(config);
    if (seen.has(key)) throw createOmniError('Prefab', `Prefab 继承存在循环：${[...seen, key].join(' -> ')}`);
    seen.add(key);
    const parent = this.resolve(config.extends, seen);
    seen.delete(key);
    return mergePrefab(parent, config);
  }

  clear() {
    this.prefabs.clear();
    return this;
  }
}

function mergePrefab(parent = {}, child = {}) {
  const { extends: _extends, ...childRest } = child;
  return {
    ...parent,
    ...childRest,
    props: {
      ...(parent.props || {}),
      ...(child.props || {})
    },
    options: {
      ...(parent.options || {}),
      ...(child.options || {})
    },
    components: child.components || parent.components || [],
    children: child.children || parent.children || []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const Prefab = new PrefabRegistry();

export { Prefab };
export default Prefab;
