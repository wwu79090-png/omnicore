const DEFAULT_TARGET_FRAME_MS = 1000 / 60;

export function createPerformanceDashboardSnapshot({
  renderMs = 0,
  scriptMs = 0,
  physicsMs = 0,
  assetMs = 0,
  audioMs = 0,
  gcMs = 0,
  fps = 0,
  targetFrameMs = DEFAULT_TARGET_FRAME_MS
} = {}) {
  const segments = [
    segment('render', renderMs, targetFrameMs),
    segment('script', scriptMs, targetFrameMs),
    segment('physics', physicsMs, targetFrameMs),
    segment('assets', assetMs, targetFrameMs),
    segment('audio', audioMs, targetFrameMs),
    segment('gc', gcMs, targetFrameMs)
  ];
  const totalMs = round(segments.reduce((sum, item) => sum + item.ms, 0));
  const status = totalMs <= targetFrameMs ? 'ok' : totalMs <= targetFrameMs * 1.25 ? 'warning' : 'critical';
  return {
    format: 'OmniCore.PerformanceDashboardSnapshot',
    version: 1,
    fps: Number(fps) || 0,
    totalMs,
    segments,
    frameBudget: {
      targetFrameMs,
      remainingMs: round(targetFrameMs - totalMs),
      status
    },
    bottlenecks: segments
      .filter((item) => item.status !== 'ok')
      .sort((left, right) => right.ms - left.ms)
  };
}

export class PerformanceDashboard {
  constructor(options = {}) {
    this.options = options;
    this.lastSnapshot = createPerformanceDashboardSnapshot(options);
  }

  update(stats = {}) {
    this.lastSnapshot = createPerformanceDashboardSnapshot({ ...this.options, ...stats });
    return this.lastSnapshot;
  }

  snapshot() {
    return this.lastSnapshot;
  }
}

function segment(name, ms, targetFrameMs) {
  const value = Math.max(0, Number(ms) || 0);
  const ratio = targetFrameMs > 0 ? value / targetFrameMs : 0;
  return {
    name,
    ms: round(value),
    ratio: round(ratio),
    status: ratio <= 0.35 ? 'ok' : ratio <= 0.6 ? 'warning' : 'critical'
  };
}

function round(value) {
  return Number(value.toFixed(3));
}

export default PerformanceDashboard;
