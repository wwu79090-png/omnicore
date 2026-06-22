export function createAllocationPressureReport({
  allocations = [],
  generatedAt = new Date().toISOString()
} = {}) {
  const rows = allocations.map((item) => {
    const created = Math.max(0, Number(item.created || 0));
    const reused = Math.max(0, Number(item.reused || 0));
    const destroyed = Math.max(0, Number(item.destroyed || 0));
    const churn = Math.max(0, created - reused);
    const reuseRatio = created > 0 ? reused / created : 1;
    return {
      type: item.type || 'Unknown',
      created,
      reused,
      destroyed,
      churn,
      reuseRatio: Number(reuseRatio.toFixed(3)),
      severity: reuseRatio >= 0.75 ? 'ok' : reuseRatio >= 0.4 ? 'warning' : 'critical'
    };
  });
  const hotspots = rows
    .filter((item) => item.severity !== 'ok')
    .sort((left, right) => right.churn - left.churn);
  return {
    format: 'OmniCore.AllocationPressureReport',
    version: 1,
    generatedAt,
    ok: hotspots.length === 0,
    allocations: rows,
    hotspots,
    recommendations: hotspots.map((item) => (
      `${item.type}: reuse ratio ${item.reuseRatio}; route through ObjectPool or preallocate during scene load.`
    ))
  };
}

export default createAllocationPressureReport;
