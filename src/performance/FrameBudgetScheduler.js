import { createOmniError } from '../core/OmniError.js';

/**
 * Runtime frame-budget scheduler for slicing non-critical work.
 */
export class FrameBudgetScheduler {
  constructor({
    frameBudgetMs = 6,
    targetFrameMs = 1000 / 60,
    lowFpsThreshold = 3,
    degradationHandlers = []
  } = {}) {
    this.frameBudgetMs = Math.max(0, Number(frameBudgetMs) || 0);
    this.targetFrameMs = Math.max(1, Number(targetFrameMs) || (1000 / 60));
    this.lowFpsThreshold = Math.max(1, Number(lowFpsThreshold) || 1);
    this.degradationHandlers = new Set(degradationHandlers.filter((handler) => typeof handler === 'function'));
    this.queue = [];
    this.consecutiveLowFpsFrames = 0;
    this.degradationLevel = 0;
  }

  enqueue(run, { label = 'task', costMs = 1, critical = false } = {}) {
    if (typeof run !== 'function') throw createOmniError('FrameBudgetScheduler', 'Task must be a function.');
    this.queue.push({
      label,
      costMs: normalizeCost(costMs),
      critical: Boolean(critical),
      run
    });
    return this.queue.length;
  }

  enqueueSliced(label, items, runItem, { costMsPerItem = 1, critical = false } = {}) {
    if (typeof runItem !== 'function') {
      throw createOmniError('FrameBudgetScheduler', 'Sliced task must be a function.');
    }
    const pending = Array.from(items || []);
    if (!pending.length) return this.queue.length;
    this.queue.push({
      label,
      costMs: normalizeCost(costMsPerItem),
      critical: Boolean(critical),
      run: () => runItem(pending.shift()),
      remaining: () => pending.length
    });
    return this.queue.length;
  }

  onDegrade(handler) {
    if (typeof handler !== 'function') {
      throw createOmniError('FrameBudgetScheduler', 'Degradation handler must be a function.');
    }
    this.degradationHandlers.add(handler);
    return () => this.degradationHandlers.delete(handler);
  }

  runFrame({ frameTimeMs = this.targetFrameMs } = {}) {
    const budget = this.frameBudgetMs;
    let spent = 0;
    let executed = 0;
    const deferredLabels = [];

    while (this.queue.length) {
      const task = this.queue[0];
      if (!task.critical && executed > 0 && spent + task.costMs > budget) {
        deferredLabels.push(task.label);
        break;
      }

      task.run();
      spent += task.costMs;
      executed += 1;
      if (typeof task.remaining === 'function' && task.remaining() > 0) {
        if (!task.critical && spent + task.costMs > budget) deferredLabels.push(task.label);
        else continue;
        break;
      }
      this.queue.shift();
    }

    const degradation = this._updateDegradation(frameTimeMs);
    return {
      executed,
      spentMs: Number(spent.toFixed(3)),
      deferred: deferredLabels.length,
      deferredLabels,
      remaining: this.queue.length,
      degraded: Boolean(degradation),
      degradation
    };
  }

  pendingCount() {
    return this.queue.length;
  }

  _updateDegradation(frameTimeMs) {
    if (Number(frameTimeMs) > this.targetFrameMs) this.consecutiveLowFpsFrames += 1;
    else this.consecutiveLowFpsFrames = 0;

    if (this.consecutiveLowFpsFrames < this.lowFpsThreshold) return null;
    this.degradationLevel += 1;
    const payload = {
      level: this.degradationLevel,
      reason: 'consecutive-low-fps',
      frameTimeMs: Number(frameTimeMs),
      targetFrameMs: this.targetFrameMs,
      consecutiveLowFpsFrames: this.consecutiveLowFpsFrames
    };
    for (const handler of this.degradationHandlers) handler(payload);
    this.consecutiveLowFpsFrames = 0;
    return payload;
  }
}

function normalizeCost(value) {
  return Math.max(0, Number(value) || 0);
}

export default FrameBudgetScheduler;
