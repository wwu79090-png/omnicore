import { stableHash } from '../quality/EngineQualityHarness.js';

export class SeededRandom {
  constructor(seed = 1) {
    this.seed = normalizeSeed(seed);
    this.state = this.seed;
  }

  next() {
    this.state = (this.state * 48271) % 2147483647;
    return this.state / 2147483647;
  }

  int(min = 0, max = 1) {
    const low = Math.ceil(Number(min));
    const high = Math.floor(Number(max));
    return Math.floor(this.next() * (high - low + 1)) + low;
  }

  snapshot() {
    return {
      seed: this.seed,
      state: this.state
    };
  }

  restore(snapshot = {}) {
    this.seed = normalizeSeed(snapshot.seed || this.seed);
    this.state = normalizeSeed(snapshot.state || this.seed);
    return this;
  }
}

export class DeterministicReplay {
  constructor({ seed = 1, fixedDelta = 1 / 60 } = {}) {
    this.seed = normalizeSeed(seed);
    this.fixedDelta = Number(fixedDelta) || 1 / 60;
    this.random = new SeededRandom(this.seed);
    this.frames = [];
    this.inputs = [];
  }

  recordInput(action, {
    frame = this.frames.length,
    down = true,
    value = 1,
    source = 'manual'
  } = {}) {
    const input = {
      frame,
      action,
      down: Boolean(down),
      value,
      source
    };
    this.inputs.push(input);
    return input;
  }

  step(state = {}, reducer = defaultReducer) {
    const frame = {
      index: this.frames.length,
      delta: this.fixedDelta,
      random: this.random.next(),
      inputs: this.inputs.filter((input) => input.frame === this.frames.length)
    };
    frame.state = reducer(state, frame);
    this.frames.push(frame);
    return frame.state;
  }

  playback(initialState = {}, reducer = defaultReducer) {
    const replay = new DeterministicReplay({ seed: this.seed, fixedDelta: this.fixedDelta });
    replay.inputs = this.inputs.map((input) => ({ ...input }));
    let state = clone(initialState);
    for (let index = 0; index < this.frames.length; index += 1) state = replay.step(state, reducer);
    return {
      state,
      hash: replay.hash(),
      frames: replay.frames
    };
  }

  serialize() {
    return {
      schema: 'omnicore.deterministic-replay.v1',
      seed: this.seed,
      fixedDelta: this.fixedDelta,
      frames: this.frames.map((frame) => ({
        index: frame.index,
        delta: frame.delta,
        random: frame.random,
        inputs: frame.inputs,
        state: frame.state
      })),
      inputs: this.inputs.map((input) => ({ ...input }))
    };
  }

  hash() {
    return stableHash(this.serialize());
  }
}

function normalizeSeed(seed) {
  const value = Math.abs(Math.trunc(Number(seed) || 1)) % 2147483647;
  return value === 0 ? 1 : value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultReducer(state, frame) {
  return {
    ...clone(state),
    frame: frame.index,
    inputs: frame.inputs
  };
}

export default DeterministicReplay;
