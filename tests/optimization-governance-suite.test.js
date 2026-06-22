import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import OmniCore from '../src/index.js';
import { createEngineDoctorReport } from '../scripts/engine-doctor.js';

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
});

describe('optimization governance suite', () => {
  it('generates a real-device performance baseline matrix', async () => {
    const { createDevicePerformanceBaseline } = await import('../scripts/device-performance-baseline.js');
    const report = createDevicePerformanceBaseline({
      generatedAt: '2026-06-21T00:00:00.000Z'
    });

    expect(report.format).toBe('OmniCore.DevicePerformanceBaseline');
    expect(report.devices.map((device) => device.id)).toEqual([
      'windows-low-end-igpu',
      'android-mid-range-webview',
      'wechat-devtools',
      'chrome-webgpu'
    ]);
    for (const device of report.devices) {
      expect(device.metrics).toEqual(expect.objectContaining({
        fps: expect.any(Number),
        p95FrameMs: expect.any(Number),
        memoryMb: expect.any(Number),
        drawCalls: expect.any(Number),
        gcEvents: expect.any(Number),
        packageBytes: expect.any(Number)
      }));
      expect(device.capture).toContain('console error/warn');
    }
  });

  it('builds runtime dashboard, resource waterfall, allocation, and startup reports', async () => {
    const {
      createPerformanceDashboardSnapshot
    } = await import('../src/debug/PerformanceDashboard.js');
    const {
      createResourceWaterfall,
      summarizeResourceWaterfall
    } = await import('../src/debug/ResourceWaterfall.js');
    const {
      createAllocationPressureReport
    } = await import('../src/debug/AllocationPressureReport.js');
    const {
      StartupProfiler
    } = await import('../src/performance/StartupProfiler.js');

    const dashboard = createPerformanceDashboardSnapshot({
      renderMs: 4,
      scriptMs: 3,
      physicsMs: 1,
      assetMs: 2,
      audioMs: 0.5,
      gcMs: 0.25,
      fps: 144
    });
    expect(dashboard.segments.map((item) => item.name)).toEqual([
      'render',
      'script',
      'physics',
      'assets',
      'audio',
      'gc'
    ]);
    expect(dashboard.frameBudget.status).toBe('ok');

    const waterfall = createResourceWaterfall({ now: () => 100 });
    waterfall.markStart('hero.png');
    waterfall.markDownloaded('hero.png', { bytes: 2048, at: 116 });
    waterfall.markDecoded('hero.png', { at: 125 });
    waterfall.markCacheHit('bgm.ogg', { at: 130 });
    waterfall.markFallback('missing.wav', { reason: '404', at: 140 });
    const resourceSummary = summarizeResourceWaterfall(waterfall.entries());
    expect(resourceSummary.totalResources).toBe(3);
    expect(resourceSummary.cacheHits).toBe(1);
    expect(resourceSummary.fallbacks[0]).toMatchObject({ id: 'missing.wav', reason: '404' });

    const allocation = createAllocationPressureReport({
      allocations: [
        { type: 'Sprite', created: 100, reused: 90, destroyed: 5 },
        { type: 'Tween', created: 50, reused: 5, destroyed: 1 }
      ]
    });
    expect(allocation.hotspots[0].type).toBe('Tween');
    expect(allocation.recommendations[0]).toContain('Tween');

    const startupTicks = [0, 12, 30, 45, 52, 61];
    const startup = new StartupProfiler({ now: () => startupTicks.shift() });
    startup.mark('game-constructor');
    startup.mark('js-init');
    startup.mark('resource-load');
    startup.mark('font-load');
    startup.mark('scene-build');
    startup.mark('first-frame');
    const startupReport = startup.report();
    expect(startupReport.totalMs).toBe(61);
    expect(startupReport.phases.map((phase) => phase.name)).toContain('first-frame');
  });

  it('audits package buckets and blocks performance regressions', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-size-audit-'));
    tempRoots.push(root);
    for (const [file, bytes] of [
      ['dist/omnicore.esm.js', 1024],
      ['packages/omnicore-editor/src/editor-app.js', 2048],
      ['examples/demo.js', 512],
      ['docs/readme.md', 256],
      ['assets/sprite.png', 128]
    ]) {
      const full = path.join(root, file);
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, 'x'.repeat(bytes), 'utf8');
    }

    const { createSizeAuditReport } = await import('../scripts/size-audit.js');
    const { comparePerformanceRegression } = await import('../scripts/performance-regression-gate.js');
    const audit = createSizeAuditReport({
      root,
      budgets: {
        runtime: 4096,
        editor: 4096,
        examples: 1024,
        docs: 1024,
        assets: 1024,
        npmTarball: 8192
      }
    });
    expect(audit.format).toBe('OmniCore.SizeAudit');
    expect(audit.ok).toBe(true);
    expect(audit.buckets.map((bucket) => bucket.name)).toEqual([
      'runtime',
      'editor',
      'examples',
      'docs',
      'assets',
      'npmTarball'
    ]);

    const regression = comparePerformanceRegression({
      baseline: { fps: 144, p95FrameMs: 8, packageBytes: 1000 },
      current: { fps: 130, p95FrameMs: 8.5, packageBytes: 1010 },
      thresholds: { fpsDropPercent: 0.2, frameMsIncreasePercent: 0.2, packageIncreasePercent: 0.2 }
    });
    expect(regression.passed).toBe(true);

    const blocked = comparePerformanceRegression({
      baseline: { fps: 144, p95FrameMs: 8, packageBytes: 1000 },
      current: { fps: 90, p95FrameMs: 13, packageBytes: 1600 },
      thresholds: { fpsDropPercent: 0.1, frameMsIncreasePercent: 0.1, packageIncreasePercent: 0.1 }
    });
    expect(blocked.passed).toBe(false);
    expect(blocked.regressions.map((item) => item.metric)).toEqual(['fps', 'p95FrameMs', 'packageBytes']);
  });

  it('explains render batching breaks and exports doctor fix commands', async () => {
    const { diagnoseBatchBreaks } = await import('../src/renderer/BatchDiagnostics.js');
    const diagnostics = diagnoseBatchBreaks([
      { id: 'a', texture: 'atlas.png', blendMode: 'normal', shader: 'sprite', mask: null, material: 'default', layer: 'world' },
      { id: 'b', texture: 'hero.png', blendMode: 'normal', shader: 'sprite', mask: null, material: 'default', layer: 'world' },
      { id: 'c', texture: 'hero.png', blendMode: 'add', shader: 'sprite', mask: 'circle', material: 'glow', layer: 'fx' }
    ]);

    expect(diagnostics.breaks.map((item) => item.reason)).toEqual(expect.arrayContaining([
      'texture',
      'blendMode',
      'mask',
      'material',
      'layer'
    ]));
    expect(diagnostics.suggestions[0]).toContain('atlas');

    const doctor = createEngineDoctorReport({ generatedAt: '2026-06-21T00:00:00.000Z' });
    for (const item of doctor.diagnostics.zh) {
      expect(item.fixCommand).toEqual(expect.any(String));
      expect(item.fixCommand.length).toBeGreaterThan(4);
    }
  });

  it('ships benchmark scripts for every official playable template and exposes public helpers', async () => {
    for (const template of ['platformer', 'rpg-dialogue', 'bullet-heaven']) {
      const root = path.join('examples', 'official-templates', template);
      const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      expect(packageJson.scripts.benchmark).toBe('node benchmark.js');
      const result = spawnSync(process.execPath, [path.join(root, 'benchmark.js')], {
        cwd: process.cwd(),
        encoding: 'utf8'
      });
      expect(result.status).toBe(0);
      const report = JSON.parse(result.stdout);
      expect(report.template).toBe(template);
      expect(report.metrics).toEqual(expect.objectContaining({
        fps: expect.any(Number),
        p95FrameMs: expect.any(Number),
        memoryMb: expect.any(Number),
        drawCalls: expect.any(Number),
        gcEvents: expect.any(Number),
        packageBytes: expect.any(Number)
      }));
    }

    expect(OmniCore.PerformanceDashboard).toBeDefined();
    expect(OmniCore.ResourceWaterfall).toBeDefined();
    expect(OmniCore.AllocationPressureReport).toBeDefined();
    expect(OmniCore.StartupProfiler).toBeDefined();
    expect(OmniCore.diagnoseBatchBreaks).toBeDefined();
    expect(existsSync('docs/optimization-governance.md')).toBe(true);
  });
});
