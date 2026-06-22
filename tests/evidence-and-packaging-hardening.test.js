import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createTypeDeclarationSource } from '../scripts/build.js';
import { createPublishDryRunReport } from '../scripts/npm-publish-dry-run.js';

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe('evidence and packaging hardening', () => {
  it('generates uncapped FPS evidence and public markdown from real-device style samples', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-uncapped-evidence-'));
    tempRoots.push(root);
    const out = path.join(root, 'uncapped.json');
    const markdownOut = path.join(root, 'uncapped.md');
    const { captureUncappedFpsEvidence } = await importScript('scripts/capture-uncapped-fps-evidence.js');

    const report = captureUncappedFpsEvidence({
      out,
      markdownOut,
      generatedAt: '2026-06-21T00:00:00.000Z',
      samples: [
        { device: 'Windows 144Hz', browser: 'Chrome', displayHz: 144, fps: 141, p95FrameMs: 7.8, sprites: 1000, drawCalls: 3 },
        { device: 'Android 120Hz', browser: 'WebView', displayHz: 120, fps: 116, p95FrameMs: 9.1, sprites: 1000, drawCalls: 3 }
      ]
    });

    expect(report.ok).toBe(true);
    expect(report.samples.every((sample) => sample.uncapped)).toBe(true);
    expect(readFileSync(out, 'utf8')).toContain('Windows 144Hz');
    expect(readFileSync(markdownOut, 'utf8')).toContain('Uncapped FPS Evidence');
  });

  it('verifies TypeScript declaration coverage for newly exported hot-path APIs', async () => {
    const { createTypeCoverageReport } = await importScript('scripts/verify-types-coverage.js');
    const report = createTypeCoverageReport({
      declarationSource: createTypeDeclarationSource()
    });

    expect(report.ok).toBe(true);
    expect(report.coveredSymbols).toEqual(expect.arrayContaining([
      'optimizeRenderQueueForBatching',
      'createRuntimeObjectPools',
      'DirtyFlagTracker',
      'createAsyncAssetPipeline',
      'createIncrementalSpatialIndexReport',
      'WorkerTaskScheduler',
      'createTextureBudgetPlan',
      'createTilemapChunkStreamPlan',
      'createAnimationLODPlan',
      'createWebGPUInstancingDescriptor',
      'createWebGPUTextureArrayBatch',
      'createWebGPUComputeDispatchPlan'
    ]));
  });

  it('creates hot-path performance gate and long-run stability evidence', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-hot-path-gate-'));
    tempRoots.push(root);
    const out = path.join(root, 'gate.json');
    const { createPerformanceHotPathsGateReport, writePerformanceHotPathsGateReport } = await importScript('scripts/performance-hot-paths-gate.js');
    const { createRuntimeSoakReport } = await import('../src/quality/RuntimeSoakHarness.js');

    const report = createPerformanceHotPathsGateReport({ generatedAt: '2026-06-21T00:00:00.000Z' });
    const outFile = writePerformanceHotPathsGateReport(report, out);
    const soak = createRuntimeSoakReport({
      iterations: 10,
      spritesPerScene: 12,
      resourcesPerScene: 3,
      tweensPerScene: 4,
      includeHotPathMetrics: true
    });

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual(expect.arrayContaining([
      'render-queue-batching',
      'runtime-object-pools',
      'dirty-flag-sync',
      'tilemap-streaming',
      'animation-lod',
      'webgpu-descriptors'
    ]));
    expect(existsSync(outFile)).toBe(true);
    expect(soak.ok).toBe(true);
    expect(soak.hotPaths).toMatchObject({
      pooledTypes: ['Sprite', 'Tween', 'Particle', 'Event'],
      dirtySync: 'only-dirty-records'
    });
  });

  it('captures WebGPU hot-path descriptors and tightens npm package quality evidence', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-webgpu-package-'));
    tempRoots.push(root);
    const out = path.join(root, 'webgpu.json');
    const { captureWebGPUEvidence } = await importScript('scripts/capture-webgpu-evidence.js');

    const webgpu = captureWebGPUEvidence({
      out,
      fps: 144,
      sprites: 1000,
      includeHotPaths: true,
      device: 'Chrome WebGPU Lab'
    });
    const packageReport = createPublishDryRunReport([{
      id: 'omnicore@1.0.0',
      name: 'omnicore',
      version: '1.0.0',
      size: 1024 * 1024,
      unpackedSize: 4 * 1024 * 1024,
      entryCount: 8,
      files: [
        { path: 'package.json', size: 1024 },
        { path: 'README.md', size: 2048 },
        { path: 'LICENSE', size: 1024 },
        { path: 'src/index.js', size: 4096 },
        { path: 'dist/omnicore.esm.js', size: 958909 },
        { path: 'dist/omnicore.d.ts', size: 16384 },
        { path: 'docs/performance-hot-paths.md', size: 4096 },
        { path: 'examples/performance-hot-paths-demo/index.html', size: 4096 }
      ]
    }]);

    expect(webgpu.evidence.hotPaths).toMatchObject({
      instancing: expect.objectContaining({ drawCalls: 1 }),
      textureArray: expect.objectContaining({ drawCalls: 1 }),
      compute: expect.objectContaining({ workgroups: expect.any(Number) })
    });
    expect(packageReport.ok).toBe(true);
    expect(packageReport.packageQuality).toMatchObject({
      provenanceReady: true,
      sbomReady: true,
      treeShakingReady: true
    });
    expect(packageReport.packageQuality.includedExamples).toContain('examples/performance-hot-paths-demo/index.html');
  });

  it('ships a performance hot-paths demo and public proof links', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const readme = readFileSync('README.md', 'utf8');
    const website = readFileSync('website/index.html', 'utf8');
    const workflow = readFileSync('.github/workflows/benchmark.yml', 'utf8');
    const demoMain = readFileSync('examples/performance-hot-paths-demo/src/main.js', 'utf8');

    expect(packageJson.scripts).toMatchObject({
      'performance:uncapped-evidence': 'node scripts/capture-uncapped-fps-evidence.js',
      'types:coverage': 'node scripts/verify-types-coverage.js',
      'performance:hot-paths-gate': 'node scripts/performance-hot-paths-gate.js'
    });
    expect(packageJson.files).toEqual(expect.arrayContaining([
      'docs/performance/real-device-uncapped-fps.md',
      'examples/performance-hot-paths-demo'
    ]));
    expect(demoMain).toContain('optimizeRenderQueueForBatching');
    expect(demoMain).toContain('createRuntimeObjectPools');
    expect(demoMain).toContain('DirtyFlagTracker');
    expect(demoMain).toContain('createWebGPUInstancingDescriptor');
    expect(readme).toContain('默认不限 FPS');
    expect(readme).toContain('examples/performance-hot-paths-demo');
    expect(website).toContain('Uncapped FPS');
    expect(website).toContain('performance-hot-paths-demo');
    expect(workflow).toContain('npm run performance:hot-paths-gate');
    expect(workflow).toContain('performance-hot-paths-report.json');
  });
});

function importScript(file) {
  return import(pathToFileURL(path.resolve(file)).href);
}
