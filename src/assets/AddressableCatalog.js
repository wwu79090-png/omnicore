export class AddressableCatalog {
  constructor({ baseUrl = '', entries = [] } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.entries = entries.map(normalizeEntry);
    this.byAddress = new Map(this.entries.map((entry) => [entry.address, entry]));
  }

  static create(config = {}) {
    return new AddressableCatalog(config);
  }

  resolve(address, { platform = 'web' } = {}) {
    const entry = this.byAddress.get(address);
    if (!entry) return null;
    const variantPath = entry.variants[platform] || entry.path;
    return {
      ...entry,
      path: variantPath,
      url: joinUrl(this.baseUrl, variantPath)
    };
  }

  bundle(name) {
    return this.entries.filter((entry) => entry.bundle === name);
  }

  toLoaderBundle(bundleName, options = {}) {
    return this.bundle(bundleName).map((entry) => {
      const resolved = this.resolve(entry.address, options);
      return {
        key: resolved.address,
        url: resolved.url,
        type: resolved.type || inferType(resolved.path)
      };
    });
  }
}

function normalizeEntry(entry = {}) {
  return {
    address: String(entry.address || entry.key || entry.path || ''),
    path: normalizePath(entry.path || entry.url || ''),
    bundle: entry.bundle || 'default',
    type: entry.type || null,
    variants: Object.fromEntries(Object.entries(entry.variants || {}).map(([key, value]) => [key, normalizePath(value)])),
    labels: [...(entry.labels || [])].sort()
  };
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/u, '');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/^\/+/u, '');
}

function joinUrl(baseUrl, path) {
  return `${baseUrl}/${normalizePath(path)}`.replace(/([^:]\/)\/+/gu, '$1');
}

function inferType(path) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(path)) return 'image';
  if (/\.(json|csv)$/iu.test(path)) return 'json';
  if (/\.(mp3|ogg|wav|m4a)$/iu.test(path)) return 'audio';
  return 'text';
}

export default AddressableCatalog;
