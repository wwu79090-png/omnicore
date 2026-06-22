export class FramePacingController {
  constructor({ targetMs = 1000 / 60, hitchMs = 50, windowSize = 120 } = {}) {
    this.targetMs = Number(targetMs) || (1000 / 60);
    this.hitchMs = Number(hitchMs) || 50;
    this.windowSize = Math.max(1, Math.floor(Number(windowSize) || 120));
    this.frames = [];
  }

  record(frameMs) {
    this.frames.push(Number(frameMs) || 0);
    while (this.frames.length > this.windowSize) this.frames.shift();
    return this;
  }

  report() {
    const sorted = [...this.frames].sort((a, b) => a - b);
    const hitches = this.frames.filter((value) => value >= this.hitchMs).length;
    const overBudgetFrames = this.frames.filter((value) => value > Math.ceil(this.targetMs)).length;
    const averageMs = this.frames.length
      ? round(this.frames.reduce((sum, value) => sum + value, 0) / this.frames.length)
      : 0;
    const p95Ms = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : 0;
    return {
      frames: this.frames.length,
      hitches,
      averageMs,
      p95Ms,
      overBudgetFrames,
      actions: buildActions({ hitches, overBudgetFrames, p95Ms, targetMs: this.targetMs })
    };
  }
}

function buildActions({ hitches, overBudgetFrames, p95Ms, targetMs }) {
  const actions = [];
  if (hitches > 0) actions.push('deferNonCriticalJobs');
  if (p95Ms > targetMs * 2) actions.push('tightenTexturePool');
  if (overBudgetFrames >= 2) actions.push('reduceRenderScale');
  return actions;
}

function round(value) {
  return Number(value.toFixed(3));
}

export default FramePacingController;
