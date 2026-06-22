export class NetworkSnapshotBuffer {
  constructor({ capacity = 32 } = {}) {
    this.capacity = Math.max(1, Math.floor(Number(capacity) || 32));
    this.snapshots = [];
  }

  push({ tick = 0, timeMs = tick, state = {} } = {}) {
    this.snapshots.push({
      tick: Number(tick) || 0,
      timeMs: Number(timeMs) || 0,
      state: clone(state)
    });
    this.snapshots.sort((a, b) => a.timeMs - b.timeMs || a.tick - b.tick);
    while (this.snapshots.length > this.capacity) this.snapshots.shift();
    return this;
  }

  sample(timeMs, { extrapolateMs = 0 } = {}) {
    const target = Number(timeMs) || 0;
    if (this.snapshots.length === 0) return null;
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    if (target <= first.timeMs) return formatSample('clamp-past', first, first, 0);

    for (let index = 0; index < this.snapshots.length - 1; index += 1) {
      const from = this.snapshots[index];
      const to = this.snapshots[index + 1];
      if (target >= from.timeMs && target <= to.timeMs) {
        const alpha = ratio(target, from.timeMs, to.timeMs);
        return formatSample('interpolate', from, to, alpha);
      }
    }

    const maxExtrapolate = Math.max(0, Number(extrapolateMs) || 0);
    if (this.snapshots.length >= 2 && target - last.timeMs <= maxExtrapolate) {
      const from = this.snapshots[this.snapshots.length - 2];
      return formatSample('extrapolate', from, last, ratio(target, from.timeMs, last.timeMs));
    }
    return formatSample('clamp-future', last, last, 1);
  }

  snapshot() {
    return {
      capacity: this.capacity,
      ticks: this.snapshots.map((snapshot) => snapshot.tick),
      snapshots: this.snapshots.map(clone)
    };
  }
}

function formatSample(mode, from, to, alpha) {
  return {
    mode,
    fromTick: from.tick,
    toTick: to.tick,
    alpha: round(alpha),
    state: blend(from.state, to.state, alpha)
  };
}

function ratio(value, from, to) {
  if (to === from) return 0;
  return (value - from) / (to - from);
}

function blend(left, right, alpha) {
  if (typeof left === 'number' && typeof right === 'number') return round(left + ((right - left) * alpha));
  if (Array.isArray(left) && Array.isArray(right)) {
    return right.map((value, index) => blend(left[index], value, alpha));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return Object.fromEntries([...keys].sort().map((key) => [key, blend(left[key], right[key], alpha)]));
  }
  return alpha >= 0.5 ? clone(right) : clone(left);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function round(value) {
  return Number(value.toFixed(3));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default NetworkSnapshotBuffer;
