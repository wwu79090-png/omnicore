export class AnimationStateMachine {
  constructor(entity, {
    initial = null,
    states = {},
    transitions = []
  } = {}) {
    this.entity = entity;
    this.states = { ...states };
    this.transitions = [...transitions];
    this.current = initial || Object.keys(states)[0] || null;
    this.started = false;
  }

  start(state = this.current) {
    if (state) this.current = state;
    this.started = true;
    this._playCurrent();
    return this;
  }

  update(context = {}) {
    if (!this.started) this.start(this.current);
    const transition = this.transitions.find((item) => this._matchesTransition(item, context));
    if (!transition) return this.current;
    return this.setState(transition.to, context);
  }

  setState(name, context = {}) {
    if (!this.states[name] || this.current === name) return this.current;
    const previous = this.current;
    this.current = name;
    this.states[previous]?.onExit?.(context, this);
    this.states[name]?.onEnter?.(context, this);
    this._playCurrent();
    return this.current;
  }

  _matchesTransition(transition, context) {
    if (!transition || transition.from !== this.current) return false;
    if (typeof transition.when === 'function') return Boolean(transition.when(context, this));
    if (typeof transition.when === 'string') return Boolean(context[transition.when]);
    if (transition.when && typeof transition.when === 'object') {
      return Object.entries(transition.when).every(([key, value]) => context[key] === value);
    }
    return false;
  }

  _playCurrent() {
    const state = this.states[this.current];
    if (!state) return;
    const animation = state.animation || this.current;
    const loop = state.loop ?? true;
    this.entity?.play?.(animation, loop);
  }
}

export default AnimationStateMachine;
