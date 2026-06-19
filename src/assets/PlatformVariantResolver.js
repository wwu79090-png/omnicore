export class PlatformVariantResolver {
  constructor({ platform = 'web', variants = {}, defaultPlatform = 'web' } = {}) {
    this.platform = platform;
    this.defaultPlatform = defaultPlatform;
    this.variants = variants.variants || variants;
  }

  select(platform = this.platform) {
    return this.variants[platform] || this.variants[this.defaultPlatform] || { basePath: '' };
  }

  resolve(assetPath, platform = this.platform) {
    const variant = this.select(platform);
    const base = String(variant.basePath || '').replace(/\/$/u, '');
    const clean = String(assetPath || '').replace(/^\/+/u, '');
    return base ? `${base}/${clean}` : clean;
  }

  manifestEntry(assetPath, platform = this.platform) {
    const variant = this.select(platform);
    return {
      platform,
      url: this.resolve(assetPath, platform),
      scale: variant.scale ?? 1,
      textureQuality: variant.textureQuality ?? variant.imageQuality ?? 1
    };
  }
}

export default PlatformVariantResolver;
