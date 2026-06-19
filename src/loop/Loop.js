import { errorMessage } from '../core/OmniError.js';
import { DEFAULT_LOOP_FPS } from '../config/defaults.js';

/**
 * Fixed-step requestAnimationFrame loop.
 *
 * Locks updates to 60 FPS, reports delta/interpolation, and pauses/resumes on
 * page visibility changes. The internal ticker is intentionally not exposed.
 *
 * @example
 * const loop = new Loop();
 * loop.subscribe((dt, time, alpha) => scene.update(dt, time, alpha));
 * loop.start();
 */
export class Loop {
  constructor({
    fps = DEFAULT_LOOP_FPS,
    framerateCap = fps,
    vsync = true,
    displayHz = null,
    autoPause = true,
    stallMs = 120,
    stallFrameThreshold = 3,
    onStall = null,
    onFrameStart = null,
    onFrameEnd = null,
    onFrameError = null,
    timeGuard = null
  } = {}) {
    this.fps = resolveFrameRate(framerateCap, fps, displayHz);
    this.frameMs = 1000 / this.fps;
    this.vsync = vsync;
    this.framerateCap = framerateCap;
    this.autoPause = autoPause;
    this.stallMs = stallMs;
    this.stallFrameThreshold = stallFrameThreshold;
    this.onStall = onStall;
    this.onFrameStart = onFrameStart;
    this.onFrameEnd = onFrameEnd;
    this.onFrameError = onFrameError;
    this.timeGuard = timeGuard;
    this.slowFrameCount = 0;
    this.subscribers = new Set();
    this.frame = 0;
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.frameHandle = null;
    this.boundTick = (time) => this._tick(time);
    this.visibilityHandler = () => {
      if (document.hidden) this.pause();
      else this.resume();
    };
  }

  subscribe(handler) {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastTime = this._now();
    if (this.autoPause && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
    this._schedule();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this.lastTime = this._now();
  }

  stop() {
    this.running = false;
    if (this.frameHandle != null) this._cancel(this.frameHandle);
    if (this.autoPause && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.frameHandle = null;
  }

  _tick(time) {
    if (!this.running) return;

    if (!this.paused) {
      const delta = this._normalizeDelta(time);
      this.accumulator += delta;
      while (this.accumulator >= this.frameMs) {
        this.frame += 1;
        const frameIndex = this.frame;
        const frameContext = {
          frame: frameIndex,
          time,
          frameMs: this.frameMs,
          delta: this.frameMs / 1000
        };

        const tickStartedAt = this._now();
        let frameError = null;

        const startResult = this._safeCall(this.onFrameStart, 'frameStart', frameContext);
        if (startResult.error) {
          frameError = startResult.error;
        }

        if (!frameError) {
          const seconds = this.timeGuard?.clampSeconds?.(this.frameMs / 1000) ?? this.frameMs / 1000;
          for (const handler of this.subscribers) {
            try {
              handler(seconds, time, this.accumulator / this.frameMs);
            } catch (error) {
              frameError = { error, phase: 'frameUpdate' };
              break;
            }
          }
        }

        if (frameError) {
          const recovered = this._safeCall(
            this.onFrameError,
            'frameError',
            frameError.error || frameError,
            { ...frameContext, phase: frameError.phase || 'frameError' }
          );
          if (recovered?.value && recovered?.value?.recovered !== undefined) {
            frameContext.recovered = recovered.value.recovered;
          }
        }

        this._detectStall(this._now() - tickStartedAt);
        const endResult = this._safeCall(
          this.onFrameEnd,
          'frameEnd',
          { ...frameContext, error: frameError?.error || frameError }
        );

        if (endResult.error) {
          // 关闭帧级错误传播，主循环保持健壮。
          frameContext.loopError = endResult.error;
        }

        this.accumulator -= this.frameMs;
      }
      this.lastTime = time;
    }

    this._schedule();
  }

  _safeCall(callback, scope, ...payloads) {
    if (!callback) return { ok: true, value: null, error: null };
    try {
      return {
        ok: true,
        value: callback(...payloads),
        error: null
      };
    } catch (error) {
      const context = payloads.find((value) => value && typeof value === 'object' && typeof value.frame === 'number') || {};
      console.error(errorMessage('Loop', `生命周期回调 ${scope} 异常`), {
        scope,
        frame: context.frame || 0,
        cause: error?.message || String(error)
      });
      return { ok: false, value: null, error };
    }
  }

  _normalizeDelta(time) {
    const rawDelta = Number(time) - Number(this.lastTime);
    if (!Number.isFinite(rawDelta) || rawDelta <= 0) return 0;
    if (rawDelta <= 100) return rawDelta;
    console.warn('[OmniCore] 检测到大跨度时间跳跃，已限制增量时间');
    return 16;
  }

  _schedule() {
    this.frameHandle = this._raf(this.boundTick);
  }

  _raf(handler) {
    if (!this.vsync) return setTimeout(() => handler(this._now()), this.frameMs);
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(handler);
    return setTimeout(() => handler(this._now()), this.frameMs);
  }

  _cancel(handle) {
    if (!this.vsync) {
      clearTimeout(handle);
      return;
    }
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
    else clearTimeout(handle);
  }

  _now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  _detectStall(updateMs) {
    if (updateMs <= this.stallMs) {
      this.slowFrameCount = 0;
      return;
    }
    this.slowFrameCount += 1;
    if (this.slowFrameCount < this.stallFrameThreshold) return;

    const payload = {
      updateMs,
      stallMs: this.stallMs,
      frames: this.slowFrameCount
    };
    this.stop();
    this.onStall?.(payload);
    console.error(errorMessage('Loop', `连续 ${this.slowFrameCount} 帧超过 ${this.stallMs}ms，循环已停止。`), payload);
  }
}

export function resolveFrameRate(framerateCap = DEFAULT_LOOP_FPS, fallback = DEFAULT_LOOP_FPS, displayHz = null) {
  if (framerateCap === 'auto') {
    const detected = displayHz || globalThis.screen?.refreshRate || fallback;
    return normalizeFps(detected, fallback);
  }
  if ([30, 60, 120].includes(Number(framerateCap))) return Number(framerateCap);
  return normalizeFps(fallback, DEFAULT_LOOP_FPS);
}

function normalizeFps(value, fallback) {
  const fps = Number(value);
  if (!Number.isFinite(fps) || fps <= 0) return fallback;
  return Math.min(240, Math.max(15, Math.round(fps)));
}

export default Loop;
