import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public adoption readiness layer', () => {
  it('ships a complete official arcade survivor template for first-time users', () => {
    const root = 'examples/official-templates/arcade-survivor';
    const main = readFileSync(`${root}/src/main.js`, 'utf8');
    const readme = readFileSync(`${root}/README.md`, 'utf8');
    const manifest = JSON.parse(readFileSync(`${root}/omnicore.template.json`, 'utf8'));

    expect(existsSync(`${root}/index.html`)).toBe(true);
    expect(existsSync(`${root}/package.json`)).toBe(true);
    expect(main).toContain('new OmniCore.Game');
    expect(main).toContain('new OmniCore.Scene');
    expect(main).toContain('new OmniCore.Sprite');
    expect(main).toContain('OmniCore.Tween');
    expect(main).toContain('restartGame');
    expect(readme).toContain('10 minute complete game');
    expect(manifest).toMatchObject({
      id: 'arcade-survivor',
      category: 'complete-game'
    });
  });

  it('turns the website playground into an API playground with crash export', () => {
    const playground = readFileSync('website/playground/index.html', 'utf8');

    expect(playground).toContain('data-api-playground');
    expect(playground).toContain('API Reference');
    expect(playground).toContain('Sprite quickstart');
    expect(playground).toContain('Tween motion');
    expect(playground).toContain('Crash export');
    expect(playground).toContain('downloadCrashBundle');
    expect(playground).toContain('CrashHandler');
    expect(playground).toContain('data-compatibility-matrix');
  });

  it('documents compatibility, real-device capture, and public links', () => {
    const compatibility = readFileSync('docs/platforms/compatibility-matrix.md', 'utf8');
    const captureGuide = readFileSync('docs/performance/real-device-capture-guide.md', 'utf8');
    const readme = readFileSync('README.md', 'utf8');
    const website = readFileSync('website/index.html', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(compatibility).toContain('Chrome');
    expect(compatibility).toContain('Safari');
    expect(compatibility).toContain('Android WebView');
    expect(compatibility).toContain('WeChat WebView');
    expect(captureGuide).toContain('144Hz');
    expect(captureGuide).toContain('Android 120Hz');
    expect(captureGuide).toContain('WeChat');
    expect(readme).toContain('examples/official-templates/arcade-survivor');
    expect(readme).toContain('docs/platforms/compatibility-matrix.md');
    expect(website).toContain('arcade-survivor');
    expect(website).toContain('Compatibility Matrix');
    expect(packageJson.files).toEqual(expect.arrayContaining([
      'docs/platforms/compatibility-matrix.md',
      'docs/performance/real-device-capture-guide.md'
    ]));
  });

  it('provides a non-publishing release platform readiness check', async () => {
    const { createReleasePlatformReadinessReport } = await import('../scripts/release-platform-check.js');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const report = createReleasePlatformReadinessReport({
      generatedAt: '2026-06-21T00:00:00.000Z',
      distExists: true,
      publishDryRunOk: true,
      github: { authenticated: true, user: 'wwu79090-png' },
      npm: { authenticated: true, user: 'shalu', packageAvailable: true },
      vercel: { authenticated: true, user: 'shalu', projectLinked: true }
    });

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual(expect.arrayContaining([
      'github-auth',
      'npm-auth',
      'npm-package-availability',
      'vercel-auth',
      'dist-artifact',
      'publish-dry-run'
    ]));
    expect(report.nextActions).toContain('npm publish --access public');
    expect(report.nextActions).toContain('vercel --prod');
    expect(packageJson.scripts).toMatchObject({
      'release:platform-check': 'node scripts/release-platform-check.js'
    });
  });
});
