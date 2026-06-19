import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import BehaviorTree from '../src/behaviortree/BehaviorTree.js';
import EventBus from '../src/core/EventBus.js';
import EventSheet from '../src/data/EventSheet.js';
import DebugConsole from '../src/debug/DebugConsole.js';
import EditorPanel from '../src/editor/EditorPanel.js';
import PhysicsWorld from '../src/physics/PhysicsWorld.js';
import CollisionMask from '../src/physics/CollisionMask.js';
import RenderLayerManager from '../src/renderer/RenderLayerManager.js';
import Store from '../src/store/Store.js';
import ChunkCache from '../src/tilemap/ChunkCache.js';
import ChunkManager from '../src/tilemap/ChunkManager.js';
import Tilemap from '../src/tilemap/Tilemap.js';
import WorkerManager from '../src/worker/WorkerManager.js';
import { Scene, Sprite } from '../src/scene/Scene.js';

describe('state-machine EventSheet behavior tree', () => {
  it('runs onStateExit and onStateEnter hooks when a transition becomes true', () => {
    const store = new Store({ hp: 30, mode: 'alive' });
    const calls = [];
    store.set('die', () => calls.push('die'));
    const tree = new BehaviorTree({
      initial: 'idle',
      states: {
        idle: {
          onStateExit: [{ op: 'set', target: 'store.mode', value: 'leaving-idle' }],
          transitions: [{ when: [{ op: 'lt', left: 'store.hp', right: 20 }], to: 'die' }]
        },
        die: {
          onStateEnter: [{ execute: 'die' }]
        }
      }
    }, { store });

    tree.attach();
    store.set('hp', 10);

    expect(tree.currentState).toBe('die');
    expect(store.get('mode')).toBe('leaving-idle');
    expect(calls).toEqual(['die']);
    expect(tree.debugTree().activeState).toBe('die');
  });

  it('drives patrol, chase, and attack NPC behavior from EventSheet state JSON', () => {
    const store = new Store({ distanceToPlayer: 96, npcAction: 'boot' });
    const bus = new EventBus();
    const sheet = EventSheet.parse({
      initial: 'patrol',
      states: ['patrol', 'chase', 'attack'],
      transitions: {
        onSeePlayer: 'chase',
        onHit: 'chase',
        chase: [
          { when: [{ op: 'lte', left: 'store.distanceToPlayer', right: 24 }], to: 'attack' },
          { on: 'onLosePlayer', to: 'patrol' }
        ],
        attack: {
          onLosePlayer: 'patrol'
        }
      },
      onStateEnter: {
        patrol: [{ op: 'set', target: 'store.npcAction', value: 'patrol' }],
        chase: [{ op: 'set', target: 'store.npcAction', value: 'chase' }],
        attack: [{ op: 'set', target: 'store.npcAction', value: 'attack' }]
      }
    });

    sheet.attach({ store, events: bus, entity: { id: 'guard' } });
    bus.emit('onSeePlayer', { playerId: 'hero' });
    store.set('distanceToPlayer', 12);
    bus.emit('onHit', { damage: 3 });
    bus.emit('onLosePlayer');

    expect(sheet.behaviorTree.debugTree()).toMatchObject({
      activeState: 'patrol',
      states: [
        { name: 'patrol', active: true },
        { name: 'chase', active: false },
        { name: 'attack', active: false }
      ]
    });
    expect(sheet.behaviorTree.triggered.map((item) => item.to).filter(Boolean)).toEqual([
      'chase',
      'attack',
      'chase',
      'patrol'
    ]);
    expect(store.get('npcAction')).toBe('patrol');

    sheet.detach();
  });
});

describe('tilemap runtime chunk unloading', () => {
  it('unloads chunks outside the camera margin and releases cached payloads', () => {
    const tilemap = Tilemap.parse({
      width: 16,
      height: 16,
      tilewidth: 16,
      tileheight: 16,
      layers: [{ id: 1, name: 'Ground', type: 'tilelayer', width: 16, height: 16, data: Array(256).fill(1) }]
    });
    const cache = new ChunkCache();
    const manager = new ChunkManager(tilemap, { cache, chunkPixelSize: 64, unloadDistance: 0 });

    manager.update({ x: 0, y: 0, width: 64, height: 64 });
    manager.update({ x: 192, y: 192, width: 64, height: 64 });

    expect(manager.activeChunks.size).toBe(1);
    expect(cache.has('Ground:0:0')).toBe(false);
    expect(cache.has('Ground:3:3')).toBe(true);
  });
});

describe('physics masks and gravity facade', () => {
  it('filters collision callbacks by category and mask and updates gravity', () => {
    const world = new PhysicsWorld();
    world.gravity({ x: 0, y: 1 });
    const bullet = { name: 'bullet', body: { collisionFilter: CollisionMask.filter('bullet', 'enemy') } };
    const enemy = { name: 'enemy', body: { collisionFilter: CollisionMask.filter('enemy', 'bullet') } };
    const ground = { name: 'ground', body: { collisionFilter: CollisionMask.filter('world', 'player') } };
    const calls = [];

    world.onCollision(bullet, (target) => calls.push(target.name));
    world.emitCollision(bullet.body, ground.body, bullet, ground);
    world.emitCollision(bullet.body, enemy.body, bullet, enemy);

    expect(world.engine.world.gravity).toEqual({ x: 0, y: 1 });
    expect(calls).toEqual(['enemy']);
  });
});

describe('Worker Store sync', () => {
  it('sends subscribed Store field changes to worker local state automatically', () => {
    const messages = [];
    const worker = { postMessage: vi.fn((message) => messages.push(message)), terminate: vi.fn() };
    const manager = new WorkerManager({ workerFactory: () => worker });
    const store = new Store({ grid: [[0]], target: { x: 1, y: 2 } });

    manager.sync(store, ['grid', 'target']);
    store.set('target', { x: 3, y: 4 });

    expect(messages).toContainEqual({ type: 'sync', key: 'target', value: { x: 3, y: 4 } });
  });
});

describe('EditorPanel and render layer manager', () => {
  it('attaches a debug editor sidebar, selects entities, and saves edits into Store', () => {
    const scene = new Scene('play');
    const hero = scene.add(new Sprite('hero', { x: 10, y: 12, width: 20, height: 20 }));
    hero.name = 'hero';
    const store = new Store();
    const game = {
      store,
      scene: { current: scene },
      renderer: { renderScene: vi.fn(), canvas: document.createElement('canvas') },
      core: { canvas: document.createElement('canvas') }
    };
    const panel = new EditorPanel(game);

    panel.attach();
    panel.select(hero);
    panel.setSelectedProperty('x', 42);

    expect(document.querySelector('[data-omnicore-editor-panel]')).not.toBeNull();
    expect(store.get('editor:selectedEntity').x).toBe(42);
    expect(store.get('config/scene.json').entities[0].x).toBe(42);
    panel.detach();
  });

  it('sorts Pixi display children from Store.zIndex without rebuilding display objects', () => {
    const store = new Store({ zIndex: {} });
    const stage = {
      children: [{ id: 'a' }, { id: 'b' }],
      setChildIndex: vi.fn((child, index) => {
        stage.children = stage.children.filter((item) => item !== child);
        stage.children.splice(index, 0, child);
      })
    };
    const manager = new RenderLayerManager({ store, container: stage });
    manager.register('a', stage.children[0]);
    manager.register('b', stage.children[1]);

    store.set('zIndex', { a: 20, b: 1 });

    expect(stage.setChildIndex).toHaveBeenCalled();
    expect(stage.children.map((child) => child.id)).toEqual(['b', 'a']);
  });
});

describe('Store middleware and debug console', () => {
  it('runs middleware and skips unchanged values', () => {
    const store = new Store({ score: 1 });
    const seen = [];
    store.use(({ key, value }) => (key === 'score' ? value * 2 : value));
    store.subscribe('score', (value) => seen.push(value));

    store.set('score', 1);
    store.set('score', 2);

    expect(store.get('score')).toBe(4);
    expect(seen).toEqual([1, 4]);
  });

  it('forwards console logs and EventBus events through DebugConsole', () => {
    const sent = [];
    const socket = { readyState: 1, send: vi.fn((payload) => sent.push(JSON.parse(payload))), close: vi.fn() };
    const bus = new EventBus();
    const consoleRef = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    const debug = new DebugConsole({ socketFactory: () => socket, consoleRef, events: bus });

    debug.attach();
    consoleRef.log('mobile log');
    bus.emit('scene:mount', { name: 'play' });

    expect(sent.map((item) => item.type)).toEqual(['console', 'event']);
    debug.detach();
  });
});

describe('scaffold templates, addon packaging, and website docs', () => {
  it('creates platformer, rpg, and puzzle templates', () => {
    const root = mkTemp();
    try {
      for (const template of ['platformer', 'rpg', 'puzzle']) {
        execFileSync(process.execPath, [
          path.resolve('scripts/create-omnicore-app.mjs'),
          `game-${template}`,
          '--template',
          template
        ], { cwd: root, stdio: 'pipe' });
        expect(existsSync(path.join(root, `game-${template}`, 'src/main.js'))).toBe(true);
        expect(readFileSync(path.join(root, `game-${template}`, 'src/main.js'), 'utf8')).toContain(template);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('packages an addon directory with manifest and zip output', () => {
    const root = mkTemp();
    try {
      const addonDir = path.join(root, 'my-addon');
      mkdirSync(path.join(addonDir, 'src'), { recursive: true });
      writeFileSync(path.join(addonDir, 'src/index.js'), 'export default { init() {} };');
      writeFileSync(path.join(addonDir, 'manifest.json'), JSON.stringify({ name: 'my-addon', version: '1.0.0' }));

      execFileSync(process.execPath, [
        path.resolve('scripts/build-addon.js'),
        '--dir',
        addonDir,
        '--out',
        path.join(root, 'dist')
      ], { cwd: process.cwd(), stdio: 'pipe' });

      expect(existsSync(path.join(root, 'dist', 'my-addon-1.0.0.zip'))).toBe(true);
      expect(existsSync(path.join(root, 'dist', 'manifest.json'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('documents 2D focus, Code Awakener case study, and roadmap', () => {
    expect(readFileSync('README.md', 'utf8')).toContain('OmniCore 专注于 2D 游戏开发');
    expect(readFileSync('website/case-studies.md', 'utf8')).toContain('代码觉醒者');
    expect(readFileSync('website/roadmap.md', 'utf8')).toContain('开发路线图');
    expect(readFileSync('docs/api/README.zh-CN.md', 'utf8')).toContain('OmniCore API');
  });
});

function mkTemp() {
  const root = path.join(tmpdir(), `omnicore-next-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}
