import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import CrashReporter from '../src/debug/CrashReporter.js';
import {
  auditDeprecatedApis,
  updateReadmeDeprecatedPlan
} from '../scripts/audit-deprecated.js';
import { evaluateDependabotAutomerge } from '../scripts/dependabot-automerge.js';

describe('release automation workflows', () => {
  it('publishes tagged releases to npm after tests, build, docs build, changelog, and GitHub Release creation', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');

    expect(workflow).not.toContain('branches: [main]');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("startsWith(github.ref, 'refs/tags/v')");
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('npm run docs:build');
    expect(workflow).toContain('standard-version');
    expect(workflow).toContain('deps(security): auto-merge dependabot patch');
    expect(workflow).toContain('npm version patch');
    expect(workflow).toContain('npm publish --access public');
    expect(workflow).toContain('softprops/action-gh-release');
    expect(workflow).toContain('NODE_AUTH_TOKEN');
  });

  it('gates PRs with persisted main benchmark data and uploads regression reports', () => {
    const workflow = readFileSync('.github/workflows/benchmark.yml', 'utf8');

    expect(workflow).toContain('pull_request');
    expect(workflow).toContain('npm run benchmark');
    expect(workflow).toContain('stored-benchmark.json');
    expect(workflow).toContain('npm run benchmark:ci');
    expect(workflow).toContain('--threshold 0.05');
    expect(workflow).toContain('actions/upload-artifact');
    expect(workflow).toContain('performance-regression-report.md');
  });

  it('configures weekly Dependabot checks plus guarded high-severity non-breaking auto-merge', () => {
    const config = readFileSync('.github/dependabot.yml', 'utf8');
    const workflow = readFileSync('.github/workflows/dependabot-automerge.yml', 'utf8');

    expect(config).toContain('package-ecosystem: "npm"');
    expect(config).toContain('interval: "weekly"');
    expect(config).toContain('open-pull-requests-limit');
    expect(workflow).toContain('npm audit --json');
    expect(workflow).toContain('scripts/dependabot-automerge.js');
    expect(workflow).toContain('gh pr merge');
    expect(workflow).toContain('deps(security): auto-merge dependabot patch');
    expect(workflow).toContain('eligible == \'true\'');
  });

  it('keeps docs generation and deprecated API audit wired into npm lifecycle and docs sync PRs', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const workflow = readFileSync('.github/workflows/docs-sync.yml', 'utf8');

    expect(packageJson.scripts['docs:generate']).toBe('node scripts/generate-api-docs.js --out docs/api');
    expect(packageJson.scripts['docs:build']).toBe('npm run docs:generate && npm run docs:api');
    expect(packageJson.scripts.prepare).toContain('npm run docs:generate');
    expect(packageJson.scripts.prebuild).toContain('npm run audit:deprecated');
    expect(workflow).toContain('docs/api');
    expect(workflow).toContain('更新文档');
    expect(workflow).toContain('peter-evans/create-pull-request');
  });

  it('keeps branch pushes green for release-only workflows with explicit no-op guards', () => {
    const docsSync = readFileSync('.github/workflows/docs-sync.yml', 'utf8');
    const release = readFileSync('.github/workflows/release.yml', 'utf8');
    const expressionOpen = '${{';

    expect(docsSync).not.toContain('branches: [main]');
    expect(docsSync).toContain('push:');
    expect(docsSync).toContain('branch-guard');
    expect(docsSync).toContain(`${expressionOpen} github.ref != 'refs/heads/main' }}`);
    expect(docsSync).toContain('No docs sync work for this branch');
    expect(release).not.toContain('branches: [main]');
    expect(release).toContain('push:');
    expect(release).toContain('branch-guard');
    expect(release).toContain(`${expressionOpen} github.ref != 'refs/heads/main' && !startsWith(github.ref, 'refs/tags/v') }}`);
    expect(release).toContain('No release work for this branch');
  });
});

describe('release automation scripts', () => {
  it('allows Dependabot auto-merge only for high-severity non-breaking security updates', () => {
    const audit = {
      vulnerabilities: {
        vite: { severity: 'high' },
        debug: { severity: 'moderate' }
      }
    };
    const patchEvent = {
      pull_request: {
        user: { login: 'dependabot[bot]' },
        title: 'Bump vite from 8.0.0 to 8.0.1',
        labels: [{ name: 'dependencies' }, { name: 'semver-patch' }]
      }
    };
    const majorEvent = {
      pull_request: {
        user: { login: 'dependabot[bot]' },
        title: 'Bump vite from 8.0.0 to 9.0.0',
        labels: [{ name: 'dependencies' }, { name: 'semver-major' }]
      }
    };

    expect(evaluateDependabotAutomerge({ audit, event: patchEvent })).toMatchObject({
      eligible: true,
      hasHighSeverity: true,
      nonBreaking: true
    });
    expect(evaluateDependabotAutomerge({ audit, event: majorEvent })).toMatchObject({
      eligible: false,
      nonBreaking: false
    });
    expect(evaluateDependabotAutomerge({ audit: { vulnerabilities: {} }, event: patchEvent }).eligible).toBe(false);
  });

  it('scans JSDoc deprecated APIs and refreshes README migration plan table', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-deprecated-'));
    const srcDir = path.join(root, 'src');
    const readmePath = path.join(root, 'README.md');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(path.join(srcDir, 'legacy.js'), `
/**
 * @deprecated Use newThing instead.
 * @replacement newThing
 * @removeIn 2.0.0
 */
export function oldThing() {
  return 'old';
}

export function caller() {
  return oldThing();
}
`);
    writeFileSync(readmePath, '# OmniCore\n');

    try {
      const audit = await auditDeprecatedApis({ root, srcDir, scanDirs: [srcDir] });
      await updateReadmeDeprecatedPlan({ readmePath, entries: audit.entries });
      const readme = readFileSync(readmePath, 'utf8');

      expect(audit.entries).toEqual([
        expect.objectContaining({
          api: 'oldThing',
          replacement: 'newThing',
          removeIn: '2.0.0',
          callCount: 1
        })
      ]);
      expect(readme).toContain('## 废弃API迁移计划表');
      expect(readme).toContain('oldThing');
      expect(readme).toContain('newThing');
      expect(readme).toContain('2.0.0');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('CrashReporter telemetry automation', () => {
  it('stays disabled by default and enables telemetry from config or environment', async () => {
    const posted = [];
    const disabled = new CrashReporter({
      fetcher: async (url, options) => posted.push({ url, options })
    });

    await disabled.capture(new Error('off'));
    expect(disabled.enabled).toBe(false);
    expect(posted).toEqual([]);

    const reporter = new CrashReporter({
      env: {
        OMNICORE_TELEMETRY_ENABLED: 'true',
        OMNICORE_CRASH_WEBHOOK: '/crash-hook'
      },
      store: { snapshot: () => ({ level: 3 }) },
      scene: { current: { name: 'Code Awakener' } },
      metrics: { snapshot: () => ({ fps: 60 }) },
      device: {
        userAgent: 'vitest-agent',
        platform: 'test-os',
        deviceMemory: 8
      },
      fetcher: async (url, options) => {
        posted.push({ url, body: JSON.parse(options.body), signal: options.signal });
        return { ok: true };
      }
    });

    await reporter.capture(new Error('boom'));

    expect(reporter.enabled).toBe(true);
    expect(reporter.timeoutMs).toBe(60000);
    expect(posted[0].url).toBe('/crash-hook');
    expect(posted[0].signal).toBeDefined();
    expect(posted[0].body.store).toEqual({ level: 3 });
    expect(posted[0].body.scene).toEqual({ name: 'Code Awakener' });
    expect(posted[0].body.device).toMatchObject({
      userAgent: 'vitest-agent',
      platform: 'test-os',
      deviceMemory: 8
    });
  });
});
