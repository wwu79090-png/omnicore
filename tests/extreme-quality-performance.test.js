import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import EventBus from '../src/core/EventBus.js';
import HotReload from '../src/hotreload/HotReload.js';
import Loop from '../src/loop/Loop.js';
import Button from '../src/ui/Button.js';
import UIElement from '../src/ui/UIElement.js';

describe('extreme quality and performance upgrades', () => {
  it('ships a critical first-frame skeleton and precompile script before the module entry', () => {
    const html = readFileSync('examples/index.html', 'utf8');
    const viteConfig = readFileSync('vite.config.js', 'utf8');
    const criticalCssIndex = html.indexOf('id="omnicore-critical-css"');
    const skeletonIndex = html.indexOf('id="omnicore-boot-skeleton"');
    const precompileIndex = html.indexOf('id="omnicore-precompile-core"');
    const moduleIndex = html.indexOf('type="module"');

    expect(criticalCssIndex).toBeGreaterThan(-1);
    expect(skeletonIndex).toBeGreaterThan(criticalCssIndex);
    expect(precompileIndex).toBeGreaterThan(skeletonIndex);
    expect(precompileIndex).toBeLessThan(moduleIndex);
    expect(html).toContain('omnicore:first-frame-start');
    expect(html).toContain('requestAnimationFrame');
    expect(viteConfig).toContain('startupBootstrapPlugin');
    expect(viteConfig).toContain('omnicore-first-frame-bootstrap.js');
  });

  it('records minor GC diagnostics and lets Loop report frame allocation pressure', async () => {
    const { MemoryGuardian } = await import('../src/debug/MemoryGuardian.js');
    const gcReports = [];
    const guardian = new MemoryGuardian({
      debug: true,
      onGC: (report) => gcReports.push(report),
      logger: { warn: vi.fn() }
    });
    const report = guardian.recordGC({
      kind: 'minor',
      duration: 12,
      frame: 7,
      source: 'test',
      deltaHeap: -2048
    });

    expect(report).toMatchObject({
      kind: 'minor',
      duration: 12,
      frame: 7,
      source: 'test'
    });
    expect(report.suggestions.join('\n')).toContain('EventBus');
    expect(gcReports).toHaveLength(1);

    const loopGuardian = { watchFrame: vi.fn() };
    const loop = new Loop({
      autoPause: false,
      vsync: false,
      memoryGuardian: loopGuardian
    });
    loop.running = true;
    loop.lastTime = 0;
    loop.subscribe(() => {});
    loop._tick(17);
    loop.stop();

    expect(loopGuardian.watchFrame).toHaveBeenCalledWith(expect.objectContaining({
      frame: 1,
      frameMs: expect.any(Number),
      updateMs: expect.any(Number)
    }));
  });

  it('rejects anonymous EventBus callbacks in debug mode but accepts reused function handles', () => {
    const bus = new EventBus({ debug: true });

    expect(() => bus.on('tick', () => {})).toThrow(/\[OmniCore\] 内存警告：请在 EventBus 中复用函数句柄/);

    function reusedTickHandler() {}
    expect(() => bus.on('tick', reusedTickHandler)).not.toThrow();
  });

  it('renders only dirty UI rectangles and caches static panels offscreen', async () => {
    const { UIRenderManager } = await import('../src/ui/UIRenderManager.js');
    const manager = new UIRenderManager();
    const button = new Button('Start', { x: 10, y: 20, width: 80, height: 24 });
    const staticPanel = new UIElement({ x: 0, y: 0, width: 160, height: 90 });
    const ctx = createFakeCanvasContext();

    manager.track(button);
    manager.markDirty(button, 'hover');
    manager.render(ctx, [button]);

    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.clearRect).toHaveBeenCalledWith(10, 20, 80, 24);
    expect(ctx.save).toHaveBeenCalled();

    const cache = manager.cacheStatic(staticPanel, {
      createCanvas: (width, height) => ({
        width,
        height,
        getContext: () => createFakeCanvasContext()
      })
    });

    expect(cache).toMatchObject({
      width: 160,
      height: 90,
      dirty: false
    });
    expect(staticPanel.renderCache).toBe(cache);
  });

  it('runs scene logic through LogicWorker and writes render state into a shared channel', async () => {
    const { LogicWorker, LOGIC_RENDER_STRIDE } = await import('../src/worker/LogicWorker.js');
    const workerManager = createFakeWorkerManager();
    const logicWorker = new LogicWorker({ workerManager, capacity: 4 });

    const result = await logicWorker.tick([
      { id: 'npc-1', x: 4, y: 8, alpha: 1, rotation: 0, scaleX: 1, scaleY: 1 }
    ], { dt: 1 / 60 });

    expect(workerManager.register).toHaveBeenCalledWith('logicFrame', expect.any(Function), { pure: true });
    expect(workerManager.run).toHaveBeenCalledWith('logicFrame', expect.objectContaining({
      dt: 1 / 60,
      entities: [expect.objectContaining({ id: 'npc-1', x: 4, y: 8 })]
    }), expect.any(Object));
    expect(result.channel.view[0]).toBe(5);
    expect(result.channel.view[1]).toBe(10);
    expect(result.channel.view[2]).toBe(0.75);
    expect(result.channel.length).toBe(4 * LOGIC_RENDER_STRIDE);
  });

  it('hot-swaps core modules without reloading the page and resumes the loop on the next frame', async () => {
    let rafCallback = null;
    const runtime = {
      OmniCore: { version: 'old' },
      location: { reload: vi.fn() },
      requestAnimationFrame: (callback) => {
        rafCallback = callback;
        return 1;
      }
    };
    const loop = {
      pause: vi.fn(),
      resume: vi.fn()
    };
    const nextCore = { version: 'new' };
    const hotReload = new HotReload({
      runtime,
      loop,
      moduleImporter: vi.fn(async () => ({ default: nextCore })),
      onChange: vi.fn()
    });

    const result = await hotReload.applyChange({
      type: 'core-module',
      url: '/src/index.js'
    });

    expect(result).toMatchObject({ type: 'core-module', core: nextCore });
    expect(runtime.OmniCore).toBe(nextCore);
    expect(runtime.location.reload).not.toHaveBeenCalled();
    expect(loop.pause).toHaveBeenCalled();
    expect(loop.resume).not.toHaveBeenCalled();

    rafCallback();
    expect(loop.resume).toHaveBeenCalled();
  });
});

function createFakeCanvasContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    set fillStyle(value) {
      this._fillStyle = value;
    },
    get fillStyle() {
      return this._fillStyle;
    },
    set strokeStyle(value) {
      this._strokeStyle = value;
    },
    get strokeStyle() {
      return this._strokeStyle;
    },
    set font(value) {
      this._font = value;
    },
    get font() {
      return this._font;
    },
    set lineWidth(value) {
      this._lineWidth = value;
    },
    get lineWidth() {
      return this._lineWidth;
    },
    set textAlign(value) {
      this._textAlign = value;
    },
    get textAlign() {
      return this._textAlign;
    },
    set textBaseline(value) {
      this._textBaseline = value;
    },
    get textBaseline() {
      return this._textBaseline;
    }
  };
}

function createFakeWorkerManager() {
  const manager = {
    register: vi.fn(() => manager),
    createSharedBuffer: vi.fn(({ length, ArrayType = Float32Array }) => {
      const buffer = new ArrayBuffer(length * ArrayType.BYTES_PER_ELEMENT);
      const control = new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 4);
      return {
        name: 'logic-render',
        length,
        shared: typeof SharedArrayBuffer !== 'undefined',
        buffer,
        control,
        view: new ArrayType(buffer),
        state: new Int32Array(control),
        ArrayType
      };
    }),
    writeSharedFrame: vi.fn((channel, values) => {
      channel.view.set(values);
      return 1;
    }),
    run: vi.fn(async (name, payload) => ({
      entities: payload.entities.map((entity) => ({
        ...entity,
        x: entity.x + 1,
        y: entity.y + 2,
        alpha: 0.75
      }))
    }))
  };
  return manager;
}
