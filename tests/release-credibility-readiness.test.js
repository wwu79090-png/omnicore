import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('release credibility readiness', () => {
  it('ships GitHub community health files and issue routing', () => {
    const security = readFileSync('SECURITY.md', 'utf8');
    const support = readFileSync('SUPPORT.md', 'utf8');
    const conduct = readFileSync('CODE_OF_CONDUCT.md', 'utf8');
    const issueConfig = readFileSync('.github/ISSUE_TEMPLATE/config.yml', 'utf8');
    const labels = readFileSync('.github/labels.yml', 'utf8');

    expect(security).toContain('Supported Versions');
    expect(security).toContain('Reporting a Vulnerability');
    expect(support).toContain('GitHub Issues');
    expect(support).toContain('QQ 3424636983');
    expect(conduct).toContain('Contributor Covenant');
    expect(issueConfig).toContain('blank_issues_enabled: false');
    expect(labels).toContain('performance');
    expect(labels).toContain('compatibility');
  });

  it('prepares npm provenance, dependency inventory, and release checklist automation', async () => {
    const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const inventoryModule = await importScript('scripts/dependency-inventory.js');
    const checklistModule = await importScript('scripts/release-checklist.js');
    const inventory = inventoryModule.createDependencyInventory({
      generatedAt: '2026-06-21T00:00:00.000Z',
      packageJson,
      lockfile: { packages: {} }
    });
    const checklist = checklistModule.createReleaseChecklistReport({
      generatedAt: '2026-06-21T00:00:00.000Z',
      files: new Set([
        'SECURITY.md',
        'SUPPORT.md',
        'CODE_OF_CONDUCT.md',
        'docs/platforms/compatibility-matrix.md',
        'docs/performance/real-device-capture-guide.md',
        'docs/release-notes/dependency-inventory.json',
        '.github/workflows/release.yml'
      ]),
      releaseWorkflow,
      packageJson,
      publishDryRunOk: true
    });

    expect(releaseWorkflow).toContain('npm publish --provenance --access public');
    expect(releaseWorkflow).toContain('npm run release:deps');
    expect(releaseWorkflow).toContain('npm run release:checklist');
    expect(inventory.format).toBe('OmniCore.DependencyInventory');
    expect(inventory.dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'pixi.js', type: 'dependency' })
    ]));
    expect(checklist.ok).toBe(true);
    expect(checklist.checks.map((check) => check.id)).toEqual(expect.arrayContaining([
      'security-policy',
      'support-policy',
      'code-of-conduct',
      'npm-provenance-workflow',
      'dependency-inventory',
      'real-device-guide'
    ]));
    expect(packageJson.scripts).toMatchObject({
      'release:deps': 'node scripts/dependency-inventory.js',
      'release:checklist': 'node scripts/release-checklist.js'
    });
    expect(packageJson.files).toEqual(expect.arrayContaining([
      'SECURITY.md',
      'SUPPORT.md',
      'CODE_OF_CONDUCT.md'
    ]));
  });

  it('improves conversion copy and playground copying', () => {
    const readme = readFileSync('README.md', 'utf8');
    const playground = readFileSync('website/playground/index.html', 'utf8');
    const website = readFileSync('website/index.html', 'utf8');

    expect(readme).toContain('npm publish --provenance');
    expect(readme).toContain('SECURITY.md');
    expect(readme).toContain('SUPPORT.md');
    expect(playground).toContain('copyCodeSnippet');
    expect(playground).toContain('Copy code');
    expect(website).toContain('Security Policy');
    expect(website).toContain('NPM provenance');
  });
});

function importScript(file) {
  return import(pathToFileURL(path.resolve(file)).href);
}
