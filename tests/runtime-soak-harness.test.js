import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RuntimeSoakHarness,
  createRuntimeSoakReport
} from '../src/index.js';

describe('runtime soak harness', () => {
  it('runs repeated scene lifecycle cycles and reports no leaked resources or listeners', () => {
    const report = createRuntimeSoakReport({
      iterations: 24,
      spritesPerScene: 4,
      resourcesPerScene: 2,
      tweensPerScene: 2,
      generatedAt: '2026-06-21T00:00:00.000Z'
    });

    expect(report).toMatchObject({
      schema: 'omnicore.runtime-soak-report.v1',
      ok: true,
      iterations: 24,
      totals: expect.objectContaining({
        scenesCreated: 24,
        scenesDestroyed: 24,
        spritesCreated: 96,
        resourcesCreated: 48,
        resourcesDestroyed: 48
      }),
      leaks: [],
      warnings: []
    });
    expect(report.peak.entities).toBeGreaterThanOrEqual(4);
    expect(new RuntimeSoakHarness({ iterations: 2 }).run()).toMatchObject({ ok: true });
  });

  it('exposes a package script for longer local soak runs', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(packageJson.scripts['test:soak']).toBe('node scripts/runtime-soak.js');
  });
});
