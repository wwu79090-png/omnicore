import { afterEach, describe, expect, it, vi } from 'vitest';
import OmniCore, { Tween } from '../src/index.js';

describe('migration foundation tools', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete globalThis.fetch;
  });

  it('creates debug grid overlay lines only when debug is enabled', () => {
    const grid = OmniCore.Debug.Grid({
      debug: true,
      width: 64,
      height: 32,
      cellSize: 16,
      color: 'rgba(255, 255, 255, 0.25)'
    });

    expect(grid.enabled).toBe(true);
    expect(grid.lines).toEqual([
      { x1: 0, y1: 0, x2: 0, y2: 32 },
      { x1: 16, y1: 0, x2: 16, y2: 32 },
      { x1: 32, y1: 0, x2: 32, y2: 32 },
      { x1: 48, y1: 0, x2: 48, y2: 32 },
      { x1: 64, y1: 0, x2: 64, y2: 32 },
      { x1: 0, y1: 0, x2: 64, y2: 0 },
      { x1: 0, y1: 16, x2: 64, y2: 16 },
      { x1: 0, y1: 32, x2: 64, y2: 32 }
    ]);
    expect(OmniCore.Debug.Grid({ debug: false, width: 64, height: 32 }).lines).toEqual([]);
  });

  it('parses hex colors into normalized rgba records', () => {
    expect(OmniCore.Color.from('#369')).toMatchObject({
      r: 51,
      g: 102,
      b: 153,
      a: 1,
      hex: '#336699',
      css: 'rgba(51, 102, 153, 1)'
    });
    expect(OmniCore.Color.from('#33669980')).toMatchObject({
      r: 51,
      g: 102,
      b: 153,
      a: 0.502
    });
    expect(() => OmniCore.Color.from('336699')).toThrow(/hex/);
  });

  it('safe parses json and returns the fallback on invalid payloads', () => {
    expect(OmniCore.Data.safeParse('{"level":1}')).toEqual({ level: 1 });
    expect(OmniCore.Data.safeParse('{bad json')).toBeNull();
    expect(OmniCore.Data.safeParse('{bad json', { level: 0 })).toEqual({ level: 0 });
  });

  it('calculates distance and radius checks from points or numeric coordinates', () => {
    expect(OmniCore.Math.distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(OmniCore.Math.distance(0, 0, 6, 8)).toBe(10);
    expect(OmniCore.Math.isInRadius({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
    expect(OmniCore.Math.isInRadius(0, 0, 6, 8, 9)).toBe(false);
  });

  it('fetches with timeout and aborts stalled requests', async () => {
    vi.useFakeTimers();
    const abortSignals = [];
    globalThis.fetch = vi.fn((url, options) => {
      abortSignals.push(options.signal);
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    });

    const request = OmniCore.Net.fetchWithTimeout('/slow.json', 25);
    const expectation = expect(request).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(25);

    await expectation;
    expect(globalThis.fetch).toHaveBeenCalledWith('/slow.json', expect.objectContaining({ signal: abortSignals[0] }));
    expect(abortSignals[0].aborted).toBe(true);
  });

  it('exposes Tween isPlaying, pause, and resume controls', () => {
    const target = { x: 0 };
    const tween = new Tween(target, {
      x: { from: 0, to: 10 },
      duration: 100,
      ease: 'linear',
      autoplay: false
    });

    expect(tween.isPlaying).toBe(false);
    tween.play();
    expect(tween.isPlaying).toBe(true);
    tween.update(50);
    expect(target.x).toBe(5);
    tween.pause();
    expect(tween.isPlaying).toBe(false);
    tween.update(50);
    expect(target.x).toBe(5);
    tween.resume();
    expect(tween.isPlaying).toBe(true);
    tween.update(50);
    expect(target.x).toBe(10);
  });
});
