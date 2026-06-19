import { describe, expect, it, vi, afterEach } from 'vitest';
import Store from '../src/store/Store.js';
import Loop from '../src/loop/Loop.js';
import OmniCore from '../src/index.js';
import { Scene, Sprite } from '../src/scene/Scene.js';
import PixiRenderer from '../src/renderer/PixiRenderer.js';

describe('runtime hardening and diagnostics', () => {
  afterEach(() => {
    OmniCore.Assert.configure({ enabled: false });
    vi.restoreAllMocks();
  });

  it('exports OmniCore.Assert from the public package entry', async () => {
    const module = await import('../src/index.js');

    expect(typeof module.Assert.isDefined).toBe('function');
    expect(module.default.Assert).toBe(module.Assert);
  });

  it('reuses fixed pool objects without phantom data in 1000 create/destroy/create cycles', () => {
    const pool = OmniCore.Pool.create('hardening-phantom', 1000, {
      factory: () => ({
        x: 999,
        y: 999,
        scale: {
          x: 9,
          y: 9,
          set(valueX, valueY) {
            this.x = valueX;
            this.y = valueY;
          }
        },
        components: ['seed'],
        __listeners: ['seed'],
        __resetCount: 0,
        __reset() {
          this.__resetCount += 1;
        }
      })
    });

    for (let index = 0; index < 1000; index += 1) {
      const entity = pool.allocate();
      entity.x = 100 + index;
      entity.y = 200 + index;
      entity.components = ['old'];
      entity.__listeners = ['old'];
      pool.free(entity);
    }

    for (let index = 0; index < 1000; index += 1) {
      const reused = pool.allocate();
      expect(reused.__resetCount).toBe(2);
      expect(reused.x).toBe(0);
      expect(reused.y).toBe(0);
      expect(reused.scale).toMatchObject({ x: 0, y: 0 });
      expect(reused.components).toEqual([]);
      expect(reused.__listeners).toEqual([]);
      pool.free(reused);
    }

    OmniCore.Pool.destroy('hardening-phantom');
  });

  it('clamps frame spikes longer than 100ms to 16ms to prevent clock overflow jumps', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loop = new Loop({ fps: 60, timeGuard: null, autoPause: false });
    const callbacks = [];
    loop.subscribe((seconds) => {
      callbacks.push(seconds);
    });
    loop.running = true;
    loop.lastTime = 0;

    loop._tick(600000);
    expect(warn).toHaveBeenCalledWith('[OmniCore] 检测到大跨度时间跳跃，已限制增量时间');
    expect(callbacks).toHaveLength(0);

    loop._tick(600200);
    expect(warn).toHaveBeenCalledTimes(1);

    loop._tick(600216);
    loop._tick(600232);
    expect(callbacks).toHaveLength(3);
    expect(callbacks[0]).toBeCloseTo(loop.frameMs / 1000, 5);
    expect(callbacks[1]).toBeCloseTo(loop.frameMs / 1000, 5);
    loop.stop();
    warn.mockRestore();
  });

  it('can suppress frame spike warnings for non-debug browser smoke tests', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loop = new Loop({ fps: 60, timeGuard: null, autoPause: false, warnTimeJumps: false });

    loop.running = true;
    loop.lastTime = 0;
    loop._tick(600000);

    expect(warn).not.toHaveBeenCalled();
    loop.stop();
    warn.mockRestore();
  });

  it('throws a detailed assertion when debug entity sprite reference is missing', () => {
    OmniCore.Assert.configure({ enabled: true });
    const scene = new Scene('debug');
    scene.debug = true;
    const entity = new Sprite('hero', { x: 0, y: 0 });
    scene.add(entity);
    entity.sprite = null;

    expect(() => {
      scene.update(16, 16);
    }).toThrow(/\[OmniCore\] Assertion Failed: entity\.sprite at .*:\d+/);
  });

  it('skips entity assertions when Assert is disabled', () => {
    const scene = new Scene('release');
    scene.debug = true;
    const entity = new Sprite('hero', { x: 0, y: 0 });
    scene.add(entity);
    entity.sprite = null;

    expect(() => {
      scene.update(16, 16);
    }).not.toThrow();
  });

  it('forces Safari/WebKit pixi requests to Canvas 2D by default', () => {
    const restoreNavigator = mockUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    );

    try {
      const game = new OmniCore.Game({
        renderer: 'pixi',
        autoStart: false,
        autoAttach: false
      });

      expect(game._resolveRendererPreference('pixi')).toBe('canvas');
      expect(game.store.get('renderer:requestedBackend')).toBe('pixi');
      expect(game.store.get('renderer:qualityProfile')).toMatchObject({
        tier: 'low',
        reason: 'webkit-light-mode',
        requestedBackend: 'pixi'
      });
    } finally {
      restoreNavigator();
    }
  });

  it('allows Safari Pixi mode only when webkitLightMode is explicitly disabled', () => {
    const restoreNavigator = mockUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
    );

    try {
      const game = new OmniCore.Game({
        renderer: 'pixi',
        webkitLightMode: false,
        autoStart: false,
        autoAttach: false
      });

      expect(game._resolveRendererPreference('pixi')).toBe('pixi');
    } finally {
      restoreNavigator();
    }
  });

  it('forces batch submission and keeps 1000 sprite updates under 60 FPS in command-buffer render', () => {
    const store = new Store();
    const renderer = new PixiRenderer({
      backend: 'pixi',
      store,
      width: 320,
      height: 180,
      commandBuffer: true,
      commandCapacity: 4096
    });
    const fakeSprites = [];

    renderer.stage = createFakeStage();
    renderer.app = {
      stage: renderer.stage,
      renderer: {
        render: vi.fn()
      }
    };
    renderer._takeSpriteDisplayObject = () => {
      const sprite = {
        texture: null,
        x: 0,
        y: 0,
        alpha: 1,
        rotation: 0,
        scale: {
          x: 1,
          y: 1,
          set(nextX, nextY) {
            this.x = nextX;
            this.y = nextY;
          }
        },
        destroyed: false,
        destroyedParent: null,
        visible: true,
        parent: null
      };
      fakeSprites.push(sprite);
      return sprite;
    };
    renderer._resolveTexture = (source) => source;

    const scene = new Scene('stress');
    for (let index = 0; index < 1000; index += 1) {
      scene.add(new Sprite('atlas://hero', { x: index, y: index, width: 16, height: 16 }));
    }

    const frameCount = 120;
    const start = performance.now();
    for (let frame = 0; frame < frameCount; frame += 1) {
      for (const child of scene.children) {
        child.x += 1;
        child.y += 1;
      }
      renderer.renderScene(scene);
      expect(renderer.batchAdapter.lastFlushStats.forced).toBe(true);
      expect(renderer.batchAdapter.lastFlushStats.commands).toBe(1000);
      expect(renderer.batchAdapter.lastFlushStats.textureBatches).toBe(1);
    }
    const costMsPerFrame = (performance.now() - start) / frameCount;
    expect(costMsPerFrame).toBeLessThan(16.67);
    expect(fakeSprites.length).toBe(1000);
  });
});

function createFakeStage() {
  const stage = {
    children: [],
    addChild: vi.fn((child) => {
      if (!stage.children.includes(child)) stage.children.push(child);
      child.parent = stage;
      return child;
    }),
    removeChild: vi.fn((child) => {
      stage.children = stage.children.filter((item) => item !== child);
      child.parent = null;
      return child;
    }),
    setChildIndex: vi.fn((child, index) => {
      const current = stage.children.indexOf(child);
      if (current < 0) return;
      stage.children.splice(current, 1);
      stage.children.splice(index, 0, child);
    })
  };
  return stage;
}

function mockUserAgent(userAgent) {
  const previousNavigator = globalThis.navigator;
  const nextNavigator = Object.create(previousNavigator || null);
  Object.defineProperty(nextNavigator, 'userAgent', {
    configurable: true,
    value: userAgent
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: nextNavigator
  });
  return () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: previousNavigator
    });
  };
}
