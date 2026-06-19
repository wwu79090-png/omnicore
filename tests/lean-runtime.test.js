import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('lean microkernel runtime and developer tooling', () => {
  const cleanup = [];

  afterEach(() => {
    cleanup.splice(0).forEach((target) => rmSync(target, { recursive: true, force: true }));
  });

  it('exposes Bootstrap/EventBus/Store as lean Core and registers six addons', async () => {
    const { Core, Addons, createLeanRuntime } = await import('../src/lean/index.js');
    expect(Object.keys(Core).sort()).toEqual(['Bootstrap', 'EventBus', 'Store']);
    expect(Object.keys(Addons).sort()).toEqual([
      'Audio',
      'DevTools',
      'Input',
      'Physics',
      'Renderer',
      'Resources',
      'Scene',
      'Storage'
    ]);

    const runtime = await createLeanRuntime({ renderer: { backend: 'canvas' }, debug: true });
    expect(runtime.core.store.get('omnicore:platform')).toBe('web');
    expect(runtime.addons.renderer.backend).toBe('canvas');
    expect(typeof runtime.addons.physics.rectIntersects).toBe('function');
    runtime.destroy();
  });

  it('Store supports watch, snapshot, version migration, and emergency repair', async () => {
    const { Store } = await import('../src/lean/core/Store.js');
    const seen = [];
    const store = new Store({
      version: '2.0.0',
      initialState: { fragmentCount: 3 },
      migrations: {
        '1.0.0->2.0.0': (snapshot) => ({ ...snapshot, migrated: true })
      },
      emergencyPatch: {
        fragmentCount: { min: 0, max: 99, fallback: 0 }
      }
    });

    store.watch('fragmentCount', (value) => seen.push(value));
    store.set('fragmentCount', 200);
    expect(seen).toContain(0);
    expect(store.get('fragmentCount')).toBe(0);

    const migrated = store.migrate({ version: '1.0.0', state: { hp: 10 } });

    expect(store.snapshot().version).toBe('2.0.0');
    expect(migrated.state.migrated).toBe(true);
    expect(migrated.backup.state.hp).toBe(10);
  });

  it('Store migration notifies watchers for changed keys', async () => {
    const { Store } = await import('../src/lean/core/Store.js');
    const seen = [];
    const store = new Store({ version: '2.0.0', initialState: { hp: 1 } });
    store.watch('hp', (value) => seen.push(value));

    store.migrate({ version: '1.0.0', state: { hp: 10 } });

    expect(seen).toEqual([10]);
  });

  it('make generator creates scene and component templates', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'omnicore-make-'));
    cleanup.push(temp);
    execFileSync(process.execPath, [path.resolve('scripts/make.js'), 'scene', 'BattleScene'], { cwd: temp });
    execFileSync(process.execPath, [path.resolve('scripts/make.js'), 'component', 'HealthBar'], { cwd: temp });

    expect(readFileSync(path.join(temp, 'src/scenes/BattleScene.js'), 'utf8')).toContain('mount(context)');
    expect(readFileSync(path.join(temp, 'src/components/HealthBar.js'), 'utf8')).toContain('unmount(context)');
  });

  it('generate-icons creates platform icon outputs from logo input', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'omnicore-icons-'));
    cleanup.push(temp);
    execFileSync(process.execPath, [
      path.resolve('scripts/generate-icons.js'),
      '--input',
      path.resolve('assets/branding/logo-highres.png'),
      '--out',
      temp
    ]);

    expect(existsSync(path.join(temp, 'web/favicon.png'))).toBe(true);
    expect(existsSync(path.join(temp, 'web/icon-192.png'))).toBe(true);
    expect(existsSync(path.join(temp, 'wechat/icon.png'))).toBe(true);
    expect(existsSync(path.join(temp, 'electron/icon-512.png'))).toBe(true);
    expect(readPngSize(path.join(temp, 'web/icon-192.png'))).toEqual({ width: 192, height: 192 });
    expect(readPngSize(path.join(temp, 'electron/icon-512.png'))).toEqual({ width: 512, height: 512 });
  });

  it('launcher and publish-local scripts are directly callable', async () => {
    expect(existsSync(path.resolve('launcher.js'))).toBe(true);
    expect(existsSync(path.resolve('OmniCore_Dev_Launcher.bat'))).toBe(true);
    expect(existsSync(path.resolve('OmniCore_Dev_Launcher.command'))).toBe(true);

    const child = spawn(process.execPath, [path.resolve('scripts/publish-local.js'), '--port', '0', '--once'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const output = await new Promise((resolve, reject) => {
      let text = '';
      child.stdout.on('data', (chunk) => {
        text += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        text += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', () => resolve(text));
    });
    expect(output).toContain('/publish');
    expect(output).toContain('QRCode');
  });

  it('replaces HMR sockets and reports malformed payloads without throwing', async () => {
    const { ResourcesAddon } = await import('../src/lean/addons/Resources.js');
    const emitted = [];

    class FakeSocket {
      constructor(url) {
        this.url = url;
        this.close = vi.fn();
        this.listeners = new Map();
      }

      addEventListener(type, handler) {
        this.listeners.set(type, handler);
      }

      message(data) {
        this.listeners.get('message')?.({ data });
      }
    }

    const resources = new ResourcesAddon();
    resources.mount({ bus: { emit: (event, payload) => emitted.push([event, payload]) } });
    const first = resources.connectHMR('ws://one', FakeSocket);
    const second = resources.connectHMR('ws://two', FakeSocket);

    expect(first.close).toHaveBeenCalledTimes(1);
    second.message('{"type":"reload"}');
    expect(() => second.message('not json')).not.toThrow();
    expect(emitted[0]).toEqual(['resources:hmr', { type: 'reload' }]);
    expect(emitted[1][0]).toBe('resources:hmr:error');
  });

  it('ResourcesAddon treats non-ok HTTP responses as missing assets', async () => {
    const { ResourcesAddon } = await import('../src/lean/addons/Resources.js');
    const resources = new ResourcesAddon({
      fetcher: async () => ({
        ok: false,
        status: 404,
        text: async () => 'not found',
        json: async () => ({})
      })
    });

    const bundle = await resources.loadBundle([{ key: 'hero', url: '/missing.png' }]);

    expect(bundle.hero.missing).toBe(true);
    expect(bundle.hero.error).toContain('HTTP 404');
  });

  it('InputAddon binds keyboard events to the bootstrap window instead of the global window', async () => {
    const { InputAddon } = await import('../src/lean/addons/Input.js');
    const fakeWindow = new EventTarget();
    const input = new InputAddon();
    const actions = [];
    input.mapAction('jump', ['Space']);
    input.on('action', (event) => actions.push(event.detail));
    input.mount({
      window: fakeWindow,
      document: { body: new EventTarget() }
    });

    fakeWindow.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));

    expect(input.isDown('Space')).toBe(true);
    expect(actions).toEqual([{ name: 'jump', down: true, code: 'Space' }]);
    input.unmount();
  });

  it('RendererAddon uses global PIXI when Pixi backend is available', async () => {
    const { RendererAddon } = await import('../src/lean/addons/Renderer.js');
    const added = [];
    class FakeApplication {
      constructor(options) {
        this.options = options;
        this.stage = { addChild: (child) => added.push(child) };
        this.view = options.view;
      }
    }
    class FakeGraphics {
      rect() { return this; }

      fill() { return this; }
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: (type) => (type === 'webgl' ? {} : null),
      remove() {}
    };
    const renderer = new RendererAddon({ backend: 'pixi' });
    await renderer.mount({
      document: { body: { appendChild() {} } },
      store: { set() {} }
    }, {
      canvas,
      PIXI: {
        Application: FakeApplication,
        Graphics: FakeGraphics
      }
    });
    renderer.drawRect({ x: 1, y: 2, width: 3, height: 4 });

    expect(renderer.backend).toBe('pixi');
    expect(renderer.app).toBeInstanceOf(FakeApplication);
    expect(added[0]).toBeInstanceOf(FakeGraphics);
  });

  it('OmniCore.Genealogy returns build watermark metadata', async () => {
    const OmniCore = (await import('../src/index.js')).default;
    const genealogy = OmniCore.Genealogy();
    expect(genealogy.engine).toBe('OmniCore');
    expect(genealogy.author).toContain('OmniCore');
    expect(genealogy.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T/);
  }, 60000);
});

function readPngSize(file) {
  const buffer = readFileSync(file);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}
