#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DirtyFlagTracker,
  createAnimationLODPlan,
  createRuntimeObjectPools,
  createTilemapChunkStreamPlan,
  createWebGPUComputeDispatchPlan,
  createWebGPUInstancingDescriptor,
  createWebGPUTextureArrayBatch,
  optimizeRenderQueueForBatching
} from '../src/index.js';

export function createPerformanceHotPathsGateReport({
  generatedAt = new Date().toISOString()
} = {}) {
  const checks = [
    createRenderQueueBatchingCheck(),
    createRuntimeObjectPoolsCheck(),
    createDirtyFlagSyncCheck(),
    createTilemapStreamingCheck(),
    createAnimationLODCheck(),
    createWebGPUDescriptorsCheck()
  ];
  return {
    format: 'OmniCore.PerformanceHotPathsGateReport',
    version: 1,
    generatedAt,
    ok: checks.every((check) => check.ok),
    checks,
    summary: {
      passed: checks.filter((check) => check.ok).length,
      failed: checks.filter((check) => !check.ok).length
    }
  };
}

export function writePerformanceHotPathsGateReport(
  report,
  out = path.join('docs', 'release-notes', 'performance-hot-paths-report.json')
) {
  const outFile = path.resolve(out);
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return outFile;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const report = createPerformanceHotPathsGateReport({ generatedAt: options.generatedAt });
  const outFile = writePerformanceHotPathsGateReport(report, options.out);
  console.log(`[OmniCore] performance hot-paths gate ${report.ok ? 'passed' : 'failed'}: ${outFile}`);
  if (!report.ok) {
    for (const check of report.checks.filter((item) => !item.ok)) {
      console.error(`[performance:hot-paths-gate] ${check.id}: ${check.message}`);
    }
    process.exitCode = 1;
  }
  return report;
}

function createRenderQueueBatchingCheck() {
  const plan = optimizeRenderQueueForBatching([
    { id: 'hero-a', layer: 'world', texture: 'hero.png', material: 'sprite' },
    { id: 'prop', layer: 'world', texture: 'props.png', material: 'sprite' },
    { id: 'hero-b', layer: 'world', texture: 'hero.png', material: 'sprite' },
    { id: 'hud', layer: 'ui', texture: 'ui.png', material: 'sprite' }
  ]);
  return {
    id: 'render-queue-batching',
    ok: plan.savedDrawCalls > 0 && plan.afterDrawCalls < plan.beforeDrawCalls,
    message: 'Render queue groups safe commands by compatible render state.',
    evidence: plan
  };
}

function createRuntimeObjectPoolsCheck() {
  const pools = createRuntimeObjectPools({ warm: { Sprite: 1, Tween: 1, Particle: 1, Event: 1 } });
  const sprite = pools.acquire('Sprite', { id: 'gate-sprite' });
  pools.release('Sprite', sprite);
  pools.acquire('Sprite', { id: 'gate-sprite-reused' });
  const evidence = pools.report();
  const spritePool = evidence.types.find((type) => type.name === 'Sprite');
  return {
    id: 'runtime-object-pools',
    ok: spritePool?.reused > 0 && evidence.types.length === 4,
    message: 'Runtime pools reuse Sprite, Tween, Particle, and Event objects.',
    evidence
  };
}

function createDirtyFlagSyncCheck() {
  const synced = [];
  const tracker = new DirtyFlagTracker({
    sync: (entity, properties, record) => synced.push({ id: record.id, properties })
  });
  const hero = { id: 'hero', x: 0, alpha: 1 };
  const npc = { id: 'npc', x: 0 };
  tracker.track(hero, 'hero');
  tracker.track(npc, 'npc');
  tracker.set(hero, 'x', 12);
  tracker.set(npc, 'x', 0);
  const evidence = tracker.syncOnlyDirty({ now: 1 });
  return {
    id: 'dirty-flag-sync',
    ok: evidence.dirtyCount === 1 && evidence.syncedProperties === 1 && synced[0]?.id === 'hero',
    message: 'Dirty sync patches only changed records in the current frame.',
    evidence: {
      ...evidence,
      synced
    }
  };
}

function createTilemapStreamingCheck() {
  const evidence = createTilemapChunkStreamPlan({
    viewport: { x: 0, y: 0, width: 64, height: 64 },
    chunkSize: 32,
    loadedChunks: ['0,0', '5,5'],
    preloadRadius: 1,
    mapWidth: 6,
    mapHeight: 6
  });
  return {
    id: 'tilemap-streaming',
    ok: evidence.keep.includes('0,0') && evidence.load.includes('2,2') && evidence.unload.includes('5,5'),
    message: 'Tilemap streaming loads visible/preloaded chunks and unloads distant chunks.',
    evidence
  };
}

function createAnimationLODCheck() {
  const evidence = createAnimationLODPlan([
    { id: 'hero', distance: 32, visible: true, hasFFD: true },
    { id: 'npc', distance: 420, visible: true, hasFFD: true },
    { id: 'cloud', distance: 80, visible: false }
  ], {
    nearDistance: 128,
    farDistance: 512
  });
  return {
    id: 'animation-lod',
    ok: evidence.paused === 1 && evidence.ffdDisabled >= 2,
    message: 'Animation LOD keeps near FFD active and downgrades far/offscreen actors.',
    evidence
  };
}

function createWebGPUDescriptorsCheck() {
  const instancing = createWebGPUInstancingDescriptor({
    instances: [
      { x: 0, y: 0, width: 16, height: 16 },
      { x: 16, y: 0, width: 16, height: 16 },
      { x: 32, y: 0, width: 16, height: 16 }
    ]
  });
  const textureArray = createWebGPUTextureArrayBatch([
    { id: 'a', texture: 'hero.png' },
    { id: 'b', texture: 'props.png' },
    { id: 'c', texture: 'hero.png' }
  ]);
  const compute = createWebGPUComputeDispatchPlan({ task: 'particles', items: 1000, workgroupSize: 64 });
  return {
    id: 'webgpu-descriptors',
    ok: instancing.drawCalls === 1 && textureArray.drawCalls === 1 && compute.workgroups > 0,
    message: 'WebGPU descriptors expose instancing, texture-array batching, and compute dispatch plans.',
    evidence: {
      instancing,
      textureArray,
      compute
    }
  };
}

function parseArgs(argv = []) {
  const options = {
    out: path.join('docs', 'release-notes', 'performance-hot-paths-report.json'),
    generatedAt: undefined
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (arg === '--generated-at') {
      index += 1;
      options.generatedAt = argv[index];
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  main();
}

export default main;
