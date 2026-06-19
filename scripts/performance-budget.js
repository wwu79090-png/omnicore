#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Dimension3D from '../src/dimension3d/Dimension3D.js';

const FOUR_MB = 4 * 1024 * 1024;
const DEFAULT_RUNTIME_BUDGETS = {
  maxEntitySyncMs: 45,
  maxTileScanMs: 24,
  maxDepthSortMs: 24,
  maxCollisionMs: 18
};

export function runDeterministicRuntimeBudget(options = {}) {
  const config = {
    entityCount: Number(options.entityCount || 1000),
    tileCount: Number(options.tileCount || 2048),
    frames: Number(options.frames || 120),
    ...DEFAULT_RUNTIME_BUDGETS,
    ...pickBudgetOptions(options)
  };

  const positionsX = new Float64Array(config.entityCount);
  const positionsY = new Float64Array(config.entityCount);
  const velocitiesX = new Float64Array(config.entityCount);
  const velocitiesY = new Float64Array(config.entityCount);
  for (let index = 0; index < config.entityCount; index += 1) {
    positionsX[index] = (index * 13) % 1024;
    positionsY[index] = (index * 17) % 768;
    velocitiesX[index] = ((index % 7) - 3) * 0.125;
    velocitiesY[index] = ((index % 5) - 2) * 0.125;
  }

  advanceEntities(positionsX, positionsY, velocitiesX, velocitiesY, config.entityCount, 2);
  const entitySyncMs = measureBest(() => {
    advanceEntities(positionsX, positionsY, velocitiesX, velocitiesY, config.entityCount, config.frames);
  });

  const tileData = Array.from({ length: config.tileCount }, (_, index) => (index % 11 === 0 ? 1 : 0));
  let solidTiles = 0;
  const tileScanMs = measureBest(() => {
    let count = 0;
    for (const tile of tileData) if (tile) count += 1;
    solidTiles = count;
  }, 3);

  const layer = new Dimension3D.PlaneLayer({ zToYScale: 12 });
  for (let index = 0; index < Math.min(config.entityCount, 512); index += 1) {
    layer.add2D({
      id: `actor-${index}`,
      x: positionsX[index],
      y: positionsY[index],
      width: 16,
      height: 16
    });
    if (index % 4 === 0) {
      layer.add3D({
        id: `model-${index}`,
        position: { x: positionsX[index], y: 0, z: index % 16 },
        bounds: { width: 32, height: 48, depth: 24 }
      });
    }
  }
  const depthSortMs = measureBest(() => {
    layer.applyZSort();
  }, 3);

  let collisions = 0;
  const models = layer.items
    .filter((item) => item.kind === '3d')
    .map((item) => item.object)
    .slice(0, 64);
  const projectedModels = layer.projectColliders3D(models);
  const collisionProjectionMs = measureBest(() => {
    let count = 0;
    for (let index = 0; index < Math.min(config.entityCount, 256); index += 1) {
      const entity = {
        x: positionsX[index],
        y: positionsY[index],
        width: 16,
        height: 16
      };
      for (const projected of projectedModels) {
        if (layer.collidesProjected2D(entity, projected.collider)) count += 1;
      }
    }
    collisions = count;
  }, 3);

  const metrics = {
    entityCount: config.entityCount,
    tileCount: config.tileCount,
    frames: config.frames,
    solidTiles,
    collisions,
    entitySyncMs,
    tileScanMs,
    depthSortMs,
    collisionProjectionMs
  };
  const budgets = {
    maxEntitySyncMs: config.maxEntitySyncMs,
    maxTileScanMs: config.maxTileScanMs,
    maxDepthSortMs: config.maxDepthSortMs,
    maxCollisionMs: config.maxCollisionMs
  };
  const failures = [
    budgetFailure('entitySyncMs', metrics.entitySyncMs, budgets.maxEntitySyncMs),
    budgetFailure('tileScanMs', metrics.tileScanMs, budgets.maxTileScanMs),
    budgetFailure('depthSortMs', metrics.depthSortMs, budgets.maxDepthSortMs),
    budgetFailure('collisionProjectionMs', metrics.collisionProjectionMs, budgets.maxCollisionMs)
  ].filter(Boolean);

  return {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    metrics,
    budgets,
    failures,
    suggestions: failures.map((failure) => runtimeSuggestion(failure))
  };
}

export function analyzePackageBudget({
  dir = path.resolve('dist'),
  limitBytes = FOUR_MB,
  largestFiles = 8
} = {}) {
  const root = path.resolve(dir);
  const files = existsSync(root) ? collectFiles(root) : [];
  const bytes = files.reduce((total, item) => total + item.bytes, 0);
  return {
    ok: bytes <= limitBytes,
    dir: root,
    bytes,
    limitBytes,
    overBy: Math.max(0, bytes - limitBytes),
    fileCount: files.length,
    largestFiles: files
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, largestFiles)
      .map((item) => ({
        file: path.relative(root, item.file).replace(/\\/g, '/'),
        bytes: item.bytes
      }))
  };
}

export function suggestBudgetFixes(packageBudget) {
  if (packageBudget.ok) return [];
  const largest = packageBudget.largestFiles?.[0];
  const suggestions = [
    `Package exceeds ${formatBytes(packageBudget.limitBytes)} by ${formatBytes(packageBudget.overBy)}.`
  ];
  if (largest) {
    suggestions.push(`Start with ${largest.file} (${formatBytes(largest.bytes)}): split optional content, remove debug code, or move large assets to a remote/OBundle pipeline.`);
  }
  suggestions.push('Run npm run build:wechat -- --debug only for device debugging, not release packages.');
  return suggestions;
}

export function createPerformanceBudgetReport({
  packageDir = path.resolve('dist', 'wechat'),
  out = null,
  runtimeOptions = {},
  packageOptions = {}
} = {}) {
  const runtime = runDeterministicRuntimeBudget(runtimeOptions);
  const packageBudget = analyzePackageBudget({ dir: packageDir, ...packageOptions });
  const suggestions = [
    ...runtime.suggestions,
    ...suggestBudgetFixes(packageBudget)
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    ok: runtime.ok && packageBudget.ok,
    runtime,
    package: packageBudget,
    suggestions
  };
  if (out) {
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    writeFileSync(path.resolve(out), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return report;
}

function pickBudgetOptions(options) {
  return Object.fromEntries(Object.entries(options).filter(([key]) => key.startsWith('max')));
}

function collectFiles(dir) {
  const output = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) output.push(...collectFiles(full));
    else output.push({ file: full, bytes: stat.size });
  }
  return output;
}

function budgetFailure(metric, value, limit) {
  return value > limit ? { metric, value, limit, overBy: Number((value - limit).toFixed(3)) } : null;
}

function runtimeSuggestion(failure) {
  const label = {
    entitySyncMs: 'entity update loop',
    tileScanMs: 'tile scan',
    depthSortMs: '2.5D depth sort',
    collisionProjectionMs: '2.5D collision projection'
  }[failure.metric] || failure.metric;
  return `${label} exceeded ${failure.limit}ms by ${failure.overBy}ms; reduce per-frame allocations or precompute static data.`;
}

function advanceEntities(positionsX, positionsY, velocitiesX, velocitiesY, entityCount, frames) {
  for (let frame = 0; frame < frames; frame += 1) {
    for (let index = 0; index < entityCount; index += 1) {
      let x = positionsX[index] + velocitiesX[index];
      let y = positionsY[index] + velocitiesY[index];
      if (x >= 1024) x -= 1024;
      else if (x < 0) x += 1024;
      if (y >= 768) y -= 768;
      else if (y < 0) y += 768;
      positionsX[index] = x;
      positionsY[index] = y;
    }
  }
}

function measureBest(task, samples = 5) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < samples; index += 1) {
    const startedAt = now();
    task();
    best = Math.min(best, elapsed(startedAt));
  }
  return best;
}

function now() {
  return process.hrtime.bigint();
}

function elapsed(startedAt) {
  return Number((Number(process.hrtime.bigint() - startedAt) / 1_000_000).toFixed(3));
}

function formatBytes(bytes) {
  return `${Number((bytes / 1024 / 1024).toFixed(2))}MB`;
}

function parseArgs(argv) {
  const options = { runtimeOptions: {}, packageOptions: {} };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--package-dir') {
      index += 1;
      options.packageDir = argv[index];
    } else if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--limit-bytes') {
      index += 1;
      options.packageOptions.limitBytes = Number(argv[index]);
    } else if (arg === '--entities') {
      index += 1;
      options.runtimeOptions.entityCount = Number(argv[index]);
    } else if (arg === '--tiles') {
      index += 1;
      options.runtimeOptions.tileCount = Number(argv[index]);
    } else if (arg === '--frames') {
      index += 1;
      options.runtimeOptions.frames = Number(argv[index]);
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const report = createPerformanceBudgetReport(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
