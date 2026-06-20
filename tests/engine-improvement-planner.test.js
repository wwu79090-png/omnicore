import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FrameProfiler } from '../src/debug/FrameProfiler.js';
import {
  buildEngineImprovementPlan,
  formatEngineImprovementMarkdown
} from '../src/quality/ImprovementPlanner.js';

describe('engine improvement planner', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('turns market weak points into a large prioritized execution backlog', () => {
    const plan = buildEngineImprovementPlan({
      generatedAt: '2026-06-20T00:00:00.000+08:00'
    });

    expect(plan.summary.totalOpportunities).toBeGreaterThanOrEqual(30);
    expect(plan.summary.phaseCount).toBeGreaterThanOrEqual(5);
    expect(plan.opportunities[0]).toMatchObject({
      id: expect.any(String),
      priority: expect.stringMatching(/^P[0-3]$/u),
      area: expect.any(String),
      actions: expect.arrayContaining([expect.any(String)])
    });
    expect(plan.opportunities.map((item) => item.id)).toEqual(expect.arrayContaining([
      'runtime-frame-profiler-hotspots',
      'market-benchmark-trend-parity',
      'migration-codemod-parity',
      'plugin-sandbox-signing',
      'golden-scene-visual-regression'
    ]));
    expect(plan.nextActions.length).toBeGreaterThanOrEqual(10);
  });

  it('tracks evidence coverage and completed improvement items instead of keeping the backlog static', () => {
    const plan = buildEngineImprovementPlan({
      generatedAt: '2026-06-20T00:00:00.000+08:00'
    });
    const profiler = plan.opportunities.find((item) => item.id === 'runtime-frame-profiler-hotspots');
    const backlogCi = plan.opportunities.find((item) => item.id === 'improvement-backlog-ci');
    const benchmarkTrend = plan.opportunities.find((item) => item.id === 'market-benchmark-trend-parity');
    const pluginSecurity = plan.opportunities.find((item) => item.id === 'plugin-sandbox-signing');

    expect(plan.summary.evidenceCompleteCount).toBeGreaterThan(0);
    expect(plan.summary.evidenceCompletionScore).toBeGreaterThan(0);
    expect(profiler).toMatchObject({
      status: 'complete',
      evidenceStatus: {
        complete: true,
        missing: []
      }
    });
    expect(backlogCi).toMatchObject({
      status: 'complete',
      evidenceStatus: {
        complete: true,
        missing: []
      }
    });
    expect(benchmarkTrend).toMatchObject({
      status: 'complete',
      evidenceStatus: {
        complete: true,
        missing: []
      }
    });
    expect(pluginSecurity).toMatchObject({
      status: 'complete',
      evidenceStatus: {
        complete: true,
        missing: []
      }
    });
    expect(plan.completedOpportunities.map((item) => item.id)).toEqual(expect.arrayContaining([
      'runtime-frame-profiler-hotspots',
      'improvement-backlog-ci',
      'market-benchmark-trend-parity',
      'plugin-sandbox-signing'
    ]));
    expect(plan.nextActions.map((item) => item.id)).not.toContain('runtime-frame-profiler-hotspots');
    expect(plan.nextActions.map((item) => item.id)).not.toContain('market-benchmark-trend-parity');
    expect(plan.nextActions.map((item) => item.id)).not.toContain('plugin-sandbox-signing');
  });

  it('formats the backlog as a markdown execution plan', () => {
    const markdown = formatEngineImprovementMarkdown(buildEngineImprovementPlan({
      generatedAt: '2026-06-20T00:00:00.000+08:00'
    }));

    expect(markdown).toContain('# OmniCore Engine Improvement Plan');
    expect(markdown).toContain('Evidence completion:');
    expect(markdown).toContain('| Priority | Area | Improvement | Evidence | First Action |');
    expect(markdown).toContain('runtime-frame-profiler-hotspots');
    expect(markdown).toContain('market-benchmark-trend-parity');
  });

  it('writes json and markdown from the CLI and quality report includes the plan', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-improvements-'));
    const jsonOut = path.join(temp, 'improvements.json');
    const mdOut = path.join(temp, 'improvements.md');
    const qualityOut = path.join(temp, 'quality-report.json');

    execFileSync(process.execPath, [
      'scripts/engine-improvements.js',
      '--generated-at', '2026-06-20T00:00:00.000+08:00',
      '--out', jsonOut,
      '--markdown', mdOut
    ], { cwd: process.cwd(), encoding: 'utf8' });
    execFileSync(process.execPath, [
      'scripts/generate-quality-report.js',
      '--out', qualityOut
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const plan = JSON.parse(readFileSync(jsonOut, 'utf8'));
    const quality = JSON.parse(readFileSync(qualityOut, 'utf8'));

    expect(existsSync(mdOut)).toBe(true);
    expect(plan.summary.totalOpportunities).toBeGreaterThanOrEqual(30);
    expect(quality.engineImprovementPlan.summary.totalOpportunities).toBeGreaterThanOrEqual(30);
    expect(quality.engineImprovementPlan.nextActions[0]).toMatchObject({
      id: expect.any(String),
      command: expect.any(String)
    });
  });
});

describe('FrameProfiler insights', () => {
  it('summarizes p95 frame cost and recommends fixes for hot sections', () => {
    const profiler = new FrameProfiler({ enabled: true, limit: 10 });

    profiler.startFrame({ frame: 1, time: 0 });
    profiler.record('physics', 3.5);
    profiler.record('render', 14.2, { drawCalls: 900 });
    profiler.endFrame();

    profiler.startFrame({ frame: 2, time: 16 });
    profiler.record('physics', 4.1);
    profiler.record('render', 18.5, { drawCalls: 1400 });
    profiler.endFrame();

    const summary = profiler.summarize({
      frameBudgetMs: 16.7,
      sectionBudgetMs: 8
    });
    const recommendations = profiler.recommend({
      frameBudgetMs: 16.7,
      sectionBudgetMs: 8
    });

    expect(summary.frameCount).toBe(2);
    expect(summary.p95FrameMs).toBeGreaterThan(16.7);
    expect(summary.overBudgetFrames).toBe(2);
    expect(summary.sections[0]).toMatchObject({
      name: 'render',
      maxMs: 18.5,
      overBudget: true
    });
    expect(recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'frame-budget-p95' }),
      expect.objectContaining({ code: 'hot-section', section: 'render' })
    ]));
  });
});
