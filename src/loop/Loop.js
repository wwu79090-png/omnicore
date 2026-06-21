import { errorMessage } from '../core/OmniError.js';
import { DEFAULT_LOOP_FPS } from '../config/defaults.js';
import MemoryGuardian from '../debug/MemoryGuardian.js';

/**
 * requestAnimationFrame loop with optional fixed-step cap.
 *
 * Runs uncapped by default, reports delta/interpolation, and pauses/resumes on
 * page visibility changes. Pass fps/framerateCap to opt into a fixed step.
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
    timeGuard = null,
    warnTimeJumps = true,
    onTimeJump = null,
    memoryGuardian = null,
    debug = false
  } = {}) {
    this.fps = resolveFrameRate(framerateCap, fps, displayHz);
    this.uncapped = this.fps == null;
    this.frameMs = this.uncapped ? 0 : 1000 / this.fps;
    this.vsync = vsync;
    this.framerateCap = this.uncapped ? null : framerateCap;
    this.autoPause = autoPause;
    this.stallMs = stallMs;
    this.stallFrameThreshold = stallFrameThreshold;
    this.onStall = onStall;
    this.onFrameStart = onFrameStart;
    this.onFrameEnd = onFrameEnd;
    this.onFrameError = onFrameError;
    this.timeGuard = timeGuard;
    this.warnTimeJumps = warnTimeJumps;
    this.onTimeJump = onTimeJump;
    this.memoryGuardian = memoryGuardian === true
      ? new MemoryGuardian({ debug })
      : memoryGuardian;
    this.memoryGuardian?.start?.();
    this.timeJumpWarningIssued = false;
    this.slowFrameCount = 0;
    this.subscribers = new Set();
    this.renderSubscribers = new Set();
    this.frame = 0;
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.time = {
      delta: 0,
      deltaMs: 0,
      fixedDelta: this.uncapped ? 0 : this.frameMs / 1000,
      fixedDeltaMs: this.frameMs,
      renderDelta: 0,
      renderDeltaMs: 0,
      elapsed: 0,
      elapsedMs: 0,
      frame: 0,
      alpha: 0
    };
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

  subscribeRender(handler) {
    this.renderSubscribers.add(handler);
    return () => this.renderSubscribers.delete(handler);
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
    this.memoryGuardian?.stop?.();
    this.frameHandle = null;
  }

  _tick(time) {
    if (!this.running) return;

    if (!this.paused) {
      const delta = this._normalizeDelta(time);
      this.accumulator += delta;
      this.time.renderDeltaMs = delta;
      this.time.renderDelta = delta / 1000;
      if (this.uncapped) {
        if (delta > 0) this._runFrame(delta / 1000, time, 0, delta);
        this.accumulator = 0;
      }
      while (!this.uncapped && this.accumulator >= this.frameMs) {
        this.frame += 1;
        const frameIndex = this.frame;
        const alpha = clamp01(this.accumulator / this.frameMs);
        this._runFrame(this.frameMs / 1000, time, alpha, this.frameMs, frameIndex);
        this.accumulator -= this.frameMs;
      }
      const renderAlpha = this.uncapped ? 0 : clamp01(this.accumulator / this.frameMs);
      this.time.alpha = renderAlpha;
      this._emitRender(renderAlpha, time);
      this.lastTime = time;
    }

    this._schedule();
  }

  _runFrame(deltaSeconds, time, alpha, frameMs, frameIndex = null) {
    this.frame = frameIndex ?? this.frame + 1;
    const currentFrame = this.frame;
    const seconds = this.timeGuard?.clampSeconds?.(deltaSeconds) ?? deltaSeconds;
    const frameContext = {
      frame: currentFrame,
      time,
      frameMs,
      delta: seconds,
      alpha,
      uncapped: this.uncapped
    };

    const tickStartedAt = this._now();
    let frameError = null;

    const startResult = this._safeCall(this.onFrameStart, 'frameStart', frameContext);
    if (startResult.error) {
      frameError = startResult.error;
    }

    if (!frameError) {
      this._updateFixedTime(seconds, currentFrame, alpha);
      for (const handler of this.subscribers) {
        try {
          handler(seconds, time, alpha, frameContext);
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

    const frameEndedAt = this._now();
    const updateMs = frameEndedAt - tickStartedAt;
    this.memoryGuardian?.watchFrame?.({
      ...frameContext,
      updateMs,
      startedAt: tickStartedAt,
      endedAt: frameEndedAt
    });
    this._detectStall(updateMs);
    const endResult = this._safeCall(
      this.onFrameEnd,
      'frameEnd',
      { ...frameContext, error: frameError?.error || frameError }
    );

    if (endResult.error) {
      // 关闭帧级错误传播，主循环保持健壮。
      frameContext.loopError = endResult.error;
    }
  }

  _updateFixedTime(seconds, frameIndex, alpha) {
    this.time.delta = seconds;
    this.time.deltaMs = seconds * 1000;
    this.time.fixedDelta = seconds;
    this.time.fixedDeltaMs = seconds * 1000;
    this.time.elapsed += seconds;
    this.time.elapsedMs += seconds * 1000;
    this.time.frame = frameIndex;
    this.time.alpha = alpha;
  }

  _emitRender(alpha, time) {
    if (!this.renderSubscribers.size) return;
    const frameContext = {
      frame: this.frame,
      time,
      alpha,
      delta: this.time.delta,
      renderDelta: this.time.renderDelta
    };
    for (const handler of this.renderSubscribers) {
      try {
        handler(alpha, time, frameContext);
      } catch (error) {
        this._safeCall(this.onFrameError, 'frameRender', error, { ...frameContext, phase: 'frameRender' });
        break;
      }
    }
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
    if (this.warnTimeJumps && !this.timeJumpWarningIssued) {
      this.timeJumpWarningIssued = true;
      const payload = { deltaMs: rawDelta, thresholdMs: 100, clampedMs: 16 };
      if (this.onTimeJump) this.onTimeJump(payload);
      else console.warn('[OmniCore] 检测到大跨度时间跳跃，已限制增量时间');
    }
    return 16;
  }

  _schedule() {
    this.frameHandle = this._raf(this.boundTick);
  }

  _raf(handler) {
    if (!this.vsync) return setTimeout(() => handler(this._now()), this.uncapped ? 0 : this.frameMs);
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(handler);
    return setTimeout(() => handler(this._now()), this.uncapped ? 0 : this.frameMs);
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
  if (framerateCap == null || framerateCap === false || framerateCap === 'none' || framerateCap === 'unlimited') return null;
  if (framerateCap === 'auto') {
    const detected = displayHz || globalThis.screen?.refreshRate || fallback;
    return detected == null ? null : normalizeFps(detected, fallback);
  }
  const explicit = normalizeFps(framerateCap, null);
  if (explicit != null) return explicit;
  return normalizeFps(fallback, DEFAULT_LOOP_FPS);
}

function normalizeFps(value, fallback) {
  const fps = Number(value);
  if (!Number.isFinite(fps) || fps <= 0) return fallback;
  return Math.max(1, Math.round(fps));
}

function clamp01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(0.999999, Number(value)));
}

export default Loop;
