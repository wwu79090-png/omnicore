export class StartupProfiler {
  constructor({ now = defaultNow } = {}) {
    this.now = now;
    this.marks = [];
  }

  mark(name, meta = {}) {
    const at = Number(this.now());
    this.marks.push({
      name,
      at: Number.isFinite(at) ? at : 0,
      meta
    });
    return this;
  }

  report() {
    if (!this.marks.length) {
      return {
        format: 'OmniCore.StartupProfile',
        totalMs: 0,
        phases: []
      };
    }
    const start = this.marks[0].at;
    const phases = this.marks.map((mark, index) => {
      const previous = index === 0 ? start : this.marks[index - 1].at;
      return {
        name: mark.name,
        at: round(mark.at - start),
        durationMs: round(mark.at - previous),
        meta: mark.meta
      };
    });
    return {
      format: 'OmniCore.StartupProfile',
      version: 1,
      totalMs: round(this.marks[this.marks.length - 1].at - start),
      phases,
      bottlenecks: phases
        .slice()
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 5)
    };
  }
}

function defaultNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function round(value) {
  return Number(value.toFixed(3));
}

export default StartupProfiler;
