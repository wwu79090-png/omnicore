import { createOmniError } from '../core/OmniError.js';

export class VirtualAssetFS {
  constructor({ files = {} } = {}) {
    this.files = new Map();
    Object.entries(files || {}).forEach(([path, file]) => this.mount(path, file));
  }

  mount(path, file = {}) {
    const key = normalizePath(path);
    this.files.set(key, {
      path: key,
      type: file.type || inferType(key),
      bytes: Number(file.bytes || 0),
      data: clone(file.data ?? null)
    });
    return this;
  }

  resolve(path) {
    const key = normalizePath(path);
    const withSlash = key.startsWith('/') ? key : `/${key}`;
    const file = this.files.get(withSlash);
    if (!file) throw createOmniError('VirtualAssetFS', `Virtual asset is not mounted: ${path}`);
    return clone(file);
  }

  manifest() {
    return [...this.files.values()]
      .map(({ path, type, bytes }) => ({ path, type, bytes }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  pack({ cartridge = 'assets' } = {}) {
    const files = this.manifest();
    return {
      cartridge,
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      files
    };
  }
}

function normalizePath(value) {
  const text = String(value || '').replace(/\\/gu, '/');
  return text.startsWith('/') ? text : `/${text}`;
}

function inferType(path) {
  if (/\.(png|jpg|jpeg|webp|gif)$/iu.test(path)) return 'image';
  if (/\.(json|csv|tmx)$/iu.test(path)) return 'json';
  if (/\.(mp3|ogg|wav|m4a)$/iu.test(path)) return 'audio';
  return 'asset';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default VirtualAssetFS;
