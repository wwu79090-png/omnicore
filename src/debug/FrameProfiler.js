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

export default FrameProfiler;
