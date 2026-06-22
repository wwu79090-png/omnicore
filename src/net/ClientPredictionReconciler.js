export class ClientPredictionReconciler {
  constructor({ initialState = {}, reducer = defaultReducer } = {}) {
    this.currentState = clone(initialState);
    this.reducer = reducer;
    this.inputs = [];
  }

  recordInput({ tick = 0, input = {} } = {}) {
    const entry = {
      tick: Number(tick) || 0,
      input: clone(input),
      before: clone(this.currentState)
    };
    this.currentState = clone(this.reducer(this.currentState, entry.input));
    entry.after = clone(this.currentState);
    this.inputs.push(entry);
    this.inputs.sort((a, b) => a.tick - b.tick);
    return clone(entry);
  }

  reconcile({ tick = 0, state = {} } = {}) {
    const authoritativeTick = Number(tick) || 0;
    const authoritativeState = clone(state);
    const prediction = this.inputs.find((entry) => entry.tick === authoritativeTick);
    const before = prediction ? prediction.after : this.currentState;
    const corrected = !same(before, authoritativeState);
    const pending = this.inputs.filter((entry) => entry.tick > authoritativeTick);

    this.currentState = authoritativeState;
    const replayedTicks = [];
    const replayed = [];
    for (const entry of pending) {
      const beforeReplay = clone(this.currentState);
      this.currentState = clone(this.reducer(this.currentState, entry.input));
      replayedTicks.push(entry.tick);
      replayed.push({
        tick: entry.tick,
        input: clone(entry.input),
        before: beforeReplay,
        after: clone(this.currentState)
      });
    }
    this.inputs = replayed;

    return {
      authoritativeTick,
      corrected,
      correction: corrected ? { before: clone(before), after: authoritativeState } : null,
      replayedTicks,
      state: clone(this.currentState)
    };
  }

  state() {
    return clone(this.currentState);
  }

  pendingInputs() {
    return this.inputs.map(clone);
  }
}

function defaultReducer(state, input) {
  return { ...clone(state), ...clone(input) };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default ClientPredictionReconciler;
