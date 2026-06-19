import { createOmniError } from '../core/OmniError.js';

function getPath(target, path) {
  return String(path)
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), target);
}

/**
 * State-machine behavior tree used by EventSheet.
 *
 * It keeps state transitions declarative while using Store as the source of
 * truth. `onStateEnter` and `onStateExit` hooks reuse EventSheet-style actions.
 *
 * @example
 * const tree = new BehaviorTree({ initial: 'idle', states: { idle: { transitions: [] } } }, { store });
 * tree.attach();
 */
export class BehaviorTree {
  constructor(config = {}, { store = null, events = null, entity = null } = {}) {
    this.config = normalizeConfig(config);
    this.store = store;
    this.events = events;
    this.entity = entity;
    this.currentState = this.config.initial;
    this.triggered = [];
    this.unsubscribe = [];
  }

  attach({ store = this.store, events = this.events, entity = this.entity } = {}) {
    this.detach();
    this.store = store;
    this.events = events;
    this.entity = entity;
    const watch = this._watchKeys();
    for (const key of watch) {
      const off = this.store?.subscribe?.(key, () => this.tick());
      if (off) this.unsubscribe.push(off);
    }
    for (const event of this._eventNames()) {
      const off = this.events?.on?.(event, (payload) => this.tick(event, payload));
      if (off) this.unsubscribe.push(off);
    }
    this._runHooks(this._state()?.onStateEnter || [], 'enter', {});
    return this;
  }

  detach() {
    for (const off of this.unsubscribe) off?.();
    this.unsubscribe.length = 0;
  }

  tick(event = null, payload = null) {
    const state = this._state();
    if (!state) return this.currentState;
    for (const transition of state.transitions || []) {
      if (!this._transitionTriggerMatches(transition, event)) continue;
      if (!this._conditionsPass(transition.when || transition.conditions || [], { event, payload })) continue;
      this.transitionTo(transition.to || transition.transition, transition, { event, payload });
      break;
    }
    return this.currentState;
  }

  transitionTo(nextState, transition = {}, context = {}) {
    if (!nextState || nextState === this.currentState) return this.currentState;
    const previous = this.currentState;
    const previousState = this._state(previous);
    this._runHooks(previousState?.onStateExit || [], 'exit', context);
    this.currentState = nextState;
    this.triggered.push({ type: 'transition', from: previous, to: nextState, transition });
    this.events?.emit?.('behavior:transition', {
      from: previous,
      to: nextState,
      entity: this.entity,
      event: context.event,
      payload: context.payload
    });
    this._runHooks(this._state(nextState)?.onStateEnter || [], 'enter', context);
    return this.currentState;
  }

  debugTree() {
    return {
      activeState: this.currentState,
      states: Object.entries(this.config.states).map(([name, state]) => ({
        name,
        active: name === this.currentState,
        transitions: (state.transitions || []).map((transition) => ({
          to: transition.to || transition.transition,
          triggered: this.triggered.some((item) => item.to === (transition.to || transition.transition))
        }))
      })),
      triggered: [...this.triggered]
    };
  }

  _state(name = this.currentState) {
    return this.config.states[name] || null;
  }

  _conditionsPass(conditions, context = {}) {
    const list = Array.isArray(conditions) ? conditions : [conditions];
    return list.every((condition) => this._conditionPass(condition, context));
  }

  _conditionPass(condition = {}, context = {}) {
    if (!condition) return true;
    const left = this._value(condition.left, context);
    const right = this._value(condition.right ?? condition.value, context);
    switch (condition.op) {
      case 'lt': return left < right;
      case 'lte': return left <= right;
      case 'gt': return left > right;
      case 'gte': return left >= right;
      case 'equals': return left === right;
      case 'notEquals': return left !== right;
      case 'truthy': return Boolean(left);
      case 'falsy': return !left;
      default:
        throw createOmniError('BehaviorTree', `不支持的状态机条件：${condition.op}`);
    }
  }

  _transitionTriggerMatches(transition, event) {
    const transitionEvent = transition.on || transition.event;
    if (transitionEvent) return event === transitionEvent;
    return event == null;
  }

  _runHooks(actions, hook, context = {}) {
    for (const action of actions) {
      this.triggered.push({ type: hook, state: this.currentState, action });
      if (action.execute) this._execute(action.execute, context);
      else if (action.op === 'set') this._set(action.target, this._value(action.value, context));
      else if (action.op === 'emit') this.events?.emit?.(action.event, this._value(action.payload, context));
    }
  }

  _execute(name, context = {}) {
    const fn = this.store?.get?.(name);
    if (typeof fn === 'function') {
      fn({
        store: this.store,
        entity: this.entity,
        tree: this,
        event: context.event,
        payload: context.payload
      });
    }
  }

  _set(target, value) {
    if (String(target).startsWith('store.')) {
      this.store?.set?.(String(target).slice(6), value);
    }
  }

  _value(value, context = {}) {
    if (typeof value === 'string' && value.startsWith('store.')) return this.store?.get?.(value.slice(6));
    if (typeof value === 'string' && value.startsWith('payload.')) return getPath(context.payload, value.slice(8));
    if (typeof value === 'string' && value.startsWith('event.')) return getPath(context, value);
    if (value && typeof value === 'object' && '$path' in value) return this._value(value.$path, context);
    return value;
  }

  _watchKeys() {
    const keys = new Set();
    for (const state of Object.values(this.config.states)) {
      for (const transition of state.transitions || []) {
        for (const condition of transition.when || transition.conditions || []) {
          if (typeof condition.left === 'string' && condition.left.startsWith('store.')) keys.add(condition.left.slice(6));
        }
      }
    }
    return keys;
  }

  _eventNames() {
    const names = new Set();
    for (const state of Object.values(this.config.states)) {
      for (const transition of state.transitions || []) {
        const event = transition.on || transition.event;
        if (event) names.add(event);
      }
    }
    return names;
  }
}

function normalizeConfig(config = {}) {
  const states = normalizeStates(config.states || {});
  applyStateHooks(states, config.onStateEnter, 'onStateEnter');
  applyStateHooks(states, config.onStateExit, 'onStateExit');
  applyTopLevelTransitions(states, config.transitions || {});
  for (const state of Object.values(states)) {
    state.transitions = normalizeTransitions(state.transitions || []);
  }
  const initial = config.initial || Object.keys(states)[0] || config.state || 'default';
  if (!states[initial]) states[initial] = { transitions: [] };
  return { ...config, initial, states };
}

function normalizeStates(states) {
  if (Array.isArray(states)) {
    return Object.fromEntries(states.map((name) => [name, { transitions: [] }]));
  }
  return Object.fromEntries(Object.entries(states).map(([name, state]) => [
    name,
    {
      ...state,
      transitions: normalizeTransitions(state.transitions || [])
    }
  ]));
}

function applyStateHooks(states, hooks, key) {
  for (const [stateName, actions] of Object.entries(hooks || {})) {
    states[stateName] = states[stateName] || { transitions: [] };
    states[stateName][key] = [
      ...(states[stateName][key] || []),
      ...toArray(actions)
    ];
  }
}

function applyTopLevelTransitions(states, transitions) {
  for (const [key, value] of Object.entries(transitions || {})) {
    if (Object.prototype.hasOwnProperty.call(states, key) && isStateTransitionSet(value)) {
      states[key].transitions = [
        ...(states[key].transitions || []),
        ...normalizeTransitions(value)
      ];
      continue;
    }

    for (const state of Object.values(states)) {
      state.transitions = [
        ...(state.transitions || []),
        ...normalizeGlobalEventTransitions(key, value)
      ];
    }
  }
}

function isStateTransitionSet(value) {
  if (Array.isArray(value)) return true;
  if (!value || typeof value !== 'object') return false;
  return !('to' in value || 'transition' in value || 'when' in value || 'conditions' in value);
}

function normalizeGlobalEventTransitions(event, value) {
  if (typeof value === 'string') return [{ on: event, to: value }];
  if (Array.isArray(value)) {
    return value.map((transition) => normalizeTransition({ ...transition, on: transition.on || transition.event || event }));
  }
  if (value && typeof value === 'object') return [normalizeTransition({ ...value, on: value.on || value.event || event })];
  return [];
}

function normalizeTransitions(transitions) {
  if (Array.isArray(transitions)) return transitions.map((transition) => normalizeTransition(transition));
  if (!transitions || typeof transitions !== 'object') return [];
  if ('to' in transitions || 'transition' in transitions || 'when' in transitions || 'conditions' in transitions) {
    return [normalizeTransition(transitions)];
  }
  return Object.entries(transitions).map(([event, target]) => (
    typeof target === 'string'
      ? { on: event, to: target }
      : normalizeTransition({ ...target, on: target.on || target.event || event })
  ));
}

function normalizeTransition(transition = {}) {
  if (typeof transition === 'string') return { to: transition };
  return {
    ...transition,
    to: transition.to || transition.transition,
    on: transition.on || transition.event || null,
    when: toArray(transition.when || transition.conditions || [])
  };
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export default BehaviorTree;
