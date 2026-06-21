import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import OmniCore, { CrashHandler, Hook, Plugin } from '../src/index.js';

describe('OmniCore engineering and ecosystem foundation', () => {
  it('creates an RPG starter through create-omnicore-app', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'omnicore-create-'));
    try {
      execFileSync(process.execPath, [
        path.resolve('scripts/create-omnicore-app.mjs'),
        'guild-demo',
        '--template',
        'rpg'
      ], { cwd: root, stdio: 'pipe' });

      const appRoot = path.join(root, 'guild-demo');
      const pkg = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
      const main = readFileSync(path.join(appRoot, 'src/main.js'), 'utf8');

      expect(pkg.dependencies.omnicore).toBeDefined();
      expect(main).toContain('class RpgScene');
      expect(main).toContain('template:rpg:inventory');
      expect(existsSync(path.join(appRoot, 'assets/sprites/default/default-atlas.json'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('ships a complete VS Code extension project with snippets and debug configuration', () => {
    const extensionRoot = path.resolve('tools/vscode-omnicore');
    const manifest = JSON.parse(readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));
    const snippets = readFileSync(path.join(extensionRoot, 'snippets/omnicore.code-snippets'), 'utf8');
    const launch = JSON.parse(readFileSync(path.join(extensionRoot, '.vscode/launch.json'), 'utf8'));

    expect(manifest.name).toBe('vscode-omnicore');
    expect(manifest.engines.vscode).toBeDefined();
    expect(manifest.contributes.snippets[0].path).toBe('./snippets/omnicore.code-snippets');
    expect(manifest.contributes.debuggers[0].type).toBe('omnicore');
    expect(snippets).toContain('OmniCore Game');
    expect(snippets).toContain('OmniCore Scene');
    expect(launch.configurations.some((config) => config.type === 'chrome' || config.type === 'pwa-chrome')).toBe(true);
  });

  it('defines build-time declaration output for npm consumers', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const buildScript = readFileSync('scripts/build.js', 'utf8');

    expect(pkg.types).toBe('dist/omnicore.d.ts');
    expect(pkg.exports['.'].types).toBe('./dist/omnicore.d.ts');
    expect(buildScript).toContain('generateTypeDeclarations');
  });

  it('documents the mainland China npm mirror command in README', () => {
    const readme = readFileSync('README.md', 'utf8');

    expect(readme).toContain('npm config set registry https://registry.npmmirror.com/');
    expect(readme).toContain('中国大陆网络环境');
  });

  it('exposes Hook and Plugin interfaces for external extensions', async () => {
    const hook = new Hook();
    const received = [];
    const off = hook.on('game:init', (payload) => received.push(payload.id));
    hook.emit('game:init', { id: 'boot' });
    off();
    hook.emit('game:init', { id: 'ignored' });

    const plugin = Plugin.create({
      name: 'test-plugin',
      install(api) {
        api.Hook.emit('plugin:installed', { name: 'test-plugin' });
      }
    });
    const pluginEvents = [];
    OmniCore.Hook.on('plugin:installed', (event) => pluginEvents.push(event.name));
    await OmniCore.Plugin.use(plugin, OmniCore);

    expect(received).toEqual(['boot']);
    expect(Plugin.isPlugin(plugin)).toBe(true);
    expect(pluginEvents).toContain('test-plugin');
    expect(OmniCore.Plugin.has('test-plugin')).toBe(true);
  });

  it('captures fatal errors into a diagnostic report through CrashHandler', () => {
    const handler = new CrashHandler({
      game: { config: { debug: true }, scene: { current: { name: 'battle' } } },
      store: { snapshot: () => ({ player: { hp: 12 } }) },
      metrics: { snapshot: () => ({ fps: 58 }) }
    });
    const report = handler.capture(new Error('fatal boom'), { phase: 'update' });

    expect(report.id).toMatch(/^crash_/);
    expect(report.error.message).toBe('fatal boom');
    expect(report.scene.name).toBe('battle');
    expect(report.store.player.hp).toBe(12);
    expect(report.metrics.fps).toBe(58);
    expect(report.context.phase).toBe('update');
    expect(report.runtime.userAgent).toBeDefined();
  });

  it('exports a complete reproduction bundle from CrashHandler reports', () => {
    const handler = new CrashHandler({
      game: {
        config: { debug: true, renderer: 'canvas' },
        scene: {
          current: {
            name: 'battle',
            children: [
              { id: 'hero', type: 'sprite', texture: 'hero.png', x: 40, y: 96, zIndex: 1 },
              { id: 'hud', type: 'node', layer: 'ui', x: 0, y: 0, zIndex: 10 }
            ]
          }
        }
      },
      store: { snapshot: () => ({ player: { hp: 12 } }) },
      metrics: { snapshot: () => ({ fps: 58 }) }
    });

    const bundle = handler.captureReproduction(new Error('render boom'), { phase: 'render' }, {
      assetManifest: {
        assets: [{ key: 'hero.png', type: 'image', hash: 'hero-hash' }]
      },
      inputs: [{ code: 'Space', time: 12 }]
    });

    expect(bundle).toMatchObject({
      schema: 'omnicore.reproduction-bundle.v1',
      crash: expect.objectContaining({
        error: expect.objectContaining({ message: 'render boom' }),
        context: { phase: 'render' }
      }),
      sceneDocument: expect.objectContaining({
        schema: 'omnicore.scene-document.v1',
        name: 'battle'
      }),
      dependencies: expect.objectContaining({
        images: ['hero.png']
      }),
      assetManifest: expect.objectContaining({
        assets: [expect.objectContaining({ key: 'hero.png' })]
      }),
      inputs: [{ code: 'Space', time: 12 }],
      renderSnapshot: expect.objectContaining({
        schema: 'omnicore.render-queue-snapshot.v1',
        order: ['hero', 'hud']
      }),
      store: { player: { hp: 12 } },
      metrics: { fps: 58 }
    });
    expect(handler.latestReproduction()).toEqual(bundle);
  });
});
