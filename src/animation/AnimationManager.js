import { createOmniError } from '../core/OmniError.js';

/**
 * Small frame-animation manager for data-driven sprites and UI elements.
 */
export class AnimationManager {
  constructor(target = null) {
    this.target = target;
    this.animations = new Map();
    this.current = null;
    this.frameIndex = 0;
    this.elapsed = 0;
    this.playing = false;
  }

  add(name, frames = [], { frameRate = 12, loop = true } = {}) {
    this.animations.set(String(name), {
      name: String(name),
      frames: Array.isArray(frames) ? frames : [],
      frameRate: Math.max(1, Number(frameRate) || 12),
      loop: Boolean(loop)
    });
    return this;
  }

  play(name) {
    const animation = this.animations.get(String(name));
    if (!animation) {
      throw createOmniError('AnimationManager', `AnimationManager missing animation: ${name}`, {
        code: 'OMNICORE_ANIMATION_MISSING',
        details: { name }
      });
    }
    this.current = animation;
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

  update(deltaMs = 0) {
    if (!this.playing || !this.current?.frames.length) return this;
    this.elapsed += Math.max(0, Number(deltaMs) || 0);
    const frameMs = 1000 / this.current.frameRate;
    while (this.elapsed >= frameMs && this.playing) {
      this.elapsed -= frameMs;
      this.frameIndex += 1;
      if (this.frameIndex >= this.current.frames.length) {
        if (this.current.loop) this.frameIndex = 0;
        else {
          this.frameIndex = this.current.frames.length - 1;
          this.stop();
        }
      }
      this._applyFrame();
    }
    return this;
  }

  _applyFrame() {
    const frame = this.current?.frames[this.frameIndex];
    if (!this.target || frame == null) return;
    this.target.frame = frame;
    this.target.texture = frame?.texture ?? frame?.frame ?? frame?.name ?? frame;
  }
}

export default AnimationManager;
