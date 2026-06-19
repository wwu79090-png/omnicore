import Easing from '../math/Easing.js';

/**
 * Timeline animation controller driven by JSON keyframes.
 *
 * @example
 * const timeline = new Timeline({ targets: { hero } });
 * timeline.load({ duration: 1000, tracks: [...] }).play();
 * timeline.update(16);
 */
export class Timeline {
  constructor({ targets = {}, events = {}, loop = false } = {}) {
    this.targets = targets;
    this.eventHandlers = events;
    this.loop = loop;
    this.duration = 0;
    this.tracks = [];
    this.events = [];
    this.time = 0;
    this.playing = false;
    this.firedEvents = new Set();
  }

  load(json = {}, runtime = {}) {
    const branch = selectBranch(json.branches || [], runtime);
    this.duration = json.duration || 0;
    this.loop = json.loop ?? this.loop;
    this.tracks = [...(json.tracks || []), ...(branch?.tracks || [])].map((track) => ({
      ...track,
      keyframes: [...(track.keyframes || [])].sort((a, b) => a.time - b.time)
    }));
    this.events = [...(json.events || []), ...(branch?.events || [])].sort((a, b) => a.time - b.time);
    this.branch = branch || null;
    this.time = 0;
    this.firedEvents.clear();
    this.seek(0);
    return this;
  }

  play() {
    this.playing = true;
    return this;
  }

  pause() {
    this.playing = false;
    return this;
  }

  stop() {
    this.playing = false;
    this.time = 0;
    this.firedEvents.clear();
    this.seek(0);
    return this;
  }

  update(deltaMs) {
    if (!this.playing) return this;
    return this.seek(this.time + deltaMs);
  }

  seek(timeMs) {
    const previous = this.time;
    this.time = this._normalizeTime(timeMs);
    this._applyTracks();
    this._emitEvents(previous, this.time);
    return this;
  }

  _normalizeTime(timeMs) {
    if (this.duration <= 0) return Math.max(0, timeMs);
    if (this.loop) {
      if (timeMs >= this.duration) this.firedEvents.clear();
      return timeMs % this.duration;
    }
    if (timeMs >= this.duration) this.playing = false;
    return Math.max(0, Math.min(timeMs, this.duration));
  }

  _applyTracks() {
    for (const track of this.tracks) {
      const target = this.targets[track.target] || track.target;
      if (!target || typeof target === 'string') continue;
      const value = this._sample(track);
      setPath(target, track.property, value);
    }
  }

  _sample(track) {
    const frames = track.keyframes;
    if (!frames.length) return undefined;
    if (this.time <= frames[0].time) return frames[0].value;
    if (this.time >= frames[frames.length - 1].time) return frames[frames.length - 1].value;

    let left = frames[0];
    let right = frames[frames.length - 1];
    for (let index = 0; index < frames.length - 1; index += 1) {
      if (this.time >= frames[index].time && this.time <= frames[index + 1].time) {
        left = frames[index];
        right = frames[index + 1];
        break;
      }
    }

    const span = right.time - left.time || 1;
    const local = (this.time - left.time) / span;
    const easeName = right.ease || left.ease || 'linear';
    const ease = Easing[easeName] || Easing.linear;
    return interpolate(left.value, right.value, ease(local));
  }

  _emitEvents(previous, current) {
    for (const item of this.events) {
      const key = `${item.name}:${item.time}`;
      if (this.firedEvents.has(key)) continue;
      if (item.time > previous && item.time <= current) {
        this.firedEvents.add(key);
        this.eventHandlers[item.name]?.(item.payload, { time: item.time, timeline: this });
      }
    }
  }
}

function selectBranch(branches, runtime) {
  return branches.find((branch) => evaluateCondition(branch.condition, runtime)) || null;
}

function evaluateCondition(condition, runtime) {
  if (!condition) return true;
  const children = condition.conditions || condition.children || [];
  const left = getPath(runtime, condition.left || condition.target || condition.path);
  const right = resolveValue(condition.right ?? condition.value, runtime);
  switch (condition.op) {
    case 'and':
      return children.every((item) => evaluateCondition(item, runtime));
    case 'or':
      return children.some((item) => evaluateCondition(item, runtime));
    case 'not':
      return !evaluateCondition(condition.condition || children[0], runtime);
    case 'exists':
      return left != null;
    case 'truthy':
      return Boolean(left);
    case 'equals':
      return left === right;
    case 'notEquals':
      return left !== right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    default:
      return false;
  }
}

function getPath(target, path) {
  if (!path) return undefined;
  return String(path)
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), target);
}

function resolveValue(value, runtime) {
  if (value && typeof value === 'object' && '$path' in value) return getPath(runtime, value.$path);
  return value;
}

function interpolate(left, right, ratio) {
  if (typeof left === 'number' && typeof right === 'number') {
    return left + (right - left) * ratio;
  }
  return ratio < 1 ? left : right;
}

function setPath(target, path, value) {
  const parts = String(path).split('.');
  let cursor = target;
  while (parts.length > 1) {
    const part = parts.shift();
    cursor[part] ??= {};
    cursor = cursor[part];
  }
  cursor[parts[0]] = value;
}

export default Timeline;
