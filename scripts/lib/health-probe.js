export function evaluateBrowserProbe({
  pageStatus = '',
  canvasCount = 0,
  fallbackBackend = null,
  consoleIssues = [],
  reason = null
} = {}) {
  const ready = String(pageStatus).includes('当前后端') && Number(canvasCount) === 1;
  return {
    status: ready ? 'pass' : 'fail',
    pageStatus,
    canvasCount,
    fallbackBackend,
    consoleIssueCount: consoleIssues.length,
    reason: ready ? null : reason || 'browser did not reach a rendered backend'
  };
}

export default evaluateBrowserProbe;
