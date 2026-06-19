import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('market adoption readiness pack', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('adds migration guides and a 30 minute trial path for competing engine users', () => {
    const phaser = readFileSync('docs/migration/from-phaser.md', 'utf8');
    const construct = readFileSync('docs/migration/from-construct.md', 'utf8');
    const cocos = readFileSync('docs/migration/from-cocos.md', 'utf8');
    const trial = readFileSync('docs/adoption/30-minute-trial.md', 'utf8');
    const page = readFileSync('website/migration/index.html', 'utf8');

    expect(phaser).toContain('Phaser Scene');
    expect(phaser).toContain('OmniCore Scene');
    expect(phaser).toContain('Arcade Physics');
    expect(phaser).toContain('loadPhysics');

    expect(construct).toContain('Event Sheet');
    expect(construct).toContain('VisualEventGraph');
    expect(construct).toContain('JSON Event Sheet');
    expect(construct).toContain('风险等级');

    expect(cocos).toContain('Cocos Component');
    expect(cocos).toContain('addComponent');
    expect(cocos).toContain('Prefab');
    expect(cocos).toContain('平台发布');

    expect(trial).toContain('30 分钟');
    expect(trial).toContain('create-omnicore-app');
    expect(trial).toContain('npm test');
    expect(trial).toContain('npm run build');
    expect(trial).toContain('console error/warn');

    expect(page).toContain('data-migration-guide="phaser"');
    expect(page).toContain('data-migration-guide="construct"');
    expect(page).toContain('data-migration-guide="cocos"');
    expect(page).toContain('data-risk-level="medium"');
  });

  it('records adoption readiness in the generated quality report', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-adoption-readiness-'));
    const out = path.join(temp, 'quality-report.json');

    execFileSync(process.execPath, ['scripts/generate-quality-report.js', '--out', out], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const report = JSON.parse(readFileSync(out, 'utf8'));

    expect(report.marketAdoptionReadiness).toMatchObject({
      target: 90,
      allAboveTarget: true,
      dimensions: {
        migrationGuides: expect.objectContaining({
          score: 100,
          missing: []
        }),
        trialPath: expect.objectContaining({
          score: 100,
          missing: []
        }),
        publicEntryPoints: expect.objectContaining({
          score: 100,
          missing: []
        })
      }
    });
    expect(report.marketAdoptionReadiness.overallScore).toBeGreaterThanOrEqual(90);
  });
});
