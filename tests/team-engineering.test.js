import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import Store from '../src/store/Store.js';

describe('team engineering baseline', () => {
  it('provides standard team configuration and release scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(existsSync('.commitlintrc.js')).toBe(true);
    expect(existsSync('.eslintrc.js')).toBe(true);
    expect(existsSync('.prettierrc')).toBe(true);
    expect(existsSync('.husky/pre-commit')).toBe(true);
    expect(existsSync('MAINTAINERS.md')).toBe(true);
    expect(existsSync('.github/workflows/benchmark.yml')).toBe(true);
    expect(pkg.scripts['lint:fix']).toContain('eslint -c .eslintrc.json --no-eslintrc');
    expect(pkg.scripts.release).toContain('standard-version');
    expect(pkg.scripts['test:contract']).toBe('node scripts/contract-test.js');
    expect(pkg.scripts['benchmark:ci']).toBe('node scripts/benchmark-threshold.js');
    expect(pkg.devDependencies['standard-version']).toBeTruthy();
    expect(pkg.devDependencies['@commitlint/cli']).toBeTruthy();
    expect(pkg.devDependencies['@commitlint/config-conventional']).toBeTruthy();
    expect(pkg.devDependencies.husky).toBeTruthy();
  });

  it('exposes contract and changelog helper scripts', () => {
    expect(existsSync('scripts/contract-test.js')).toBe(true);
    expect(existsSync('scripts/update-changelog.js')).toBe(true);
    expect(() => execFileSync(process.execPath, ['scripts/contract-test.js', '--dry-run'], { encoding: 'utf8' })).not.toThrow();
    expect(() => execFileSync(process.execPath, ['scripts/update-changelog.js', '--dry-run'], { encoding: 'utf8' })).not.toThrow();
  });

  it('creates a standalone plugin SDK project scaffold', () => {
    const temp = path.join(process.cwd(), 'node_modules/.tmp/omnicore-plugin-sdk-test');
    execFileSync(process.execPath, ['create-omnicore-plugin-sdk/index.mjs', temp, '--name', 'team-addon'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    const pluginPkg = JSON.parse(readFileSync(path.join(temp, 'package.json'), 'utf8'));
    expect(pluginPkg.name).toBe('team-addon');
    expect(pluginPkg.scripts.dev).toBeTruthy();
    expect(pluginPkg.scripts.build).toBeTruthy();
    expect(pluginPkg.scripts.publish).toBeTruthy();
    expect(existsSync(path.join(temp, 'src/index.js'))).toBe(true);
    expect(existsSync(path.join(temp, 'demo/index.html'))).toBe(true);
  });
});

describe('RemoteDevTools and performance metrics', () => {
  it('exports a JSON debug snapshot through a WebSocket-like endpoint', async () => {
    const { default: RemoteDevTools } = await import('../src/debug/RemoteDevTools.js');
    const sent = [];
    const game = {
      store: new Store({ hp: 10 }),
      scene: { current: { name: 'Level1', children: [{ id: 'hero' }, { id: 'npc' }] } },
      renderer: { backend: 'canvas' },
      metrics: { export: () => ({ renderer: [{ duration: 1.2 }] }) }
    };

    const tools = new RemoteDevTools(game, {
      debug: true,
      server: { clients: [{ readyState: 1, send: (message) => sent.push(JSON.parse(message)) }] }
    });

    tools.attach();
    tools.broadcast();

    expect(sent[0].type).toBe('omnicore:state');
    expect(sent[0].payload.store.hp).toBe(10);
    expect(sent[0].payload.scene.entityCount).toBe(2);
    expect(sent[0].payload.renderer.backend).toBe('canvas');
    expect(sent[0].payload.metrics.renderer[0].duration).toBe(1.2);
    tools.detach();
  });

  it('collects renderer and physics timing metrics and exports JSON', async () => {
    const { default: PerformanceMetrics } = await import('../src/debug/PerformanceMetrics.js');
    const PhysicsWorld = (await import('../src/physics/PhysicsWorld.js')).default;
    const PixiRenderer = (await import('../src/renderer/PixiRenderer.js')).default;

    const metrics = new PerformanceMetrics({ enabled: true });
    const renderer = new PixiRenderer({ backend: 'canvas', canvas: document.createElement('canvas'), metrics });
    await renderer.init();
    renderer.renderScene({ children: [] });

    const world = new PhysicsWorld({ metrics });
    const handler = vi.fn();
    const player = { body: { collisionFilter: { category: 2, mask: 4 } } };
    const enemy = { body: { collisionFilter: { category: 4, mask: 2 } } };
    world.onCollision(player, handler);
    world.emitCollision(player.body, enemy.body, player, enemy);

    const exported = JSON.parse(metrics.exportJSON());
    expect(exported.renderer.length).toBeGreaterThan(0);
    expect(exported.physics.length).toBeGreaterThan(0);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
