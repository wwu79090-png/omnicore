import { describe, expect, it, vi } from 'vitest';
import EventBus from '../../src/core/EventBus.js';
import {
  createCanvas,
  detectEnvironment,
  normalizeConfig,
  safeInitialize
} from '../../src/core/Bootstrap.js';
import { Backend, Game } from '../../src/core/OmniCore.js';

describe('OmniCore core public contract', () => {
  it('keeps EventBus on/off/emit/clear behavior stable', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const off = bus.on('ready', handler);

    bus.emit('ready', { scene: 'boot' });
    off();
    bus.emit('ready', { scene: 'ignored' });
    bus.clear();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ scene: 'boot' });
    expect(bus.listeners.size).toBe(0);
  });

  it('keeps Bootstrap normalization, canvas creation, environment detection, and safe fallback stable', async () => {
    const config = normalizeConfig({ width: 320, height: 180, renderer: 'canvas' });
    const canvas = createCanvas(320, 180);
    const env = detectEnvironment({ navigator: { userAgent: 'MicroMessenger MiniGame' }, wx: { request() {} } });
    const fallback = await safeInitialize('FailingModule', () => {
      throw new Error('boom');
    }, 'fallback');

    expect(config.width).toBe(320);
    expect(config.renderer).toBe('canvas');
    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(180);
    expect(env.platform).toBe('wechat');
    expect(env.skipThree).toBe(true);
    expect(fallback).toBe('fallback');
  });

  it('keeps Game and Backend public methods available without changing signatures', () => {
    const game = new Game({ renderer: 'canvas', autoStart: false, autoAttach: false });

    expect(typeof game.init).toBe('function');
    expect(typeof game.start).toBe('function');
    expect(typeof game.pause).toBe('function');
    expect(typeof game.resume).toBe('function');
    expect(typeof game.destroy).toBe('function');
    expect(typeof game.createRenderer).toBe('function');
    expect(typeof Backend.bind).toBe('function');
    expect(typeof Backend.switch).toBe('function');
  });
});
