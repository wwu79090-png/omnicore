export class TimeGuard {
  constructor({
    enabled = true,
    expectedFrameMs = 16,
    spikeMultiplier = 5,
    clock = () => Date.now(),
    warn = (message) => globalThis.console?.warn?.(message)
  } = {}) {
    this.enabled = enabled;
    this.expectedFrameMs = expectedFrameMs;
    this.spikeMultiplier = spikeMultiplier;
    this.clock = clock;
    this.warn = warn;
    this.lastWallMs = null;
    this.lastAcceptedMs = expectedFrameMs;
    this.lockedCount = 0;
    this.lastWarning = null;
  }

  clamp(deltaMs) {
    const safeDelta = Number(deltaMs);
    if (!this.enabled || !Number.isFinite(safeDelta) || safeDelta <= 0) return this.expectedFrameMs;

    const now = this.clock();
    const wallDelta = this.lastWallMs == null ? this.expectedFrameMs : Math.max(0, now - this.lastWallMs);
    const baseline = Math.max(1, wallDelta || this.expectedFrameMs, this.lastAcceptedMs || this.expectedFrameMs);
    this.lastWallMs = now;

    if (safeDelta >= baseline * this.spikeMultiplier) {
      this.lockedCount += 1;
      const locked = this.expectedFrameMs;
      this.lastAcceptedMs = locked;
      this.lastWarning = { deltaMs: safeDelta, wallDelta, baseline };
      this.warn?.(`[OmniCore] [TimeGuard] deltaTime 异常：${safeDelta.toFixed(2)}ms，已锁定为 ${locked}ms。`);
      return locked;
    }

    this.lastAcceptedMs = safeDelta;
    return safeDelta;
  }

  clampSeconds(deltaSeconds) {
    return this.clamp(Number(deltaSeconds) * 1000) / 1000;
  }

  reset() {
    this.lastWallMs = null;
    this.lastAcceptedMs = this.expectedFrameMs;
    this.lockedCount = 0;
    this.lastWarning = null;
  }
}

export default TimeGuard;
