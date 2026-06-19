export class FrameProfiler {
  constructor({ enabled = true, limit = 120, clock = defaultClock } = {}) {
    this.enabled = enabled;
    this.limit = limit;
    this.clock = clock;
    this.frames = [];
    this.current = null;
  }

  startFrame({ frame = 0, time = this.clock() } = {}) {
    if (!this.enabled) return null;
    this.current = {
      frame,
      time,
      startedAt: this.clock(),
      totalMs: 0,
      sections: []
    };
    return this.current;
  }

  record(name, duration, meta = {}) {
    if (!this.enabled || !name || !this.current || !Number.isFinite(duration)) return null;
    const section = {
      name,
      duration: roundMs(duration),
      ...meta
    };
    this.current.sections.push(section);
    this.current.totalMs = roundMs(this.current.sections.reduce((sum, item) => sum + item.duration, 0));
    return section;
  }

  measure(name, fn, meta = {}) {
    if (!this.enabled || typeof fn !== 'function') return fn();
    const start = this.clock();
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.finally(() => this.record(name, this.clock() - start, meta));
    }
    this.record(name, this.clock() - start, meta);
    return result;
  }

  endFrame() {
    if (!this.enabled || !this.current) return null;
    const frame = {
      frame: this.current.frame,
      time: this.current.time,
      totalMs: roundMs(this.current.totalMs || this.clock() - this.current.startedAt),
      sections: this.current.sections.map((section) => ({ ...section }))
    };
    this.frames.push(frame);
    if (this.frames.length > this.limit) this.frames.shift();
    this.current = null;
    return frame;
  }

  latest() {
    return this.frames[this.frames.length - 1] || null;
  }

  export() {
    return {
      frames: this.frames.map((frame) => ({
        ...frame,
        sections: frame.sections.map((section) => ({ ...section }))
      }))
    };
  }

  summarize({
    frameBudgetMs = 16.7,
    sectionBudgetMs = 8
  } = {}) {
    const frames = this.frames.map((frame) => ({
      ...frame,
      totalMs: roundMs(frame.totalMs || 0),
      sections: frame.sections.map((section) => ({ ...section }))
    }));
    const frameDurations = frames.map((frame) => frame.totalMs).sort((left, right) => left - right);
    const sectionStats = new Map();

    for (const frame of frames) {
      for (const section of frame.sections) {
        const current = sectionStats.get(section.name) || {
          name: section.name,
          count: 0,
          totalMs: 0,
          maxMs: 0,
          p95Ms: 0,
          samples: [],
          lastMeta: {}
        };
        const duration = Number(section.duration) || 0;
        current.count += 1;
        current.totalMs += duration;
        current.maxMs = Math.max(current.maxMs, duration);
        current.samples.push(duration);
        const { name, duration: ignoredDuration, ...meta } = section;
        current.lastMeta = meta;
        sectionStats.set(section.name, current);
      }
    }

    const sections = Array.from(sectionStats.values())
      .map((section) => {
        const sorted = section.samples.sort((left, right) => left - right);
        const avgMs = section.count ? section.totalMs / section.count : 0;
        return {
          name: section.name,
          count: section.count,
          avgMs: roundMs(avgMs),
          maxMs: roundMs(section.maxMs),
          p95Ms: roundMs(percentile(sorted, 0.95)),
          totalMs: roundMs(section.totalMs),
          overBudget: section.maxMs > sectionBudgetMs || avgMs > sectionBudgetMs,
          lastMeta: section.lastMeta
        };
      })
      .sort((left, right) => right.totalMs - left.totalMs);

    const slowestFrame = frames.reduce((slowest, frame) => {
      if (!slowest || frame.totalMs > slowest.totalMs) return frame;
      return slowest;
    }, null);

    return {
      frameCount: frames.length,
      frameBudgetMs,
      sectionBudgetMs,
      avgFrameMs: roundMs(average(frameDurations)),
      p95FrameMs: roundMs(percentile(frameDurations, 0.95)),
      maxFrameMs: roundMs(frameDurations[frameDurations.length - 1] || 0),
      overBudgetFrames: frames.filter((frame) => frame.totalMs > frameBudgetMs).length,
      slowestFrame,
      sections
    };
  }

  recommend(options = {}) {
    const summary = this.summarize(options);
    const recommendations = [];

    if (summary.p95FrameMs > summary.frameBudgetMs) {
      recommendations.push({
        code: 'frame-budget-p95',
        severity: 'warning',
        message: `p95 frame time ${summary.p95FrameMs}ms exceeds ${summary.frameBudgetMs}ms.`,
        action: 'Profile the hottest update/render sections and reduce per-frame allocations.'
      });
    }

    for (const section of summary.sections.filter((item) => item.overBudget).slice(0, 5)) {
      recommendations.push({
        code: 'hot-section',
        severity: 'warning',
        section: section.name,
        message: `${section.name} reached ${section.maxMs}ms and averaged ${section.avgMs}ms.`,
        action: recommendationForSection(section)
      });
    }

    if (summary.overBudgetFrames > 0 && recommendations.length === 0) {
      recommendations.push({
        code: 'sporadic-long-frame',
        severity: 'info',
        message: `${summary.overBudgetFrames} frames exceeded the frame budget.`,
        action: 'Record longer sessions and compare slowest-frame section metadata.'
      });
    }

    return recommendations;
  }

  clear() {
    this.frames.length = 0;
    this.current = null;
  }
}

function defaultClock() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function roundMs(value) {
  return Number(value.toFixed(3));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sortedValues, ratio) {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1);
  return sortedValues[index] || 0;
}

function recommendationForSection(section) {
  const name = String(section.name || '').toLowerCase();
  if (name.includes('render')) return 'Reduce draw calls, batch by texture/material, and precompile static layers.';
  if (name.includes('physics')) return 'Sleep offscreen bodies, reduce broadphase pairs, or move static collisions into baked geometry.';
  if (name.includes('asset') || name.includes('load')) return 'Preload or stream assets incrementally and avoid decoding during gameplay frames.';
  if (name.includes('event')) return 'Cache EventSheet predicates and batch high-frequency event dispatch.';
  return 'Inspect allocations and split this section across frames or workers.';
}

export default FrameProfiler;
