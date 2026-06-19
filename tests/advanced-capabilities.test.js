import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, {
  AIImporter,
  Database,
  HotReload,
  Node,
  PrefabManager,
  RendererManager,
  Store,
  Timeline,
  VisualEventGraph,
  WorkerManager
} from '../src/index.js';

describe('advanced OmniCore capabilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('builds a named node tree and instantiates nested prefabs with path overrides', () => {
    const root = new Node({ name: 'Root' });
    const child = new Node({ name: 'Enemy' });
    const weapon = new Node({ name: 'Weapon', props: { damage: 1 } });

    root.addChild(child);
    child.addChild(weapon);

    expect(root.getChild('Enemy')).toBe(child);
    expect(root.getChild('Enemy/Weapon')).toBe(weapon);
    expect(weapon.parent).toBe(child);

    const prefab = PrefabManager.instantiate(
      {
        type: 'node',
        name: 'Root',
        children: [
          {
            type: 'node',
            name: 'Enemy',
            children: [{ type: 'node', name: 'Weapon', props: { damage: 2 } }]
          }
        ]
      },
      0,
      0,
      {},
      {
        'Enemy/Weapon': { props: { damage: 9 }, x: 14 }
      }
    );

    expect(prefab.getChild('Enemy/Weapon').props.damage).toBe(9);
    expect(prefab.getChild('Enemy/Weapon').x).toBe(14);
    expect(prefab.toJSON().children[0].children[0].props.damage).toBe(9);
  });

  it('loads RPG database JSON and resolves records through DB.get(type, id)', async () => {
    const db = new Database({
      fetcher: async (url) => ({
        ok: true,
        json: async () => ({
          potion: { id: 'potion', name: `Potion from ${url}`, price: 30 }
        })
      })
    });

    await db.load({ items: '/items.json' });

    expect(db.get('items', 'potion')).toEqual({
      id: 'potion',
      name: 'Potion from /items.json',
      price: 30
    });
    expect(db.all('items')).toHaveLength(1);
  });

  it('drives target properties and event hooks from timeline JSON', () => {
    const sprite = { x: 0, alpha: 0 };
    const hit = vi.fn();
    const timeline = new Timeline({
      targets: { hero: sprite },
      events: { hit }
    });

    timeline.load({
      duration: 1000,
      tracks: [
        { target: 'hero', property: 'x', keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 100, ease: 'linear' }] },
        { target: 'hero', property: 'alpha', keyframes: [{ time: 0, value: 0 }, { time: 500, value: 1, ease: 'linear' }] }
      ],
      events: [{ time: 500, name: 'hit', payload: { damage: 4 } }]
    });

    timeline.play();
    timeline.update(500);

    expect(sprite.x).toBe(50);
    expect(sprite.alpha).toBe(1);
    expect(hit).toHaveBeenCalledWith({ damage: 4 }, expect.objectContaining({ time: 500 }));
  });

  it('packs assets into atlas/audio manifest with the pipeline script', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'omnicore-pipeline-'));
    const assetsDir = path.join(temp, 'assets');
    const outDir = path.join(temp, 'dist');
    mkdirSync(path.join(assetsDir, 'sprites'), { recursive: true });
    mkdirSync(path.join(assetsDir, 'audio'), { recursive: true });
    writeFileSync(path.join(assetsDir, 'sprites', 'hero.png'), 'png');
    writeFileSync(path.join(assetsDir, 'audio', 'theme.mp3'), 'mp3');

    execFileSync(process.execPath, ['scripts/pipeline.js', '--assets', assetsDir, '--out', outDir], {
      cwd: process.cwd()
    });

    const manifest = JSON.parse(readFileSync(path.join(outDir, 'asset-manifest.json'), 'utf8'));
    const atlas = JSON.parse(readFileSync(path.join(outDir, 'sprites.atlas'), 'utf8'));

    expect(atlas.frames.hero.source).toContain('hero.png');
    expect(manifest.assets.some((item) => item.type === 'atlas' && item.url.endsWith('sprites.atlas'))).toBe(true);
    expect(manifest.assets.some((item) => item.type === 'audio' && item.url.endsWith('theme.webm'))).toBe(true);
  });

  it('renders a debug-only visual event graph and exports executable JSON', () => {
    const graph = new VisualEventGraph({ debug: true });
    const condition = graph.addNode({
      id: 'has-key',
      type: 'condition',
      label: 'Has Key',
      scope: { doorId: 'north' },
      data: { op: 'equals', left: 'state.key', right: true }
    });
    const action = graph.addNode({ id: 'open-door', type: 'action', label: 'Open Door', data: { op: 'set', target: 'state.door', value: 'open' } });
    graph.connect(condition.id, action.id);
    graph.attach(document.body);

    const json = graph.exportJSON();

    expect(document.querySelector('[data-omnicore-visual-graph]')).not.toBeNull();
    expect(document.querySelector('[data-omnicore-event-tree]')?.textContent).toContain('doorId');
    expect(json.nodes).toHaveLength(2);
    expect(json.edges).toEqual([{ from: 'has-key', to: 'open-door' }]);
    expect(graph.toEventSheet().events[0].actions[0].target).toBe('state.door');
    expect(graph.toEventTree()[0].conditions.scope).toEqual({ doorId: 'north' });
  });

  it('auto-selects the first successful renderer backend', async () => {
    const manager = new RendererManager({
      createRenderer: async (backend) => {
        if (backend === 'pixi') throw new Error('pixi unavailable');
        return { backend, destroy: vi.fn() };
      }
    });

    const renderer = await manager.create('auto');

    expect(renderer.backend).toBe('canvas');
    expect(manager.attempts).toEqual(['pixi', 'canvas']);
  });

  it('applies hot reload asset and config changes without refreshing the game', async () => {
    const assetLoader = { loadImage: vi.fn(async (item) => ({ key: item.key, texture: 'new-texture' })) };
    const database = { register: vi.fn() };
    const hotReload = new HotReload({ assetLoader, database });

    const result = await hotReload.applyChange({
      type: 'asset',
      assetType: 'image',
      key: 'hero',
      url: '/hero.png'
    });
    await hotReload.applyChange({
      type: 'config',
      dbType: 'items',
      id: 'potion',
      data: { name: 'Potion' }
    });

    expect(result.asset.texture).toBe('new-texture');
    expect(database.register).toHaveBeenCalledWith('items', 'potion', { name: 'Potion' });
  });

  it('reports malformed hot reload socket messages without throwing', () => {
    const socket = { close: vi.fn(), onmessage: null };
    const logger = { error: vi.fn() };
    const hotReload = new HotReload({
      socketFactory: () => socket,
      logger
    });

    hotReload.connect();

    expect(() => socket.onmessage({ data: 'not json' })).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith('hotreload', expect.any(Error));
  });

  it('converts natural language level descriptions into Scene JSON through AIImporter', async () => {
    const importer = new AIImporter({
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          scene: {
            name: 'maze',
            children: [{ type: 'sprite', name: 'monster-1' }, { type: 'sprite', name: 'chest-1' }]
          }
        })
      })
    });

    const scene = await importer.generateScene('设计一个含 3 个怪物、两个宝箱的迷宫');

    expect(scene.name).toBe('maze');
    expect(scene.children).toHaveLength(2);
  });

  it('runs registered worker tasks with a main-thread fallback', async () => {
    const workers = new WorkerManager({ workerFactory: null });
    workers.register('sum', ({ values }) => values.reduce((total, value) => total + value, 0));

    await expect(workers.run('sum', { values: [1, 2, 3] })).resolves.toBe(6);
  });

  it('rejects pending worker tasks when destroyed', async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn() };
    const workers = new WorkerManager({ workerFactory: () => worker });
    workers.register('slow', () => 'fallback');

    const pending = workers.run('slow');
    workers.destroy();
    const result = await Promise.race([
      pending.then(() => 'resolved', (error) => error.message),
      new Promise((resolve) => {
        setTimeout(() => resolve('still-pending'), 0);
      })
    ]);

    expect(result).toBe('[OmniCore] [Worker] WorkerManager 已销毁，任务未完成。');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('falls back to the registered handler when worker postMessage fails', async () => {
    const worker = {
      postMessage: vi.fn(() => {
        throw new Error('blocked');
      }),
      terminate: vi.fn()
    };
    const workers = new WorkerManager({ workerFactory: () => worker });
    workers.register('sum', ({ values }) => values.reduce((total, value) => total + value, 0));

    await expect(workers.run('sum', { values: [1, 2, 3] })).resolves.toBe(6);
    expect(workers.pending.size).toBe(0);
  });

  it('installs marketplace plugins through the Store protocol and OmniCore.install', async () => {
    Store.configurePluginMarket({
      cdn: 'https://cdn.example.com/plugins',
      fetcher: async () => ({
        ok: true,
        json: async () => ({
          name: 'weather',
          version: '1.0.0',
          module: 'weather.js',
          permissions: ['events']
        })
      }),
      moduleLoader: async () => ({
        default: {
          install(api) {
            api.register('weather', { enabled: true });
          }
        }
      })
    });

    const plugin = await OmniCore.install('weather');

    expect(plugin.name).toBe('weather');
    expect(Store.getPlugin('weather').exports).toEqual({ enabled: true });
  });
});
