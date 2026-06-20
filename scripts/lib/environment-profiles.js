export const networkProfiles = Object.freeze([
  Object.freeze({
    name: '3g',
    offline: false,
    latencyMs: 320,
    downlinkKbps: 750,
    expectedDegradation: 'slow-network'
  }),
  Object.freeze({
    name: '4g',
    offline: false,
    latencyMs: 80,
    downlinkKbps: 4000,
    expectedDegradation: null
  }),
  Object.freeze({
    name: 'offline',
    offline: true,
    latencyMs: 0,
    downlinkKbps: 0,
    expectedDegradation: 'offline-fallback'
  })
]);

export function summarizeNetworkProbe({
  profile,
  loaded = false,
  error = null,
  durationMs = 0,
  pageStatus = '',
  canvasCount = 0,
  consoleIssues = []
} = {}) {
  if (!profile) {
    return {
      profile: 'unknown',
      status: 'fail',
      degraded: false,
      reason: 'missing-profile',
      durationMs,
      pageStatus,
      canvasCount,
      consoleIssues
    };
  }
  if (profile.offline && !loaded) {
    return {
      profile: profile.name,
      status: 'pass',
      degraded: true,
      reason: profile.expectedDegradation || 'offline-fallback',
      error,
      durationMs,
      pageStatus,
      canvasCount,
      consoleIssues
    };
  }
  const rendered = loaded && canvasCount > 0 && (!pageStatus || pageStatus.includes('当前后端'));
  const hasConsoleIssues = consoleIssues.length > 0;
  return {
    profile: profile.name,
    status: rendered && !hasConsoleIssues ? 'pass' : 'fail',
    degraded: profile.name !== '4g',
    reason: rendered
      ? profile.expectedDegradation
      : error || (hasConsoleIssues ? 'console-issues' : 'network-load-failed'),
    durationMs,
    pageStatus,
    canvasCount,
    consoleIssues
  };
}

export function buildLowMemoryBenchmarkProfile({ memoryGb = 2 } = {}) {
  const safeMemoryGb = Number.isFinite(Number(memoryGb)) ? Number(memoryGb) : 2;
  const memoryMb = Math.max(1, Math.round(safeMemoryGb * 1024));
  return {
    task: 'memory-limit',
    memoryGb: safeMemoryGb,
    memoryMb,
    deviceClass: `low-memory-${safeMemoryGb}gb`,
    maxHeapMb: Math.max(128, Math.round(memoryMb * 0.45)),
    expectedMinFps: 30,
    cpuSlowdown: safeMemoryGb <= 2 ? 6 : 4
  };
}
