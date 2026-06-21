/**
 * Asset manifest release gate for budgets, hashes, missing references, and dependency cycles.
 */
import { createOmniError } from '../core/OmniError.js';

export const ASSET_PIPELINE_REPORT_SCHEMA = 'omnicore.asset-pipeline-report.v1';

export class AssetPipelineGate {
  constructor(options = {}) {
    this.options = { ...options };
    this.report = options.report || null;
  }

  run(overrides = {}) {
    this.report = createAssetPipelineReport({ ...this.options, ...overrides });
    return this.report;
  }

  assert() {
    const report = this.report || this.run();
    if (!report.ok) {
      const codes = report.failures.map((failure) => failure.code).join(', ');
      throw createOmniError('AssetPipelineGate', `Asset pipeline gate failed: ${codes}`, {
        code: 'ASSET_PIPELINE_GATE_FAILED',
        details: report
      });
    }
    return report;
  }
}

export function createAssetPipelineReport({
  manifest = {},
  budgets = {},
  required = [],
  generatedAt = '2026-06-21T00:00:00.000Z'
} = {}) {
  const assets = normalizeAssets(manifest.assets || []);
  const assetKeys = new Set(assets.map((asset) => asset.key));
  const dependencies = normalizeDependencies(manifest.dependencies || manifest.references || {});
  const failures = [];
  const totals = summarizeAssets(assets);

  checkBudgets({ totals, budgets, failures });
  checkHashes({ assets, failures });
  checkReferences({ dependencies, assetKeys, failures });
  checkRequired({ required, assetKeys, failures });
  checkCycles({ dependencies, assetKeys, failures });

  const topFiles = [...assets]
    .sort((left, right) => right.size - left.size || left.key.localeCompare(right.key))
    .map(({ key, type, size, url }) => ({ key, type, size, url }));

  return {
    schema: ASSET_PIPELINE_REPORT_SCHEMA,
    generatedAt,
    ok: failures.length === 0,
    totals,
    budgets: clone(budgets || {}),
    failures,
    topFiles,
    topDirectories: summarizeDirectories(assets),
    deadResources: normalizeList(manifest.deadResources || []),
    dependencies
  };
}

function checkBudgets({ totals, budgets, failures }) {
  const totalBytes = Number(budgets.totalBytes);
  if (Number.isFinite(totalBytes) && totals.totalBytes > totalBytes) {
    failures.push({
      code: 'asset-budget-exceeded',
      value: totals.totalBytes,
      limit: totalBytes,
      overBy: totals.totalBytes - totalBytes,
      message: `Asset total size ${totals.totalBytes} exceeds budget ${totalBytes}.`
    });
  }

  for (const [type, limitValue] of Object.entries(budgets.byType || {})) {
    const value = Number(totals.byType[type] || 0);
    const limit = Number(limitValue);
    if (!Number.isFinite(limit) || value <= limit) continue;
    failures.push({
      code: 'asset-type-budget-exceeded',
      type,
      value,
      limit,
      overBy: value - limit,
      message: `Asset type ${type} size ${value} exceeds budget ${limit}.`
    });
  }
}

function checkHashes({ assets, failures }) {
  for (const asset of assets) {
    if (asset.hash) continue;
    failures.push({
      code: 'asset-missing-hash',
      key: asset.key,
      message: `Asset ${asset.key} is missing a content hash.`
    });
  }
}

function checkReferences({ dependencies, assetKeys, failures }) {
  for (const [source, deps] of Object.entries(dependencies)) {
    for (const dependency of deps) {
      if (assetKeys.has(dependency)) continue;
      failures.push({
        code: 'asset-reference-missing',
        source,
        dependency,
        message: `${source} references missing asset ${dependency}.`
      });
    }
  }
}

function checkRequired({ required, assetKeys, failures }) {
  for (const key of normalizeList(required)) {
    if (assetKeys.has(key)) continue;
    failures.push({
      code: 'asset-required-missing',
      key,
      message: `Required asset ${key} is not present in the manifest.`
    });
  }
}

function checkCycles({ dependencies, assetKeys, failures }) {
  const graph = {};
  for (const [source, deps] of Object.entries(dependencies)) {
    if (!assetKeys.has(source)) continue;
    graph[source] = deps.filter((dependency) => assetKeys.has(dependency));
  }

  const visiting = new Set();
  const visited = new Set();
  const reported = new Set();

  const visit = (node, path = []) => {
    if (visiting.has(node)) {
      const cycle = [...path.slice(path.indexOf(node)), node];
      const key = cycle.join(' -> ');
      if (!reported.has(key)) {
        reported.add(key);
        failures.push({
          code: 'asset-dependency-cycle',
          cycle,
          message: `Asset dependency cycle detected: ${key}.`
        });
      }
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph[node] || []) visit(next, [...path, node]);
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of Object.keys(graph)) visit(node);
}

function summarizeAssets(assets) {
  const byType = {};
  let totalBytes = 0;
  for (const asset of assets) {
    totalBytes += asset.size;
    byType[asset.type] = (byType[asset.type] || 0) + asset.size;
  }
  return {
    totalBytes,
    assetCount: assets.length,
    byType
  };
}

function summarizeDirectories(assets) {
  const directories = new Map();
  for (const asset of assets) {
    const directory = asset.key.includes('/') ? asset.key.split('/').slice(0, -1).join('/') : '.';
    const current = directories.get(directory) || { directory, size: 0, files: 0 };
    current.size += asset.size;
    current.files += 1;
    directories.set(directory, current);
  }
  return [...directories.values()].sort((left, right) => right.size - left.size || left.directory.localeCompare(right.directory));
}

function normalizeAssets(assets) {
  return normalizeList(assets).map((asset) => {
    const source = typeof asset === 'string' ? { key: asset } : asset || {};
    const key = normalizeKey(source.key || source.id || source.url || source.path || source.src);
    return {
      key,
      url: normalizeKey(source.url || source.path || source.src || key),
      type: source.type || inferType(key),
      size: Math.max(0, Number(source.size || source.bytes || 0) || 0),
      hash: source.hash || source.contentHash || null
    };
  }).filter((asset) => asset.key);
}

function normalizeDependencies(dependencies = {}) {
  return Object.fromEntries(
    Object.entries(dependencies || {}).map(([source, deps]) => [
      normalizeKey(source),
      normalizeList(deps).map(normalizeKey).filter(Boolean)
    ])
  );
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function normalizeKey(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/^assets\//u, '');
}

function inferType(key) {
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/iu.test(key)) return 'image';
  if (/\.(mp3|ogg|wav|m4a|webm)$/iu.test(key)) return 'audio';
  if (/\.(glb|gltf|blend|fbx|obj)$/iu.test(key)) return 'model';
  if (/\.(json|csv|tmx)$/iu.test(key)) return 'data';
  if (/\.(fnt|ttf|otf|woff2?)$/iu.test(key)) return 'font';
  return 'asset';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default AssetPipelineGate;
