import { describe, expect, it, vi } from 'vitest';
import OmniCore, {
  Camera,
  DataAdapter,
  Entity,
  Font,
  InputManager,
  Loader,
  Scene,
  Sprite,
  Timer,
  Text
} from '../src/index.js';

describe('Phaser migration compatibility gaps', () => {
  it('supports Phaser-style sprite origins so legacy map coordinates do not drift', () => {
    const sprite = new Sprite('house', {
      x: 100,
      y: 80,
      width: 40,
      height: 20,
      label: false
    });
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn()
    };

    expect(sprite.getOrigin()).toEqual({ x: 0, y: 0 });
    expect(sprite.setOrigin(0.5).getOrigin()).toEqual({ x: 0.5, y: 0.5 });

    sprite.render(ctx);

    expect(ctx.fillRect).toHaveBeenCalledWith(-20, -10, 40, 20);
    expect(sprite.setOrigin(0.25, 0.75)).toBe(sprite);
    expect(sprite.getOrigin()).toEqual({ x: 0.25, y: 0.75 });
  });

  it('converts HTML screen coordinates to camera world coordinates for UI click-through checks', () => {
    const camera = new Camera({ x: 100, y: 50, zoom: 2 });
    camera.offsetX = 10;
    camera.offsetY = -4;

    expect(camera.screenToWorld(210, 96)).toEqual({ x: 200, y: 100 });
    expect(camera.screenToWorld({ clientX: 210, clientY: 96 })).toEqual({ x: 200, y: 100 });

    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 20, top: 16, width: 640, height: 360 })
    });
    camera.setScreenTarget(canvas);
    expect(camera.screenToWorld({ clientX: 230, clientY: 112 })).toEqual({ x: 200, y: 100 });
    expect(camera.screenToWorld({ x: 210, y: 96 })).toEqual({ x: 200, y: 100 });
  });

  it('returns clearable timers and clears scene-owned timers on scene unmount', () => {
    const timer = new Timer();
    const delayed = vi.fn();
    const interval = vi.fn();

    const delayedTask = timer.delay(100, delayed);
    const intervalTask = timer.interval(10, interval);

    expect(typeof delayedTask.clear).toBe('function');
    expect(typeof intervalTask.clear).toBe('function');
    delayedTask.clear();
    timer.update(100);
    expect(delayed).not.toHaveBeenCalled();
    expect(interval).toHaveBeenCalledTimes(10);

    intervalTask.clear();
    timer.update(10);
    expect(interval).toHaveBeenCalledTimes(10);

    const scene = new Scene('legacy-room');
    const globalTimer = new Timer();
    scene.bindTimer(globalTimer);
    const sceneCallback = vi.fn();
    const globalCallback = vi.fn();
    scene.timer.delay(100, sceneCallback);
    globalTimer.delay(100, globalCallback);

    scene.unmount();
    globalTimer.update(100);

    expect(sceneCallback).not.toHaveBeenCalled();
    expect(globalCallback).toHaveBeenCalledTimes(1);
  });

  it('emits pointer drag and doubleClick events for legacy inventory and map interactions', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 5, top: 10, width: 200, height: 120 })
    });
    const input = new InputManager({ target: canvas });
    const drag = vi.fn();
    const doubleClick = vi.fn();
    input.pointer.on('drag', drag);
    input.pointer.on('doubleClick', doubleClick);

    dispatchPointer(canvas, 'pointerdown', 15, 20);
    dispatchPointer(canvas, 'pointermove', 35, 45);
    dispatchPointer(canvas, 'pointerup', 35, 45);
    dispatchPointer(canvas, 'click', 35, 45);
    dispatchPointer(canvas, 'click', 36, 46);

    expect(drag).toHaveBeenCalledWith(expect.objectContaining({
      x: 30,
      y: 35,
      startX: 10,
      startY: 10,
      dx: 20,
      dy: 25
    }));
    expect(doubleClick).toHaveBeenCalledWith(expect.objectContaining({
      x: 31,
      y: 36,
      previousClick: expect.objectContaining({ x: 30, y: 35 })
    }));

    input.destroy();
  });

  it('accepts backgroundColor as a Phaser-style game config alias', async () => {
    const game = new OmniCore.Game({
      renderer: 'canvas',
      width: 64,
      height: 32,
      autoStart: false,
      autoAttach: false,
      autoResize: false,
      backgroundColor: '#1a2b3c'
    });

    await game.init();

    expect(game.config.background).toBe('#1a2b3c');
    expect(game.renderer.background).toBe('#1a2b3c');

    game.destroy();
  });

  it('renders rich text style descriptors with stroke, shadow, word wrap, and line spacing', () => {
    const text = new Text('Hello OmniCore player', {
      x: 12,
      y: 24,
      color: '#ffffff',
      font: '20px Orbitron',
      lineSpacing: 6
    })
      .setStroke('#101010', 3)
      .setShadow('#000000', 8)
      .setWordWrap(48);
    const calls = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn((...args) => calls.push(['fillText', ...args])),
      strokeText: vi.fn((...args) => calls.push(['strokeText', ...args])),
      measureText: (value) => ({ width: String(value).length * 8 })
    };

    const lines = text.layoutLines(ctx);
    text.render(ctx);

    expect(text.style).toMatchObject({
      fill: '#ffffff',
      stroke: { color: '#101010', thickness: 3 },
      shadow: { color: '#000000', blur: 8 },
      wordWrap: { width: 48 },
      lineSpacing: 6
    });
    expect(lines.length).toBeGreaterThan(1);
    expect(ctx.strokeText).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
    expect(calls.at(-1)[3]).toBeGreaterThan(24);
  });

  it('emits mouse wheel payloads and detects keyboard key combinations', () => {
    const canvas = document.createElement('canvas');
    const input = new InputManager({ target: canvas });
    const wheel = vi.fn();
    input.mouse.on('wheel', wheel);

    const wheelEvent = new Event('wheel', { bubbles: true, cancelable: true });
    Object.defineProperties(wheelEvent, {
      clientX: { value: 20 },
      clientY: { value: 30 },
      deltaX: { value: 1 },
      deltaY: { value: -120 },
      deltaMode: { value: 0 }
    });
    canvas.dispatchEvent(wheelEvent);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true }));

    expect(wheel).toHaveBeenCalledWith(expect.objectContaining({
      deltaX: 1,
      deltaY: -120,
      deltaMode: 0
    }));
    expect(input.keyboard.isCombo(['Control', 'z'])).toBe(true);
    expect(input.keyboard.isCombo(['Ctrl', 'Z'])).toBe(true);

    input.destroy();
  });

  it('accepts Phaser-style camera setBounds positional arguments and clamps the viewport', () => {
    const camera = new Camera({ x: 500, y: 240 });

    camera.setViewport({ width: 100, height: 50 });
    camera.setBounds(0, 0, 320, 180);
    camera.update(0);

    expect(camera.getViewTransform()).toMatchObject({ x: 220, y: 130 });
  });

  it('maps legacy asset paths and returns visible missing image placeholders', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetcher = vi.fn(async (url) => {
      if (url === '/omnicore/assets/hero.png') {
        return { ok: true, blob: async () => ({ kind: 'blob', url }) };
      }
      return { ok: false, status: 404, text: async () => 'missing' };
    });
    const loader = new Loader({
      fetcher,
      preferWebp: false,
      pathResolver: {
        'assets/images/hero.png': '/omnicore/assets/hero.png'
      }
    });

    try {
      const loaded = await loader.loadBundle([{ key: 'hero', url: 'assets/images/hero.png', type: 'image' }]);
      const missing = await loader.loadBundle([{ key: 'missing', url: 'assets/images/missing.png', type: 'image', width: 96, height: 32 }]);
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn()
      };
      missing.missing.render(ctx);

      expect(loaded.hero).toMatchObject({
        type: 'ImageAsset',
        url: '/omnicore/assets/hero.png',
        resolvedFrom: 'assets/images/hero.png'
      });
      expect(missing.missing).toMatchObject({
        type: 'ResourceMissing',
        label: '资源丢失：assets/images/missing.png',
        width: 96,
        height: 32
      });
      expect(ctx.fillText).toHaveBeenCalledWith('资源丢失：assets/images/missing.png', expect.any(Number), expect.any(Number));
    } finally {
      error.mockRestore();
    }
  });

  it('translates legacy JSON fields and ids through DataAdapter', () => {
    const adapter = new DataAdapter({
      fields: {
        id: { to: 'nodeId', transform: (value) => Number(String(value).replace(/\D/g, '')) },
        node_01: 'node1'
      }
    });

    expect(adapter.adapt({
      id: 'node_01',
      node_01: { hp: 100 },
      children: [{ id: 'node_02' }]
    })).toEqual({
      nodeId: 1,
      node1: { hp: 100 },
      children: [{ nodeId: 2 }]
    });
  });

  it('loads custom web fonts before title rendering', async () => {
    const loaded = [];
    class FakeFontFace {
      constructor(family, source, descriptors) {
        this.family = family;
        this.source = source;
        this.descriptors = descriptors;
      }

      async load() {
        loaded.push(this.family);
        return this;
      }
    }
    const previousFontFace = globalThis.FontFace;
    const previousFonts = document.fonts;
    globalThis.FontFace = FakeFontFace;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { add: vi.fn() }
    });

    const face = await Font.load('Orbitron', 'https://cdn.example.com/Orbitron.woff2');

    expect(face).toMatchObject({
      family: 'Orbitron',
      source: 'url("https://cdn.example.com/Orbitron.woff2")'
    });
    expect(loaded).toEqual(['Orbitron']);
    expect(document.fonts.add).toHaveBeenCalledWith(face);
    expect(OmniCore.Font.load).toBe(Font.load);

    globalThis.FontFace = previousFontFace;
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: previousFonts
    });
  });

  it('computes world positions through parent-child transform chains', () => {
    const panel = Entity.createEntity('node', { name: 'panel', x: 100, y: 50 });
    const close = Entity.createEntity('node', { name: 'close', x: 16, y: 8 });
    const icon = Entity.createEntity('node', { name: 'icon', x: 2, y: 3 });

    panel.addChild(close);
    close.addChild(icon);

    expect(close.getWorldPosition()).toEqual({ x: 116, y: 58 });
    expect(icon.getWorldPosition()).toEqual({ x: 118, y: 61 });
    expect(panel.toLocalPosition({ x: 116, y: 58 })).toEqual({ x: 16, y: 8 });
  });
});

function dispatchPointer(target, type, clientX, clientY) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: 1 },
    button: { value: 0 }
  });
  target.dispatchEvent(event);
}
