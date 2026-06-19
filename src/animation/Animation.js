import { createOmniError } from '../core/OmniError.js';

/**
 * SpriteSheet frame animation controller.
 *
 * Frames can be an array or a map of animation names to arrays. Each frame is
 * written to `sprite.frame` and `sprite.texture` so existing Sprite rendering
 * paths can consume it.
 *
 * @example
 * const animation = new Animation(sprite, { run: ['run-0', 'run-1'] }, { frameRate: 12 });
 * animation.play('run');
 * scene.add(sprite.addAnimation(animation));
 */
export class Animation {
  constructor(sprite, spriteSheet, { frameRate = 12, loop = true } = {}) {
    const normalized = normalizeSpriteSheet(spriteSheet);
    this.sprite = sprite;
    this.spriteSheet = normalized.animations;
    this.frameRates = normalized.frameRates;
    this.frameRate = normalized.frameRate || frameRate;
    this.loop = loop;
    this.current = null;
    this.frameIndex = 0;
    this.elapsed = 0;
    this.playing = false;
  }

  play(name = 'default') {
    if (!this.spriteSheet[name]) throw createOmniError('Animation', `动画不存在：${name}`);
    this.current = name;
    this.frameIndex = 0;
    this.elapsed = 0;
    this.playing = true;
    this._applyFrame();
    return this;
  }

  stop() {
    this.playing = false;
    return this;
  }

  update(delta) {
    if (!this.playing || !this.current) return this;
    const frames = this.spriteSheet[this.current];
    const frameRate = this.frameRates[this.current] || this.frameRate;
    const frameMs = 1000 / frameRate;
    const deltaMs = delta <= 10 ? delta * 1000 : delta;
    this.elapsed += deltaMs;

    while (this.elapsed >= frameMs && this.playing) {
      this.elapsed -= frameMs;
      this.frameIndex += 1;
      if (this.frameIndex >= frames.length) {
        if (this.loop) this.frameIndex = 0;
        else {
          this.frameIndex = frames.length - 1;
          this.stop();
        }
      }
      this._applyFrame();
    }
    return this;
  }

  _applyFrame() {
    const frame = this.spriteSheet[this.current][this.frameIndex];
    this.sprite.frame = frame;
    const texture = frame?.texture ?? frame?.frame ?? frame?.name ?? frame;
    if (texture !== undefined) this.sprite.texture = texture;
    if (frame && typeof frame === 'object') {
      if (frame.rotation != null) this.sprite.rotation = frame.rotation;
      if (frame.scale != null) {
        this.sprite.scaleX = frame.scale;
        this.sprite.scaleY = frame.scale;
      }
      if (frame.scaleX != null) this.sprite.scaleX = frame.scaleX;
      if (frame.scaleY != null) this.sprite.scaleY = frame.scaleY;
      if (frame.alpha != null) this.sprite.alpha = frame.alpha;
      if (frame.x != null) this.sprite.x = frame.x;
      if (frame.y != null) this.sprite.y = frame.y;
    }
  }
}

function normalizeSpriteSheet(spriteSheet = {}) {
  if (Array.isArray(spriteSheet)) {
    return { animations: { default: spriteSheet }, frameRates: {}, frameRate: null };
  }

  const source = spriteSheet.animations && typeof spriteSheet.animations === 'object'
    ? spriteSheet.animations
    : spriteSheet;
  const animations = {};
  const frameRates = {};

  for (const [name, value] of Object.entries(source || {})) {
    if (Array.isArray(value)) {
      animations[name] = value;
      continue;
    }
    const frames = value?.keyframes || value?.frames || [];
    animations[name] = frames.map((frame) => ({
      ...frame,
      texture: frame.texture ?? frame.frame ?? frame.name
    }));
    if (value?.frameRate) frameRates[name] = value.frameRate;
  }

  return {
    animations,
    frameRates,
    frameRate: spriteSheet.frameRate || null
  };
}

export default Animation;
