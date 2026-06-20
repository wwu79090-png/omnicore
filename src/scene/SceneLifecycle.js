import { createOmniError } from '../core/OmniError.js';

export const SCENE_LIFECYCLE_ORDER = Object.freeze([
  'created',
  'init',
  'preload',
  'create',
  'enter',
  'pause',
  'resume',
  'leave',
  'destroyed'
]);

export class SceneLifecycle {
  constructor({ name = 'scene', owner = null } = {}) {
    this.name = name;
    this.owner = owner;
    this.state = 'created';
    this.history = [{ state: this.state, at: Date.now() }];
    this.destroyed = false;
    this.abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  }

  get signal() {
    return this.abortController?.signal || { aborted: this.destroyed };
  }

  transition(state, detail = {}) {
    if (!SCENE_LIFECYCLE_ORDER.includes(state)) {
      throw createOmniError('SceneLifecycle', `Unknown scene lifecycle state: ${state}`);
    }
    if (this.destroyed && state !== 'destroyed') {
      throw createOmniError('SceneLifecycle', `Scene "${this.name}" is already destroyed.`, {
        code: 'OMNICORE_SCENE_DESTROYED',
        category: 'scene',
        recoverable: false
      });
    }
    this.state = state;
    if (state === 'destroyed') {
      this.destroyed = true;
      this.abortController?.abort?.();
    }
    const record = { state, detail, at: Date.now() };
    this.history.push(record);
    return record;
  }

  assertAlive() {
    if (!this.destroyed) return true;
    throw createOmniError('SceneLifecycle', `Scene "${this.name}" was used after destroy.`, {
      code: 'OMNICORE_SCENE_AFTER_DESTROY',
      category: 'scene',
      recoverable: false
    });
  }

  guard(callback, { fallback = undefined } = {}) {
    return (...args) => {
      if (this.destroyed) return fallback;
      return callback(...args);
    };
  }

  snapshot() {
    return {
      name: this.name,
      state: this.state,
      destroyed: this.destroyed,
      aborted: Boolean(this.signal.aborted),
      history: this.history.map((item) => ({ ...item }))
    };
  }
}

export default SceneLifecycle;
