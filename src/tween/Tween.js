import Easing from '../math/Easing.js';

/**
 * Lightweight Phaser-inspired Tween.
 *
 * Supports numeric target properties, `{ from, to, start }` descriptors,
 * `yoyo`, `repeat`, callbacks, and manual updates from OmniCore.Loop.
 *
 * @example
 * const tween = new Tween(sprite, {
 *   x: { from: 0, to: 320 },
 *   alpha: 0.5,
 *   duration: 600,
 *   ease: 'outCubic',
 *   yoyo: true,
 *   repeat: 1
 * });
 * loop.subscribe((dt) => tween.update(dt * 1000));
 */
const CONTROL_KEYS = new Set([
  'targets',
  'duration',
  'delay',
  'repeat',
  'repeatDelay',
  'hold',
  'ease',
  'yoyo',
  'autoplay',
  'onStart',
  'onUpdate',
  'onComplete',
  'onRepeat',
  'onYoyo'
]);

export class Tween {
  static to(target, config = {}) {
    return new Tween(target, { ...config, targets: target });
  }

  static fromTo(target, from = {}, to = {}, config = {}) {
    const properties = {};
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      properties[key] = {
        from: Number(from[key] ?? target?.[key] ?? 0),
        to: Number(to[key] ?? target?.[key] ?? 0)
      };
    }
    return new Tween(target, { ...properties, ...config, targets: target });
  }

  static sequence(target, keyframes = [], config = {}) {
    return new TweenSequence(target, keyframes, config);
  }

  constructor(target, config = {}) {
    this.target = config.targets || target;
    this.config = config;
    this.duration = Math.max(1, Number(config.duration ?? 1000));
    this.delay = Number(config.delay ?? 0);
    this.repeatDelay = Number(config.repeatDelay ?? 0);
    this.repeat = Number(config.repeat ?? 0);
    this.yoyo = Boolean(config.yoyo);
    this.ease = Easing.get(config.ease);
    this.elapsed = 0;
    this.segment = 0;
    this.playing = false;
    this.completed = false;
    this.started = false;
    this.direction = 1;
    this.properties = this._parseProperties(config);
    this.totalSegments = Math.max(1, this.repeat + 1);

    for (const property of this.properties) {
      if (property.start !== undefined) this.target[property.key] = property.start;
    }

    if (config.autoplay !== false) this.play();
  }

  get isPlaying() {
    return this.playing && !this.completed;
  }

  _parseProperties(config) {
    return Object.entries(config)
      .filter(([key]) => !CONTROL_KEYS.has(key))
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          return {
            key,
            start: value.start,
            from: Number(value.from ?? this.target[key] ?? 0),
            to: Number(value.to ?? this.target[key] ?? 0)
          };
        }
        return {
          key,
          start: undefined,
          from: Number(this.target[key] ?? 0),
          to: Number(value)
        };
      });
  }

  play() {
    if (this.completed) this.restart();
    this.playing = true;
    return this;
  }

  pause() {
    this.playing = false;
    return this;
  }

  resume() {
    if (!this.completed) this.playing = true;
    return this;
  }

  restart() {
    this.elapsed = 0;
    this.segment = 0;
    this.direction = 1;
    this.completed = false;
    this.started = false;
    for (const property of this.properties) {
      this.target[property.key] = property.from;
    }
    return this.play();
  }

  stop() {
    this.playing = false;
    this.completed = true;
    return this;
  }

  update(deltaMs) {
    if (!this.playing || this.completed) return this;

    if (!this.started) {
      this.started = true;
      this.config.onStart?.(this);
    }

    this.elapsed += deltaMs;
    if (this.elapsed < this.delay) return this;

    let segmentElapsed = this.elapsed - this.delay;
    while (segmentElapsed >= this.duration && !this.completed) {
      this._apply(1);
      this.segment += 1;
      if (this.segment >= this.totalSegments) {
        this.completed = true;
        this.playing = false;
        this.config.onComplete?.(this);
        return this;
      }
      if (this.yoyo) {
        this.direction *= -1;
        this.config.onYoyo?.(this);
      } else {
        this._apply(0);
        this.config.onRepeat?.(this);
      }
      segmentElapsed -= this.duration + this.repeatDelay;
      this.elapsed = this.delay + segmentElapsed;
    }

    const progress = Math.max(0, Math.min(1, segmentElapsed / this.duration));
    this._apply(progress);
    this.config.onUpdate?.(this);
    return this;
  }

  _apply(progress) {
    const eased = this.ease(progress);
    const t = this.direction === 1 ? eased : 1 - eased;
    for (const property of this.properties) {
      this.target[property.key] = property.from + (property.to - property.from) * t;
    }
  }
}

export class TweenSequence {
  constructor(target, keyframes = [], {
    duration = null,
    loop = false,
    autoplay = true,
    onUpdate = null,
    onComplete = null
  } = {}) {
    this.target = target;
    this.keyframes = [...keyframes]
      .map((frame) => ({
        time: Math.max(0, Number(frame.time || 0)),
        props: { ...(frame.props || {}) }
      }))
      .sort((left, right) => left.time - right.time);
    const lastTime = this.keyframes.at(-1)?.time || 0;
    this.duration = Math.max(1, Number(duration ?? lastTime) || 1);
    this.loop = Boolean(loop);
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.elapsed = 0;
    this.playing = Boolean(autoplay);
    this.completed = false;
    this._applyAt(0);
  }

  play() {
    this.playing = true;
    return this;
  }

  pause() {
    this.playing = false;
    return this;
  }

  restart() {
    this.elapsed = 0;
    this.completed = false;
    this._applyAt(0);
    return this.play();
  }

  update(deltaMs = 0) {
    if (!this.playing || this.completed) return this;
    this.elapsed += Math.max(0, Number(deltaMs) || 0);
    let time = this.elapsed;
    if (this.loop) time %= this.duration;
    else if (time >= this.duration) {
      time = this.duration;
      this.completed = true;
      this.playing = false;
    }
    this._applyAt(time);
    this.onUpdate?.(this);
    if (this.completed) this.onComplete?.(this);
    return this;
  }

  _applyAt(time) {
    if (!this.target || !this.keyframes.length) return;
    let active = this.keyframes[0];
    for (const frame of this.keyframes) {
      if (frame.time <= time) active = frame;
      else break;
    }
    Object.assign(this.target, active.props);
  }
}

export default Tween;
