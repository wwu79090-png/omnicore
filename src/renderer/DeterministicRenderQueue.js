/**
 * Deterministic render queue and snapshot helpers for visual regression and replay diagnostics.
 */
import { stableHash } from '../quality/EngineQualityHarness.js';

export const RENDER_QUEUE_SNAPSHOT_SCHEMA = 'omnicore.render-queue-snapshot.v1';

export function createDeterministicRenderQueue(input = [], {
  layerOrder = ['background', 'world', 'foreground', 'ui']
} = {}) {
  const layerRanks = new Map(layerOrder.map((layer, index) => [String(layer), index]));
  return collectRenderNodes(input)
    .map((node, index) => normalizeRenderEntry(node, index, layerRanks))
    .sort(compareRenderEntries)
    .map((entry, order) => ({
      ...entry,
      order
    }));
}

export function snapshotRenderQueue(queue = []) {
  const entries = collectRenderNodes(queue).map((entry, index) => normalizeSnapshotEntry(entry, index));
  const order = entries.map((entry) => entry.id);
  return {
    schema: RENDER_QUEUE_SNAPSHOT_SCHEMA,
    order,
    entries,
    hash: stableHash(entries)
  };
}

export function compareRenderSnapshots(left, right) {
  const leftSnapshot = normalizeSnapshot(left);
  const rightSnapshot = normalizeSnapshot(right);
  const max = Math.max(leftSnapshot.entries.length, rightSnapshot.entries.length);
  for (let index = 0; index < max; index += 1) {
    const a = leftSnapshot.entries[index] || null;
    const b = rightSnapshot.entries[index] || null;
    if (stableHash(a) === stableHash(b)) continue;
    return {
      ok: false,
      firstMismatch: {
        index,
        left: a,
        right: b
      }
    };
  }
  return {
    ok: leftSnapshot.hash === rightSnapshot.hash,
    firstMismatch: leftSnapshot.hash === rightSnapshot.hash ? null : { index: 0, left: leftSnapshot.hash, right: rightSnapshot.hash }
  };
}

function collectRenderNodes(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.children)) return input.children;
  if (Array.isArray(input.entities)) return input.entities;
  if (input.records instanceof Map) return [...input.records.values()].map((record) => record.displayObject || record);
  return [input];
}

function normalizeRenderEntry(node, originalIndex, layerRanks) {
  const source = node || {};
  const id = String(source.id || source.name || source.renderId || `render-${originalIndex}`);
  const layer = String(source.layer || source.renderLayer || source.group || 'world');
  return {
    id,
    layer,
    layerIndex: layerRanks.has(layer) ? layerRanks.get(layer) : layerRanks.size,
    zIndex: normalizeNumber(source.zIndex ?? source.z ?? source.depth, 0),
    y: normalizeNumber(source.y ?? source.position?.y, 0),
    x: normalizeNumber(source.x ?? source.position?.x, 0),
    texture: source.texture || source.textureKey || null,
    visible: source.visible !== false,
    originalIndex
  };
}

function normalizeSnapshotEntry(entry, index) {
  const source = entry || {};
  return {
    id: String(source.id || source.name || `render-${index}`),
    layer: String(source.layer || 'world'),
    layerIndex: normalizeNumber(source.layerIndex, 0),
    zIndex: normalizeNumber(source.zIndex, 0),
    y: normalizeNumber(source.y, 0),
    x: normalizeNumber(source.x, 0),
    texture: source.texture || null,
    visible: source.visible !== false
  };
}

function normalizeSnapshot(value) {
  if (value?.schema === RENDER_QUEUE_SNAPSHOT_SCHEMA) return value;
  return snapshotRenderQueue(value);
}

function compareRenderEntries(left, right) {
  return left.layerIndex - right.layerIndex
    || left.zIndex - right.zIndex
    || left.y - right.y
    || left.x - right.x
    || left.id.localeCompare(right.id)
    || left.originalIndex - right.originalIndex;
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default {
  createDeterministicRenderQueue,
  snapshotRenderQueue,
  compareRenderSnapshots
};
