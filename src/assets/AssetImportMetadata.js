export class AssetImportMetadata {
  constructor(config = {}) {
    this.source = normalizeAssetPath(config.source || config.path || '');
    this.importer = config.importer || inferImporter(this.source);
    this.importerVersion = String(config.importerVersion || '1');
    this.uid = config.uid || `asset:${this.source}`;
    this.platformVariants = normalizeVariants(config.platformVariants || config.variants || {});
    this.dependencies = normalizeArray(config.dependencies).map(normalizeAssetPath).sort();
    this.mtimeMs = Number(config.mtimeMs || 0);
    this.cacheKey = [
      this.importer,
      this.source,
      this.importerVersion,
      stableStringify(this.platformVariants),
      this.dependencies.join(',')
    ].join(':');
  }

  static create(config = {}) {
    return new AssetImportMetadata(config);
  }

  resolveVariant(platform = 'web') {
    return {
      ...(this.platformVariants.default || {}),
      ...(this.platformVariants[platform] || {})
    };
  }

  needsReimport({ mtimeMs = this.mtimeMs, importerVersion = this.importerVersion } = {}) {
    return Number(mtimeMs || 0) > this.mtimeMs || String(importerVersion || '') !== this.importerVersion;
  }

  toJSON() {
    return {
      uid: this.uid,
      source: this.source,
      importer: this.importer,
      importerVersion: this.importerVersion,
      platformVariants: this.platformVariants,
      dependencies: [...this.dependencies],
      mtimeMs: this.mtimeMs,
      cacheKey: this.cacheKey
    };
  }
}

function normalizeAssetPath(value) {
  return String(value || '').replace(/\\/gu, '/').toLowerCase();
}

function normalizeVariants(variants = {}) {
  return Object.fromEntries(Object.entries(variants).map(([platform, value]) => [platform, { ...(value || {}) }]));
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function inferImporter(source) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(source)) return 'texture';
  if (/\.(mp3|ogg|wav|m4a)$/iu.test(source)) return 'audio';
  if (/\.(glb|gltf)$/iu.test(source)) return 'model';
  if (/\.(json|csv|tmx)$/iu.test(source)) return 'data';
  return 'asset';
}

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export default AssetImportMetadata;
