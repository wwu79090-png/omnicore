import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMarketEngineComparison } from '../src/quality/MarketEngineComparison.js';

describe('market engine comparison', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('compares OmniCore against Phaser, Pixi, Construct, Cocos, and Godot with sourced dimensions', () => {
    const report = buildMarketEngineComparison();

    expect(report).toMatchObject({
      generatedBy: 'OmniCore market engine comparison',
      targetScore: 90,
      omnicore: expect.objectContaining({
        overallScore: expect.any(Number),
        targetDimensionsAbove90: true
      })
    });
    expect(report.omnicore.overallScore).toBeGreaterThanOrEqual(90);
    for (const key of [
      'web2DEngineCandidate',
      'phaserMigrationAppeal',
      'pixiFrameworkLayer',
      'editorLowCodeMaturity',
      'editorLongTermMaturity'
    ]) {
      expect(report.omnicore.dimensions[key].score).toBeGreaterThanOrEqual(90);
    }
    expect(report.omnicore.dimensions.editorLongTermMaturity.score).toBeGreaterThanOrEqual(95);
    expect(Object.keys(report.competitors)).toEqual(expect.arrayContaining([
      'phaser-3.80.1',
      'pixijs-8',
      'construct-3',
      'cocos-creator',
      'godot'
    ]));
    for (const competitor of Object.values(report.competitors)) {
      expect(competitor.sources.length).toBeGreaterThanOrEqual(1);
      expect(competitor.dimensions.web2DEngineCandidate.score).toEqual(expect.any(Number));
    }
    expect(report.findings.strengths).toEqual(expect.arrayContaining([
      expect.stringContaining('Phaser 迁移'),
      expect.stringContaining('Pixi'),
      expect.stringContaining('长期成熟度'),
      expect.stringContaining('生态成熟度')
    ]));
    expect(report.findings.remainingGaps).toEqual([]);
  });

  it('writes json and markdown artifacts for repeatable market evaluation', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-market-compare-'));
    const out = path.join(temp, 'market-engine-comparison.json');
    const markdown = path.join(temp, 'market-engine-comparison.md');

    execFileSync(process.execPath, [
      'scripts/market-engine-compare.js',
      '--out', out,
      '--markdown', markdown
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const report = JSON.parse(readFileSync(out, 'utf8'));
    const doc = readFileSync(markdown, 'utf8');

    expect(existsSync(out)).toBe(true);
    expect(existsSync(markdown)).toBe(true);
    expect(report.omnicore.targetDimensionsAbove90).toBe(true);
    expect(doc).toContain('OmniCore vs 市场 Web 2D 引擎测评');
    expect(doc).toContain('Phaser 3.80.1');
    expect(doc).toContain('PixiJS');
    expect(doc).toContain('Construct 3');
    expect(doc).toContain('Cocos Creator');
    expect(doc).toContain('Godot');
    expect(doc).toContain('剩余差距: 无');
  });
});
