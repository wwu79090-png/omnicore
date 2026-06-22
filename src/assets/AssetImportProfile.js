import AssetImportMetadata from './AssetImportMetadata.js';

export const ASSET_IMPORT_PROFILE_RESOLUTION_SCHEMA = 'omnicore.asset-import-profile-resolution.v1';
export const ASSET_IMPORT_PROFILE_AUDIT_SCHEMA = 'omnicore.asset-import-profile-audit.v1';

export class AssetImportProfile {
  constructor({
    sourceRoot = 'source-assets',
    outputRoot = 'dist/assets',
    importerVersion = '1',
    defaults = {},
    presets = [],
    strictPresets = false
  } = {}) {
    this.sourceRoot = normalizePath(sourceRoot);
    this.outputRoot = normalizePath(outputRoot);
    this.importerVersion = String(importerVersion || '1');
    this.defaults = clone(defaults || {});
    this.presets = normalizeArray(presets).map(normalizePreset);
    this.strictPresets = Boolean(strictPresets);
  }

  static create(config = {}) {
    return new AssetImportProfile(config);
  }

  static crossEngineProfile() {
    return {
      sources: [
        'Unity Texture Import Settings',
        'Godot Import dock parameters',
        'Cocos Creator texture compression presets',
        'Unreal Interchange pipeline stacks'
      ],
      capabilities: [
        'import-preset-resolution',
        'platform-import-overrides',
        'deterministic-reimport-cache-key',
        'import-output-routing',
        'bulk-import-diagnostics',
        'pipeline-stack-metadata'
      ]
    };
  }

  crossEngineProfile() {
    return AssetImportProfile.crossEngineProfile();
  }

  resolve(asset = {}, { platform = 'web', preset = null, settings = {} } = {}) {
    const source = normalizePath(asset.source || asset.path || asset.src || '');
    const labels = normalizeArray(asset.labels).map(normalizeToken);
    const importer = normalizeToken(asset.importer || inferImporter(source));
    const matches = this._matchingPresets({ source, labels, importer, preset });
    const selected = selectPreset(matches);
    const diagnostics = diagnosticsForMatches({ source, importer, matches, selected, strictPresets: this.strictPresets });
    const platformKey = normalizeToken(platform || 'web');
    const selectedPreset = selected || fallbackPreset({ importer, source });
    const variantSettings = mergeObjects(
      selectedPreset.platforms.default,
      selectedPreset.platforms[platformKey],
      normalizeVariants(asset.platformVariants || asset.variants).default,
      normalizeVariants(asset.platformVariants || asset.variants)[platformKey]
    );
    const resolvedSettings = mergeObjects(
      defaultImporterSettings(this.defaults, importer),
      selectedPreset.settings,
      asset.settings,
      variantSettings,
      settings
    );
    const output = resolveOutput({
      source,
      outputRoot: this.outputRoot,
      preset: selectedPreset,
      settings: resolvedSettings
    });
    const dependencies = [
      ...normalizeArray(selectedPreset.dependencies),
      ...normalizeArray(asset.dependencies)
    ].map(normalizePath).sort();
    const platformVariants = mergeVariants(selectedPreset.platforms, normalizeVariants(asset.platformVariants || asset.variants));
    const metadata = AssetImportMetadata.create({
      source,
      importer,
      importerVersion: this.importerVersion,
      platformVariants,
      dependencies,
      mtimeMs: asset.mtimeMs
    }).toJSON();
    const reimport = createReimportFingerprint({
      source,
      importer,
      importerVersion: this.importerVersion,
      preset: selectedPreset.name,
      platform: platformKey,
      output,
      settings: resolvedSettings,
      dependencies,
      mtimeMs: asset.mtimeMs
    });

    return {
      schema: ASSET_IMPORT_PROFILE_RESOLUTION_SCHEMA,
      source,
      importer,
      preset: selected ? selected.name : null,
      platform: platformKey,
      output,
      settings: resolvedSettings,
      metadata,
      reimport,
      diagnostics,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  audit(assets = [], options = {}) {
    const resolutions = normalizeArray(assets).map((asset) => this.resolve(asset, options));
    const diagnostics = resolutions.flatMap((resolution) => resolution.diagnostics);
    const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length;
    const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length;
    return {
      schema: ASSET_IMPORT_PROFILE_AUDIT_SCHEMA,
      summary: {
        ok: errorCount === 0,
        assetCount: resolutions.length,
        errorCount,
        warningCount
      },
      diagnostics,
      resolutions,
      crossEngineProfile: this.crossEngineProfile()
    };
  }

  _matchingPresets({ source, labels, importer, preset }) {
    return this.presets
      .filter((candidate) => {
        if (preset && candidate.name !== preset) return false;
        if (candidate.importer && candidate.importer !== importer) return false;
        if (candidate.extensions.length && !candidate.extensions.includes(extname(source))) return false;
        if (candidate.pathIncludes.length && !candidate.pathIncludes.some((part) => source.includes(part))) return false;
        if (candidate.labels.length && !candidate.labels.every((label) => labels.includes(label))) return false;
        return true;
      })
      .sort((left, right) => right.priority - left.priority || left.order - right.order);
  }
}

function normalizePreset(preset = {}, order = 0) {
  return {
    name: String(preset.name || `preset-${order}`),
    importer: preset.importer ? normalizeToken(preset.importer) : null,
    priority: Number(preset.priority || 0),
    order,
    extensions: normalizeArray(preset.extensions).map(normalizeExtension),
    pathIncludes: normalizeArray(preset.pathIncludes).map((value) => normalizePath(value)),
    labels: normalizeArray(preset.labels).map(normalizeToken),
    output: clone(preset.output || {}),
    settings: clone(preset.settings || {}),
    platforms: normalizeVariants(preset.platforms || {}),
    dependencies: normalizeArray(preset.dependencies).map(normalizePath)
  };
}

function selectPreset(matches) {
  return matches[0] || null;
}

function diagnosticsForMatches({ source, importer, matches, selected, strictPresets }) {
  const diagnostics = [];
  if (matches.length > 1) {
    diagnostics.push({
      code: 'multiple-presets-match',
      severity: 'warning',
      source,
      importer,
      presets: matches.map((match) => match.name)
    });
  }
  if (!selected && strictPresets) {
    diagnostics.push({
      code: 'missing-preset',
      severity: 'error',
      source,
      importer
    });
  }
  return diagnostics;
}

function fallbackPreset({ importer, source }) {
  return normalizePreset({
    name: `${importer}-default`,
    importer,
    extensions: [extname(source)],
    output: {}
  });
}

function resolveOutput({ source, outputRoot, preset, settings }) {
  const outputConfig = preset.output || {};
  const extension = normalizeExtension(settings.outputExtension || outputConfig.extension || extensionForFormat(settings.format) || extname(source));
  const baseName = basenameWithoutExt(source);
  const folder = normalizePath(outputConfig.folder || '');
  return {
    path: joinPath(outputRoot, folder, `${baseName}${extension}`),
    extension,
    bundle: outputConfig.bundle || 'default'
  };
}

function createReimportFingerprint(payload) {
  const cacheKey = `import:${payload.preset}:${payload.platform}:${stableHash(payload)}`;
  return {
    cacheKey,
    inputs: {
      source: payload.source,
      importer: payload.importer,
      importerVersion: payload.importerVersion,
      preset: payload.preset,
      platform: payload.platform,
      dependencies: [...payload.dependencies],
      mtimeMs: Number(payload.mtimeMs || 0)
    }
  };
}

function defaultImporterSettings(defaults, importer) {
  return mergeObjects(defaults.settings?.[importer], defaults[importer]?.settings);
}

function mergeVariants(...variants) {
  const result = {};
  for (const variantMap of variants) {
    for (const [platform, value] of Object.entries(variantMap || {})) {
      result[platform] = mergeObjects(result[platform], value);
    }
  }
  return result;
}

function normalizeVariants(variants = {}) {
  return Object.fromEntries(
    Object.entries(variants || {}).map(([platform, value]) => [normalizeToken(platform), clone(value || {})])
  );
}

function mergeObjects(...objects) {
  const result = {};
  for (const object of objects) {
    if (!object || typeof object !== 'object') continue;
    for (const [key, value] of Object.entries(object)) {
      if (isPlainObject(value) && isPlainObject(result[key])) result[key] = mergeObjects(result[key], value);
      else result[key] = clone(value);
    }
  }
  return result;
}

function inferImporter(source) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(source)) return 'texture';
  if (/\.(mp3|ogg|wav|m4a)$/iu.test(source)) return 'audio';
  if (/\.(glb|gltf|fbx|obj|blend|usd|usdz)$/iu.test(source)) return 'model';
  if (/\.(json|csv|tmx|xml|yaml|yml)$/iu.test(source)) return 'data';
  if (/\.(ttf|otf|woff|woff2)$/iu.test(source)) return 'font';
  return 'asset';
}

function extensionForFormat(format) {
  return format ? `.${normalizeToken(format)}` : '';
}

function basenameWithoutExt(file) {
  return normalizePath(file).split('/').pop().replace(/\.[^/.]+$/u, '');
}

function extname(file) {
  const match = normalizePath(file).match(/\.[^/.]+$/u);
  return match ? normalizeExtension(match[0]) : '';
}

function normalizeExtension(value) {
  const text = normalizeToken(value);
  if (!text) return '';
  return text.startsWith('.') ? text : `.${text}`;
}

function joinPath(...parts) {
  return parts.map((part) => normalizePath(part).replace(/^\/+|\/+$/gu, '')).filter(Boolean).join('/');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/\/+/gu, '/').toLowerCase();
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function stableHash(value) {
  const text = stableStringify(value);
  let hash = 5381;
  for (const char of text) hash = (hash * 33 + char.charCodeAt(0)) % 4294967291;
  return hash.toString(16);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

export default AssetImportProfile;
