import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMarketEngineComparison } from '../src/quality/MarketEngineComparison.js';

describe('ecosystem maturity market scoring', () => {
  it('derives OmniCore ecosystem maturity from concrete repo evidence', () => {
    const report = buildMarketEngineComparison({ generatedAt: '2026-06-20T00:00:00.000Z' });
    const ecosystem = report.omnicore.dimensions.ecosystemMaturity;

    expect(ecosystem.score).toBeGreaterThanOrEqual(90);
    expect(ecosystem.evidence).toContain('ecosystem evidence');
    expect(ecosystem.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'pluginPackages', present: true }),
      expect.objectContaining({ key: 'pluginExamples', present: true }),
      expect.objectContaining({ key: 'starterTemplates', present: true }),
      expect.objectContaining({ key: 'tutorialLibrary', present: true }),
      expect.objectContaining({ key: 'publicBenchmarks', present: true }),
      expect.objectContaining({ key: 'adoptionCases', present: true })
    ]));
    expect(report.findings.remainingGaps.join('\n')).not.toContain('生态成熟度仍低于');
  });

  it('ships public ecosystem adoption assets for external developers', () => {
    expect(existsSync('docs/ecosystem/plugin-catalog.md')).toBe(true);
    expect(existsSync('docs/ecosystem/public-benchmarks.md')).toBe(true);
    expect(existsSync('examples/plugins/analytics-beacon/src/index.js')).toBe(true);

    const catalog = readFileSync('docs/ecosystem/plugin-catalog.md', 'utf8');
    const benchmarks = readFileSync('docs/ecosystem/public-benchmarks.md', 'utf8');
    const analyticsPlugin = readFileSync('examples/plugins/analytics-beacon/src/index.js', 'utf8');
    const tutorials = readFileSync('website/tutorials/index.html', 'utf8');

    expect(catalog).toContain('@omnicore/plugin-wechat-monetization');
    expect(catalog).toContain('examples/plugins/analytics-beacon');
    expect(catalog).toContain('review checklist');
    expect(benchmarks).toContain('benchmark:ci');
    expect(benchmarks).toContain('performance:budget');
    expect(benchmarks).toContain('device baseline');
    expect(analyticsPlugin).toContain('install(context');
    expect(analyticsPlugin).toContain('track');
    expect(tutorials).toContain('data-ecosystem-learning-path');
  });
});
