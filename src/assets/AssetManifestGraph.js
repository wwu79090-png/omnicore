import { stableHash } from '../quality/EngineQualityHarness.js';

export class AssetManifestGraph {
  constructor({
    assets = [],
    references = {},
    platformVariants = {},
    generatedAt = '2026-06-20T00:00:00.000Z'
  } = {}) {
    this.assets = assets.map(normalizeAsset);
    this.references = normalizeReferences(references);
    this.platformVariants = platformVariants;
    this.generatedAt = generatedAt;
  }

  build() {
    const referencedAssets = new Set(Object.values(this.references).flat());
    const dependencies = {};
    for (const [source, deps] of Object.entries(this.references)) {
      dependencies[source] = deps.map((asset) => assetKey(asset));
    }
    const assets = this.assets.map((asset) => ({
      ...asset,
      hash: asset.hash || stableHash([asset.key, asset.url, asset.size || 0]),
      variants: this._variantsFor(asset),
      cacheKey: `${asset.key}:${asset.hash || stableHash([asset.key, asset.url, asset.size || 0])}`
    }));
    const deadResources = assets
      .filter((asset) => referencedAssets.size > 0 && !referencedAssets.has(asset.key) && !referencedAssets.has(asset.url))
      .map((asset) => asset.key);
    return {
      schema: 'omnicore.asset-manifest-graph.v1',
      generatedAt: this.generatedAt,
      assets,
      dependencies,
      deadResources,
      contentHash: stableHash({ assets, dependencies, deadResources })
    };
  }

  _variantsFor(asset) {
    const variants = {};
    for (const [platform, config] of Object.entries(this.platformVariants || {})) {
      const basePath = String(config.basePath || '').replace(/\/$/u, '');
      variants[platform] = {
        url: basePath ? `${basePath}/${asset.url}`.replace(/\/+/gu, '/') : asset.url,
        scale: Number(config.scale ?? 1),
        quality: Number(config.textureQuality ?? config.imageQuality ?? 1)
      };
    }
    return variants;
  }

  static fromAssets(assets = [], options = {}) {
    return new AssetManifestGraph({ assets, ...options }).build();
  }
}

function normalizeAsset(asset = {}) {
  const key = assetKey(asset.key || asset.id || asset.url || asset.path);
  return {
    key,
    url: asset.url || asset.path || key,
    type: asset.type || inferType(asset.url || asset.path || key),
    size: Number(asset.size || asset.bytes || 0),
    hash: asset.hash || null
  };
}

function normalizeReferences(references = {}) {
  return Object.fromEntries(
    Object.entries(references).map(([key, value]) => [
      key,
      (Array.isArray(value) ? value : [value]).map(assetKey)
    ])
  );
}

function assetKey(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/^assets\//u, '');
}

function inferType(url) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(url)) return 'image';
  if (/\.(mp3|ogg|wav|m4a|webm)$/iu.test(url)) return 'audio';
  if (/\.(glb|gltf)$/iu.test(url)) return 'model';
  if (/\.(json)$/iu.test(url)) return 'data';
  return 'asset';
}

export default AssetManifestGraph;
