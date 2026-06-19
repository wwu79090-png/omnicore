import { afterEach, describe, expect, it, vi } from 'vitest';
import { Kernel, SplashScreen } from '../../src/index.js';

describe('microkernel Kernel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('warns when registering the same addon twice and keeps the latest addon', () => {
    const logger = { warn: vi.fn() };
    const first = { init: vi.fn() };
    const second = { init: vi.fn() };
    const kernel = new Kernel({ logger });

    kernel.addon('renderer', first);
    kernel.addon('renderer', second);
    kernel.use('renderer');

    expect(logger.warn).toHaveBeenCalledWith('microkernel', 'Addon 已存在，将覆盖注册：renderer');
    expect(first.init).not.toHaveBeenCalled();
    expect(second.init).toHaveBeenCalledWith(kernel, {});
  });

  it('flushes only the latest dirty entity data in a requestAnimationFrame micro loop', () => {
    const frames = [];
    const logger = { warn: vi.fn() };
    const kernel = new Kernel({
      debug: true,
      logger,
      performanceThreshold: 2,
      requestAnimationFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelAnimationFrame: vi.fn()
    });
    const renderer = {
      renderDirty: vi.fn(({ dirty }) => {
        dirty.forEach(() => {
          kernel.recordDrawInstruction();
          kernel.recordDrawInstruction();
          kernel.recordDrawInstruction();
        });
      })
    };

    kernel.attachRenderer(renderer);
    kernel.updateEntity('hero', { x: 1 });
    kernel.updateEntity('hero', { x: 2 });
    frames.shift()(16);

    expect(renderer.renderDirty).toHaveBeenCalledTimes(1);
    expect(renderer.renderDirty).toHaveBeenCalledWith(
      expect.objectContaining({
        dirty: [{ key: 'entity:hero', value: { x: 2 } }]
      })
    );
    expect(logger.warn).toHaveBeenCalledWith('microkernel', '单帧绘制指令过多：3');

    kernel.destroy();
  });

  it('keeps splash screen DOM until the 500ms minimum duration and removes it before 600ms', async () => {
    vi.useFakeTimers();
    const splash = new SplashScreen({ text: 'Timed Boot', minDuration: 500, fadeDuration: 50 });

    splash.show();
    const hidden = splash.hide();
    await vi.advanceTimersByTimeAsync(499);

    expect(document.querySelector('[data-omnicore-splash]')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(100);
    await hidden;

    expect(document.querySelector('[data-omnicore-splash]')).toBeNull();
  });
});
