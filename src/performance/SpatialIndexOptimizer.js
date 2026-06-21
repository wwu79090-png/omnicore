/**
 * Creates a serializable report for EntitySpatialIndex incremental behavior.
 */
export function createIncrementalSpatialIndexReport(index) {
  const stats = index?.stats || {};
  return {
    format: 'OmniCore.IncrementalSpatialIndexReport',
    mode: stats.rebuilds > 0 && stats.incrementalUpdates === 0 ? 'rebuild' : 'incremental',
    cellSize: index?.cellSize || 0,
    entities: index?.records?.size || 0,
    cells: index?.cells?.size || 0,
    adds: stats.adds || 0,
    removes: stats.removes || 0,
    updates: stats.updates || 0,
    incrementalUpdates: stats.incrementalUpdates || 0,
    rebuilds: stats.rebuilds || 0,
    lastQueryStats: index?.lastQueryStats || null
  };
}

export default createIncrementalSpatialIndexReport;
