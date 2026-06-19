import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectEnvironment, safeInitialize } from '../src/core/Bootstrap.js';
import Logger from '../src/core/Logger.js';
import EventBus from '../src/core/EventBus.js';
import InputManager from '../src/input/InputManager.js';
import AssetLoader from '../src/loader/AssetLoader.js';
import WebGLContextManager from '../src/renderer/WebGLContextManager.js';
import PerformanceMonitor from '../src/debug/PerformanceMonitor.js';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));

describe('runtime hardening and deployment guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete globalThis.__OmniCore_LastError;
    if (globalThis.window) delete globalThis.window.__OmniCore_LastError;
  });

  it('detects WeChat mini-game runtime and exposes a wx.request fetch adapter', async () => {
    const request = vi.fn(({ success }) => {
      success({
        statusCode: 200,
        data: { ok: true },
        header: { 'content-type': 'application/json' }
      });
    });

    const env = detectEnvironment({
      wx: { request },
      navigator: { userAgent: 'MicroMessenger MiniGame' }
    });

    expect(env.platform).toBe('wechat');
    expect(env.isMiniGame).toBe(true);
    expect(env.skipThree).toBe(true);
    expect(env.skipPixiViewport).toBe(true);

    const response = await env.fetcher('/config.json', { method: 'POST', body: { boot: true } });

    expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: '/config.json', method: 'POST' }));
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('wraps module initialization and returns fallback output after failures', async () => {
    const logger = { error: vi.fn() };

    const result = await safeInitialize(
      'PixiRenderer',
      () => {
        throw new Error('webgl unavailable');
      },
      (error) => ({ fallback: true, reason: error.message }),
      logger
    );

    expect(result).toEqual({ fallback: true, reason: '[OmniCore] [Bootstrap] PixiRenderer 初始化失败。' });
    expect(logger.error).toHaveBeenCalledWith('bootstrap', 'PixiRenderer 初始化失败。', expect.any(Error));
  });

  it('records structured last-error metadata from Logger.error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = new Logger({ namespace: 'TestCore' });

    logger.error('renderer', 'boom');

    expect(window.__OmniCore_LastError).toEqual(
      expect.objectContaining({
        namespace: 'TestCore',
        scope: 'renderer',
        message: expect.stringContaining('boom'),
        timestamp: expect.any(String),
        file: expect.any(String),
        line: expect.any(Number)
      })
    );
  });

  it('normalizes pointer input, prevents touch defaults, and resizes canvas by device resolution', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 5, top: 10, width: 200, height: 100 })
    });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });

    const input = new InputManager({ target: canvas, preventDefault: true });
    const down = vi.fn();
    input.pointer.on('down', down);

    const pointerDown = new MouseEvent('pointerdown', { clientX: 25, clientY: 35, cancelable: true });
    const preventDefault = vi.spyOn(pointerDown, 'preventDefault');
    canvas.dispatchEvent(pointerDown);
    window.dispatchEvent(new Event('resize'));

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(input.pointer.down).toBe(true);
    expect(input.pointer.position).toEqual({ x: 20, y: 25 });
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(200);
    expect(input.resolution).toBe(2);
    expect(down).toHaveBeenCalledWith(expect.objectContaining({ x: 20, y: 25 }));

    input.destroy();
  });

  it('keeps asset loading alive by returning a generated missing-texture object', async () => {
    const graphicsFactory = vi.fn((options) => ({ kind: 'fallback-graphics', ...options }));
    const loader = new AssetLoader({
      fetcher: async () => {
        throw new Error('404');
      },
      graphicsFactory
    });

    const asset = await loader.loadImage({ key: 'hero', url: '/missing.png', width: 24, height: 24 });

    expect(asset.fallback).toBe(true);
    expect(asset.displayObject).toEqual(expect.objectContaining({ kind: 'fallback-graphics', width: 24 }));
    expect(graphicsFactory).toHaveBeenCalledTimes(1);
  });

  it('handles WebGL context loss, restoration, and canvas fallback hooks', async () => {
    vi.useFakeTimers();
    const canvas = document.createElement('canvas');
    const onLost = vi.fn();
    const onRestored = vi.fn();
    const onFallback = vi.fn();
    const manager = new WebGLContextManager({
      canvas,
      restoreTimeout: 1,
      onLost,
      onRestored,
      onFallback
    });

    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    vi.advanceTimersByTime(1);
    await Promise.resolve();
    canvas.dispatchEvent(new Event('webglcontextrestored'));

    expect(lost.defaultPrevented).toBe(true);
    expect(manager.lost).toBe(false);
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onRestored).toHaveBeenCalledTimes(1);

    manager.destroy();
    vi.useRealTimers();
  });

  it('renders a debug performance panel and warns on sustained low FPS', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const monitor = new PerformanceMonitor({ debug: true, lowFpsThreshold: 30, lowFpsFrames: 2 });

    monitor.attach();
    monitor.update({ fps: 24, renderMs: 6, gameObjects: 3, memory: 4096 });
    monitor.update({ fps: 25, renderMs: 7, gameObjects: 4, memory: 8192 });

    const panel = document.querySelector('[data-omnicore-performance]');
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('FPS');
    expect(panel.textContent).toContain('Objects: 4');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[OmniCore] [Performance] FPS 低于 30'));

    monitor.destroy();
  });

  it('interrupts recursive event loops with a readable cycle path', () => {
    const bus = new EventBus({ maxRecursionDepth: 8 });
    let calls = 0;
    bus.on('event:A', () => {
      calls += 1;
      if (calls < 5) bus.emit('event:B', { source: 'A' });
    });
    bus.on('event:B', () => {
      bus.emit('event:A', { source: 'B' });
    });

    expect(() => bus.emit('event:A')).toThrow(/Event Loop Detected: event:A -> event:B -> event:A/);
    expect(calls).toBe(1);
    expect(bus.getRecursionDiagnostics()).toMatchObject({
      lastCycle: ['event:A', 'event:B', 'event:A'],
      lastDepth: 3
    });
  });

  it('exposes a production build script with production mode', () => {
    expect(packageJson.scripts['build:prod']).toBe('vite build --mode production');
    expect(packageJson.scripts.prebuild).toContain('scripts/build-static-batches.js');
  });
});
