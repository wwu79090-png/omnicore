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
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import OmniCore, { Error as OmniErrorTools } from '../src/index.js';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

describe('engineering completeness surface', () => {
  const temps = [];

  afterEach(() => {
    while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
  });

  it('generates a runnable rpg-mini starter with a basic 2D scene', () => {
    const root = tempDir('omnicore-create-app-');
    execFileSync(process.execPath, [
      path.resolve('scripts/create-omnicore-app.mjs'),
      'starter-rpg',
      '--template',
      'rpg-mini'
    ], { cwd: root, encoding: 'utf8' });

    const project = path.join(root, 'starter-rpg');
    const main = readFileSync(path.join(project, 'src/main.js'), 'utf8');

    expect(existsSync(path.join(project, 'package.json'))).toBe(true);
    expect(existsSync(path.join(project, 'assets/sprites/default/default-atlas.json'))).toBe(true);
    expect(main).toContain('class RpgScene extends Scene');
    expect(main).toContain("new Sprite('grass'");
    expect(main).toContain("new Sprite('player'");
    expect(main).toContain("new Sprite('npc'");
    expect(main).toContain('new OmniCore.Game');
  });

  it('wires docs:build to generate a JSDoc-backed HTML documentation site', () => {
    expect(packageJson.scripts['docs:build']).toBe('node scripts/build-docs-site.js --out docs/api');

    const root = tempDir('omnicore-docs-site-');
    const outDir = path.join(root, 'api-site');
    execFileSync(process.execPath, [
      path.resolve('scripts/build-docs-site.js'),
      '--out',
      outDir
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
    const manifest = JSON.parse(readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('OmniCore API');
    expect(html).toContain('JSDoc');
    expect(manifest.modules.length).toBeGreaterThan(25);
    expect(manifest.modules.some((module) => module.path === 'core/OmniError.js')).toBe(true);
  });

  it('exposes OmniCore.Error as a Chinese friendly interception layer', () => {
    const original = new TypeError("Cannot read properties of undefined (reading 'add')");
    const friendly = OmniCore.Error.from(original, { module: 'Scene', phase: 'update' });

    expect(OmniCore.Error).toBe(OmniErrorTools);
    expect(friendly.message).toContain('对象未初始化');
    expect(friendly.userMessage).toContain('请确认');
    expect(friendly.cause).toBe(original);
    expect(OmniCore.Error.capture(() => {
      throw new Error('Failed to fetch');
    }, { module: 'Loader', fallback: 'placeholder' })).toBe('placeholder');
  });

  it('provides npm run migrate for rewriting deprecated APIs in old projects', () => {
    expect(packageJson.scripts.migrate).toBe('node scripts/omni-migrate.js --write');

    const root = tempDir('omnicore-migrate-script-');
    const src = path.join(root, 'src');
    const report = path.join(root, 'migration-report.md');
    mkdirSync(src, { recursive: true });
    const file = path.join(src, 'game.js');
    writeFileSync(file, [
      'const game = new OmniCore.Game({ debug: true });',
      "Store.set('player.hp', 10);",
      "OmniCore.Storage.read('slot1');",
      "OmniCore.Storage.write('slot1', data);"
    ].join('\n'));

    const npm = resolveNpm(['run', 'migrate', '--', '--root', root, '--report', report]);
    execFileSync(npm.command, npm.args, {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const migrated = readFileSync(file, 'utf8');
    expect(migrated).toContain('OmniCore.createGame({ debug: true })');
    expect(migrated).toContain("Store.setValue('player.hp', 10)");
    expect(migrated).toContain("OmniCore.Storage.get('slot1')");
    expect(migrated).toContain("OmniCore.Storage.set('slot1', data)");
    expect(readFileSync(report, 'utf8')).toContain('| `OmniCore.Storage.read` |');
  });

  it('registers npx omni-doctor and reports dependency, environment, and resource health', async () => {
    expect(packageJson.bin['omni-doctor']).toBe('./scripts/engine-doctor.js');

    const { createEngineDoctorReport, writeEngineDoctorMarkdown } = await import(
      pathToFileURL(path.resolve('scripts/engine-doctor.js')).href
    );
    const root = tempDir('omnicore-doctor-health-');
    mkdirSync(path.join(root, 'assets/sprites/default'), { recursive: true });
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      scripts: { build: 'vite build', test: 'vitest run' },
      dependencies: { omnicore: '^1.0.0' },
      devDependencies: { vite: '^8.0.16' }
    }, null, 2));
    writeFileSync(path.join(root, 'asset-manifest.json'), JSON.stringify({
      assets: [{ key: 'hero', type: 'image', url: 'assets/sprites/default/hero.svg' }]
    }, null, 2));
    writeFileSync(path.join(root, 'assets/sprites/default/hero.svg'), '<svg></svg>\n');

    const report = createEngineDoctorReport({ projectRoot: root, generatedAt: '2026-06-20T00:00:00.000Z' });
    const markdown = writeEngineDoctorMarkdown(report);

    expect(report.health.dependencies).toMatchObject({ ok: true, dependencyCount: 1, devDependencyCount: 1 });
    expect(report.health.environment).toMatchObject({ ok: true, node: expect.any(String), platform: expect.any(String) });
    expect(report.health.resources).toMatchObject({ ok: true, assetFiles: 1, missing: [] });
    expect(markdown).toContain('## Health Report');
    expect(markdown).toContain('dependencies');
    expect(markdown).toContain('environment');
    expect(markdown).toContain('resources');
  });

  function tempDir(prefix) {
    const dir = mkdtempSync(path.join(tmpdir(), prefix));
    temps.push(dir);
    return dir;
  }
});

function resolveNpm(args) {
  if (process.platform !== 'win32') return { command: 'npm', args };
  const escaped = args.map((arg) => (/\s/u.test(arg) ? `"${arg.replace(/"/gu, '\\"')}"` : arg));
  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', ['npm.cmd', ...escaped].join(' ')]
  };
}
