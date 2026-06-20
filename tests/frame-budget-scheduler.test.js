import { describe, expect, it, vi } from 'vitest';
import FrameBudgetScheduler from '../src/performance/FrameBudgetScheduler.js';

describe('FrameBudgetScheduler', () => {
  it('slices queued work so a frame never runs past its budget', () => {
    const processed = [];
    const scheduler = new FrameBudgetScheduler({ frameBudgetMs: 4 });

    scheduler.enqueueSliced('bulk-import', [1, 2, 3, 4, 5], (item) => {
      processed.push(item);
    }, { costMsPerItem: 2 });

    const first = scheduler.runFrame({ frameTimeMs: 12 });
    const second = scheduler.runFrame({ frameTimeMs: 12 });
    const third = scheduler.runFrame({ frameTimeMs: 12 });

    expect(first).toMatchObject({ executed: 2, deferred: 1, remaining: 1 });
    expect(second).toMatchObject({ executed: 2, deferred: 1, remaining: 1 });
    expect(third).toMatchObject({ executed: 1, deferred: 0, remaining: 0 });
    expect(processed).toEqual([1, 2, 3, 4, 5]);
  });

  it('escalates degradation after consecutive low-fps frames without dropping queued work', () => {
    const work = [];
    const onDegrade = vi.fn();
    const scheduler = new FrameBudgetScheduler({
      frameBudgetMs: 4,
      targetFrameMs: 16,
      lowFpsThreshold: 2,
      degradationHandlers: [onDegrade]
    });

    scheduler.enqueue(() => work.push('a'), { label: 'a', costMs: 3 });
    scheduler.enqueue(() => work.push('b'), { label: 'b', costMs: 3 });

    const first = scheduler.runFrame({ frameTimeMs: 20 });
    const second = scheduler.runFrame({ frameTimeMs: 40 });

    expect(first).toMatchObject({ executed: 1, deferred: 1, degraded: false });
    expect(second).toMatchObject({ executed: 1, deferred: 0, degraded: true });
    expect(work).toEqual(['a', 'b']);
    expect(onDegrade).toHaveBeenCalledWith(expect.objectContaining({
      level: 1,
      reason: 'consecutive-low-fps',
      consecutiveLowFpsFrames: 2
    }));
  });
});
