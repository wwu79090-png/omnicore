import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createReleaseReadinessReport,
  probeHtmlTarget,
  probeNpmRegistry
} from '../scripts/release-readiness.js';

describe('release readiness gate', () => {
  it('accepts dist-based package entrypoints and separates external publication gaps', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const readme = readFileSync('README.md', 'utf8');
    const report = createReleaseReadinessReport({
      packageJson,
      readme,
      releaseWorkflow: workflow,
      distEntry: { exists: existsSync('dist/omnicore.esm.js'), size: 928553 },
      env: {
        NODE_AUTH_TOKEN: 'npm-token',
        VERCEL_TOKEN: 'vercel-token'
      },
      publicTargets: {
        npmRegistry: { status: 'not-published', url: 'https://registry.npmjs.org/omnicore' },
        vercel: { ok: false, status: 'wrong-site', title: 'OmniCore Digital' },
        githubPages: { ok: false, status: 'http-404' },
        latestRelease: { targetCommitish: 'old', url: 'https://github.com/wwu79090-png/omnicore/releases/tag/v1.0.0-product-launch' }
      },
      currentCommit: 'new',
      generatedAt: '2026-06-21T00:00:00.000Z'
    });

    expect(packageJson.main).toBe('dist/omnicore.esm.js');
    expect(packageJson.module).toBe('dist/omnicore.esm.js');
    expect(packageJson.exports['.'].import).toBe('./dist/omnicore.esm.js');
    expect(packageJson.exports['./src']).toBe('./src/index.js');
    expect(packageJson.scripts['release:readiness']).toBe('node scripts/release-readiness.js');
    expect(workflow.indexOf('npm run release:readiness')).toBeLessThan(workflow.indexOf('npm publish --access public'));
    expect(report.ok).toBe(true);
    expect(report.publicReleaseReady).toBe(false);
    expect(report.blockers).toEqual([]);
    expect(report.credentialGaps).toEqual([]);
    expect(report.externalGaps.map((gate) => gate.id)).toEqual(expect.arrayContaining([
      'npm-registry-publication',
      'vercel-homepage-sane',
      'github-pages-enabled',
      'latest-release-targets-head'
    ]));
  });

  it('flags local blockers and missing credentials before strict publication', () => {
    const report = createReleaseReadinessReport({
      packageJson: {
        main: 'src/index.js',
        module: 'src/index.js',
        exports: { '.': { import: './src/index.js' } },
        scripts: {}
      },
      readme: '590/590 passed and 730.71 kB',
      releaseWorkflow: 'npm publish --access public',
      distEntry: { exists: false, size: 0 },
      env: {},
      publicTargets: {}
    });

    expect(report.ok).toBe(false);
    expect(report.blockers.map((gate) => gate.id)).toEqual(expect.arrayContaining([
      'dist-entrypoint-main',
      'dist-entrypoint-module',
      'dist-entrypoint-export',
      'dist-artifact-present',
      'readme-no-stale-metrics',
      'release-readiness-script',
      'release-workflow-readiness-before-publish'
    ]));
    expect(report.credentialGaps.map((gate) => gate.id)).toEqual([
      'npm-auth-token-present',
      'vercel-token-present'
    ]);
  });

  it('classifies npm and homepage probes without hitting the network in tests', async () => {
    const published = await probeNpmRegistry(async () => ({
      status: 200,
      text: async () => JSON.stringify({ 'dist-tags': { latest: '1.0.0' } })
    }));
    const missing = await probeNpmRegistry(async () => ({
      status: 404,
      text: async () => ''
    }));
    const homepage = await probeHtmlTarget('https://example.test', undefined, async () => ({
      status: 200,
      text: async () => '<title>OmniCore v1.0.0</title><p>2D-first web game engine with PixiJS rendering</p>'
    }));
    const wrongSite = await probeHtmlTarget('https://example.test', undefined, async () => ({
      status: 200,
      text: async () => '<title>OmniCore Digital | Next-Gen Digital Banking & Fintech Solutions</title>'
    }));

    expect(published).toMatchObject({ ok: true, status: 'published', version: '1.0.0' });
    expect(missing).toMatchObject({ ok: false, status: 'not-published' });
    expect(homepage).toMatchObject({ ok: true, status: 'engine-homepage' });
    expect(wrongSite).toMatchObject({ ok: false, status: 'wrong-site' });
  });
});
