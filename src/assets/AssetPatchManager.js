import { createOmniError } from '../core/OmniError.js';

/**
 * Runtime resource patch applier for OTA asset overlays.
 *
 * @example
 * const patches = new AssetPatchManager();
 * await patches.apply('/patches/v2.patch');
 * patches.resolve('hero.png');
 */
export class AssetPatchManager {
  constructor({
    fetcher = globalThis.fetch?.bind(globalThis),
    storage = createMemoryStorage(),
    prefix = 'assets/'
  } = {}) {
    this.fetcher = fetcher;
    this.storage = storage;
    this.prefix = prefix;
    this.appliedPatches = [];
  }

  /**
   * @param {string|object} patchSource Patch URL or parsed patch payload.
   * @returns {Promise<object>} Applied patch summary.
   */
  async apply(patchSource) {
    const patch = typeof patchSource === 'string'
      ? await this._fetchPatch(patchSource)
      : patchSource;
    const files = await this._resolvePatchFiles(patch, typeof patchSource === 'string' ? patchSource : null);
    const applied = Object.keys(files).sort();
    const removed = [...(patch?.removed || [])].sort();

    for (const file of applied) {
      this.storage.setItem(this._key(file), decodePatchFile(files[file]));
    }
    for (const file of removed) {
      this.storage.removeItem(this._key(file));
    }

    const summary = {
      format: patch?.format || 'OmniCore.OTAPatch',
      version: patch?.version || 1,
      applied,
      removed,
      source: typeof patchSource === 'string' ? patchSource : null
    };
    this.appliedPatches.push(summary);
    return summary;
  }

  /**
   * @param {string} file Asset path relative to the asset root.
   * @returns {string|null} Patched asset payload or null when no override exists.
   */
  resolve(file) {
    return this.storage.getItem(this._key(file));
  }

  async _fetchPatch(url) {
    if (!this.fetcher) throw createOmniError('Assets', 'AssetPatchManager requires a fetcher to load remote patches.');
    const response = await this.fetcher(url);
    if (!response?.ok) throw createOmniError('Assets', `Asset patch download failed: ${url}`);
    return response.json();
  }

  async _resolvePatchFiles(patch = {}, patchUrl = null) {
    if (patch.files) return patch.files;
    const baseUrl = patch.baseUrl || (patchUrl ? patchUrl.slice(0, patchUrl.lastIndexOf('/') + 1) : '');
    const names = [...(patch.changed || []), ...(patch.added || [])].sort();
    const files = {};
    for (const name of names) {
      const response = await this.fetcher(new URL(name, baseUrl || globalThis.location?.href || 'http://localhost/').toString());
      if (!response?.ok) throw createOmniError('Assets', `Patched asset download failed: ${name}`);
      files[name] = { content: await response.text(), encoding: 'utf8' };
    }
    return files;
  }

  _key(file) {
    return `${this.prefix}${String(file).replace(/^\/+|\\/g, '/')}`.replace(/\/+/g, '/');
  }
}

function decodePatchFile(entry) {
  if (typeof entry === 'string') return entry;
  if (entry?.encoding === 'base64') return atob(entry.content || '');
  return String(entry?.content ?? '');
}

function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key)
  };
}

export default AssetPatchManager;
