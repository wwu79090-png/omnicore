const PLATFORM_DEFAULTS = {
  web: {
    outputDir: 'dist/web',
    command: 'npm run build:prod',
    bundle: { maxSizeKb: 8192 }
  },
  wechat: {
    outputDir: 'dist/wechat',
    command: 'npm run build:wechat',
    bundle: { maxSizeKb: 4096 }
  },
  electron: {
    outputDir: 'dist/electron',
    command: 'npm run build:mobile',
    bundle: { maxSizeKb: 65536 }
  }
};

export class ExportPreset {
  constructor(config = {}) {
    const platform = config.platform || 'web';
    const defaults = PLATFORM_DEFAULTS[platform] || PLATFORM_DEFAULTS.web;
    this.name = config.name || platform;
    this.platform = platform;
    this.outputDir = config.outputDir || defaults.outputDir;
    this.command = config.command || defaults.command;
    this.icons = { ...(config.icons || {}) };
    this.permissions = [...(config.permissions || [])].sort();
    this.bundle = { ...(defaults.bundle || {}), ...(config.bundle || {}) };
    this.env = { ...(config.env || {}) };
  }

  static create(config = {}) {
    return new ExportPreset(config);
  }

  validate() {
    const errors = [];
    const warnings = [];
    if (!this.name) errors.push({ code: 'missing-export-preset-name', message: 'Export preset requires a name.' });
    if (!PLATFORM_DEFAULTS[this.platform]) warnings.push({ code: 'unknown-export-platform', message: `Unknown platform: ${this.platform}` });
    if (Number(this.bundle.estimatedSizeKb || 0) > Number(this.bundle.maxSizeKb || Infinity)) {
      warnings.push({
        code: 'bundle-budget-exceeded',
        message: `Estimated bundle ${this.bundle.estimatedSizeKb}KB exceeds ${this.bundle.maxSizeKb}KB.`
      });
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  toBuildConfig() {
    return {
      name: this.name,
      platform: this.platform,
      outputDir: this.outputDir,
      command: this.command,
      icons: { ...this.icons },
      permissions: [...this.permissions],
      bundle: { ...this.bundle },
      env: {
        ...this.env,
        OMNICORE_EXPORT_PRESET: this.name
      }
    };
  }
}

export default ExportPreset;
