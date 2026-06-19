import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Dimension3D from '../src/dimension3d/Dimension3D.js';
import {
  analyzePackageBudget,
  createPerformanceBudgetReport,
  runDeterministicRuntimeBudget,
  suggestBudgetFixes
} from '../scripts/performance-budget.js';

describe('deterministic performance and package budgets', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('measures fixed 2D and 2.5D runtime budgets without browser rendering', () => {
    const report = runDeterministicRuntimeBudget({
      entityCount: 256,
      tileCount: 512,
      frames: 60,
      maxEntitySyncMs: 20,
      maxTileScanMs: 16,
      maxDepthSortMs: 12,
      maxCollisionMs: 12
    });

    expect(report.ok).toBe(true);
    expect(report.metrics.entityCount).toBe(256);
    expect(report.metrics.tileCount).toBe(512);
    expect(report.metrics.entitySyncMs).toBeLessThanOrEqual(report.budgets.maxEntitySyncMs);
    expect(report.metrics.tileScanMs).toBeLessThanOrEqual(report.budgets.maxTileScanMs);
    expect(report.metrics.depthSortMs).toBeLessThanOrEqual(report.budgets.maxDepthSortMs);
    expect(report.metrics.collisionProjectionMs).toBeLessThanOrEqual(report.budgets.maxCollisionMs);
    expect(Dimension3D.PlaneLayer).toBeTypeOf('function');
  });

  it('keeps the default runtime budget under release thresholds', () => {
    const report = runDeterministicRuntimeBudget();

    expect(report.ok).toBe(true);
    expect(report.failures).toEqual([]);
  });

  it('blocks package budgets over the 4MB WeChat redline and gives concrete suggestions', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-budget-'));
    const out = path.join(temp, 'wechat');
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, 'game.js'), Buffer.alloc((4 * 1024 * 1024) + 32, 1));

    const budget = analyzePackageBudget({
      dir: out,
      limitBytes: 4 * 1024 * 1024,
      largestFiles: 3
    });

    expect(budget.ok).toBe(false);
    expect(budget.bytes).toBeGreaterThan(budget.limitBytes);
    expect(budget.largestFiles[0]).toMatchObject({ file: 'game.js' });
    expect(suggestBudgetFixes(budget)).toEqual(expect.arrayContaining([
      expect.stringContaining('game.js')
    ]));
  });

  it('writes a combined performance budget report with failures and optimization advice', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-budget-report-'));
    const packageDir = path.join(temp, 'package');
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(path.join(packageDir, 'game.js'), 'console.log("small");\n');
    const out = path.join(temp, 'report.json');

    const report = createPerformanceBudgetReport({
      packageDir,
      out,
      runtimeOptions: {
        entityCount: 128,
        tileCount: 128,
        frames: 30,
        maxEntitySyncMs: 40,
        maxTileScanMs: 20,
        maxDepthSortMs: 20,
        maxCollisionMs: 20
      }
    });

    expect(report.ok).toBe(true);
    expect(report.runtime.ok).toBe(true);
    expect(report.package.ok).toBe(true);
    expect(report.suggestions).toEqual([]);
    expect(JSON.parse(readFileSync(out, 'utf8'))).toMatchObject({ ok: true });
  });
});
