import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';

const tempRoots = [];

function makeTempRoot(prefix) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

describe('OmniCore full stack phase 4 desktop editor packaging', () => {
  afterEach(() => {
    while (tempRoots.length) rmSync(tempRoots.pop(), { recursive: true, force: true });
  });

  it('emits an auditable desktop package manifest in dry-run mode', () => {
    const out = makeTempRoot('omnicore-editor-package-');
    const output = execFileSync(process.execPath, [
      path.resolve('packages/omnicore-editor/scripts/package-desktop.cjs'),
      '--dry-run',
      '--out',
      out,
      '--platform',
      'win32'
    ], { cwd: process.cwd(), encoding: 'utf8' });
    const manifestPath = path.join(out, 'desktop-package-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(output).toContain('desktop-package-manifest.json');
    expect(manifest).toMatchObject({
      productName: 'OmniCore Editor',
      platform: 'win32',
      artifactName: 'omnicore-editor-win32-x64',
      executable: 'omnicore-editor.exe',
      dryRun: true
    });
    expect(manifest.files).toEqual(expect.arrayContaining([
      'dist',
      'electron.main.cjs',
      'preload.cjs',
      'package.json'
    ]));
  });
});

describe('OmniCore full stack phase 4 plugin marketplace closure', () => {
  it('ships a runnable WeChat monetization plugin example linked from the market page', () => {
    const root = path.join('examples', 'plugins', 'WechatMiniGameMonetization');
    const market = readFileSync('website/plugins/index.html', 'utf8');

    expect(existsSync(path.join(root, 'package.json'))).toBe(true);
    expect(existsSync(path.join(root, 'README.md'))).toBe(true);
    expect(existsSync(path.join(root, 'src', 'index.js'))).toBe(true);
    expect(existsSync(path.join(root, 'demo', 'index.html'))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).dependencies)
      .toMatchObject({ '@omnicore/plugin-wechat-monetization': 'file:../../../packages/omnicore-plugin-wechat-monetization' });
    expect(readFileSync(path.join(root, 'README.md'), 'utf8')).toContain('Official OmniCore plugin');
    expect(readFileSync(path.join(root, 'demo', 'index.html'), 'utf8')).toContain('data-omnicore-plugin-demo');
    expect(market).toContain('@omnicore/plugin-wechat-monetization');
    expect(market).toContain('examples/plugins/WechatMiniGameMonetization/demo/index.html');
  });

  it('validates marketplace package names, demos, and install snippets', () => {
    const temp = makeTempRoot('omnicore-market-validate-');
    const reportPath = path.join(temp, 'marketplace-validation.json');
    execFileSync(process.execPath, [
      path.resolve('scripts/validate-marketplace-index.js'),
      '--out',
      reportPath
    ], { cwd: process.cwd(), encoding: 'utf8' });
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(report.ok).toBe(true);
    expect(report.plugins).toEqual(expect.arrayContaining([
      expect.objectContaining({
        packageName: '@omnicore/plugin-wechat-monetization',
        demo: 'examples/plugins/WechatMiniGameMonetization/demo/index.html',
        listed: true,
        security: expect.objectContaining({
          ok: true,
          permissions: expect.arrayContaining(['network', 'payment']),
          integrity: expect.objectContaining({
            algorithm: 'sha256',
            matched: true,
            actual: expect.stringMatching(/^[a-f0-9]{64}$/u)
          })
        })
      })
    ]));
    expect(packageJson.scripts['marketplace:validate']).toBe('node scripts/validate-marketplace-index.js');
  });

  it('fails marketplace validation when plugin security metadata is unsafe', () => {
    const temp = makeTempRoot('omnicore-market-unsafe-plugin-');
    const site = path.join(temp, 'website', 'plugins');
    const pkgDir = path.join(temp, 'unsafe-plugin');
    mkdirSync(site, { recursive: true });
    mkdirSync(path.join(pkgDir, 'src'), { recursive: true });
    writeFileSync(path.join(site, 'index.html'), [
      '<code>npm install @omnicore/plugin-unsafe</code>',
      'examples/plugins/plugin-unsafe/demo/index.html'
    ].join('\n'), 'utf8');
    writeFileSync(path.join(pkgDir, 'src', 'index.js'), 'export default {};\n', 'utf8');
    writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({
      name: '@omnicore/plugin-unsafe',
      version: '0.0.1',
      main: 'src/index.js',
      scripts: { postinstall: 'node install.js' },
      keywords: ['omnicore-plugin'],
      omnicorePlugin: {
        permissions: ['network'],
        permissionJustifications: {},
        sha256: 'bad-sha'
      }
    }, null, 2), 'utf8');

    let failed = false;
    try {
      execFileSync(process.execPath, [
        path.resolve('scripts/validate-marketplace-index.js'),
        '--website',
        site,
        '--package',
        path.join(pkgDir, 'package.json')
      ], { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      failed = true;
      expect(error.status).toBe(1);
      expect(String(error.stderr)).toContain('unsafe-plugin-permission');
      expect(String(error.stderr)).toContain('invalid-plugin-sha256');
      expect(String(error.stderr)).toContain('dangerous-plugin-lifecycle-script');
    }
    expect(failed).toBe(true);
  });

  it('fails marketplace validation when a package is listed under the wrong install command', () => {
    const temp = makeTempRoot('omnicore-market-invalid-');
    const site = path.join(temp, 'website', 'plugins');
    mkdirSync(site, { recursive: true });
    writeFileSync(path.join(site, 'index.html'), '<code>npm install @omnicore/wrong</code>', 'utf8');

    let failed = false;
    try {
      execFileSync(process.execPath, [
        path.resolve('scripts/validate-marketplace-index.js'),
        '--website',
        site,
        '--package',
        'packages/omnicore-plugin-wechat-monetization/package.json'
      ], { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      failed = true;
      expect(error.status).toBe(1);
      expect(String(error.stderr)).toContain('missing-marketplace-install');
    }
    expect(failed).toBe(true);
  });
});
