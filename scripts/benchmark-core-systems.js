#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { EntitySpatialIndex } from '../src/core/EntitySpatialIndex.js';

const entityCount = 1000;
const iterations = Number(process.env.OMNICORE_SPATIAL_BENCH_ITERATIONS || 20000);
const query = { x: 16, y: 16, radius: 15 };
const entities = Array.from({ length: entityCount }, (_, id) => ({
  id,
  kind: 'enemy',
  x: (id % 100) * 32 + 16,
  y: Math.floor(id / 100) * 32 + 16
}));
const filter = (entity) => entity.kind === 'enemy';

const index = new EntitySpatialIndex({ cellSize: 32 });
for (const entity of entities) index.add(entity);

const warmupFull = fullScan(entities, query, filter, 250);
const warmupIndexed = indexedScan(index, query, filter, 250);
assertSameHits(warmupFull.hits, warmupIndexed.hits);

const full = fullScan(entities, query, filter, iterations);
const indexed = indexedScan(index, query, filter, iterations);
assertSameHits(full.hits, indexed.hits);

const candidateSpeedup = Number((entityCount / Math.max(1, indexed.stats.candidates)).toFixed(2));
const timeSpeedup = Number((full.ms / Math.max(0.001, indexed.ms)).toFixed(2));
const result = {
  entityCount,
  cellSize: 32,
  iterations,
  query,
  fullScan: {
    ms: Number(full.ms.toFixed(3)),
    entitiesVisitedPerQuery: entityCount,
    filterCallsPerQuery: entityCount,
    hitsPerQuery: full.hits.length
  },
  spatialIndex: {
    ms: Number(indexed.ms.toFixed(3)),
    cellsVisitedPerQuery: indexed.stats.cells,
    candidatesVisitedPerQuery: indexed.stats.candidates,
    filterCallsPerQuery: indexed.stats.hits,
    hitsPerQuery: indexed.hits.length
  },
  speedup: {
    candidateReduction: candidateSpeedup,
    wallClock: timeSpeedup
  },
  passed: candidateSpeedup >= 50 && timeSpeedup >= 50
};

console.log(JSON.stringify(result, null, 2));

if (!result.passed) {
  console.error('[OmniCore] spatial index benchmark is below 50x.');
  process.exit(1);
}

function fullScan(items, { x, y, radius }, predicate, count) {
  const radiusSq = radius * radius;
  let hits = [];
  const start = performance.now();
  for (let iteration = 0; iteration < count; iteration += 1) {
    hits = [];
    for (const entity of items) {
      if (!predicate(entity)) continue;
      const dx = entity.x - x;
      const dy = entity.y - y;
      if (dx * dx + dy * dy <= radiusSq) hits.push(entity);
    }
  }
  return { ms: performance.now() - start, hits };
}

function indexedScan(spatialIndex, currentQuery, predicate, count) {
  let hits = [];
  const start = performance.now();
  for (let iteration = 0; iteration < count; iteration += 1) {
    hits = spatialIndex.inRadius(currentQuery.x, currentQuery.y, currentQuery.radius, predicate);
  }
  return { ms: performance.now() - start, hits, stats: spatialIndex.lastQueryStats };
}

function assertSameHits(left, right) {
  const leftIds = left.map((entity) => entity.id).sort((a, b) => a - b);
  const rightIds = right.map((entity) => entity.id).sort((a, b) => a - b);
  if (JSON.stringify(leftIds) !== JSON.stringify(rightIds)) {
    throw new Error(`Spatial index hits differ from full scan: ${leftIds.join(',')} !== ${rightIds.join(',')}`);
  }
}
