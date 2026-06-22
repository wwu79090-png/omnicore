export class RollbackFrameStore {
  constructor({ capacity = 120 } = {}) {
    this.capacity = Math.max(1, Math.floor(Number(capacity) || 120));
    this.frames = [];
  }

  save({ tick = 0, state = {} } = {}) {
    const frame = { tick: Number(tick) || 0, state: clone(state) };
    const existing = this.frames.findIndex((entry) => entry.tick === frame.tick);
    if (existing >= 0) this.frames.splice(existing, 1, frame);
    else this.frames.push(frame);
    this.frames.sort((a, b) => a.tick - b.tick);
    while (this.frames.length > this.capacity) this.frames.shift();
    return this;
  }

  restore(tick) {
    const frame = this.frames.find((entry) => entry.tick === Number(tick));
    return frame ? clone(frame.state) : null;
  }

  range({ fromTick = -Infinity, toTick = Infinity } = {}) {
    return this.frames
      .filter((frame) => frame.tick >= fromTick && frame.tick <= toTick)
      .map((frame) => ({ tick: frame.tick, state: clone(frame.state) }));
  }

  snapshot() {
    return {
      capacity: this.capacity,
      ticks: this.frames.map((frame) => frame.tick),
      frames: this.range()
    };
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default RollbackFrameStore;
