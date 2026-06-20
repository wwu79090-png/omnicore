import Tween from '../tween/Tween.js';

/**
 * UI state transition coordinator for menus, panels, and unlock flows.
 */
export class UIStateMachine {
  constructor({ initial = null, states = {} } = {}) {
    this.initial = initial;
    this.states = { ...states };
    this.current = null;
    this.transition = null;
    this.started = false;
  }

  addState(name, config = {}) {
    this.states[name] = config;
    return this;
  }

  start(initial = this.initial) {
    this.current = initial;
    this.started = true;
    this.states[this.current]?.onEnter?.({ state: this.current, machine: this });
    return this;
  }

  transitionTo(next, {
    duration = 0,
    animations = [],
    payload = {}
  } = {}) {
    if (!this.started) this.start(this.current || this.initial || next);
    const from = this.current;
    this.states[from]?.onExit?.({ from, to: next, payload, machine: this });
    const tweens = animations.map((animation) => Tween.to(animation.target, {
      ...animation.props,
      duration,
      ease: animation.ease || 'linear',
      autoplay: false
    }).play());
    this.transition = {
      from,
      to: next,
      payload,
      elapsed: 0,
      duration: Math.max(0, Number(duration) || 0),
      tweens
    };
    if (this.transition.duration === 0) this._finishTransition();
    return this.transition;
  }

  update(deltaMs = 0) {
    if (!this.transition) return this;
    const delta = Math.max(0, Number(deltaMs) || 0);
    this.transition.elapsed += delta;
    for (const tween of this.transition.tweens) tween.update(delta);
    if (this.transition.elapsed >= this.transition.duration) this._finishTransition();
    return this;
  }

  _finishTransition() {
    const { transition } = this;
    if (!transition) return;
    this.current = transition.to;
    this.transition = null;
    this.states[this.current]?.onEnter?.({
      from: transition.from,
      state: this.current,
      payload: transition.payload,
      machine: this
    });
  }
}

export default UIStateMachine;
