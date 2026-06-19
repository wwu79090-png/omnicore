import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildMarketPositioningScorecard } from '../src/quality/MarketPositioningScorecard.js';

describe('market positioning 90+ scorecard', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('scores the requested market categories at 90 or above', () => {
    const scorecard = buildMarketPositioningScorecard();

    expect(scorecard).toMatchObject({
      target: 90,
      allAboveTarget: true,
      dimensions: {
        web2DEngineCandidate: expect.objectContaining({ score: expect.any(Number), missing: [] }),
        phaserMigrationAppeal: expect.objectContaining({ score: expect.any(Number), missing: [] }),
        pixiFrameworkLayer: expect.objectContaining({ score: expect.any(Number), missing: [] }),
        editorLowCodeMaturity: expect.objectContaining({ score: expect.any(Number), missing: [] })
      }
    });
    expect(scorecard.overallScore).toBeGreaterThanOrEqual(90);
    for (const dimension of Object.values(scorecard.dimensions)) {
      expect(dimension.score).toBeGreaterThanOrEqual(90);
    }
  });

  it('writes the market positioning scorecard into quality report output', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-market-90-'));
    const out = path.join(temp, 'quality-report.json');

    execFileSync(process.execPath, ['scripts/generate-quality-report.js', '--out', out], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const report = JSON.parse(readFileSync(out, 'utf8'));
    expect(report.marketPositioningScorecard).toMatchObject({
      target: 90,
      allAboveTarget: true,
      dimensions: {
        web2DEngineCandidate: expect.objectContaining({ score: expect.any(Number) }),
        phaserMigrationAppeal: expect.objectContaining({ score: expect.any(Number) }),
        pixiFrameworkLayer: expect.objectContaining({ score: expect.any(Number) }),
        editorLowCodeMaturity: expect.objectContaining({ score: expect.any(Number) })
      }
    });
  });
});
