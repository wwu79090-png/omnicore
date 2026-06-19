import { beforeEach, describe, expect, it, vi } from 'vitest';
import OmniCore, {
  Animation,
  BackendManager,
  Button,
  Camera,
  Easing,
  EventSheet,
  InputManager,
  Loader,
  ObjectPool,
  PrefabManager,
  Rect,
  Scene,
  SceneManager,
  Store,
  Timer,
  Tween,
  Vec2
} from '../src/index.js';

describe('OmniCore public API', () => {
  beforeEach(() => {
    vi.useRealTimers();
    delete globalThis.OmniCore;
  });

  it('initializes a Game with canvas fallback, debug lookup, and no exposed ticker', async () => {
    const game = new OmniCore.Game({
      width: 320,
      height: 180,
      renderer: 'canvas',
      autoStart: false,
      autoAttach: false,
      debug: true
    });

    await game.init();

    expect(game.renderer.backend).toBe('canvas');
    expect(game.loop.ticker).toBeUndefined();
    expect(globalThis.OmniCore.lookup('game')).toBe(game);

    game.destroy();
  });

  it('mounts canvases into parent containers and clears runtime references on destroy', async () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const switchComplete = vi.fn();
    const game = new OmniCore.Game({
      width: 160,
      height: 90,
      renderer: 'canvas',
      parent,
      autoStart: false,
      switchComplete
    });

    await game.init();

    expect(parent.querySelectorAll('canvas')).toHaveLength(1);

    game.destroy();

    expect(parent.querySelectorAll('canvas')).toHaveLength(0);
    expect(game.renderer).toBeNull();
    expect(game.scene).toBeNull();
    expect(game.input).toBeNull();
    expect(game.destroyed).toBe(true);
  });

  it('manages a Phaser-inspired scene stack and destroys popped scenes', async () => {
    const game = {
      renderer: { renderScene: vi.fn(), fade: vi.fn(() => Promise.resolve()) },
      loop: { subscribe: vi.fn(() => () => {}) }
    };
    const manager = new SceneManager(game);
    const boot = new Scene('boot');
    boot.create = vi.fn();
    boot.destroy = vi.fn();

    manager.register(boot);
    await manager.push('boot', { fadeIn: 1 });

    expect(manager.current.name).toBe('boot');
    expect(boot.create).toHaveBeenCalledTimes(1);

    await manager.pop({ fadeOut: 1 });

    expect(boot.destroy).toHaveBeenCalledTimes(1);
    expect(manager.current).toBeNull();
  });

  it('updates input before Scene.update during the SceneManager frame', () => {
    const calls = [];
    const scene = new Scene('play');
    scene.update = vi.fn(() => calls.push('scene'));
    const game = {
      input: { update: vi.fn(() => calls.push('input')) },
      renderer: { renderScene: vi.fn(), fade: vi.fn(() => Promise.resolve()) },
      loop: { subscribe: vi.fn(() => () => {}) }
    };
    const manager = new SceneManager(game);
    manager.stack.push(scene);

    manager.update(1 / 60, 16);

    expect(calls).toEqual(['input', 'scene']);
  });

  it('runs from/to Tween with yoyo and repeat semantics', () => {
    const target = { x: 0 };
    const tween = new Tween(target, {
      x: { from: 0, to: 10 },
      duration: 100,
      ease: 'linear',
      yoyo: true,
      repeat: 1,
      autoplay: false
    });

    tween.play();
    tween.update(100);
    expect(target.x).toBe(10);

    tween.update(100);
    expect(target.x).toBe(0);
    expect(tween.completed).toBe(true);
  });

  it('ships Vec2, Rect, and at least 20 easing functions', () => {
    expect(new Vec2(3, 4).length()).toBe(5);
    expect(new Rect(0, 0, 10, 10).contains(5, 5)).toBe(true);
    expect(Object.values(Easing).filter((value) => typeof value === 'function').length).toBeGreaterThanOrEqual(20);
  });

  it('injects rendering backend state through Nano Stores', () => {
    const store = new Store({ score: 1 });

    store.set('score', 7);
    store.injectBackend('pixi');

    expect(store.get('score')).toBe(7);
    expect(store.get('backend')).toBe('pixi');
  });

  it('retries loadBundle and returns friendly failure metadata', async () => {
    let calls = 0;
    const loader = new Loader({
      timeout: 25,
      retries: 1,
      fetcher: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('network down');
        }
        return {
          ok: true,
          text: async () => 'hero,10\nmage,7',
          json: async () => ({ ok: true }),
          arrayBuffer: async () => new ArrayBuffer(4),
          blob: async () => new Blob(['ok'])
        };
      }
    });

    const bundle = await loader.loadBundle([{ key: 'stats', url: '/stats.csv', type: 'text' }]);

    expect(calls).toBe(2);
    expect(bundle.stats).toContain('hero');
  });

  it('uses url as the output and cache key for keyless bundle items', async () => {
    let calls = 0;
    const loader = new Loader({
      fetcher: async () => {
        calls += 1;
        return {
          ok: true,
          json: async () => ({ loaded: true })
        };
      }
    });

    const bundle = await loader.loadBundle([
      { url: '/config.json', type: 'json' },
      { url: '/config.json', type: 'json' }
    ]);

    expect(bundle['/config.json']).toEqual({ loaded: true });
    expect(bundle.undefined).toBeUndefined();
    expect(calls).toBe(1);
  });

  it('tracks keyboard and pointer input with cleanup', () => {
    const canvas = document.createElement('canvas');
    const input = new InputManager({ target: canvas });
    const click = vi.fn();
    input.pointer.on('click', click);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 12, clientY: 18 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 12, clientY: 18 }));
    input.update();

    expect(input.keyboard.isDown('KeyA')).toBe(true);
    expect(input.pointer.position).toEqual({ x: 12, y: 18 });
    expect(click).toHaveBeenCalledTimes(1);

    input.destroy();
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    expect(input.keyboard.isDown('KeyA')).toBe(false);
  });

  it('emits one click for a pointer tap followed by native click', () => {
    const canvas = document.createElement('canvas');
    const input = new InputManager({ target: canvas });
    const click = vi.fn();
    input.pointer.on('click', click);

    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 1, clientY: 2 }));
    canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 1, clientY: 2 }));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 1, clientY: 2 }));

    expect(click).toHaveBeenCalledTimes(1);
    input.destroy();
  });

  it('runs Camera follow, zoom, and shake updates', () => {
    const camera = new Camera({ x: 0, y: 0 });
    const target = { x: 100, y: 50 };

    camera.follow(target, { lerp: 1 });
    camera.zoom(2);
    camera.shake(100, 6);
    camera.update(16);

    expect(camera.x).toBe(100);
    expect(camera.y).toBe(50);
    expect(camera.zoomLevel).toBe(2);
    expect(Math.abs(camera.offsetX)).toBeLessThanOrEqual(6);
  });

  it('runs Timer delay and interval from frame deltas', () => {
    const timer = new Timer();
    const delayed = vi.fn();
    const interval = vi.fn();

    timer.delay(100, delayed);
    timer.interval(50, interval);
    timer.update(50);
    timer.update(50);
    timer.update(50);

    expect(delayed).toHaveBeenCalledTimes(1);
    expect(interval).toHaveBeenCalledTimes(3);
  });

  it('advances SpriteSheet Animation frames and stops cleanly', () => {
    const sprite = { texture: 'idle-0', frame: null };
    const animation = new Animation(sprite, {
      idle: ['idle-0', 'idle-1', 'idle-2']
    }, { frameRate: 10 });

    animation.play('idle');
    animation.update(100);
    expect(sprite.texture).toBe('idle-1');
    animation.stop();
    animation.update(100);
    expect(sprite.texture).toBe('idle-1');
  });

  it('parses Construct/GDevelop-style JSON event sheets', () => {
    const runtime = { state: { score: 5, level: 1 }, events: [] };
    const sheet = EventSheet.parse({
      events: [
        {
          conditions: [{ op: 'equals', left: 'state.score', right: 5 }],
          actions: [
            { op: 'set', target: 'state.level', value: 2 },
            { op: 'emit', event: 'level-up', payload: { level: 2 } }
          ]
        }
      ]
    });

    sheet.run(runtime);

    expect(runtime.state.level).toBe(2);
    expect(runtime.events).toEqual([{ event: 'level-up', payload: { level: 2 } }]);
  });

  it('instantiates prefabs and mounts Cocos-style components', () => {
    class Health {
      constructor(owner, options) {
        this.owner = owner;
        this.hp = options.hp;
      }
    }

    const instance = PrefabManager.instantiate(
      {
        type: 'sprite',
        texture: 'hero',
        components: [{ type: Health, options: { hp: 9 } }]
      },
      12,
      24
    );

    expect(instance.texture).toBe('hero');
    expect(instance.x).toBe(12);
    expect(instance.y).toBe(24);
    expect(instance.components[0].hp).toBe(9);
  });

  it('supports native Canvas UI button hit testing and click dispatch', () => {
    const button = new Button('Start', { x: 10, y: 20, width: 120, height: 36, zIndex: 4 });
    const onClick = vi.fn();

    button.onClick(onClick);
    button.dispatch('click', { x: 20, y: 25 });

    expect(button.hitTest(20, 25)).toBe(true);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reuses objects through ObjectPool reset hooks', () => {
    const pool = new ObjectPool(() => ({ alive: false }), (item) => {
      item.alive = false;
    });
    const first = pool.acquire();
    first.alive = true;
    pool.release(first);

    const second = pool.acquire();

    expect(second).toBe(first);
    expect(second.alive).toBe(false);
  });

  it('switches rendering backends by destroying, rebuilding, remounting, repainting, and reinjecting Store', async () => {
    const destroyed = [];
    const hooks = [];
    const store = new Store();
    const parent = document.createElement('div');
    const oldCanvas = document.createElement('canvas');
    parent.appendChild(oldCanvas);
    const game = {
      renderer: { backend: 'pixi', canvas: oldCanvas, destroy: () => destroyed.push('pixi') },
      store,
      hooks: {
        switchStart: (backend) => hooks.push(`start:${backend}`),
        switchComplete: (backend) => hooks.push(`complete:${backend}`)
      },
      events: { emit: vi.fn() },
      core: {
        canvas: oldCanvas,
        container: parent,
        recreateCanvas: vi.fn(() => {
          const canvas = document.createElement('canvas');
          parent.appendChild(canvas);
          return canvas;
        }),
        resetWebGLState: vi.fn(),
        clearContainerCanvases: vi.fn(() => {
          parent.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
        })
      },
      scene: { current: new Scene('play') },
      createRenderer: vi.fn(async (backend) => ({
        backend,
        canvas: game.core.canvas,
        renderScene: vi.fn(),
        destroy: () => destroyed.push(backend)
      }))
    };
    const backend = new BackendManager(game);

    await backend.switch('canvas');

    expect(destroyed).toEqual(['pixi']);
    expect(game.core.resetWebGLState).toHaveBeenCalledTimes(1);
    expect(game.core.clearContainerCanvases).toHaveBeenCalledTimes(1);
    expect(game.core.recreateCanvas).toHaveBeenCalledTimes(1);
    expect(game.renderer.backend).toBe('canvas');
    expect(game.renderer.renderScene).toHaveBeenCalledWith(game.scene.current);
    expect(store.get('backend')).toBe('canvas');
    expect(hooks).toEqual(['start:canvas', 'complete:canvas']);
    expect(parent.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('runs Game onStart, onPause, and onResume lifecycle hooks', async () => {
    const calls = [];
    const game = new OmniCore.Game({
      renderer: 'canvas',
      autoStart: false,
      autoAttach: false,
      onStart: () => calls.push('start'),
      onPause: () => calls.push('pause'),
      onResume: () => calls.push('resume')
    });

    await game.init();
    game.start();
    game.pause();
    game.resume();

    expect(calls).toEqual(['start', 'pause', 'resume']);
    game.destroy();
  });
});
